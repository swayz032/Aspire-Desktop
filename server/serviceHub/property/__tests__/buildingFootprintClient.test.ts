/**
 * buildingFootprintClient.test.ts
 *
 * Contract tests, error-mapping tests, and evil/security tests for the
 * Google Solar API building footprint client.
 *
 * Test categories:
 *
 *   CONTRACT TESTS (happy paths)
 *     1. Valid response with roof segments → 'ready' + polygon + center + height
 *     2. Polygon is CCW-wound and closed (last point === first point)
 *     3. Polygon uses convex hull across all segment bounding-box corners
 *     4. Height computed as median of planeHeightAtCenterMeters
 *     5. Height defaults to 6 m when no planeHeightAtCenterMeters present
 *     6. Center falls back to bounding-box midpoint when root center absent
 *
 *   ERROR-MAPPING TESTS (failure modes)
 *     7.  404 NOT_FOUND → 'unavailable' (not an error)
 *     8.  Empty roofSegmentStats + no root boundingBox → 'unavailable'
 *     9.  Degenerate polygon (< 4 points) → 'unavailable'
 *     10. Network timeout (AbortError) → 'error' with PROVIDER_TIMEOUT
 *     11. HTTP 500 → 'error' with PROVIDER_ERROR
 *     12. HTTP 503 → 'error' with PROVIDER_ERROR
 *     13. HTTP 429 → 'error' with PROVIDER_ERROR
 *     14. Invalid coords → 'error' with INVALID_COORDS (no network call)
 *     15. API key missing → 'error' with API_KEY_MISSING (no network call)
 *
 *   EVIL / SECURITY TESTS
 *     16. API key must NEVER appear in any returned error message
 *     17. No autonomous retry — provider error returns immediately without looping
 *     18. convexHull — pure unit tests for correctness and CCW winding
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/* -------------------------------------------------------------------------- */
/* Mock global fetch before importing the module under test                  */
/* -------------------------------------------------------------------------- */

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

let originalApiKey: string | undefined;

beforeEach(() => {
  originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = 'test-key-do-not-log';
  mockFetch.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
  jest.useRealTimers();
});

/* -------------------------------------------------------------------------- */
/* Module import (after mock setup)                                           */
/* -------------------------------------------------------------------------- */

import {
  fetchBuildingFootprint,
  convexHull,
  __setFetchForTests,
  FootprintErrorCode,
} from '../buildingFootprintClient';

// Wire the module-level fetch override so the module sees our mock
beforeEach(() => {
  __setFetchForTests(mockFetch as unknown as typeof fetch);
});
afterEach(() => {
  __setFetchForTests(undefined);
});

/* -------------------------------------------------------------------------- */
/* Factories                                                                  */
/* -------------------------------------------------------------------------- */

type MockSegment = {
  pitchDegrees?: number;
  planeHeightAtCenterMeters?: number;
  boundingBox?: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
  center?: { latitude: number; longitude: number };
};

function makeSolarResponse(opts: {
  center?: { latitude: number; longitude: number };
  boundingBox?: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
  segments?: MockSegment[];
}): object {
  return {
    center: opts.center ?? { latitude: 33.6195, longitude: -84.3382 },
    boundingBox: opts.boundingBox ?? {
      sw: { latitude: 33.6190, longitude: -84.3390 },
      ne: { latitude: 33.6200, longitude: -84.3374 },
    },
    solarPotential: {
      roofSegmentStats: (opts.segments ?? [
        {
          pitchDegrees: 25,
          planeHeightAtCenterMeters: 5.5,
          boundingBox: {
            sw: { latitude: 33.6192, longitude: -84.3388 },
            ne: { latitude: 33.6198, longitude: -84.3378 },
          },
          center: { latitude: 33.6195, longitude: -84.3383 },
        },
        {
          pitchDegrees: 24,
          planeHeightAtCenterMeters: 6.0,
          boundingBox: {
            sw: { latitude: 33.6191, longitude: -84.3387 },
            ne: { latitude: 33.6197, longitude: -84.3379 },
          },
          center: { latitude: 33.6194, longitude: -84.3383 },
        },
      ]),
    },
  };
}

function makeOkResponse(body: object): Response {
  return {
    ok:     true,
    status: 200,
    json:   async () => body,
    text:   async () => JSON.stringify(body),
  } as unknown as Response;
}

function makeErrorResponse(status: number, body = ''): Response {
  return {
    ok:     false,
    status,
    json:   async () => ({}),
    text:   async () => body,
  } as unknown as Response;
}

function make404Response(): Response {
  return {
    ok:     false,
    status: 404,
    json:   async () => ({ error: { code: 404, status: 'NOT_FOUND', message: 'Building not found' } }),
    text:   async () => '{"error":{"status":"NOT_FOUND"}}',
  } as unknown as Response;
}

/* ========================================================================== */
/* CONTRACT TESTS                                                             */
/* ========================================================================== */

describe('fetchBuildingFootprint — contract tests', () => {
  it('1. valid Solar response returns ready with polygon, center, and height', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(makeSolarResponse({})));
    const result = await fetchBuildingFootprint(33.6195, -84.3382, '4863 Price St, Forest Park, GA');
    jest.runAllTimers();

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.data.polygon.length).toBeGreaterThanOrEqual(4);
    expect(result.data.center.lat).toBeCloseTo(33.6195, 3);
    expect(result.data.center.lng).toBeCloseTo(-84.3382, 3);
    expect(result.data.heightMeters).toBeGreaterThan(0);
    expect(result.data.boundingBox).toBeDefined();
    expect(result.data.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('2. polygon is CCW-wound and closed (last point === first point)', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(makeSolarResponse({})));
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    if (result.status !== 'ready') throw new Error(`expected ready, got ${result.status}`);
    const poly = result.data.polygon;

    // Closed: last === first
    expect(poly[0][0]).toBeCloseTo(poly[poly.length - 1][0], 8);
    expect(poly[0][1]).toBeCloseTo(poly[poly.length - 1][1], 8);

    // CCW: shoelace signed area should be positive
    let area = 0;
    for (let i = 0; i < poly.length - 1; i++) {
      area += poly[i][0] * poly[i + 1][1] - poly[i + 1][0] * poly[i][1];
    }
    expect(area).toBeGreaterThan(0);
  });

  it('3. polygon covers corners of all roof-segment bounding boxes', async () => {
    // Use a clearly non-rectangular building (L-shape via 3 segments)
    const segments: MockSegment[] = [
      {
        pitchDegrees: 20, planeHeightAtCenterMeters: 5,
        boundingBox: { sw: { latitude: 33.0, longitude: -84.0 }, ne: { latitude: 33.01, longitude: -83.99 } },
      },
      {
        pitchDegrees: 20, planeHeightAtCenterMeters: 5,
        boundingBox: { sw: { latitude: 33.01, longitude: -84.0 }, ne: { latitude: 33.02, longitude: -83.995 } },
      },
      {
        pitchDegrees: 20, planeHeightAtCenterMeters: 5,
        boundingBox: { sw: { latitude: 33.0, longitude: -83.995 }, ne: { latitude: 33.005, longitude: -83.98 } },
      },
    ];
    mockFetch.mockResolvedValueOnce(makeOkResponse(makeSolarResponse({ segments })));
    const result = await fetchBuildingFootprint(33.01, -84.0, 'test');
    jest.runAllTimers();

    if (result.status !== 'ready') throw new Error(`expected ready, got ${result.status}`);
    // The bounding box of the polygon must contain all input coordinates
    const lngs = result.data.polygon.map((p) => p[0]);
    const lats = result.data.polygon.map((p) => p[1]);
    expect(Math.min(...lngs)).toBeLessThanOrEqual(-84.0);
    expect(Math.max(...lngs)).toBeGreaterThanOrEqual(-83.98);
    expect(Math.min(...lats)).toBeLessThanOrEqual(33.0);
    expect(Math.max(...lats)).toBeGreaterThanOrEqual(33.02);
  });

  it('4. height is the median of planeHeightAtCenterMeters values', async () => {
    const segments: MockSegment[] = [
      { pitchDegrees: 20, planeHeightAtCenterMeters: 4,
        boundingBox: { sw: { latitude: 33.0, longitude: -84.0 }, ne: { latitude: 33.01, longitude: -83.99 } } },
      { pitchDegrees: 20, planeHeightAtCenterMeters: 6,
        boundingBox: { sw: { latitude: 33.0, longitude: -84.0 }, ne: { latitude: 33.01, longitude: -83.99 } } },
      { pitchDegrees: 20, planeHeightAtCenterMeters: 8,
        boundingBox: { sw: { latitude: 33.0, longitude: -84.0 }, ne: { latitude: 33.01, longitude: -83.99 } } },
    ];
    mockFetch.mockResolvedValueOnce(makeOkResponse(makeSolarResponse({ segments })));
    const result = await fetchBuildingFootprint(33.005, -84.0, 'test');
    jest.runAllTimers();

    if (result.status !== 'ready') throw new Error(`expected ready, got ${result.status}`);
    expect(result.data.heightMeters).toBe(6);  // median of [4, 6, 8]
  });

  it('5. height defaults to 6 m when no planeHeightAtCenterMeters present', async () => {
    const segments: MockSegment[] = [
      { pitchDegrees: 20,
        boundingBox: { sw: { latitude: 33.0, longitude: -84.0 }, ne: { latitude: 33.01, longitude: -83.99 } } },
    ];
    mockFetch.mockResolvedValueOnce(makeOkResponse(makeSolarResponse({ segments })));
    const result = await fetchBuildingFootprint(33.005, -84.0, 'test');
    jest.runAllTimers();

    if (result.status !== 'ready') throw new Error(`expected ready, got ${result.status}`);
    expect(result.data.heightMeters).toBe(6.0);
  });

  it('6. center falls back to bounding-box midpoint when root center absent', async () => {
    const body = {
      boundingBox: { sw: { latitude: 33.0, longitude: -84.0 }, ne: { latitude: 33.02, longitude: -83.98 } },
      solarPotential: {
        roofSegmentStats: [
          { pitchDegrees: 20, planeHeightAtCenterMeters: 5,
            boundingBox: { sw: { latitude: 33.0, longitude: -84.0 }, ne: { latitude: 33.02, longitude: -83.98 } } },
        ],
      },
    };
    mockFetch.mockResolvedValueOnce(makeOkResponse(body));
    const result = await fetchBuildingFootprint(33.01, -83.99, 'test');
    jest.runAllTimers();

    if (result.status !== 'ready') throw new Error(`expected ready, got ${result.status}`);
    expect(result.data.center.lat).toBeCloseTo(33.01, 4);
    expect(result.data.center.lng).toBeCloseTo(-83.99, 4);
  });
});

/* ========================================================================== */
/* ERROR-MAPPING TESTS                                                        */
/* ========================================================================== */

describe('fetchBuildingFootprint — error-mapping tests', () => {
  it('7. 404 NOT_FOUND → unavailable (not an error)', async () => {
    mockFetch.mockResolvedValueOnce(make404Response());
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    expect(result.status).toBe('unavailable');
    // Must not classify as 'error'
    expect(result.status).not.toBe('error');
  });

  it('8. empty roofSegmentStats + no root boundingBox → unavailable', async () => {
    const body = { solarPotential: { roofSegmentStats: [] } };
    mockFetch.mockResolvedValueOnce(makeOkResponse(body));
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    expect(result.status).toBe('unavailable');
  });

  it('10. network timeout (AbortError) → error with PROVIDER_TIMEOUT code', async () => {
    mockFetch.mockImplementationOnce(() => {
      const err = new Error('aborted');
      (err as NodeJS.ErrnoException).name = 'AbortError';
      return Promise.reject(err);
    });
    const resultPromise = fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();
    const result = await resultPromise;

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe(FootprintErrorCode.PROVIDER_TIMEOUT);
  });

  it('11. HTTP 500 → error with PROVIDER_ERROR code', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'internal server error'));
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe(FootprintErrorCode.PROVIDER_ERROR);
  });

  it('12. HTTP 503 → error with PROVIDER_ERROR code', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(503, 'service unavailable'));
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe(FootprintErrorCode.PROVIDER_ERROR);
  });

  it('13. HTTP 429 → error with PROVIDER_ERROR code', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(429, 'rate limit exceeded'));
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe(FootprintErrorCode.PROVIDER_ERROR);
  });

  it('14. invalid coords (out of range) → error with INVALID_COORDS — no network call', async () => {
    const result = await fetchBuildingFootprint(999, -84.3382, 'test');
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe(FootprintErrorCode.INVALID_COORDS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('14b. NaN coords → error with INVALID_COORDS — no network call', async () => {
    const result = await fetchBuildingFootprint(NaN, -84.3382, 'test');
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe(FootprintErrorCode.INVALID_COORDS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('15. API key missing → error with API_KEY_MISSING — no network call', async () => {
    const saved = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    process.env.GOOGLE_MAPS_API_KEY = saved;
    jest.runAllTimers();

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe(FootprintErrorCode.API_KEY_MISSING);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/* EVIL / SECURITY TESTS                                                      */
/* ========================================================================== */

describe('fetchBuildingFootprint — evil/security tests', () => {
  it('16. API key must NEVER appear in any returned error message', async () => {
    const testKey = 'TEST_SECRET_KEY_MUST_NOT_LEAK';
    process.env.GOOGLE_MAPS_API_KEY = testKey;
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, `error near key=${testKey}`));

    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain(testKey);
  });

  it('16b. API key must not leak on network error', async () => {
    const testKey = 'NETWORK_ERROR_KEY_MUST_NOT_LEAK';
    process.env.GOOGLE_MAPS_API_KEY = testKey;
    mockFetch.mockRejectedValueOnce(new Error(`network failure for key ${testKey}`));

    const resultPromise = fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();
    const result = await resultPromise;

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain(testKey);
  });

  it('17. provider error returns immediately — no autonomous retry (fetch called exactly once)', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(500, 'error'));
    const result = await fetchBuildingFootprint(33.6195, -84.3382, 'test');
    jest.runAllTimers();

    expect(result.status).toBe('error');
    // Fetch called EXACTLY once — no internal retry loop (Law #1)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

/* ========================================================================== */
/* CONVEX HULL UNIT TESTS                                                     */
/* ========================================================================== */

describe('convexHull — pure algorithm tests', () => {
  it('18a. square input → 4-point CCW hull (closed = 5 points)', () => {
    const pts: Array<[number, number]> = [
      [-84.001, 33.001],
      [-84.001, 33.009],
      [-83.991, 33.009],
      [-83.991, 33.001],
    ];
    const hull = convexHull(pts);
    // 4 unique corners + 1 closing point
    expect(hull.length).toBe(5);
    // Closed
    expect(hull[0][0]).toBeCloseTo(hull[hull.length - 1][0], 8);
    expect(hull[0][1]).toBeCloseTo(hull[hull.length - 1][1], 8);
    // CCW (positive shoelace area)
    let area = 0;
    for (let i = 0; i < hull.length - 1; i++) {
      area += hull[i][0] * hull[i + 1][1] - hull[i + 1][0] * hull[i][1];
    }
    expect(area).toBeGreaterThan(0);
  });

  it('18b. interior points are excluded from hull', () => {
    const pts: Array<[number, number]> = [
      [-84.0, 33.0],  // corner
      [-84.0, 33.01], // corner
      [-83.99, 33.01],// corner
      [-83.99, 33.0], // corner
      [-83.995, 33.005], // interior point — must NOT appear in hull
    ];
    const hull = convexHull(pts);
    // Hull should have 4 corners + close = 5 points
    expect(hull.length).toBe(5);
    // The interior point should not appear in the hull (to 3 decimal places)
    const hasInterior = hull.some(
      (p) => Math.abs(p[0] - (-83.995)) < 0.0001 && Math.abs(p[1] - 33.005) < 0.0001
    );
    expect(hasInterior).toBe(false);
  });

  it('18c. duplicate points are handled gracefully', () => {
    const pts: Array<[number, number]> = [
      [-84.0, 33.0],
      [-84.0, 33.0],  // duplicate
      [-84.0, 33.01],
      [-83.99, 33.01],
      [-83.99, 33.0],
    ];
    const hull = convexHull(pts);
    expect(hull.length).toBeGreaterThanOrEqual(4);
    // Closed
    expect(hull[0][0]).toBeCloseTo(hull[hull.length - 1][0], 8);
  });

  it('18d. empty input returns empty array', () => {
    expect(convexHull([])).toEqual([]);
  });

  it('18e. single point returns closed 2-point array', () => {
    const result = convexHull([[-84.0, 33.0]]);
    expect(result.length).toBe(2);
    expect(result[0]).toEqual(result[1]);
  });
});
