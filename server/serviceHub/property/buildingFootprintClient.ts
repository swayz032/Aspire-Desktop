/**
 * Building Footprint Client — Solar API convex-hull polygon extractor.
 *
 * Calls Google Solar API `buildingInsights:findClosest`, collects every
 * roof-segment bounding-box corner, and runs Andrew's monotone-chain
 * convex-hull algorithm to produce a single CCW-wound closed polygon
 * suitable for an INVERSE clip mask on Photorealistic 3D Tiles.
 *
 * Aspire Laws:
 *   #1 Single Brain — no retries, no fallbacks; caller decides on error.
 *   #3 Fail-closed — API key missing → returns 'error'. 404 → 'unavailable'.
 *   #7 Tools Are Hands — returns data + status; never makes decisions.
 *   #9 Security — API key never logged; address truncated to 100 chars.
 *   #10 Reliability — hard 4.5 s AbortController timeout on every fetch.
 *
 * Spec: https://developers.google.com/maps/documentation/solar/reference/rest/v1/buildingInsights/findClosest
 */

import { resolveGooglePlacesApiKey } from '../../runtimeGuards';
import { logger } from '../../logger';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SOLAR_BASE        = 'https://solar.googleapis.com/v1/buildingInsights:findClosest';
const PROVIDER_TIMEOUT  = 4_500;   // ms — strict <5s per Law #10
const ADDRESS_LOG_MAX   = 100;     // chars — truncate before logging (Law #9)
const DEFAULT_HEIGHT_M  = 6.0;    // metres — typical 1-storey house fallback

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/** Cached payload written to property_snapshots.building_footprint_data. */
export type BuildingFootprintData = {
  center:      { lat: number; lng: number; altitude: number };
  /** [lng, lat] pairs — CCW winding, closed (last pair === first pair). */
  polygon:     Array<[number, number]>;
  heightMeters: number;
  boundingBox: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };
  fetched_at:  string;
};

/** Structured result returned by fetchBuildingFootprint(). */
export type BuildingFootprintResult =
  | { status: 'ready';       data: BuildingFootprintData }
  | { status: 'unavailable'; message: string }
  | { status: 'error';       message: string; code: FootprintErrorCode };

export const enum FootprintErrorCode {
  API_KEY_MISSING  = 'API_KEY_MISSING',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_ERROR   = 'PROVIDER_ERROR',
  NETWORK_ERROR    = 'NETWORK_ERROR',
  INVALID_COORDS   = 'INVALID_COORDS',
}

/* -------------------------------------------------------------------------- */
/* Google Solar API response shapes (at the API boundary only)               */
/* -------------------------------------------------------------------------- */

type SolarLatLng = { latitude: number; longitude: number };

type SolarBoundingBox = { sw: SolarLatLng; ne: SolarLatLng };

type SolarRoofSegmentStats = {
  pitchDegrees?:              number;
  azimuthDegrees?:            number;
  stats?:                     { areaMeters2?: number };
  center?:                    SolarLatLng;
  boundingBox?:               SolarBoundingBox;
  planeHeightAtCenterMeters?: number;
};

type SolarBuildingInsightsResponse = {
  name?:            string;
  center?:          SolarLatLng;
  imageryDate?:     { year?: number; month?: number; day?: number };
  imageryQuality?:  string;
  boundingBox?:     SolarBoundingBox;
  solarPotential?: {
    maxArrayPanelsCount?:   number;
    wholeRoofStats?:        { areaMeters2?: number };
    roofSegmentStats?:      SolarRoofSegmentStats[];
    panelCapacityWatts?:    number;
  };
  error?: { code?: number; message?: string; status?: string };
};

/* -------------------------------------------------------------------------- */
/* Test escape hatch (mirrors googleSolarClient pattern)                     */
/* -------------------------------------------------------------------------- */

let _fetchOverride: typeof fetch | undefined;

export function __setFetchForTests(mock: typeof fetch | undefined): void {
  _fetchOverride = mock;
}

function getFetch(): typeof fetch {
  return _fetchOverride ?? fetch;
}

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

/**
 * Validate coordinate ranges without logging raw values (Law #9).
 */
function validateCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/* -------------------------------------------------------------------------- */
/* Andrew's Monotone Chain — Convex Hull                                      */
/* -------------------------------------------------------------------------- */
/*
 * Input:  Array of [x, y] = [lng, lat] points (any count ≥ 1).
 * Output: CCW-wound closed polygon (last point === first point).
 *
 * Why inline: the polygon is at most 8 × N_segments points (N ≤ ~20 for a
 * residential building). The full graham-scan / qhull libraries are overkill
 * and add a dependency surface. This 40-line implementation is O(n log n),
 * correct for geographic scales (<1 km span), and easy to audit.
 *
 * Reference: https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain
 */

type Point2D = [number, number];   // [lng, lat]

function cross(O: Point2D, A: Point2D, B: Point2D): number {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

/**
 * Returns a CCW-wound closed convex hull of the input points.
 * Returns empty array if fewer than 3 distinct points are provided.
 */
export function convexHull(points: Point2D[]): Array<[number, number]> {
  const n = points.length;
  if (n < 3) {
    // Degenerate: return the distinct points as-is, closed
    if (n === 0) return [];
    const first = points[0];
    return [...points, first] as Array<[number, number]>;
  }

  // Sort lexicographically by [lng, lat]
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // De-duplicate
  const deduped: Point2D[] = [];
  for (const p of sorted) {
    if (deduped.length === 0 || p[0] !== deduped[deduped.length - 1][0] || p[1] !== deduped[deduped.length - 1][1]) {
      deduped.push(p);
    }
  }

  if (deduped.length < 3) {
    const first = deduped[0];
    return [...deduped, first] as Array<[number, number]>;
  }

  const hull: Point2D[] = [];

  // Lower hull
  for (const p of deduped) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }

  // Upper hull
  const lowerLen = hull.length + 1;
  for (let i = deduped.length - 2; i >= 0; i--) {
    const p = deduped[i];
    while (hull.length >= lowerLen && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }

  // hull[0] appears at both ends — remove the duplicate tail, then close explicitly
  hull.pop();  // removes the duplicate of hull[0] that monotone chain appends

  // Ensure CCW winding (positive signed area)
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    area += hull[i][0] * hull[j][1];
    area -= hull[j][0] * hull[i][1];
  }
  if (area < 0) {
    hull.reverse();  // flip to CCW
  }

  // Close the polygon (last === first)
  hull.push(hull[0]);

  return hull as Array<[number, number]>;
}

/* -------------------------------------------------------------------------- */
/* Coordinate extraction                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Collect all four corners of a Solar bounding box as [lng, lat] points.
 */
function bbToCorners(bb: SolarBoundingBox): Point2D[] {
  const { sw, ne } = bb;
  return [
    [sw.longitude, sw.latitude],
    [ne.longitude, sw.latitude],
    [ne.longitude, ne.latitude],
    [sw.longitude, ne.latitude],
  ];
}

/**
 * Extract all roof-segment bounding-box corners + optional center points.
 * Falls back to root bounding box if no segments present.
 */
function extractPoints(resp: SolarBuildingInsightsResponse): Point2D[] {
  const segments = resp.solarPotential?.roofSegmentStats ?? [];
  const pts: Point2D[] = [];

  for (const seg of segments) {
    if (seg.boundingBox) {
      pts.push(...bbToCorners(seg.boundingBox));
    }
    if (seg.center) {
      pts.push([seg.center.longitude, seg.center.latitude]);
    }
  }

  // Fallback: root bounding box
  if (pts.length === 0 && resp.boundingBox) {
    pts.push(...bbToCorners(resp.boundingBox));
  }

  return pts;
}

/**
 * Estimate building height from roof-segment planeHeightAtCenterMeters.
 * Uses median to be robust against outlier roof planes (dormers, chimneys).
 */
function estimateHeight(segments: SolarRoofSegmentStats[]): number {
  const heights = segments
    .map((s) => s.planeHeightAtCenterMeters)
    .filter((h): h is number => typeof h === 'number' && h > 0);

  if (heights.length === 0) return DEFAULT_HEIGHT_M;

  heights.sort((a, b) => a - b);
  const mid = Math.floor(heights.length / 2);
  return heights.length % 2 === 0
    ? (heights[mid - 1] + heights[mid]) / 2
    : heights[mid];
}

/* -------------------------------------------------------------------------- */
/* HTTP call                                                                  */
/* -------------------------------------------------------------------------- */

async function callSolarApi(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<SolarBuildingInsightsResponse> {
  const params = new URLSearchParams({
    'location.latitude':  String(lat),
    'location.longitude': String(lng),
    key:                  apiKey,
  });

  const realUrl = `${SOLAR_BASE}?${params.toString()}`;
  // Safe URL for logging — never expose the key (Law #9)
  const safeUrl = `${SOLAR_BASE}?location.latitude=<lat>&location.longitude=<lng>&key=<REDACTED>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT);

  const _fetch = getFetch();
  try {
    const resp = await _fetch(realUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);

    if (resp.status === 404) {
      // Structured 404 — no building data at this location (rural / unmodelled)
      return { error: { code: 404, status: 'NOT_FOUND', message: 'Building not found' } };
    }

    if (!resp.ok) {
      let body = '';
      try { body = (await resp.text()).slice(0, 200); } catch { /* ignore */ }
      throw new Error(`PROVIDER_ERROR: HTTP ${resp.status}: ${body}`);
    }

    return (await resp.json()) as SolarBuildingInsightsResponse;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`PROVIDER_TIMEOUT: Solar API timed out after ${PROVIDER_TIMEOUT}ms`);
    }
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Fetch and compute the building footprint polygon for lat/lng coordinates.
 *
 * Returns:
 *   'ready'       — polygon computed; caller should cache and return to client.
 *   'unavailable' — Solar API returned 404 or empty roof data; not an error.
 *   'error'       — network/timeout/provider error; caller should not retry.
 *
 * Never throws. Never retries (Law #1). Never logs the API key (Law #9).
 */
export async function fetchBuildingFootprint(
  lat: number,
  lng: number,
  logAddress: string,
): Promise<BuildingFootprintResult> {
  if (!validateCoords(lat, lng)) {
    logger.warn('[buildingFootprintClient] invalid coords provided', { logAddress: safeAddr(logAddress) });
    return { status: 'error', message: 'Invalid coordinates', code: FootprintErrorCode.INVALID_COORDS };
  }

  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    logger.warn('[buildingFootprintClient] GOOGLE_MAPS_API_KEY not configured');
    return { status: 'error', message: 'Building footprint provider is not configured', code: FootprintErrorCode.API_KEY_MISSING };
  }

  const logAddr = safeAddr(logAddress);

  try {
    logger.info('[buildingFootprintClient] calling Solar API', { address: logAddr });

    const solarResp = await callSolarApi(lat, lng, apiKey);

    // 404 / NOT_FOUND → graceful unavailable (not an error)
    if (solarResp.error?.status === 'NOT_FOUND' || solarResp.error?.code === 404) {
      logger.info('[buildingFootprintClient] Solar API: building not found (unavailable)', { address: logAddr });
      return { status: 'unavailable', message: 'No building footprint data available for this address' };
    }

    // Empty roof segments → unavailable
    const segments = solarResp.solarPotential?.roofSegmentStats ?? [];
    if (segments.length === 0 && !solarResp.boundingBox) {
      logger.info('[buildingFootprintClient] Solar API: no roof segments or bounding box', { address: logAddr });
      return { status: 'unavailable', message: 'No roof data returned for this address' };
    }

    // Extract point cloud and compute convex hull
    const pts = extractPoints(solarResp);
    const polygon = convexHull(pts);

    if (polygon.length < 4) {
      // Need at least a triangle + closing point — treat as unavailable, not error
      logger.info('[buildingFootprintClient] polygon degenerate (too few points)', { address: logAddr, ptCount: pts.length });
      return { status: 'unavailable', message: 'Building footprint could not be computed for this address' };
    }

    // Center — prefer Solar root center, fall back to bounding-box midpoint
    const rawCenter = solarResp.center;
    const bb        = solarResp.boundingBox;
    const centerLat = rawCenter?.latitude  ?? (bb ? (bb.sw.latitude  + bb.ne.latitude)  / 2 : lat);
    const centerLng = rawCenter?.longitude ?? (bb ? (bb.sw.longitude + bb.ne.longitude) / 2 : lng);

    // Height
    const heightMeters = estimateHeight(segments);

    // Root bounding box for camera framing
    const boundingBox = bb
      ? { sw: { lat: bb.sw.latitude, lng: bb.sw.longitude }, ne: { lat: bb.ne.latitude, lng: bb.ne.longitude } }
      : { sw: { lat, lng }, ne: { lat, lng } };

    const data: BuildingFootprintData = {
      center:      { lat: centerLat, lng: centerLng, altitude: 0 },
      polygon,
      heightMeters,
      boundingBox,
      fetched_at:  nowIso(),
    };

    logger.info('[buildingFootprintClient] footprint computed', {
      address:       logAddr,
      polygonPoints: polygon.length,
      heightMeters,
      segmentCount:  segments.length,
    });

    return { status: 'ready', data };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';

    if (msg.startsWith('PROVIDER_TIMEOUT')) {
      logger.warn('[buildingFootprintClient] provider timeout', { address: logAddr });
      return { status: 'error', message: 'Building footprint provider timed out', code: FootprintErrorCode.PROVIDER_TIMEOUT };
    }
    if (msg.startsWith('PROVIDER_ERROR')) {
      logger.warn('[buildingFootprintClient] provider error', { address: logAddr, reason: msg.slice(0, 160) });
      return { status: 'error', message: 'Building footprint provider returned an error', code: FootprintErrorCode.PROVIDER_ERROR };
    }

    // Sanitize error message — ensure API key never leaks even in unexpected errors (Law #9)
    const safeMsg = msg.replace(apiKey, '<REDACTED>').slice(0, 160);
    logger.warn('[buildingFootprintClient] network error', { address: logAddr, reason: safeMsg });
    return { status: 'error', message: 'Building footprint request failed (network error)', code: FootprintErrorCode.NETWORK_ERROR };
  }
}
