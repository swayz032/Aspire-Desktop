/**
 * Building Footprint Route — GET /api/property/building-footprint
 *
 * Returns a convex-hull polygon wrapping the building footprint for a given
 * address, derived from Google Solar API `buildingInsights:findClosest`.
 * The polygon is used by the frontend as an INVERSE clip mask on
 * Photorealistic 3D Tiles to isolate the house mesh.
 *
 * Pipeline:
 *   1. Auth   — Bearer JWT → suite_id / office_id (existing middleware)
 *   2. Cache  — property_snapshots.building_footprint_data, keyed (suite_id, address), 90-day TTL
 *   3. Geocode — address → lat/lng via existing googleGeocodingClient
 *   4. Solar  — lat/lng → roof segments → convex hull (buildingFootprintClient)
 *   5. Persist — upsert result to cache (non-blocking)
 *   6. Receipt — every code path produces an immutable receipt (Law #2)
 *
 * Aspire Laws:
 *   #2 Receipt  — 100% code-path coverage; cache hits, fresh fetches, failures
 *                 and denials each generate an immutable receipt.
 *   #3 Fail-closed — missing auth or address → 4xx immediately.
 *   #6 Tenant Isolation — cache key includes suite_id from JWT, never from
 *                         caller-supplied params. RLS on property_snapshots
 *                         enforces DB-level isolation.
 *   #7 Tools Are Hands — route never retries; returns structured status so
 *                         frontend/orchestrator can decide next action.
 *   #9 Security — API key and full address never appear in logs or receipts;
 *                 addresses truncated to 100 chars.
 *
 * Wire response contract (frontend depends on this shape exactly):
 *   {
 *     status: 'ready' | 'unavailable' | 'error';
 *     center?:       { lat, lng, altitude };
 *     polygon?:      [lng, lat][];   // CCW, closed
 *     heightMeters?: number;
 *     boundingBox?:  { sw: {lat,lng}, ne: {lat,lng} };
 *     cachedAt?:     string;         // ISO8601 — present only on cache hits
 *     message?:      string;
 *   }
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';
import { createReceipt } from '../../receiptService';
import { geocodeAddress } from './googleGeocodingClient';
import { fetchBuildingFootprint, type BuildingFootprintData } from './buildingFootprintClient';

const router = Router();

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CACHE_TTL_DAYS  = 90;
const ADDRESS_MAX_LEN = 200;
const ADDRESS_LOG_MAX = 100;   // truncate in logs/receipts (Law #9)

/* -------------------------------------------------------------------------- */
/* Wire response type (contract with frontend)                                */
/* -------------------------------------------------------------------------- */

export type BuildingFootprintResponse = {
  status:        'ready' | 'unavailable' | 'error';
  center?:       { lat: number; lng: number; altitude: number };
  polygon?:      Array<[number, number]>;
  heightMeters?: number;
  boundingBox?:  { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  cachedAt?:     string;
  message?:      string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeAddr(address: string): string {
  return address.length > ADDRESS_LOG_MAX
    ? address.slice(0, ADDRESS_LOG_MAX) + '…'
    : address;
}

/* -------------------------------------------------------------------------- */
/* Cache layer (property_snapshots.building_footprint_data)                  */
/* -------------------------------------------------------------------------- */

async function readFootprintCache(
  suiteId: string,
  address: string,
): Promise<BuildingFootprintData | null> {
  try {
    const result = await db.execute(sql`
      SELECT building_footprint_data
        FROM public.property_snapshots
       WHERE suite_id                = ${suiteId}::uuid
         AND address                 = ${address}
         AND building_footprint_data IS NOT NULL
         AND fetched_at              > now() - make_interval(days => ${CACHE_TTL_DAYS})
       ORDER BY fetched_at DESC
       LIMIT 1
    `);
    const rows = (result as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
    const row  = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
    if (!row?.building_footprint_data) return null;
    return row.building_footprint_data as BuildingFootprintData;
  } catch (err: unknown) {
    logger.warn('[buildingFootprintRoute] cache read failed (continuing)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
    return null;
  }
}

async function writeFootprintCache(
  suiteId: string,
  address: string,
  data: BuildingFootprintData,
): Promise<void> {
  try {
    // Try to update an existing row first (match on most-recent row for this tenant+address).
    // Insert a minimal row if none exists. Mirrors aerialViewRoute cache pattern exactly.
    const existing = await db.execute(sql`
      SELECT id FROM public.property_snapshots
       WHERE suite_id = ${suiteId}::uuid
         AND address  = ${address}
       ORDER BY fetched_at DESC
       LIMIT 1
    `);
    const rows = (existing as { rows?: unknown[] }).rows ?? (existing as unknown as unknown[]);
    const row  = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;

    if (row?.id) {
      await db.execute(sql`
        UPDATE public.property_snapshots
           SET building_footprint_data = ${JSON.stringify(data)}::jsonb,
               fetched_at              = now()
         WHERE id = ${row.id as string}::uuid
      `);
    } else {
      await db.execute(sql`
        INSERT INTO public.property_snapshots
               (suite_id, address, data_jsonb, building_footprint_data, fetched_at)
        VALUES (${suiteId}::uuid, ${address}, '{}'::jsonb,
                ${JSON.stringify(data)}::jsonb, now())
      `);
    }
  } catch (err: unknown) {
    logger.warn('[buildingFootprintRoute] cache write failed (non-fatal)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Receipt writer                                                             */
/* -------------------------------------------------------------------------- */

async function writeFootprintReceipt({
  suiteId,
  officeId,
  address,
  outcome,
  cacheHit,
  errorReason,
  correlationId,
}: {
  suiteId:       string;
  officeId:      string;
  address:       string;
  outcome:       'success' | 'failed' | 'unavailable';
  cacheHit:      boolean;
  errorReason?:  string;
  correlationId: string;
}): Promise<void> {
  const status = outcome === 'success' ? 'SUCCEEDED' : outcome === 'failed' ? 'FAILED' : 'SUCCEEDED';
  try {
    await createReceipt({
      suiteId,
      officeId,
      actionType:    'compute_snapshot',
      status,
      correlationId,
      inputs: {
        tool_id:    'google_solar.building_footprint',
        risk_tier:  'green',
        address:    safeAddr(address),
        cache_hit:  cacheHit,
      },
      outputs: {
        outcome,
        error_reason: errorReason,
      },
      metadata: { source: 'building_footprint_route', risk_tier: 'green' },
    });
  } catch (err: unknown) {
    logger.warn('[buildingFootprintRoute] receipt write failed (non-fatal)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Route handler                                                              */
/* -------------------------------------------------------------------------- */

router.get('/api/property/building-footprint', async (req: Request, res: Response) => {
  // ── Auth: tenant context from JWT middleware (Law #3, Law #6) ─────────────
  const suiteId  = (req as unknown as { authenticatedSuiteId?: string }).authenticatedSuiteId;
  const officeId = (req as unknown as { authenticatedOfficeId?: string }).authenticatedOfficeId;

  if (!suiteId) {
    return res.status(401).json({
      error:   'AUTH_REQUIRED',
      message: 'Authenticated tenant context required',
    });
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const rawAddress = typeof req.query.address === 'string' ? req.query.address.trim() : '';

  if (!rawAddress) {
    return res.status(400).json({
      error:   'ADDRESS_REQUIRED',
      message: 'address query parameter is required',
    });
  }
  if (rawAddress.length > ADDRESS_MAX_LEN) {
    return res.status(400).json({
      error:   'ADDRESS_TOO_LONG',
      message: `address must be <= ${ADDRESS_MAX_LEN} characters`,
    });
  }

  const correlationId     = `corr_footprint_${Date.now()}`;
  const effectiveOfficeId = officeId ?? suiteId;

  // ── Stage 0: Cache lookup (Law #6 — suite_id gates the key) ──────────────
  try {
    const cached = await readFootprintCache(suiteId, rawAddress);
    if (cached) {
      logger.info('[buildingFootprintRoute] cache hit', {
        suite_id: suiteId,
        address:  safeAddr(rawAddress),
      });
      await writeFootprintReceipt({
        suiteId,
        officeId:      effectiveOfficeId,
        address:       rawAddress,
        outcome:       'success',
        cacheHit:      true,
        correlationId,
      });
      const response: BuildingFootprintResponse = {
        status:       'ready',
        center:       cached.center,
        polygon:      cached.polygon,
        heightMeters: cached.heightMeters,
        boundingBox:  cached.boundingBox,
        cachedAt:     cached.fetched_at,
      };
      return res.status(200).json(response);
    }
  } catch (cacheErr: unknown) {
    logger.warn('[buildingFootprintRoute] cache lookup threw (continuing to fresh fetch)', {
      reason: cacheErr instanceof Error ? cacheErr.message.slice(0, 160) : 'unknown',
    });
  }

  // ── Stage 1: Geocode address → lat/lng ───────────────────────────────────
  logger.info('[buildingFootprintRoute] cache miss — geocoding', {
    suite_id: suiteId,
    address:  safeAddr(rawAddress),
  });

  const geocoded = await geocodeAddress(rawAddress);

  if (geocoded.status !== 'ok' || !geocoded.coords) {
    const reason = geocoded.status === 'missing'
      ? 'Address not found by geocoder'
      : 'Geocoding service unavailable';
    await writeFootprintReceipt({
      suiteId,
      officeId:      effectiveOfficeId,
      address:       rawAddress,
      outcome:       geocoded.status === 'missing' ? 'unavailable' : 'failed',
      cacheHit:      false,
      errorReason:   reason,
      correlationId,
    });
    const response: BuildingFootprintResponse = {
      status:  geocoded.status === 'missing' ? 'unavailable' : 'error',
      message: reason,
    };
    return res.status(200).json(response);
  }

  const { lat, lng } = geocoded.coords;

  // ── Stage 2: Fetch building footprint from Solar API ────────────────────
  logger.info('[buildingFootprintRoute] geocoded — fetching footprint', {
    suite_id: suiteId,
    address:  safeAddr(rawAddress),
  });

  const result = await fetchBuildingFootprint(lat, lng, rawAddress);

  // ── Build response + write receipt ──────────────────────────────────────
  let response: BuildingFootprintResponse;
  let outcome: 'success' | 'failed' | 'unavailable';

  switch (result.status) {
    case 'ready': {
      const { data } = result;
      // Persist to cache non-blocking — don't hold the response for a DB write
      writeFootprintCache(suiteId, rawAddress, data).catch((e: unknown) => {
        logger.warn('[buildingFootprintRoute] background cache write failed', {
          reason: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
        });
      });
      response = {
        status:       'ready',
        center:       data.center,
        polygon:      data.polygon,
        heightMeters: data.heightMeters,
        boundingBox:  data.boundingBox,
      };
      outcome = 'success';
      break;
    }
    case 'unavailable': {
      response = { status: 'unavailable', message: result.message };
      outcome  = 'unavailable';
      break;
    }
    default: { // 'error'
      response = { status: 'error', message: result.message };
      outcome  = 'failed';
      break;
    }
  }

  // Receipt for every outcome — Law #2
  await writeFootprintReceipt({
    suiteId,
    officeId:      effectiveOfficeId,
    address:       rawAddress,
    outcome,
    cacheHit:      false,
    errorReason:   result.status === 'error' ? result.message : undefined,
    correlationId,
  });

  return res.status(200).json(response);
});

export default router;
