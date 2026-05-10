/**
 * Aerial View Client — Service Hub, feat/aerial-view-api.
 *
 * Provides a single entry point, fetchAerialVideo(), that implements the
 * three-path resolution flow:
 *
 *   1. Lookup  — GET videos:lookupVideo — instant if Google has the address
 *                cached. Returns ACTIVE immediately.
 *   2. Render  — POST videos:renderVideo — kicks off drone video generation
 *                for new addresses (~10-30s first time).
 *   3. Poll    — repeated GET videos:lookupVideo every 2 s up to POLL_BUDGET_MS
 *                waiting for ACTIVE. If still PROCESSING → 'processing'.
 *                If FAILED at any point → 'unavailable'.
 *
 * Aspire Laws:
 *   #1 Single Brain — no autonomous retry/fallback; caller decides on
 *      'processing' response (frontend re-polls, orchestrator does not retry).
 *   #2 Receipts — caller (aerialViewRoute.ts) writes the receipt; client
 *      returns a structured result so caller has all info it needs.
 *   #3 Fail-closed — GOOGLE_MAPS_API_KEY missing → throws ApiKeyMissingError;
 *      any unhandled error propagates to route (not swallowed here).
 *   #6 Tenant Isolation — cache key includes suite_id (enforced at route layer).
 *   #7 Tools Are Hands — no autonomous decisions; returns data + status only.
 *   #9 Security — API key is NEVER logged; addresses truncated to 100 chars.
 *
 * Provider specs (Google Aerial View API):
 *   Render: POST https://aerialview.googleapis.com/v1/videos:renderVideo
 *   Lookup: GET  https://aerialview.googleapis.com/v1/videos:lookupVideo
 */

import { logger } from '../../logger';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const AERIAL_VIEW_BASE = 'https://aerialview.googleapis.com/v1/videos';
const PROVIDER_TIMEOUT_MS = 4_500;   // per individual HTTP call (<5s Law #10)
const POLL_INTERVAL_MS   = 2_000;   // between polling attempts
const POLL_BUDGET_MS     = 25_000;  // total polling window before returning 'processing'
const ADDRESS_LOG_MAX    = 100;     // chars — truncate before logging (Law #9)

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/** Normalized result from the Google Aerial View API. */
export type AerialViewResult =
  | { status: 'ready';       videoUrl: string; videoH265Url?: string; thumbnailUrl?: string }
  | { status: 'processing';  message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error';       message: string; code: AerialViewErrorCode };

export type AerialVideoData = {
  videoUrl: string;
  videoH265Url?: string;
  thumbnailUrl?: string;
  fetched_at: string;
};

export const enum AerialViewErrorCode {
  API_KEY_MISSING    = 'API_KEY_MISSING',
  PROVIDER_TIMEOUT   = 'PROVIDER_TIMEOUT',
  PROVIDER_ERROR     = 'PROVIDER_ERROR',
  NETWORK_ERROR      = 'NETWORK_ERROR',
}

/* -------------------------------------------------------------------------- */
/* Internal types (Google API response shapes)                               */
/* -------------------------------------------------------------------------- */

type GoogleVideoState = 'PROCESSING' | 'ACTIVE' | 'FAILED';

type GoogleVideoUri = {
  mediaLink?: string;
};

type GoogleVideoUris = {
  videoH264?: GoogleVideoUri;
  videoH265?: GoogleVideoUri;
  image?:     GoogleVideoUri;
};

type GoogleVideoResponse = {
  state:    GoogleVideoState;
  uris?:    GoogleVideoUris;
  metadata?: Record<string, unknown>;
  error?:   { code?: number; message?: string; status?: string };
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Never log the raw API key — only its presence. (Law #9) */
function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY ?? '';
  if (!key) {
    throw new Error('API_KEY_MISSING: GOOGLE_MAPS_API_KEY is not set');
  }
  return key;
}

/** Truncate address for logging — addresses can contain PII. (Law #9) */
function safeAddr(address: string): string {
  return address.length > ADDRESS_LOG_MAX
    ? address.slice(0, ADDRESS_LOG_MAX) + '…'
    : address;
}

/**
 * Bounded fetch with AbortController timeout.
 * Throws on timeout or network error; never swallows.
 */
async function timedFetch(
  url: string,
  init?: RequestInit,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`PROVIDER_TIMEOUT: aerial view request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract normalized video URLs from a ACTIVE Google response. */
function extractUrls(uris: GoogleVideoUris | undefined): {
  videoUrl:    string | undefined;
  videoH265Url: string | undefined;
  thumbnailUrl: string | undefined;
} {
  return {
    videoUrl:     uris?.videoH264?.mediaLink,
    videoH265Url: uris?.videoH265?.mediaLink,
    thumbnailUrl: uris?.image?.mediaLink,
  };
}

/* -------------------------------------------------------------------------- */
/* Core API calls                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Lookup a pre-rendered video by address.
 * Cheap call — returns instantly from Google's cache or NOT_FOUND.
 */
async function lookupVideo(address: string, apiKey: string): Promise<GoogleVideoResponse> {
  const url = `${AERIAL_VIEW_BASE}:lookupVideo?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const resp = await timedFetch(url, { method: 'GET' });
  if (!resp.ok && resp.status !== 404) {
    // 404 = not found (expected), others are real errors
    let errText = '';
    try { errText = await resp.text(); } catch { /* ignore */ }
    throw new Error(`PROVIDER_ERROR: lookupVideo HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }
  if (resp.status === 404) {
    // Google returns 404 when the address has never been rendered
    return { state: 'FAILED', error: { status: 'NOT_FOUND' } };
  }
  return (await resp.json()) as GoogleVideoResponse;
}

/**
 * Request video generation for a new address.
 * Returns a PROCESSING response immediately; video takes 10-30s.
 */
async function renderVideo(address: string, apiKey: string): Promise<GoogleVideoResponse> {
  const url = `${AERIAL_VIEW_BASE}:renderVideo?key=${apiKey}`;
  const resp = await timedFetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ address }),
  });
  if (!resp.ok) {
    let errText = '';
    try { errText = await resp.text(); } catch { /* ignore */ }
    throw new Error(`PROVIDER_ERROR: renderVideo HTTP ${resp.status}: ${errText.slice(0, 200)}`);
  }
  return (await resp.json()) as GoogleVideoResponse;
}

/**
 * Poll videos:lookupVideo every POLL_INTERVAL_MS for up to POLL_BUDGET_MS.
 * Returns the first ACTIVE or FAILED response, or PROCESSING if time runs out.
 */
async function pollUntilActive(
  address: string,
  apiKey: string,
): Promise<GoogleVideoResponse> {
  const deadline = Date.now() + POLL_BUDGET_MS;
  while (Date.now() < deadline) {
    // Wait before next poll (first pass also waits — render just fired)
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    const response = await lookupVideo(address, apiKey);
    if (response.state === 'ACTIVE' || response.error?.status === 'FAILED') {
      return response;
    }
    // PROCESSING → keep waiting
  }
  // Budget exhausted — still PROCESSING
  return { state: 'PROCESSING' };
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Fetch an aerial drone video for the given address.
 *
 * Flow:
 *   1. lookupVideo → ACTIVE? return immediately.
 *   2. lookupVideo → NOT_FOUND? call renderVideo, then poll.
 *   3. lookupVideo → FAILED? return 'unavailable'.
 *   4. Poll exhausts budget → return 'processing' (caller/frontend re-polls).
 *
 * Never retries on error — orchestrator/frontend is responsible (Law #1).
 * Never logs the API key (Law #9).
 */
export async function fetchAerialVideo(address: string): Promise<AerialViewResult> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch {
    return {
      status:  'error',
      message: 'Aerial view provider is not configured',
      code:    AerialViewErrorCode.API_KEY_MISSING,
    };
  }

  const logAddr = safeAddr(address);

  try {
    // ── Step 1: Lookup (cheap — Google cache hit or NOT_FOUND) ────────────────
    logger.info('[aerialViewClient] lookup', { address: logAddr });
    const lookup = await lookupVideo(address, apiKey);

    if (lookup.state === 'ACTIVE') {
      const { videoUrl, videoH265Url, thumbnailUrl } = extractUrls(lookup.uris);
      if (!videoUrl) {
        return { status: 'unavailable', message: 'Aerial view video URL missing in ACTIVE response' };
      }
      logger.info('[aerialViewClient] lookup hit — ACTIVE', { address: logAddr });
      return { status: 'ready', videoUrl, videoH265Url, thumbnailUrl };
    }

    if (lookup.state === 'FAILED' && lookup.error?.status !== 'NOT_FOUND') {
      // Already rendered before and Google marked it FAILED
      logger.info('[aerialViewClient] lookup returned FAILED', { address: logAddr });
      return { status: 'unavailable', message: 'Aerial view not available for this address' };
    }

    // ── Step 2: NOT_FOUND → trigger render ───────────────────────────────────
    logger.info('[aerialViewClient] not found — triggering render', { address: logAddr });
    const render = await renderVideo(address, apiKey);

    if (render.state === 'ACTIVE') {
      // Occasionally renderVideo returns ACTIVE immediately (re-render of cached)
      const { videoUrl, videoH265Url, thumbnailUrl } = extractUrls(render.uris);
      if (!videoUrl) {
        return { status: 'unavailable', message: 'Aerial view video URL missing in render ACTIVE response' };
      }
      logger.info('[aerialViewClient] render returned ACTIVE immediately', { address: logAddr });
      return { status: 'ready', videoUrl, videoH265Url, thumbnailUrl };
    }

    if (render.state === 'FAILED') {
      logger.info('[aerialViewClient] render returned FAILED', { address: logAddr });
      return { status: 'unavailable', message: 'Aerial view generation failed for this address' };
    }

    // ── Step 3: Poll until ACTIVE or timeout ─────────────────────────────────
    logger.info('[aerialViewClient] render queued — polling', { address: logAddr, budget_ms: POLL_BUDGET_MS });
    const polled = await pollUntilActive(address, apiKey);

    if (polled.state === 'ACTIVE') {
      const { videoUrl, videoH265Url, thumbnailUrl } = extractUrls(polled.uris);
      if (!videoUrl) {
        return { status: 'unavailable', message: 'Aerial view video URL missing after poll' };
      }
      logger.info('[aerialViewClient] poll resolved ACTIVE', { address: logAddr });
      return { status: 'ready', videoUrl, videoH265Url, thumbnailUrl };
    }

    if (polled.state === 'FAILED') {
      logger.info('[aerialViewClient] poll returned FAILED', { address: logAddr });
      return { status: 'unavailable', message: 'Aerial view generation failed during processing' };
    }

    // Still PROCESSING after budget
    logger.info('[aerialViewClient] poll budget exhausted — still PROCESSING', { address: logAddr });
    return {
      status:  'processing',
      message: 'Aerial view is being generated. Check back in 30 seconds.',
    };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';

    // Classify timeout vs network vs provider error — never leak the API key
    if (msg.startsWith('PROVIDER_TIMEOUT')) {
      logger.warn('[aerialViewClient] provider timeout', { address: logAddr });
      return { status: 'error', message: 'Aerial view provider timed out', code: AerialViewErrorCode.PROVIDER_TIMEOUT };
    }
    if (msg.startsWith('PROVIDER_ERROR')) {
      logger.warn('[aerialViewClient] provider error', { address: logAddr, reason: msg.slice(0, 160) });
      return { status: 'error', message: 'Aerial view provider returned an error', code: AerialViewErrorCode.PROVIDER_ERROR };
    }

    logger.warn('[aerialViewClient] network error', { address: logAddr, reason: msg.slice(0, 160) });
    return { status: 'error', message: 'Aerial view request failed (network error)', code: AerialViewErrorCode.NETWORK_ERROR };
  }
}
