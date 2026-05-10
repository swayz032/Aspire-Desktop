/**
 * Google Geocoding API proxy.
 *
 * Used as a FALLBACK when Address Validation does not return a lat/lng
 * (status='api_failure' or coords missing from the Validation response).
 *
 * Spec: https://developers.google.com/maps/documentation/geocoding/requests-geocoding
 *
 * Aspire Laws:
 *   Law #3 (fail-closed): always returns structured result, never throws.
 *   Law #9 (no secrets logged): API key never appears in logs.
 *
 * Pattern mirrors handleStreetViewProxy in server/routes.ts:8369-8470.
 */

import { resolveGooglePlacesApiKey } from '../../runtimeGuards';
import { logger } from '../../logger';

// ─── Public types ─────────────────────────────────────────────────────────────

export type GeocodeResult = {
  status: 'ok' | 'missing' | 'api_failure';
  coords?: { lat: number; lng: number };
  formatted?: string;
};

// ─── Input validation ─────────────────────────────────────────────────────────

const ADDRESS_RE = /^[A-Za-z0-9\s,.\-#'/]+$/;
const MAX_ADDRESS_LEN = 500;

function sanitizeAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed || trimmed.length > MAX_ADDRESS_LEN) return null;
  if (!ADDRESS_RE.test(trimmed)) return null;
  return trimmed;
}

// ─── Test escape hatch ────────────────────────────────────────────────────────

let _fetchOverride: typeof fetch | undefined;

export function __setFetchForTests(mock: typeof fetch | undefined): void {
  _fetchOverride = mock;
}

function getFetch(): typeof fetch {
  return _fetchOverride ?? fetch;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GeocodeAddressOptions {
  /** Override timeout in ms — for tests only. Default: 8000. */
  timeoutMs?: number;
}

/**
 * Convert an address string to coordinates via the Google Geocoding API.
 *
 * Returns `status='missing'` when the address is valid but no result found.
 * Returns `status='api_failure'` on network errors or upstream failures.
 * Never throws.
 */
export async function geocodeAddress(
  address: string,
  opts: GeocodeAddressOptions = {},
): Promise<GeocodeResult> {
  const sanitized = sanitizeAddress(address);
  if (!sanitized) {
    logger.warn('[Geocoding] rejected malformed input', {
      lengthOk: address.trim().length <= MAX_ADDRESS_LEN,
    });
    return { status: 'api_failure' };
  }

  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    logger.warn('[Geocoding] GOOGLE_MAPS_API_KEY not configured');
    return { status: 'api_failure' };
  }

  const params = new URLSearchParams();
  params.set('address', sanitized);
  params.set('key', apiKey);

  const realUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
  const safeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=<encoded>&key=<REDACTED>`;

  const timeoutMs = opts.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const _fetch = getFetch();
  try {
    const upstream = await _fetch(realUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      logger.warn('[Geocoding] upstream non-2xx', {
        status: upstream.status,
        url: safeUrl,
      });
      return { status: 'api_failure' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await upstream.json() as any;

    // Google Geocoding returns a `status` field in the JSON body
    if (data.status === 'ZERO_RESULTS') {
      logger.info('[Geocoding] no results for address');
      return { status: 'missing' };
    }

    if (data.status !== 'OK') {
      logger.warn('[Geocoding] upstream status error', { geocodeStatus: data.status });
      return { status: 'api_failure' };
    }

    const first = data.results?.[0];
    if (!first) {
      return { status: 'missing' };
    }

    const loc = first.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      logger.warn('[Geocoding] result missing location geometry');
      return { status: 'api_failure' };
    }

    return {
      status: 'ok',
      coords: { lat: loc.lat, lng: loc.lng },
      formatted: typeof first.formatted_address === 'string' ? first.formatted_address : undefined,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const rawMsg = err instanceof Error ? err.message : 'unknown';
    const safeMsg = rawMsg.replace(apiKey, '<REDACTED>');
    logger.warn('[Geocoding] proxy error', {
      isTimeout,
      reason: safeMsg.slice(0, 120),
      url: safeUrl,
    });
    return { status: 'api_failure' };
  }
}
