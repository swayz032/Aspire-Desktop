/**
 * Adam Research Client — Service Hub Phase 3, Pass 3.1.
 *
 * Calls the Ava-Brain orchestrator's Adam agent to retrieve combined
 * ATTOM property facts + Apify Zillow photos for a given address.
 * Adam runs ATTOM and Apify in parallel and returns a single
 * ResearchResponse — desktop never touches ATTOM or Apify directly.
 *
 * Design:
 *   - ORCHESTRATOR_URL sourced from process.env.ORCHESTRATOR_URL (Railway
 *     Aspire-Desktop service env, verified ✅).
 *   - 12-second default timeout via AbortController (Adam's playbook
 *     does ATTOM + Apify in parallel; Apify actor cold-starts in ~10s.
 *     If Adam doesn't respond in 12s, something is wrong with the
 *     orchestrator — raise as api_failure and let the aggregator degrade).
 *   - AbortController pattern mirrors apifyZillowClient.ts and
 *     googleAddressValidationClient.ts.
 *   - Fail-closed (Law #3): never throws — always returns structured
 *     AdamPropertyResult so the aggregator can flag partial / missing
 *     without crashing.
 *   - Tenant isolation (Law #6): suiteId/officeId are sent in the request
 *     body; Adam enforces tenancy on its side.
 *   - No secrets in logs (Law #9): no auth header to redact (internal
 *     trust boundary); address is truncated to 100 chars in logs.
 *   - Receipts (Law #2): Adam's receipts are returned in receiptsFromAdam
 *     so the aggregator can include them in the rollup receipt.
 *
 * Endpoint:
 *   POST {ORCHESTRATOR_URL}/v1/agents/invoke
 *   Body: { agent, task, details: { address }, suite_id, office_id, correlation_id }
 */

import { logger } from '../../logger';

// ─── Public types ─────────────────────────────────────────────────────────────

export type PhotoItem = {
  url: string;
  caption?: string;
};

export type PhotoLaneBucket = {
  count: number;
  photos: PhotoItem[];
};

export type AdamPropertyResult = {
  status: 'ok' | 'partial' | 'missing' | 'api_failure';
  facts?: {
    sqft?: number;
    yearBuilt?: number;
    zoning?: string;
    propertyType?: string;
    lotSqft?: number;
    stories?: number;
    bedrooms?: number;
    bathrooms?: number;
    constructionFrame?: string;
    quality?: string;
    ownerName?: string;
    ownerOccupied?: boolean;
    estimatedValue?: number;
    estimatedValueLow?: number;
    estimatedValueHigh?: number;
    lastSaleDate?: string;
    lastSaleAmount?: number;
    annualTax?: number;
    taxYear?: number;
    address?: {
      formatted: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    coords?: { lat: number; lng: number };
  };
  photos?: {
    interior: PhotoLaneBucket;
    exterior: PhotoLaneBucket;
    roof: PhotoLaneBucket;
    uncategorized: PhotoLaneBucket;
  };
  /** Adam's per-provider receipts — pass through for trace chain (Law #2). */
  receiptsFromAdam?: unknown[];
  fetchedAt: string;
  error?: string;
};

// ─── Internal types matching Adam's ResearchResponse ─────────────────────────

type AdamPhotoRaw = {
  url: string;
  caption?: string;
  lane?: string;
};

type AdamAddressRaw = {
  streetAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  zip?: string;
  formattedAddress?: string;
};

type AdamRecordRaw = {
  address?: AdamAddressRaw;
  homeType?: unknown;
  livingArea?: unknown;
  yearBuilt?: unknown;
  zoning?: unknown;
  lotAreaValue?: unknown;
  lotAreaUnits?: unknown;
  stories?: unknown;
  bedrooms?: unknown;
  bathrooms?: unknown;
  photos?: AdamPhotoRaw[];
  photos_source?: unknown;
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  // Catch-all for ATTOM extra fields we don't map yet
  [key: string]: unknown;
};

type AdamResearchResponse = {
  artifact_type?: string;
  records?: AdamRecordRaw[];
  confidence?: number;
  freshness?: { provider?: string };
  receipts?: unknown[];
  correlation_id?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

// Cold-start Apify Zillow scrape can take ~15s; ATTOM detail + history are
// ~8s each running in parallel inside Adam. Worst-case Adam playbook P95 is
// max(ATTOM-detail, max(ATTOM-history, Apify)) ≈ 23s on cold start, ~10s
// steady-state. 25s here so cold-start succeeds without falling back to
// partial. Cached property loads return in <100ms regardless.
const DEFAULT_TIMEOUT_MS = 25_000;
const AGENT_NAME = 'adam';
const TASK_NAME = 'PROPERTY_FACTS_AND_PERMITS';

// ─── Test escape hatch ────────────────────────────────────────────────────────

let _fetchOverride: typeof fetch | undefined;

/** Test-only: inject a fetch implementation. Pass undefined to reset. */
export function __setFetchForTests(impl: typeof fetch | undefined): void {
  _fetchOverride = impl;
}

function getFetch(): typeof fetch {
  return _fetchOverride ?? globalThis.fetch;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

function toFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toTrimmedString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Convert lotAreaValue + lotAreaUnits → square feet.
 * Supports: "Acres" / "Square Feet" from ATTOM; also handles plain number (sqft assumed).
 */
function normalizeLotSqft(record: AdamRecordRaw): number | undefined {
  const value = toFiniteNumber(record.lotAreaValue);
  if (value === undefined) return undefined;
  const unit = (toTrimmedString(record.lotAreaUnits) ?? '').toLowerCase();
  if (unit === 'acres' || unit === 'acre') {
    return Math.round(value * 43560);
  }
  // Default: assume square feet.
  return Math.round(value);
}

/**
 * Normalize Adam's address object into our flat facts.address shape.
 */
function normalizeAddress(
  raw: AdamAddressRaw | undefined,
): AdamPropertyResult['facts'] extends undefined ? never : NonNullable<AdamPropertyResult['facts']>['address'] {
  if (!raw) return undefined;
  const street = toTrimmedString(raw.streetAddress) ?? toTrimmedString(raw.street);
  const city = toTrimmedString(raw.city);
  const state = toTrimmedString(raw.state);
  const zip = toTrimmedString(raw.zipcode) ?? toTrimmedString(raw.zip);
  const formatted =
    toTrimmedString(raw.formattedAddress) ??
    [street, city, state, zip].filter(Boolean).join(', ');
  return { formatted, street, city, state, zip };
}

/** Normalize Adam's record into our PhotoLaneBucket map. */
function normalizePhotos(record: AdamRecordRaw): AdamPropertyResult['photos'] {
  const interior: PhotoItem[] = [];
  const exterior: PhotoItem[] = [];
  const roof: PhotoItem[] = [];
  const uncategorized: PhotoItem[] = [];

  const raw = record.photos;
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }

  // ---- Heuristic lane classifier (overrides Adam when its lane is empty)
  // Adam returns lane='uncategorized' for most Zillow listings because
  // their captions are too generic ("Photo 4") for the python keyword
  // classifier to fire. We re-classify on the local side using:
  //   1. caption keyword scan (more aggressive than Adam's)
  //   2. positional heuristic — Zillow's responsivePhotos[] are ordered
  //      front-cover-first, with interior shots in the middle, and
  //      sometimes a roof aerial near the end
  // This stops every photo from landing in "Exterior" by default.
  const KW_INTERIOR = /\b(kitchen|bath|bed|room|living|dining|family|laundry|closet|interior|hall|stair|foyer|office|den|loft)\b/i;
  const KW_ROOF      = /\b(roof|aerial|drone|overhead|chimney|gutter)\b/i;
  const KW_EXTERIOR  = /\b(exterior|front|back|side|yard|deck|patio|porch|driveway|garage|fence|landscap)\b/i;

  function classifyByCaption(caption: string | undefined): 'interior' | 'exterior' | 'roof' | null {
    if (!caption) return null;
    if (KW_ROOF.test(caption)) return 'roof';
    if (KW_INTERIOR.test(caption)) return 'interior';
    if (KW_EXTERIOR.test(caption)) return 'exterior';
    return null;
  }

  // Positional heuristic for Zillow ordering when caption is missing.
  // Zillow listings reliably order: cover (exterior), interior tour,
  // bonus shots. Distribution scales with total count so we never dump
  // every photo into one lane:
  //   N=1   → [exterior]
  //   N=2   → [exterior, interior]
  //   N=3   → [exterior, interior, exterior]
  //   N=4-6 → first = exterior, last = exterior, middle = interior
  //   N≥7   → first 2 = exterior, last 1 = exterior (or roof if aerial-likely),
  //           middle = interior
  function classifyByPosition(idx: number, total: number): 'interior' | 'exterior' | 'roof' {
    if (total <= 1) return 'exterior';
    if (total === 2) return idx === 0 ? 'exterior' : 'interior';
    if (total === 3) return idx === 1 ? 'interior' : 'exterior';
    if (total <= 6) {
      if (idx === 0 || idx === total - 1) return 'exterior';
      return 'interior';
    }
    // N >= 7 — most Zillow listings. First 2 are cover shots (exterior),
    // last is often an aerial/roof drone shot, second-to-last is exterior.
    if (idx <= 1) return 'exterior';
    if (idx === total - 1) return 'roof';
    if (idx === total - 2) return 'exterior';
    return 'interior';
  }

  raw.forEach((p, idx) => {
    if (!p || typeof p !== 'object') return;
    const rawUrl = toTrimmedString(p.url);
    if (!rawUrl) return;
    // Zillow photo URLs: https://photos.zillowstatic.com/fp/<hash>-p_<size>.jpg
    // Sizes: p_a(96) p_b(192) p_c(384) p_d(768) p_e(1536) p_f(2048).
    // Apify default = p_d (blurry). Rewrite to p_e for 2× resolution.
    const url = rawUrl.replace(/-p_[a-f]\.jpg$/i, '-p_e.jpg');
    const caption = toTrimmedString(p.caption);
    const item: PhotoItem = caption ? { url, caption } : { url };

    // Adam's lane wins ONLY if it explicitly classified the photo. Empty
    // / 'uncategorized' / unknown values fall through to our heuristics.
    const adamLane = toTrimmedString(p.lane)?.toLowerCase() ?? '';
    let lane: 'interior' | 'exterior' | 'roof' | null = null;
    if (adamLane === 'interior' || adamLane === 'exterior' || adamLane === 'roof') {
      lane = adamLane;
    }
    if (!lane) lane = classifyByCaption(caption);
    if (!lane) lane = classifyByPosition(idx, raw.length);

    if (lane === 'interior') interior.push(item);
    else if (lane === 'exterior') exterior.push(item);
    else if (lane === 'roof') roof.push(item);
    else uncategorized.push(item);
  });

  return {
    interior: { count: interior.length, photos: interior },
    exterior: { count: exterior.length, photos: exterior },
    roof: { count: roof.length, photos: roof },
    uncategorized: { count: uncategorized.length, photos: uncategorized },
  };
}

/**
 * Derive whether the facts object has enough data for 'ok' vs 'partial'.
 * We require at least sqft or yearBuilt to be present for 'partial'.
 * All key facts present = 'ok'.
 */
function classifyStatus(
  facts: AdamPropertyResult['facts'],
  photos: AdamPropertyResult['photos'],
): 'ok' | 'partial' | 'missing' {
  if (!facts) {
    return 'missing';
  }
  const keyFacts = [
    facts.sqft,
    facts.yearBuilt,
    facts.zoning,
    facts.propertyType,
    facts.lotSqft,
  ];
  const anyFact = keyFacts.some((v) => v !== undefined);
  if (!anyFact) return 'missing';

  const allFacts = keyFacts.every((v) => v !== undefined);
  // Photos being absent is allowed — Apify may not have a listing for every property.
  const hasPhotos =
    photos !== undefined &&
    (photos.interior.count + photos.exterior.count + photos.roof.count + photos.uncategorized.count) > 0;

  // 'ok' = all key facts present (photos not required to qualify)
  if (allFacts) return 'ok';

  // At least one fact = 'partial'
  return 'partial';
}

/**
 * Normalize a raw Adam record into our typed facts shape.
 * Returns undefined if the record is falsy/not an object.
 */
function normalizeRecord(
  record: AdamRecordRaw,
): { facts: AdamPropertyResult['facts']; photos: AdamPropertyResult['photos'] } {
  // Adam (ATTOM-backed) returns snake_case fields. Older Zillow path used
  // camelCase. Read both so this works against either upstream shape.
  const r = record as Record<string, unknown>;
  const sqft =
    toFiniteNumber(r.living_sqft) ??
    toFiniteNumber(r.livingArea) ??
    toFiniteNumber(r.sqft);
  const yearBuilt = toFiniteNumber(r.year_built) ?? toFiniteNumber(r.yearBuilt);
  const zoning = toTrimmedString(r.zoning);
  const propertyType =
    toTrimmedString(r.property_type) ?? toTrimmedString(r.homeType);
  const lotSqft = normalizeLotSqft(record);
  const stories = toFiniteNumber(r.stories);
  const bedrooms = toFiniteNumber(r.beds) ?? toFiniteNumber(r.bedrooms);
  const bathrooms = toFiniteNumber(r.baths) ?? toFiniteNumber(r.bathrooms);
  const address =
    normalizeAddress(r.address) ??
    (typeof r.normalized_address === 'string'
      ? { formatted: r.normalized_address as string }
      : undefined);

  // Coords: ATTOM sometimes returns lat/lng top-level
  let coords: { lat: number; lng: number } | undefined;
  const lat = toFiniteNumber(r.lat) ?? toFiniteNumber(r.latitude);
  const lng = toFiniteNumber(r.lng) ?? toFiniteNumber(r.longitude);
  if (lat !== undefined && lng !== undefined) {
    coords = { lat, lng };
  }

  const photos = normalizePhotos(record);

  // Extra ATTOM fields the contractor needs — owner, AVM, construction
  // quality, last sale, taxes. Snake_case is canonical from the orchestrator.
  const constructionFrame = toTrimmedString(r.construction_frame);
  const quality = toTrimmedString(r.quality);
  const ownerName = toTrimmedString(r.owner_name);
  const ownerOccupied =
    typeof r.owner_occupied === 'string'
      ? (r.owner_occupied as string).toUpperCase().includes('OWNER')
      : undefined;
  const estimatedValue = toFiniteNumber(r.estimated_value);
  const estimatedValueLow = toFiniteNumber(r.estimated_value_low);
  const estimatedValueHigh = toFiniteNumber(r.estimated_value_high);
  const lastSaleDate = toTrimmedString(r.last_sale_date);
  const lastSaleAmount = toFiniteNumber(r.last_sale_amount);
  const annualTax = toFiniteNumber(r.annual_tax_amount);
  const taxYear = toFiniteNumber(r.tax_year);
  const zoningResolved =
    zoning ?? toTrimmedString(r.zoning_type) ?? toTrimmedString(r.zoning_code);

  const facts: AdamPropertyResult['facts'] = {
    ...(sqft !== undefined ? { sqft } : {}),
    ...(yearBuilt !== undefined ? { yearBuilt } : {}),
    ...(zoningResolved !== undefined ? { zoning: zoningResolved } : {}),
    ...(propertyType !== undefined ? { propertyType } : {}),
    ...(lotSqft !== undefined ? { lotSqft } : {}),
    ...(stories !== undefined ? { stories } : {}),
    ...(bedrooms !== undefined ? { bedrooms } : {}),
    ...(bathrooms !== undefined ? { bathrooms } : {}),
    ...(constructionFrame !== undefined ? { constructionFrame } : {}),
    ...(quality !== undefined ? { quality } : {}),
    ...(ownerName !== undefined ? { ownerName } : {}),
    ...(ownerOccupied !== undefined ? { ownerOccupied } : {}),
    ...(estimatedValue !== undefined ? { estimatedValue } : {}),
    ...(estimatedValueLow !== undefined ? { estimatedValueLow } : {}),
    ...(estimatedValueHigh !== undefined ? { estimatedValueHigh } : {}),
    ...(lastSaleDate !== undefined ? { lastSaleDate } : {}),
    ...(lastSaleAmount !== undefined ? { lastSaleAmount } : {}),
    ...(annualTax !== undefined ? { annualTax } : {}),
    ...(taxYear !== undefined ? { taxYear } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(coords !== undefined ? { coords } : {}),
  };

  return { facts, photos };
}

// ─── Result constructors ──────────────────────────────────────────────────────

function apiFailure(error: string, fetchedAt: string): AdamPropertyResult {
  return { status: 'api_failure', fetchedAt, error };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FetchAdamPropertyResearchArgs {
  address: string;
  suiteId: string;
  officeId: string;
  correlationId: string;
  /** Override timeout in ms. Default: 25000 (covers Apify cold-start). */
  timeoutMs?: number;
}

/**
 * Fetch normalized ATTOM property facts + Apify Zillow photos via the
 * Ava-Brain Adam agent.
 *
 * Always returns a structured AdamPropertyResult. Never throws.
 * Caller (PropertyAggregator) enforces tenant scope (Law #6 enforced
 * server-side in Adam; suiteId/officeId are forwarded for Adam to verify).
 */
export async function fetchAdamPropertyResearch(
  args: FetchAdamPropertyResearchArgs,
): Promise<AdamPropertyResult> {
  const fetchedAt = new Date().toISOString();
  const { address, suiteId, officeId, correlationId } = args;

  // Resolve orchestrator URL from environment.
  const orchestratorUrl = (process.env.ORCHESTRATOR_URL ?? '').trim();
  if (!orchestratorUrl) {
    logger.warn('[AdamResearch] ORCHESTRATOR_URL not configured');
    return apiFailure('ORCHESTRATOR_URL not configured', fetchedAt);
  }

  const cleanAddress = (address ?? '').trim();
  if (!cleanAddress) {
    logger.warn('[AdamResearch] empty address');
    return apiFailure('address is empty', fetchedAt);
  }

  // Log redacted address (truncate > 100 chars) — Law #9
  const logAddress =
    cleanAddress.length > 100
      ? cleanAddress.slice(0, 100) + '[TRUNCATED]'
      : cleanAddress;

  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = `${orchestratorUrl}/v1/agents/invoke`;

  const requestBody = {
    agent: AGENT_NAME,
    task: TASK_NAME,
    details: { address: cleanAddress },
    suite_id: suiteId,
    office_id: officeId,
    correlation_id: correlationId,
  };

  try {
    const upstream = await getFetch()(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      logger.warn('[AdamResearch] upstream non-2xx', {
        status: upstream.status,
        address: logAddress,
      });
      return apiFailure(`upstream ${upstream.status}`, fetchedAt);
    }

    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch (_parseErr: unknown) {
      logger.warn('[AdamResearch] non-JSON payload from orchestrator', {
        address: logAddress,
      });
      return apiFailure('invalid JSON from orchestrator', fetchedAt);
    }

    // Validate response shape
    if (!payload || typeof payload !== 'object') {
      return apiFailure('malformed response: not an object', fetchedAt);
    }

    // Orchestrator wraps the agent payload as `{ success, agent, result, data: {...} }`.
    // Unwrap to find `records` / `receipts`. Older versions returned them at the top
    // level — handle both shapes.
    const envelope = payload as { data?: unknown; records?: unknown; receipts?: unknown };
    const inner =
      envelope.data && typeof envelope.data === 'object' ? (envelope.data as Record<string, unknown>) : null;
    const response = (inner ?? envelope) as AdamResearchResponse;

    if (!Array.isArray(response.records) || response.records.length === 0) {
      logger.warn('[AdamResearch] no records in response', {
        address: logAddress,
      });
      return {
        status: 'missing',
        receiptsFromAdam: Array.isArray(response.receipts)
          ? response.receipts
          : undefined,
        fetchedAt,
        error: 'no records returned',
      };
    }

    const firstRecord = response.records[0];
    if (!firstRecord || typeof firstRecord !== 'object') {
      return apiFailure('malformed record in response', fetchedAt);
    }

    const { facts, photos } = normalizeRecord(firstRecord);
    const status = classifyStatus(facts, photos);

    return {
      status,
      facts: Object.keys(facts ?? {}).length > 0 ? facts : undefined,
      photos,
      receiptsFromAdam: Array.isArray(response.receipts)
        ? response.receipts
        : undefined,
      fetchedAt,
      ...(status === 'missing' ? { error: 'no usable facts in record' } : {}),
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const rawMessage = err instanceof Error ? err.message : 'unknown error';
    logger.warn('[AdamResearch] fetch failed', {
      isTimeout: isAbort,
      reason: rawMessage.slice(0, 160),
      address: logAddress,
    });
    return apiFailure(isAbort ? 'timeout' : rawMessage, fetchedAt);
  }
}
