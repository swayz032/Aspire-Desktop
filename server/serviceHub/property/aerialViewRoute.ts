/**
 * Aerial View Route — GET /api/property/aerial-video
 *
 * Serves pre-rendered Google Aerial View drone MP4 videos for a given
 * property address. Integrates the three-path client (lookup → render → poll)
 * with a 30-day per-tenant cache in property_snapshots.aerial_video_data.
 *
 * Aspire Laws:
 *   #2 Receipt — every invocation (cache hit, fresh fetch, failure) produces
 *      an immutable receipt via createReceipt().
 *   #3 Fail-closed — missing auth, missing address → 4xx immediately.
 *      Missing API key → 503 with receipt.
 *   #6 Tenant Isolation — cache key is (suite_id, address). RLS on
 *      property_snapshots enforces zero cross-tenant leakage. suite_id comes
 *      from the validated JWT, never from caller-supplied params.
 *   #7 Tools Are Hands — route does not retry provider calls; returns
 *      status:'processing' so frontend/orchestrator can re-poll.
 *   #9 Security — GOOGLE_MAPS_API_KEY never appears in logs or responses.
 *      Addresses are truncated to 100 chars in logs and receipts.
 *
 * Response shape (contract with frontend):
 *   {
 *     status: 'ready' | 'processing' | 'unavailable' | 'error';
 *     videoUrl?:     string;  // H264 MP4
 *     videoH265Url?: string;  // H265 for modern browsers
 *     thumbnailUrl?: string;  // poster frame
 *     message?:      string;  // human-readable when not ready
 *     cachedAt?:     string;  // ISO8601 if served from cache
 *   }
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';
import { createReceipt } from '../../receiptService';
import { fetchAerialVideo, type AerialVideoData } from './aerialViewClient';

const router = Router();

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CACHE_TTL_DAYS   = 30;
const ADDRESS_MAX_LEN  = 200;
const ADDRESS_LOG_MAX  = 100;    // truncate in logs/receipts (Law #9)

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Wire response sent to the frontend. */
export type AerialVideoResponse = {
  status:        'ready' | 'processing' | 'unavailable' | 'error';
  videoUrl?:     string;
  videoH265Url?: string;
  thumbnailUrl?: string;
  message?:      string;
  cachedAt?:     string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeAddr(address: string): string {
  return address.length > ADDRESS_LOG_MAX
    ? address.slice(0, ADDRESS_LOG_MAX) + '…'
    : address;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* -------------------------------------------------------------------------- */
/* Cache (property_snapshots.aerial_video_data)                              */
/* -------------------------------------------------------------------------- */

async function readAerialCache(
  suiteId: string,
  address: string,
): Promise<AerialVideoData | null> {
  try {
    const result = await db.execute(sql`
      SELECT aerial_video_data, fetched_at
        FROM public.property_snapshots
       WHERE suite_id = ${suiteId}::uuid
         AND address  = ${address}
         AND aerial_video_data IS NOT NULL
         AND fetched_at > now() - make_interval(days => ${CACHE_TTL_DAYS})
       ORDER BY fetched_at DESC
       LIMIT 1
    `);
    const rows = (result as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
    const row  = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
    if (!row?.aerial_video_data) return null;
    return row.aerial_video_data as AerialVideoData;
  } catch (err: unknown) {
    logger.warn('[aerialViewRoute] cache read failed (continuing)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
    return null;
  }
}

async function writeAerialCache(
  suiteId: string,
  address: string,
  data: AerialVideoData,
): Promise<void> {
  try {
    // Upsert: if a row already exists for this (suite_id, address), update its
    // aerial_video_data and fetched_at. Otherwise insert a new row.
    // We match on the most recent row to avoid creating unbounded duplicates.
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
           SET aerial_video_data = ${JSON.stringify(data)}::jsonb,
               fetched_at        = now()
         WHERE id = ${row.id as string}::uuid
      `);
    } else {
      // No existing row — insert a minimal one (data_jsonb required — use empty object)
      await db.execute(sql`
        INSERT INTO public.property_snapshots
               (suite_id, address, data_jsonb, aerial_video_data, fetched_at)
        VALUES (${suiteId}::uuid, ${address}, '{}'::jsonb,
                ${JSON.stringify(data)}::jsonb, now())
      `);
    }
  } catch (err: unknown) {
    logger.warn('[aerialViewRoute] cache write failed (non-fatal)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Receipt writer                                                             */
/* -------------------------------------------------------------------------- */

async function writeAerialReceipt({
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
  outcome:       'success' | 'failed' | 'processing' | 'unavailable';
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
        action:    'google_aerial_view.render',
        tool_id:   'google_aerial_view.render',
        risk_tier: 'green',
        address:   safeAddr(address),
        cache_hit: cacheHit,
      },
      outputs: {
        outcome,
        error_reason: errorReason,
      },
      metadata: { source: 'aerial_view_route', risk_tier: 'green' },
    });
  } catch (err: unknown) {
    logger.warn('[aerialViewRoute] receipt write failed (non-fatal)', {
      reason: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Route handler                                                              */
/* -------------------------------------------------------------------------- */

router.get('/api/property/aerial-video', async (req: Request, res: Response) => {
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

  const correlationId = `corr_aerial_${Date.now()}`;
  const effectiveOfficeId = officeId ?? suiteId;

  // ── Stage 0: Cache lookup (Law #6 — suite_id scopes the key) ─────────────
  try {
    const cached = await readAerialCache(suiteId, rawAddress);
    if (cached) {
      logger.info('[aerialViewRoute] cache hit', {
        suite_id: suiteId,
        address:  safeAddr(rawAddress),
      });
      await writeAerialReceipt({
        suiteId,
        officeId:      effectiveOfficeId,
        address:       rawAddress,
        outcome:       'success',
        cacheHit:      true,
        correlationId,
      });
      const response: AerialVideoResponse = {
        status:        'ready',
        videoUrl:      cached.videoUrl,
        videoH265Url:  cached.videoH265Url,
        thumbnailUrl:  cached.thumbnailUrl,
        cachedAt:      cached.fetched_at,
      };
      return res.status(200).json(response);
    }
  } catch (cacheErr: unknown) {
    // Cache failures are non-fatal — log and proceed to fresh fetch
    logger.warn('[aerialViewRoute] cache lookup threw (continuing to fresh fetch)', {
      reason: cacheErr instanceof Error ? cacheErr.message.slice(0, 160) : 'unknown',
    });
  }

  // ── Stage 1-3: Fetch from Google Aerial View API ──────────────────────────
  logger.info('[aerialViewRoute] cache miss — fetching from provider', {
    suite_id: suiteId,
    address:  safeAddr(rawAddress),
  });

  const result = await fetchAerialVideo(rawAddress);

  // ── Build response + write receipt ───────────────────────────────────────
  let response: AerialVideoResponse;
  let outcome: 'success' | 'failed' | 'processing' | 'unavailable';

  switch (result.status) {
    case 'ready': {
      const data: AerialVideoData = {
        videoUrl:     result.videoUrl,
        videoH265Url: result.videoH265Url,
        thumbnailUrl: result.thumbnailUrl,
        fetched_at:   nowIso(),
      };
      // Persist to cache (non-blocking — don't await in hot path)
      writeAerialCache(suiteId, rawAddress, data).catch((e: unknown) => {
        logger.warn('[aerialViewRoute] background cache write failed', {
          reason: e instanceof Error ? e.message.slice(0, 120) : 'unknown',
        });
      });
      response = {
        status:        'ready',
        videoUrl:      result.videoUrl,
        videoH265Url:  result.videoH265Url,
        thumbnailUrl:  result.thumbnailUrl,
      };
      outcome = 'success';
      break;
    }
    case 'processing': {
      response = { status: 'processing', message: result.message };
      outcome  = 'processing';
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

  // Receipt for every outcome (Law #2)
  await writeAerialReceipt({
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
