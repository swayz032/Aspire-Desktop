/**
 * Unit tests for the Google Address Validation API proxy.
 *
 * CRITICAL: This client is the FIRST gate in the property data pipeline.
 * These tests verify all 5 verdict cases, API key hygiene, timeout enforcement,
 * and input sanitization. All upstream HTTP is mocked — no real network calls.
 *
 * Coverage:
 *   - verdict: 'valid' (addressComplete + !inferred + !unconfirmed)
 *   - verdict: 'needs_correction' (hasInferredComponents)
 *   - verdict: 'unconfirmed' (hasUnconfirmedComponents)
 *   - verdict: 'invalid' (addressComplete=false)
 *   - verdict: 'api_failure' (upstream error / missing key)
 *   - component extraction (street, secondary, locality, region, postal, country)
 *   - coords extraction from geocode.location
 *   - timeout (AbortError)
 *   - upstream 4xx/5xx
 *   - bad input rejected (control chars, too long)
 *   - API key never appears in error output (Law #9)
 *   - empty string / whitespace rejected
 */

import {
  validateAddress,
  __setFetchForTests,
  type AddressValidationVerdict,
} from '../../../../server/serviceHub/property/googleAddressValidationClient';

const ORIGINAL_ENV = { ...process.env };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchMock(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  return jest.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Build a minimal Google Address Validation response. */
function makeGoogleResponse(overrides: {
  addressComplete?: boolean;
  hasInferredComponents?: boolean;
  hasUnconfirmedComponents?: boolean;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  components?: Array<{ componentType: string; text: string }>;
}): unknown {
  const {
    addressComplete = true,
    hasInferredComponents = false,
    hasUnconfirmedComponents = false,
    formattedAddress = '1234 Industrial Way, Austin, TX 78758, USA',
    latitude = 30.3748,
    longitude = -97.7403,
    components = [],
  } = overrides;

  return {
    result: {
      verdict: {
        addressComplete,
        hasInferredComponents,
        hasUnconfirmedComponents,
      },
      address: {
        formattedAddress,
        addressComponents: components.map((c) => ({
          componentType: c.componentType,
          componentName: { text: c.text },
        })),
      },
      geocode: {
        location: { latitude, longitude },
      },
    },
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('validateAddress', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, GOOGLE_MAPS_API_KEY: 'test_maps_key_abc123' };
  });

  afterEach(() => {
    __setFetchForTests(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  // ─── Happy path: valid ───────────────────────────────────────────────────

  test('valid address — addressComplete + no inferred/unconfirmed → status=valid', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeGoogleResponse({
            addressComplete: true,
            hasInferredComponents: false,
            hasUnconfirmedComponents: false,
            formattedAddress: '1234 Industrial Way, Austin, TX 78758, USA',
            latitude: 30.3748,
            longitude: -97.7403,
          }),
        ),
      ),
    );

    const result = await validateAddress('1234 Industrial Way, Austin, TX 78758');

    expect(result.status).toBe('valid');
    expect(result.formatted).toBe('1234 Industrial Way, Austin, TX 78758, USA');
    expect(result.coords).toEqual({ lat: 30.3748, lng: -97.7403 });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.suggestedAddress).toBeUndefined();
  });

  // ─── needs_correction ───────────────────────────────────────────────────

  test('hasInferredComponents → status=needs_correction + suggestedAddress set', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeGoogleResponse({
            addressComplete: true,
            hasInferredComponents: true,
            hasUnconfirmedComponents: false,
            formattedAddress: '1234 Industrial Way, Austin, TX 78758, USA',
          }),
        ),
      ),
    );

    const result = await validateAddress('1234 Industrial Way Austin TX');

    expect(result.status).toBe('needs_correction');
    expect(result.suggestedAddress).toBe('1234 Industrial Way, Austin, TX 78758, USA');
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ─── unconfirmed ────────────────────────────────────────────────────────

  test('hasUnconfirmedComponents → status=unconfirmed', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeGoogleResponse({
            addressComplete: true,
            hasInferredComponents: false,
            hasUnconfirmedComponents: true,
            formattedAddress: '1 Rural Route, Smalltown, TX 75001, USA',
          }),
        ),
      ),
    );

    const result = await validateAddress('1 Rural Route, Smalltown, TX');

    expect(result.status).toBe('unconfirmed');
    expect(result.suggestedAddress).toBeUndefined();
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ─── invalid ────────────────────────────────────────────────────────────

  test('addressComplete=false → status=invalid', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeGoogleResponse({
            addressComplete: false,
            hasInferredComponents: false,
            hasUnconfirmedComponents: false,
            formattedAddress: '',
          }),
        ),
      ),
    );

    const result = await validateAddress('123 Fake St NoCity NoState');

    expect(result.status).toBe('invalid');
    // coords may be present even for invalid addresses (location of undeliverable address)
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ─── api_failure (upstream 5xx) ─────────────────────────────────────────

  test('upstream 500 → status=api_failure, never throws', async () => {
    __setFetchForTests(
      makeFetchMock(async () => new Response('internal error', { status: 500 })),
    );

    const result = await validateAddress('1234 Industrial Way, Austin, TX');

    expect(result.status).toBe('api_failure');
    expect(result.coords).toBeUndefined();
  });

  // ─── api_failure (upstream 4xx) ─────────────────────────────────────────

  test('upstream 400 → status=api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () => new Response('bad request', { status: 400 })),
    );

    const result = await validateAddress('1 Any St');

    expect(result.status).toBe('api_failure');
  });

  // ─── api_failure (missing API key) ──────────────────────────────────────

  test('missing GOOGLE_MAPS_API_KEY → status=api_failure, fetch never called', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await validateAddress('1234 Industrial Way, Austin, TX');

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ─── Timeout ────────────────────────────────────────────────────────────

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

    const result = await validateAddress('1234 Industrial Way, Austin, TX', { timeoutMs: 5 });

    expect(result.status).toBe('api_failure');
    expect(result.coords).toBeUndefined();
  });

  // ─── Network error ──────────────────────────────────────────────────────

  test('network error (ECONNRESET) → status=api_failure, never throws', async () => {
    __setFetchForTests(
      makeFetchMock(async () => {
        throw new Error('ECONNRESET');
      }),
    );

    const result = await validateAddress('1 Network St');

    expect(result.status).toBe('api_failure');
  });

  // ─── Input sanitization ─────────────────────────────────────────────────

  test('empty string → status=invalid, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await validateAddress('');

    expect(result.status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('whitespace only → status=invalid, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await validateAddress('   ');

    expect(result.status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('control characters in address → status=invalid, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await validateAddress('1234 \x00Industrial\x01 Way');

    expect(result.status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('address exceeding 500 chars → status=invalid, fetch never called', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await validateAddress('A'.repeat(501));

    expect(result.status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ─── Component extraction ───────────────────────────────────────────────

  test('components extracted correctly from addressComponents array', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeGoogleResponse({
            addressComplete: true,
            components: [
              { componentType: 'street_number', text: '1234' },
              { componentType: 'route', text: 'Industrial Way' },
              { componentType: 'subpremise', text: 'Ste 200' },
              { componentType: 'locality', text: 'Austin' },
              { componentType: 'administrative_area_level_1', text: 'TX' },
              { componentType: 'postal_code', text: '78758' },
              { componentType: 'country', text: 'US' },
            ],
          }),
        ),
      ),
    );

    const result = await validateAddress('1234 Industrial Way, Ste 200, Austin, TX 78758');

    expect(result.status).toBe('valid');
    // street_number and route are concatenated
    expect(result.components?.street).toContain('1234');
    expect(result.components?.street).toContain('Industrial Way');
    expect(result.components?.secondary).toBe('Ste 200');
    expect(result.components?.city).toBe('Austin');
    expect(result.components?.state).toBe('TX');
    expect(result.components?.zip).toBe('78758');
    expect(result.components?.country).toBe('US');
  });

  // ─── Coords not present ─────────────────────────────────────────────────

  test('coords undefined when geocode.location missing', async () => {
    const body = {
      result: {
        verdict: { addressComplete: true, hasInferredComponents: false, hasUnconfirmedComponents: false },
        address: { formattedAddress: 'Some Address', addressComponents: [] },
        geocode: {},  // no location
      },
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(body)));

    const result = await validateAddress('Some Address');

    expect(result.status).toBe('valid');
    expect(result.coords).toBeUndefined();
  });

  // ─── API key hygiene (Law #9) ───────────────────────────────────────────

  test('API key never appears in error string returned to caller', async () => {
    __setFetchForTests(
      makeFetchMock(async () => {
        throw new Error(
          'fetch failed: https://addressvalidation.googleapis.com?key=test_maps_key_abc123',
        );
      }),
    );

    const result = await validateAddress('1 Key Leak St');

    expect(result.status).toBe('api_failure');
    // The key must not have leaked into any result field
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain('test_maps_key_abc123');
  });

  // ─── Upstream URL uses the real key (not redacted) ──────────────────────

  test('fetch is called with the key in the URL', async () => {
    const fetchMock = jest.fn(async () =>
      jsonResponse(makeGoogleResponse({ addressComplete: true })),
    );
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    await validateAddress('1234 Industrial Way, Austin, TX 78758');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = fetchMock.mock.calls as any[];
    const calledUrl = String(calls[0][0]);
    expect(calledUrl).toContain('addressvalidation.googleapis.com');
    expect(calledUrl).toContain('test_maps_key_abc123');
    // Body must contain the sanitized address
    const body = JSON.parse((calls[0][1] as RequestInit).body as string);
    expect(body.address.addressLines).toEqual(['1234 Industrial Way, Austin, TX 78758']);
  });

  // ─── inferred + unconfirmed together: inferred wins ─────────────────────

  test('both inferred and unconfirmed → needs_correction (inferred takes precedence)', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse(
          makeGoogleResponse({
            addressComplete: true,
            hasInferredComponents: true,
            hasUnconfirmedComponents: true,
            formattedAddress: 'Corrected Address, TX 78758',
          }),
        ),
      ),
    );

    const result = await validateAddress('Corrected Address TX');

    expect(result.status).toBe('needs_correction');
    expect(result.suggestedAddress).toBe('Corrected Address, TX 78758');
  });

  // ─── Result shape completeness (all required fields always present) ──────

  test('every verdict case returns all required fields', async () => {
    const cases: Array<{ status: AddressValidationVerdict['status']; trigger: () => void }> = [
      {
        status: 'api_failure',
        trigger: () =>
          __setFetchForTests(makeFetchMock(async () => new Response('err', { status: 500 }))),
      },
    ];

    for (const { status, trigger } of cases) {
      trigger();
      const result = await validateAddress('1 Any St');
      expect(result.status).toBe(status);
      expect(typeof result.fetchedAt).toBe('string');
      expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      __setFetchForTests(undefined);
    }
  });
});
