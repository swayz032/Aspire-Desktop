/**
 * Unit tests for the Google Solar API proxy.
 *
 * Returns roof signals (type, area, panel capacity) for a given coordinate.
 * All upstream HTTP is mocked — no real network calls.
 *
 * Coverage:
 *   - happy path (full solarPotential)
 *   - roof type inference (flat/low-slope/steep from pitchDegrees)
 *   - missing — 404 from Solar (no roof data for location)
 *   - missing fields (partial response)
 *   - upstream 5xx
 *   - timeout (AbortError)
 *   - invalid coords rejected
 *   - missing API key
 *   - API key never appears in error output (Law #9)
 */

import {
  fetchSolarInsights,
  __setFetchForTests,
} from '../../../../server/serviceHub/property/googleSolarClient';

const ORIGINAL_ENV = { ...process.env };

function makeFetchMock(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  return jest.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSolarResponse(overrides: {
  roofSegmentStats?: Array<{ pitchDegrees: number }>;
  areaMeters2?: number;
  panelCapacityWatts?: number;
  maxArrayPanelsCount?: number;
}): unknown {
  return {
    solarPotential: {
      roofSegmentStats: overrides.roofSegmentStats ?? [{ pitchDegrees: 20 }],
      wholeRoofStats: { areaMeters2: overrides.areaMeters2 ?? 200 },
      panelCapacityWatts: overrides.panelCapacityWatts ?? 400,
      maxArrayPanelsCount: overrides.maxArrayPanelsCount ?? 24,
    },
  };
}

const VALID_COORDS = { lat: 30.3748, lng: -97.7403 };

describe('fetchSolarInsights', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, GOOGLE_MAPS_API_KEY: 'test_maps_key_solar_xyz' };
  });

  afterEach(() => {
    __setFetchForTests(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  // ─── Happy path ──────────────────────────────────────────────────────────

  test('ok — returns roofType, roofAreaSqMeters, panelCapacityWatts, maxPanelCount', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeSolarResponse({
            roofSegmentStats: [{ pitchDegrees: 25 }],
            areaMeters2: 180,
            panelCapacityWatts: 380,
            maxArrayPanelsCount: 18,
          }),
        ),
      ),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('ok');
    expect(result.roofAreaSqMeters).toBe(180);
    expect(result.panelCapacityWatts).toBe(380);
    expect(result.maxPanelCount).toBe(18);
    expect(result.roofType).toBe('steep');
  });

  // ─── Roof type inference ─────────────────────────────────────────────────

  test('pitchDegrees < 5 → roofType=flat', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(makeSolarResponse({ roofSegmentStats: [{ pitchDegrees: 2 }] })),
      ),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('ok');
    expect(result.roofType).toBe('flat');
  });

  test('pitchDegrees 5-20 → roofType=low-slope', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(makeSolarResponse({ roofSegmentStats: [{ pitchDegrees: 12 }] })),
      ),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('ok');
    expect(result.roofType).toBe('low-slope');
  });

  test('pitchDegrees > 20 → roofType=steep', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(makeSolarResponse({ roofSegmentStats: [{ pitchDegrees: 35 }] })),
      ),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('ok');
    expect(result.roofType).toBe('steep');
  });

  test('multiple segments — avgPitch determines roofType', async () => {
    // avg(5, 25) = 15 → low-slope
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeSolarResponse({
            roofSegmentStats: [{ pitchDegrees: 5 }, { pitchDegrees: 25 }],
          }),
        ),
      ),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('ok');
    expect(result.roofType).toBe('low-slope');
  });

  test('empty roofSegmentStats → roofType undefined', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(makeSolarResponse({ roofSegmentStats: [] })),
      ),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('ok');
    expect(result.roofType).toBeUndefined();
  });

  // ─── Missing (404 — no roof data) ────────────────────────────────────────

  test('upstream 404 → status=missing (not api_failure)', async () => {
    __setFetchForTests(
      makeFetchMock(async () => new Response('not found', { status: 404 })),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('missing');
    expect(result.roofType).toBeUndefined();
    expect(result.panelCapacityWatts).toBeUndefined();
  });

  // ─── Partial response ────────────────────────────────────────────────────

  test('partial response — missing optional fields are omitted cleanly', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse({
          solarPotential: {
            roofSegmentStats: [{ pitchDegrees: 10 }],
            // no wholeRoofStats, no panelCapacityWatts, no maxArrayPanelsCount
          },
        }),
      ),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('ok');
    expect(result.roofType).toBe('low-slope');
    expect(result.roofAreaSqMeters).toBeUndefined();
    expect(result.panelCapacityWatts).toBeUndefined();
    expect(result.maxPanelCount).toBeUndefined();
  });

  // ─── Upstream HTTP errors ─────────────────────────────────────────────────

  test('upstream 500 → status=api_failure, never throws', async () => {
    __setFetchForTests(
      makeFetchMock(async () => new Response('internal error', { status: 500 })),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('api_failure');
  });

  test('upstream 503 → status=api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () => new Response('service unavailable', { status: 503 })),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('api_failure');
  });

  // ─── Missing API key ─────────────────────────────────────────────────────

  test('missing GOOGLE_MAPS_API_KEY → status=api_failure, fetch never called', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ─── Timeout ─────────────────────────────────────────────────────────────

  test('timeout (AbortError) → status=api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async (_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          if (init?.signal) {
            (init.signal as AbortSignal).addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      }),
    );

    const result = await fetchSolarInsights(VALID_COORDS, { timeoutMs: 5 });

    expect(result.status).toBe('api_failure');
  });

  // ─── Network error ───────────────────────────────────────────────────────

  test('network error → status=api_failure, never throws', async () => {
    __setFetchForTests(
      makeFetchMock(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    expect(result.status).toBe('api_failure');
  });

  // ─── Invalid coords ──────────────────────────────────────────────────────

  test('NaN coordinates → status=api_failure, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchSolarInsights({ lat: NaN, lng: -97 });

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('lat out of range (>90) → status=api_failure, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchSolarInsights({ lat: 95, lng: -97 });

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('lng out of range (<-180) → status=api_failure, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchSolarInsights({ lat: 30, lng: -200 });

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ─── URL construction ─────────────────────────────────────────────────────

  test('fetch URL contains solar endpoint, location params, and HIGH quality', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(makeSolarResponse({})));
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    await fetchSolarInsights(VALID_COORDS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = fetchMock.mock.calls as any[];
    const calledUrl = String(calls[0][0]);
    expect(calledUrl).toContain('solar.googleapis.com/v1/buildingInsights:findClosest');
    expect(calledUrl).toContain('location.latitude=30.3748');
    expect(calledUrl).toContain('location.longitude=-97.7403');
    expect(calledUrl).toContain('requiredQuality=HIGH');
    expect(calledUrl).toContain('test_maps_key_solar_xyz');
  });

  // ─── API key hygiene (Law #9) ─────────────────────────────────────────────

  test('API key never appears in error result', async () => {
    __setFetchForTests(
      makeFetchMock(async () => {
        throw new Error(
          'fetch failed: https://solar.googleapis.com/v1/buildingInsights?key=test_maps_key_solar_xyz',
        );
      }),
    );

    const result = await fetchSolarInsights(VALID_COORDS);

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('test_maps_key_solar_xyz');
  });
});
