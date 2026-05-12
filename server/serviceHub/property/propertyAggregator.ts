/**
 * Property Aggregator — Service Hub Phase 3, Pass 3.1.
 *
 * Orchestrates a single POST /api/service-hub/property-data request:
 *   Stage 1 (gate)   — Address Validation API runs FIRST. If verdict is
 *                      'invalid' or 'needs_correction', short-circuit
 *                      WITHOUT calling Adam / Solar / Geocoding. This
 *                      saves orchestrator/Apify tokens and prevents
 *                      false-empty data from malformed addresses.
 *   Stage 2 (fan-out) — Promise.allSettled across:
 *                        • Adam research (facts + photos in one call,
 *                          replaces Apify+ATTOM merge that lives in Python)
 *                        • Google Geocoding (only if Validation lacked coords)
 *                        • Google Solar (roof signals)
 *                      Aerial view is rendered client-side via Maps JS API
 *                      (no server-side Static Maps client anymore).
 *   Stage 3 (heuristics) — material signals + cost band derived from the
 *                      Stage 2 results.
 *
 * Caching: 24h TTL via property_snapshots (RLS-scoped to the tenant).
 * Receipts: every fetch writes a service_hub.property_data.fetched receipt;
 *           Adam's correlation_id is chained into the rollup `evidence`.
 *
 * Aspire Laws:
 *   #1 Single Brain — this is execution only; no autonomous decision.
 *   #2 Receipts — receipt written on every fetch (success and failure),
 *                 with Adam correlation_id chained for trace continuity.
 *   #3 Fail-closed — if Adam fails, status='partial' with empty facts +
 *                    empty photos; sources[] reflects every miss.
 *   #6 Tenant Isolation — RLS on property_snapshots; suite_id flows to Adam.
 *   #7 Tools are Hands — orchestrator does not retry/loop autonomously.
 *   #9 Security — addresses are truncated in logs, no secrets logged.
 */

import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';
import { createReceipt } from '../../receiptService';
import { randomUUID } from 'node:crypto';

// Upstream clients. Adam research is created in parallel by mcp-toolsmith.
import {
  fetchAdamPropertyResearch,
  type AdamPropertyResult,
} from './adamResearchClient';
import { validateAddress } from './googleAddressValidationClient';
import { geocodeAddress } from './googleGeocodingClient';
import { fetchSolarInsights } from './googleSolarClient';

import { materialSignalsHeuristic } from './materialSignalsHeuristic';
import { costBandHeuristic } from './costBandHeuristic';

import type {
  AddressValidationVerdict,
  PhotoLane,
  PropertyData,
  PropertyDataResponse,
  SourceStatus,
} from './propertyTypes';

const CACHE_TTL_HOURS = 24;
const STAGE2_TIMEOUT_MS = 8_000;
// Adam can take 25-50s cold-start (13 ATTOM endpoints fan-out + Apify Zillow
// photo scrape on a fresh container). 60s covers the p99 we've observed.
// Adam's playbook runs ATTOM (~8s) + Apify cold-start (~15s) in parallel
// — worst-case P95 ≈ 23s. 25s here gives breathing room without falling back
// to partial. Cached responses bypass this entirely.
const ADAM_TIMEOUT_MS = 60_000;
const ADDRESS_MAX_LEN = 200;

/**
 * Tenant context required for every aggregation call.
 * Caller (express route) extracts these from the authenticated request.
 */
export type AggregationContext = {
  suiteId: string;
  officeId?: string;
  /** When true, skips cache lookup and forces a fresh fetch. */
  forceRefresh?: boolean;
};

export type AggregationResult =
  | { kind: 'ok'; data: PropertyData; cacheHit: boolean }
  | { kind: 'needs_correction'; payload: PropertyDataResponse }
  | { kind: 'invalid'; verdict: AddressValidationVerdict };

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

async function readCache(
  suiteId: string,
  address: string,
): Promise<PropertyData | null> {
  try {
    // Pass interval as parameterized hours via make_interval — avoids
    // sql.raw in a SQL position (security R-001 hardening, even though
    // CACHE_TTL_HOURS is currently a module constant).
    const result = await db.execute(sql`
      SELECT data_jsonb, fetched_at
        FROM public.property_snapshots
       WHERE suite_id = ${suiteId}::uuid
         AND address = ${address}
         AND fetched_at > now() - make_interval(hours => ${CACHE_TTL_HOURS})
       ORDER BY fetched_at DESC
       LIMIT 1
    `);
    const rows = (result as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
    const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
    if (!row) return null;
    const data = row.data_jsonb;
    if (!data || typeof data !== 'object') return null;
    return data as PropertyData;
  } catch (err: unknown) {
    logger.warn('[propertyAggregator] cache read failed (continuing)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
    return null;
  }
}

async function writeCache(
  suiteId: string,
  address: string,
  data: PropertyData,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO public.property_snapshots (suite_id, address, data_jsonb, fetched_at)
      VALUES (${suiteId}::uuid, ${address}, ${JSON.stringify(data)}::jsonb, now())
    `);
  } catch (err: unknown) {
    logger.warn('[propertyAggregator] cache write failed (non-fatal)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function nowIso(): string {
  return new Date().toISOString();
}

/** Run a promise with a timeout. Resolves to undefined on timeout. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

function emptyLane(): PhotoLane {
  return { count: 0, photos: [] };
}

/**
 * Override the roof lane's thumbnailUrl to point at the Google Solar 4K
 * aerial endpoint instead of Adam's Zillow photo. The Zillow photo (if any)
 * stays in `photos[]` as a fallback the UI can use if Solar 404s. Keeping
 * the count > 0 ensures the card renders even when Adam returned no roof
 * photos but Solar has aerial imagery (most addresses do).
 *
 * The endpoint is auth-bypassed (loaded via <img src>) and 24h-cached
 * server-side, so the same address only hits Google Solar once a day.
 */
function decorateRoofWithSolarAerial(
  lanes: PropertyData['photos'],
  address: string,
  hasSolarAerial: boolean,
): PropertyData['photos'] {
  const trimmed = (address || '').trim();
  if (!trimmed) return lanes;
  // Only inject the Solar aerial when Solar actually has coverage. When
  // it doesn't, leave the roof lane alone — the frontend's HeroSwitcher
  // sees roofImagery==='streetview' and renders the interactive Pano
  // instead of a static-image gallery (which would be 640x640 max).
  if (!hasSolarAerial) {
    // Keep at least 1 count so the small Roof card tile still renders;
    // the tile thumbnail falls through to its icon since no thumbnailUrl
    // is set.
    if (lanes.roof.count === 0) lanes.roof.count = 1;
    return lanes;
  }
  const url = `/api/property/roof-aerial?address=${encodeURIComponent(trimmed)}`;
  lanes.roof.thumbnailUrl = url;
  lanes.roof.photos = [
    { id: 'solar_aerial_0', url, source: 'streetview' as const },
    ...lanes.roof.photos,
  ];
  lanes.roof.count = lanes.roof.photos.length;
  return lanes;
}

function emptyLanes(): PropertyData['photos'] {
  return {
    interior: emptyLane(),
    exterior: emptyLane(),
    roof: emptyLane(),
    streetView: emptyLane(),
  };
}

/**
 * Build the four photo lanes from Adam's already-categorized output.
 * Adam returns photos pre-sorted into interior/exterior/roof/uncategorized
 * (the heavy keyword classification lives in the Python normalizer now).
 * Anything in `uncategorized` is folded into the exterior lane (default
 * fallback per V7.1 plan).
 */
function buildPhotoLanesFromAdam(
  adamPhotos: AdamPropertyResult['photos'] | undefined,
  streetViewProxyUrl: string | undefined,
): PropertyData['photos'] {
  const lanes = emptyLanes();
  if (adamPhotos) {
    const fillLane = (
      lane: PhotoLane,
      bucket: { photos: ReadonlyArray<{ url: string; caption?: string }> } | undefined,
    ) => {
      if (!bucket || !Array.isArray(bucket.photos)) return;
      bucket.photos.forEach((p, i) => {
        lane.photos.push({
          id: `adam_${lane.photos.length}_${i}`,
          url: p.url,
          caption: p.caption,
          source: 'adam',
        });
        if (!lane.thumbnailUrl) lane.thumbnailUrl = p.url;
      });
      lane.count = lane.photos.length;
    };

    fillLane(lanes.interior, adamPhotos.interior);
    fillLane(lanes.exterior, adamPhotos.exterior);
    fillLane(lanes.roof, adamPhotos.roof);
    // Uncategorized → exterior fallback
    fillLane(lanes.exterior, adamPhotos.uncategorized);
  }

  if (streetViewProxyUrl) {
    lanes.streetView.photos.push({
      id: 'streetview_0',
      url: streetViewProxyUrl,
      source: 'streetview',
    });
    lanes.streetView.count = 1;
    lanes.streetView.thumbnailUrl = streetViewProxyUrl;
  }

  return lanes;
}

function buildEvidenceGaps(facts: PropertyData['facts']): string[] {
  const gaps: string[] = [];
  if (facts.sqft === undefined) gaps.push('sqft');
  if (facts.yearBuilt === undefined) gaps.push('yearBuilt');
  if (facts.zoning === undefined) gaps.push('zoning');
  if (facts.propertyType === undefined) gaps.push('propertyType');
  if (facts.lotSqft === undefined) gaps.push('lotSqft');
  return gaps;
}

function deriveAccessRisk(
  propertyType?: string,
): 'low' | 'medium' | 'high' | undefined {
  if (!propertyType) return undefined;
  const v = propertyType.toUpperCase();
  if (v.includes('INDUSTRIAL') || v.includes('WAREHOUSE')) return 'low';
  if (v.includes('GATED') || v.includes('CONDO') || v.includes('APARTMENT')) {
    return 'medium';
  }
  if (v.includes('HILL') || v.includes('CLIFF')) return 'high';
  return 'low';
}

/** First 80 chars only — addresses can contain PII (apt numbers, names). */
function safeAddress(address: string): string {
  return address.length > 80 ? `${address.slice(0, 80)}…` : address;
}

/* -------------------------------------------------------------------------- */
/* Main aggregator                                                            */
/* -------------------------------------------------------------------------- */

export async function aggregatePropertyData(
  rawAddress: string,
  ctx: AggregationContext,
): Promise<AggregationResult> {
  const cleanAddress = (rawAddress ?? '').trim().slice(0, ADDRESS_MAX_LEN);
  if (!cleanAddress) {
    return {
      kind: 'invalid',
      verdict: {
        status: 'invalid',
        reason: 'address is empty',
        fetchedAt: nowIso(),
      },
    };
  }
  if (!ctx.suiteId) {
    return {
      kind: 'invalid',
      verdict: {
        status: 'invalid',
        reason: 'tenant context missing',
        fetchedAt: nowIso(),
      },
    };
  }

  /* ---------- Cache lookup (Stage 0) ---------------------------------- */
  if (!ctx.forceRefresh) {
    const cached = await readCache(ctx.suiteId, cleanAddress);
    if (cached) {
      logger.info('[propertyAggregator] cache hit', {
        suite_id: ctx.suiteId,
        address: safeAddress(cleanAddress),
      });
      return { kind: 'ok', data: cached, cacheHit: true };
    }
  }

  /* ---------- Stage 1: Address validation gate ------------------------ */
  const verdict = await validateAddress(cleanAddress);

  if (verdict.status === 'invalid') {
    logger.info('[propertyAggregator] address invalid — short-circuit', {
      suite_id: ctx.suiteId,
      address: safeAddress(cleanAddress),
    });
    // Validation API succeeded but the address itself was rejected.
    // 'missing' (not 'api_failure') correctly reflects that no usable
    // address could be extracted — the API worked, the input didn't.
    await writeReceipt(ctx, cleanAddress, [
      {
        name: 'addressValidation',
        fetchedAt: verdict.fetchedAt,
        status: 'missing',
      },
    ], 'invalid');
    return { kind: 'invalid', verdict };
  }

  if (verdict.status === 'needs_correction') {
    logger.info('[propertyAggregator] address needs correction — short-circuit', {
      suite_id: ctx.suiteId,
      address: safeAddress(cleanAddress),
    });
    await writeReceipt(ctx, cleanAddress, [
      {
        name: 'addressValidation',
        fetchedAt: verdict.fetchedAt,
        status: 'partial',
        confidence: 'medium',
      },
    ], 'needs_correction');
    return {
      kind: 'needs_correction',
      payload: {
        suggestedAddress: verdict.suggestedAddress ?? verdict.formatted ?? cleanAddress,
        components: verdict.components,
        propertyData: null,
      },
    };
  }

  // 'valid' | 'unconfirmed' | 'api_failure' all proceed (degraded for failure).
  const sources: SourceStatus[] = [
    {
      name: 'addressValidation',
      fetchedAt: verdict.fetchedAt,
      status: verdict.status === 'api_failure' ? 'api_failure' : 'ok',
      confidence:
        verdict.status === 'valid'
          ? 'high'
          : verdict.status === 'unconfirmed'
          ? 'low'
          : undefined,
    },
  ];

  /* ---------- Stage 2: Parallel fan-out -------------------------------- */
  // Per-request correlation_id chains the desktop rollup receipt to Adam's
  // playbook receipt (Law #2 trace continuity).
  const correlationId = randomUUID();
  const formattedAddress = verdict.formatted ?? cleanAddress;
  const needsGeocoding = !verdict.coords;

  const [adamSettled, geocodeSettled, solarSettled] = await Promise.allSettled([
    withTimeout(
      fetchAdamPropertyResearch({
        address: formattedAddress,
        suiteId: ctx.suiteId,
        officeId: ctx.officeId ?? ctx.suiteId,
        correlationId,
        timeoutMs: ADAM_TIMEOUT_MS,
      }),
      ADAM_TIMEOUT_MS,
    ),
    needsGeocoding
      ? withTimeout(geocodeAddress(cleanAddress), STAGE2_TIMEOUT_MS)
      : Promise.resolve(undefined),
    // Solar requires coords; if we still don't have any, skip the call.
    verdict.coords
      ? withTimeout(fetchSolarInsights(verdict.coords), STAGE2_TIMEOUT_MS)
      : Promise.resolve(undefined),
  ]);

  const adamResult: AdamPropertyResult | undefined =
    adamSettled.status === 'fulfilled' ? adamSettled.value : undefined;
  const geocodeResult =
    geocodeSettled.status === 'fulfilled' ? geocodeSettled.value : undefined;
  let solarResult =
    solarSettled.status === 'fulfilled' ? solarSettled.value : undefined;

  // Coords resolution: prefer verdict, then geocoding fallback.
  let coords = verdict.coords;
  if (!coords && geocodeResult && geocodeResult.status === 'ok' && geocodeResult.coords) {
    coords = geocodeResult.coords;
  }

  // Geocoding source row (only when actually attempted).
  if (needsGeocoding) {
    if (geocodeResult && geocodeResult.status === 'ok' && geocodeResult.coords) {
      sources.push({
        name: 'geocoding',
        fetchedAt: nowIso(),
        status: 'ok',
        confidence: 'high',
      });
    } else {
      sources.push({
        name: 'geocoding',
        fetchedAt: nowIso(),
        status: geocodeResult ? 'missing' : 'api_failure',
      });
    }
  }

  // If Solar wasn't fired upfront because we lacked coords AND we now have
  // coords from geocoding, fire it now (sequential, but only in this rare
  // fallback path — keeps the happy path single-fan-out).
  if (!solarResult && coords && needsGeocoding && geocodeResult?.status === 'ok') {
    solarResult = await withTimeout(fetchSolarInsights(coords), STAGE2_TIMEOUT_MS);
  }

  // Adam source row.
  const adamStatus = adamResult?.status;
  if (adamStatus === 'ok' || adamStatus === 'partial') {
    sources.push({
      name: 'adam',
      fetchedAt: adamResult?.fetchedAt ?? nowIso(),
      status: adamStatus,
      confidence: adamStatus === 'ok' ? 'high' : 'medium',
    });
  } else {
    sources.push({
      name: 'adam',
      fetchedAt: adamResult?.fetchedAt ?? nowIso(),
      status: adamStatus === 'missing' ? 'missing' : 'api_failure',
    });
  }

  // Solar source row.
  if (solarResult && solarResult.status === 'ok') {
    sources.push({
      name: 'solar',
      fetchedAt: nowIso(),
      status: 'ok',
      confidence: 'high',
    });
  } else if (solarResult && solarResult.status === 'missing') {
    sources.push({
      name: 'solar',
      fetchedAt: nowIso(),
      status: 'missing',
    });
  } else {
    sources.push({
      name: 'solar',
      fetchedAt: nowIso(),
      status: 'api_failure',
    });
  }

  // Street view fallback proxy (client-side panorama is primary; this is the
  // static-image fallback for environments where Maps JS can't load).
  const streetViewProxyUrl = `/api/places/streetview?address=${encodeURIComponent(formattedAddress)}`;
  sources.push({
    name: 'streetView',
    fetchedAt: nowIso(),
    status: 'ok',
  });

  /* ---------- Stage 3: Heuristics -------------------------------------- */
  const adamFacts = adamResult?.facts;
  const solarRoofType =
    solarResult && solarResult.status === 'ok' ? solarResult.roofType : undefined;

  const materials = materialSignalsHeuristic({
    propertyType: adamFacts?.propertyType,
    roofType: solarRoofType,
  });
  const costBand = costBandHeuristic({
    sqft: adamFacts?.sqft,
    propertyType: adamFacts?.propertyType,
  });
  const accessRisk = deriveAccessRisk(adamFacts?.propertyType);

  /* ---------- Build final PropertyData --------------------------------- */
  const finalCoords = coords ?? { lat: 0, lng: 0 };
  const facts: PropertyData['facts'] = {
    sqft: adamFacts?.sqft,
    yearBuilt: adamFacts?.yearBuilt,
    zoning: adamFacts?.zoning,
    propertyType: adamFacts?.propertyType,
    lotSqft: adamFacts?.lotSqft,
    stories: adamFacts?.stories,
    bedrooms: adamFacts?.bedrooms,
    bathrooms: adamFacts?.bathrooms,
    constructionFrame: adamFacts?.constructionFrame,
    quality: adamFacts?.quality,
    ownerName: adamFacts?.ownerName,
    ownerOccupied: adamFacts?.ownerOccupied,
    estimatedValue: adamFacts?.estimatedValue,
    estimatedValueLow: adamFacts?.estimatedValueLow,
    estimatedValueHigh: adamFacts?.estimatedValueHigh,
    lastSaleDate: adamFacts?.lastSaleDate,
    lastSaleAmount: adamFacts?.lastSaleAmount,
    annualTax: adamFacts?.annualTax,
    taxYear: adamFacts?.taxYear,
  };

  const data: PropertyData = {
    address: {
      formatted: formattedAddress,
      street: verdict.components?.street,
      secondary: verdict.components?.secondary,
      city: verdict.components?.city,
      state: verdict.components?.state,
      zip: verdict.components?.zip,
      country: verdict.components?.country,
    },
    coords: finalCoords,
    hero: {
      streetViewProxyUrl,
    },
    facts,
    photos: decorateRoofWithSolarAerial(
      buildPhotoLanesFromAdam(adamResult?.photos, streetViewProxyUrl),
      formattedAddress || cleanAddress,
      solarResult?.status === 'ok',
    ),
    // Solar building insights ('ok') strongly correlates with dataLayers
    // aerial availability (same coverage map). When Solar said 'ok' the
    // roof canvas can render the Solar 4K aerial via PhotoGalleryHero.
    // When Solar said 'missing' or 'api_failure', the canvas falls back
    // to the interactive Street View Pano (LiveStreetViewHero) — same
    // 4K experience users get on the Street View card.
    roofImagery: solarResult?.status === 'ok' ? 'solar' : 'streetview',
    signals: {
      materials,
      roofType: solarRoofType,
      accessRisk,
    },
    costBand,
    evidenceGaps: buildEvidenceGaps(facts),
    fetchedAt: nowIso(),
    sources,
  };

  /* ---------- Persist + receipt ----------------------------------------
   * Cache key MUST match the Stage 0 lookup key (cleanAddress = raw user
   * input). Writing under formattedAddress would mean Stage 0 lookups
   * (which run BEFORE validation, so no formatted form is available)
   * could never hit. If formatted differs, write a second alias so
   * future requests entered in canonical form also hit.
   *
   * Cache-poisoning guard: never persist a result that has no Adam records.
   * Earlier bug era wrote 57 broken `no_records_field` rows to the cache
   * table that then served stale empty responses for 24h. If Adam timed
   * out or returned nothing, the next request should retry, not hit cache.
   */
  // Adam reports 'ok' when records were returned, 'partial' when some but
  // not all sources resolved, and 'missing'/'api_failure' when nothing
  // useful came back. ALSO require sqft+yearBuilt to be populated — those
  // are the load-bearing fields the UI shows. Status='ok' with null sqft
  // poisoned 2 rows on 2026-05-12 03:21; this belt-and-suspenders check
  // prevents that exact regression.
  const statusOk =
    adamResult?.status === 'ok' || adamResult?.status === 'partial';
  const factsPopulated =
    facts.sqft != null && facts.yearBuilt != null;
  const hasUsefulData = statusOk && factsPopulated;
  if (hasUsefulData) {
    await writeCache(ctx.suiteId, cleanAddress, data);
    if (formattedAddress && formattedAddress !== cleanAddress) {
      await writeCache(ctx.suiteId, formattedAddress, data);
    }
  } else {
    logger.warn('[propertyAggregator] skipping cache write — no Adam records', {
      suite_id: ctx.suiteId,
      address: cleanAddress,
    });
  }
  await writeReceipt(ctx, formattedAddress, sources, 'ok', {
    correlationId,
    adamCorrelationId: extractAdamCorrelationId(adamResult?.receiptsFromAdam),
  });

  return { kind: 'ok', data, cacheHit: false };
}

/**
 * Extract Adam's playbook correlation_id from the opaque receipts array
 * for trace chaining (Law #2). Adam's receipt shape is unknown[] at the
 * client boundary; we look for any of the documented shapes.
 */
function extractAdamCorrelationId(receipts: unknown[] | undefined): string | undefined {
  if (!Array.isArray(receipts)) return undefined;
  for (const r of receipts) {
    if (!r || typeof r !== 'object') continue;
    const rec = r as Record<string, unknown>;
    const id =
      (typeof rec.correlationId === 'string' && rec.correlationId) ||
      (typeof rec.correlation_id === 'string' && rec.correlation_id) ||
      undefined;
    if (id) return id;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Receipts                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Map aggregator outcome → ReceiptStatus column value.
 * 'invalid' / 'needs_correction' are policy denials (validation rejected
 * input) → 'DENIED'. 'failed' is a runtime exception → 'FAILED'.
 * 'ok' is the success path → 'SUCCEEDED'.
 */
function outcomeToReceiptStatus(
  outcome: 'ok' | 'needs_correction' | 'invalid' | 'failed',
): 'SUCCEEDED' | 'DENIED' | 'FAILED' {
  if (outcome === 'ok') return 'SUCCEEDED';
  if (outcome === 'failed') return 'FAILED';
  return 'DENIED'; // invalid or needs_correction
}

async function writeReceipt(
  ctx: AggregationContext,
  address: string,
  sources: SourceStatus[],
  outcome: 'ok' | 'needs_correction' | 'invalid' | 'failed',
  trace?: { correlationId?: string; adamCorrelationId?: string; errorReason?: string },
): Promise<void> {
  try {
    // Trace chain: include the local correlationId in evidence so an auditor
    // can query both stores by this ID. Adam's playbook + provider receipts
    // (in the Python receipt store) use the SAME correlationId because we
    // forward it in the Adam request body.
    const evidence: { source: string; correlation_id?: string }[] = [];
    if (trace?.correlationId) {
      evidence.push({ source: 'desktop_aggregator', correlation_id: trace.correlationId });
    }
    if (trace?.adamCorrelationId) {
      evidence.push({ source: 'adam', correlation_id: trace.adamCorrelationId });
    }

    await createReceipt({
      suiteId: ctx.suiteId,
      officeId: ctx.officeId ?? ctx.suiteId,
      actionType: 'compute_snapshot',
      status: outcomeToReceiptStatus(outcome),
      correlationId: trace?.correlationId,
      inputs: {
        action: 'service_hub.property_data.fetched',
        address: safeAddress(address),
        correlation_id: trace?.correlationId,
      },
      outputs: {
        outcome,
        error_reason: trace?.errorReason,
        sources_status_summary: sources.map((s) => ({
          name: s.name,
          status: s.status,
        })),
        evidence,
      },
      metadata: { source: 'property_aggregator', risk_tier: 'green' },
    });
  } catch (err: unknown) {
    logger.warn('[propertyAggregator] receipt write failed (non-fatal)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
  }
}
