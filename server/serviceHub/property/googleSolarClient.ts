/**
 * Google Solar API proxy — roof signals for a property.
 *
 * Fetches building insights (roof type, panel capacity, area) to power the
 * Material Signals and Quick Cost heuristics.
 *
 * Spec: https://developers.google.com/maps/documentation/solar/reference/rest/v1/buildingInsights/findClosest
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

export type SolarBuildingInsights = {
  /**
   * 'ok'      — roof data returned successfully.
   * 'missing' — no roof data for this location (404 from Solar API); not an error.
   * 'api_failure' — network error, timeout, or unexpected upstream error.
   */
  status: 'ok' | 'missing' | 'api_failure';
  /** Dominant roof type string from Solar API (e.g., "flat", "gable"). */
  roofType?: string;
  /** Total roof surface area in square metres. */
  roofAreaSqMeters?: number;
  /** Maximum panel wattage capacity for this roof. */
  panelCapacityWatts?: number;
  /** Maximum number of solar panels that fit on this roof. */
  maxPanelCount?: number;
};

// ─── Input validation ─────────────────────────────────────────────────────────

const LATLNG_RE = /^-?\d{1,3}(\.\d{1,8})?$/;

function sanitizeCoords(coords: { lat: number; lng: number }): boolean {
  const latStr = String(coords.lat);
  const lngStr = String(coords.lng);
  if (!LATLNG_RE.test(latStr) || !LATLNG_RE.test(lngStr)) return false;
  if (coords.lat < -90 || coords.lat > 90) return false;
  if (coords.lng < -180 || coords.lng > 180) return false;
  return true;
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

export interface FetchSolarInsightsOptions {
  /** Override timeout in ms — for tests only. Default: 8000. */
  timeoutMs?: number;
}

/**
 * Fetch Solar building insights for a set of coordinates.
 *
 * Returns `status='missing'` when no roof data is available for the location
 * (rural, unmodelled building) — this is normal and not an error condition.
 * Returns `status='api_failure'` on network errors or upstream 5xx.
 * Never throws.
 */
export async function fetchSolarInsights(
  coords: { lat: number; lng: number },
  opts: FetchSolarInsightsOptions = {},
): Promise<SolarBuildingInsights> {
  if (!sanitizeCoords(coords)) {
    logger.warn('[Solar] rejected invalid coords', {
      lat: typeof coords.lat,
      lng: typeof coords.lng,
    });
    return { status: 'api_failure' };
  }

  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    logger.warn('[Solar] GOOGLE_MAPS_API_KEY not configured');
    return { status: 'api_failure' };
  }

  const params = new URLSearchParams();
  params.set('location.latitude', String(coords.lat));
  params.set('location.longitude', String(coords.lng));
  params.set('requiredQuality', 'HIGH');
  params.set('key', apiKey);

  const realUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?${params.toString()}`;
  const safeUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=<lat>&location.longitude=<lng>&requiredQuality=HIGH&key=<REDACTED>`;

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

    // 404 = no roof data for this location — not an error, degrade gracefully
    if (upstream.status === 404) {
      logger.info('[Solar] no building insights for location');
      return { status: 'missing' };
    }

    if (!upstream.ok) {
      logger.warn('[Solar] upstream non-2xx', {
        status: upstream.status,
        url: safeUrl,
      });
      return { status: 'api_failure' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await upstream.json() as any;

    const solarPotential = data.solarPotential ?? {};
    const roofSegmentStats: Array<Record<string, unknown>> =
      Array.isArray(solarPotential.roofSegmentStats)
        ? solarPotential.roofSegmentStats
        : [];

    // Dominant roof type: derived from the largest segment by pitchDegrees proxy
    // The Solar API does not return a "roofType" string directly — we infer from
    // pitchDegrees: <5 = flat, 5-20 = low slope, >20 = steep.
    let roofType: string | undefined;
    if (roofSegmentStats.length > 0) {
      const pitches = roofSegmentStats
        .map((s) => (typeof s.pitchDegrees === 'number' ? s.pitchDegrees : 0));
      const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
      if (avgPitch < 5) roofType = 'flat';
      else if (avgPitch < 20) roofType = 'low-slope';
      else roofType = 'steep';
    }

    const roofAreaSqMeters: number | undefined =
      typeof solarPotential.wholeRoofStats?.areaMeters2 === 'number'
        ? solarPotential.wholeRoofStats.areaMeters2
        : undefined;

    const panelCapacityWatts: number | undefined =
      typeof solarPotential.panelCapacityWatts === 'number'
        ? solarPotential.panelCapacityWatts
        : undefined;

    const maxPanelCount: number | undefined =
      typeof solarPotential.maxArrayPanelsCount === 'number'
        ? solarPotential.maxArrayPanelsCount
        : undefined;

    return {
      status: 'ok',
      ...(roofType ? { roofType } : {}),
      ...(roofAreaSqMeters !== undefined ? { roofAreaSqMeters } : {}),
      ...(panelCapacityWatts !== undefined ? { panelCapacityWatts } : {}),
      ...(maxPanelCount !== undefined ? { maxPanelCount } : {}),
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const rawMsg = err instanceof Error ? err.message : 'unknown';
    const safeMsg = rawMsg.replace(apiKey, '<REDACTED>');
    logger.warn('[Solar] proxy error', {
      isTimeout,
      reason: safeMsg.slice(0, 120),
      url: safeUrl,
    });
    return { status: 'api_failure' };
  }
}
