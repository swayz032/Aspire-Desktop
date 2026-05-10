/**
 * Unit tests for the Google Geocoding API proxy.
 *
 * Geocoding is the fallback when Address Validation does not return lat/lng.
 * All upstream HTTP is mocked — no real network calls.
 *
 * Coverage:
 *   - happy path (ZERO_RESULTS)
 *   - missing (ZERO_RESULTS)
 *   - upstream 4xx/5xx
 *   - non-OK Google status code in JSON body
 *   - missing geometry in result
 *   - timeout (AbortError)
 *   - bad input rejected
 *   - API key never appears in error output (Law #9)
 */

import {
  geocodeAddress,
  __setFetchForTests,
} from '../../../../server/serviceHub/property/googleGeocodingClient';

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

function makeOkResponse(lat = 30.3748, lng = -97.7403, formatted = '1234 Industrial Way, Austin, TX 78758, USA'): unknown {
  return {
    status: 'OK',
    results: [
      {
        formatted_address: formatted,
        geometry: { location: { lat, lng } },
      },
    ],
  };
}

describe('geocodeAddress', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, GOOGLE_MAPS_API_KEY: 'test_maps_key_geo_xyz' };
  });

  afterEach(() => {
    __setFetchForTests(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  // ─── Happy path ──────────────────────────────────────────────────────────

  test('ok — returns coords and formatted address', async () => {
    __setFetchForTests(makeFetchMock(async () => jsonResponse(makeOkResponse())));

    const result = await geocodeAddress('1234 Industrial Way, Austin, TX 78758');

    expect(result.status).toBe('ok');
    expect(result.coords).toEqual({ lat: 30.3748, lng: -97.7403 });
    expect(result.formatted).toBe('1234 Industrial Way, Austin, TX 78758, USA');
  });

  // ─── ZERO_RESULTS ────────────────────────────────────────────────────────

  test('Google returns ZERO_RESULTS → status=missing', async () => {
    __setFetchForTests(
      makeFetchMock(async () => jsonResponse({ status: 'ZERO_RESULTS', results: [] })),
    );

    const result = await geocodeAddress('999 Nowhere Lane NoCity NoState 00000');

    expect(result.status).toBe('missing');
    expect(result.coords).toBeUndefined();
  });

  // ─── Non-OK Google status ────────────────────────────────────────────────

  test('Google returns REQUEST_DENIED → status=api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () => jsonResponse({ status: 'REQUEST_DENIED', results: [] })),
    );

    const result = await geocodeAddress('1 Any St');

    expect(result.status).toBe('api_failure');
  });

  test('Google returns INVALID_REQUEST → status=api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () => jsonResponse({ status: 'INVALID_REQUEST', results: [] })),
    );

    const result = await geocodeAddress('1 Any St');

    expect(result.status).toBe('api_failure');
  });

  // ─── Missing geometry ────────────────────────────────────────────────────

  test('result missing geometry.location → status=api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse({
          status: 'OK',
          results: [{ formatted_address: '1 Any St', geometry: {} }],
        }),
      ),
    );

    const result = await geocodeAddress('1 Any St');

    expect(result.status).toBe('api_failure');
  });

  test('results array empty with OK status → status=missing', async () => {
    __setFetchForTests(
      makeFetchMock(async () => jsonResponse({ status: 'OK', results: [] })),
    );

    const result = await geocodeAddress('1 Any St');

    expect(result.status).toBe('missing');
  });

  // ─── Upstream HTTP errors ────────────────────────────────────────────────

  test('upstream 500 → status=api_failure, never throws', async () => {
    __setFetchForTests(
      makeFetchMock(async () => new Response('internal error', { status: 500 })),
    );

    const result = await geocodeAddress('1 Any St');

    expect(result.status).toBe('api_failure');
  });

  test('upstream 429 rate limit → status=api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () => new Response('rate limited', { status: 429 })),
    );

    const result = await geocodeAddress('1 Any St');

    expect(result.status).toBe('api_failure');
  });

  // ─── Missing API key ─────────────────────────────────────────────────────

  test('missing GOOGLE_MAPS_API_KEY → status=api_failure, fetch never called', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await geocodeAddress('1234 Industrial Way');

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

    const result = await geocodeAddress('1234 Industrial Way, Austin, TX', { timeoutMs: 5 });

    expect(result.status).toBe('api_failure');
    expect(result.coords).toBeUndefined();
  });

  // ─── Network error ───────────────────────────────────────────────────────

  test('network error → status=api_failure, never throws', async () => {
    __setFetchForTests(
      makeFetchMock(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    const result = await geocodeAddress('1 Network St');

    expect(result.status).toBe('api_failure');
  });

  // ─── Input sanitization ──────────────────────────────────────────────────

  test('empty string → status=api_failure, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await geocodeAddress('');

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('control characters → status=api_failure, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await geocodeAddress('1234 \x00Fake\x01 St');

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('address over 500 chars → status=api_failure, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await geocodeAddress('A'.repeat(501));

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ─── API key hygiene (Law #9) ─────────────────────────────────────────────

  test('API key never appears in error result', async () => {
    __setFetchForTests(
      makeFetchMock(async () => {
        throw new Error(
          'request failed: https://maps.googleapis.com/geocode/json?key=test_maps_key_geo_xyz',
        );
      }),
    );

    const result = await geocodeAddress('1 Key Leak St');

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('test_maps_key_geo_xyz');
  });

  // ─── URL construction ────────────────────────────────────────────────────

  test('fetch URL contains maps geocode endpoint and encoded address', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(makeOkResponse()));
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    await geocodeAddress('1234 Industrial Way, Austin, TX 78758');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = fetchMock.mock.calls as any[];
    const calledUrl = String(calls[0][0]);
    expect(calledUrl).toContain('maps.googleapis.com/maps/api/geocode/json');
    expect(calledUrl).toContain('1234');
    expect(calledUrl).toContain('test_maps_key_geo_xyz');
  });
});
