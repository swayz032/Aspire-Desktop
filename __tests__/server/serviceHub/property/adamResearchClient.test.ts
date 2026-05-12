/**
 * Unit tests for the Adam Research client.
 *
 * Covers:
 *   - Happy path: full ResearchResponse with ATTOM facts + Apify photos
 *   - Missing photos (Apify failed in Adam) → photos undefined, status='partial'
 *   - Missing facts (ATTOM failed in Adam) → status='missing'
 *   - HTTP 4xx from orchestrator → status='api_failure'
 *   - HTTP 5xx from orchestrator → status='api_failure'
 *   - Network timeout (AbortError) → status='api_failure', error='timeout'
 *   - Photo lane bucketing (verify interior/exterior/roof/uncategorized)
 *   - Lot area unit conversion: acres → sqft (×43560)
 *   - ORCHESTRATOR_URL missing → status='api_failure', error contains 'ORCHESTRATOR_URL'
 *   - Empty address → status='api_failure'
 *   - Non-JSON response → status='api_failure'
 *   - receiptsFromAdam passed through
 *   - fetchedAt is always an ISO timestamp
 *   - Request body shape: agent, task, details, suite_id, office_id, correlation_id
 *   - No real network calls — all HTTP mocked via __setFetchForTests
 */

import {
  fetchAdamPropertyResearch,
  __setFetchForTests,
  type AdamPropertyResult,
} from '../../../../server/serviceHub/property/adamResearchClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ORIGINAL_ENV = { ...process.env };

function makeFetchMock(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return jest.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function baseArgs() {
  return {
    address: '1234 Industrial Way, Austin, TX 78758',
    suiteId: 'suite-abc',
    officeId: 'office-xyz',
    correlationId: 'corr-test-123',
  };
}

/** Full fixture matching spec — 1 record, 3 photos across 3 lanes. */
const FULL_FIXTURE = {
  artifact_type: 'property',
  records: [
    {
      address: {
        streetAddress: '1234 Industrial Way',
        city: 'Austin',
        state: 'TX',
        zipcode: '78758',
      },
      homeType: 'WAREHOUSE',
      livingArea: 42560,
      yearBuilt: 2008,
      zoning: 'LI Light Industrial',
      lotAreaValue: 2.5,
      lotAreaUnits: 'Acres',
      stories: 1,
      photos: [
        {
          url: 'https://photos.zillowstatic.com/p1.jpg',
          caption: 'Front exterior',
          lane: 'exterior',
        },
        {
          url: 'https://photos.zillowstatic.com/p2.jpg',
          caption: 'Aerial roof view',
          lane: 'roof',
        },
        {
          url: 'https://photos.zillowstatic.com/p3.jpg',
          caption: 'Office interior',
          lane: 'interior',
        },
      ],
      photos_source: 'apify_zillow',
    },
  ],
  confidence: 0.92,
  freshness: { provider: 'attom' },
  receipts: [{ id: 'receipt-attom-1' }, { id: 'receipt-apify-1' }],
  correlation_id: 'corr-test-123',
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('fetchAdamPropertyResearch', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      ORCHESTRATOR_URL: 'http://orchestrator.internal:8000',
    };
  });

  afterEach(() => {
    __setFetchForTests(undefined);
    process.env = { ...ORIGINAL_ENV };
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  test('happy path — full ResearchResponse with facts and photos', async () => {
    __setFetchForTests(makeFetchMock(async () => jsonResponse(FULL_FIXTURE)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('ok');
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Facts
    expect(result.facts?.sqft).toBe(42560);
    expect(result.facts?.yearBuilt).toBe(2008);
    expect(result.facts?.zoning).toBe('LI Light Industrial');
    expect(result.facts?.propertyType).toBe('WAREHOUSE');
    expect(result.facts?.stories).toBe(1);
    // 2.5 acres × 43560 = 108900 sqft
    expect(result.facts?.lotSqft).toBe(108900);

    // Address
    expect(result.facts?.address?.street).toBe('1234 Industrial Way');
    expect(result.facts?.address?.city).toBe('Austin');
    expect(result.facts?.address?.state).toBe('TX');
    expect(result.facts?.address?.zip).toBe('78758');
    expect(result.facts?.address?.formatted).toBeTruthy();

    // Photos — one in each non-uncategorized lane
    expect(result.photos).toBeDefined();
    expect(result.photos?.exterior.count).toBe(1);
    expect(result.photos?.roof.count).toBe(1);
    expect(result.photos?.interior.count).toBe(1);
    expect(result.photos?.uncategorized.count).toBe(0);

    // Receipts pass-through
    expect(result.receiptsFromAdam).toHaveLength(2);
    expect((result.receiptsFromAdam![0] as { id: string }).id).toBe('receipt-attom-1');

    expect(result.error).toBeUndefined();
  });

  // ─── Request body shape ─────────────────────────────────────────────────────

  test('sends correct request body with all required fields', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(FULL_FIXTURE));
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    await fetchAdamPropertyResearch({
      address: '1234 Industrial Way, Austin, TX 78758',
      suiteId: 'suite-abc',
      officeId: 'office-xyz',
      correlationId: 'corr-test-123',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const [url, init] = calls[0];

    expect(url).toBe('http://orchestrator.internal:8000/v1/agents/invoke');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.agent).toBe('adam');
    expect(body.task).toBe('PROPERTY_FACTS_AND_PERMITS');
    expect((body.details as Record<string, unknown>).address).toBe(
      '1234 Industrial Way, Austin, TX 78758',
    );
    expect(body.suite_id).toBe('suite-abc');
    expect(body.office_id).toBe('office-xyz');
    expect(body.correlation_id).toBe('corr-test-123');
  });

  // ─── Photo lane bucketing ───────────────────────────────────────────────────

  test('photo lane bucketing — multiple photos per lane', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          photos: [
            { url: 'https://z.com/i1.jpg', lane: 'interior' },
            { url: 'https://z.com/i2.jpg', lane: 'interior' },
            { url: 'https://z.com/e1.jpg', lane: 'exterior' },
            { url: 'https://z.com/r1.jpg', lane: 'roof' },
            { url: 'https://z.com/r2.jpg', lane: 'roof' },
            { url: 'https://z.com/r3.jpg', lane: 'roof' },
            { url: 'https://z.com/u1.jpg', lane: 'unknown_lane' },
          ],
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.photos?.interior.count).toBe(2);
    expect(result.photos?.interior.photos).toHaveLength(2);
    expect(result.photos?.exterior.count).toBe(1);
    expect(result.photos?.roof.count).toBe(3);
    expect(result.photos?.uncategorized.count).toBe(1);
    expect(result.photos?.uncategorized.photos[0].url).toBe('https://z.com/u1.jpg');
  });

  test('photo lane bucketing — no lane field falls to uncategorized', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          photos: [
            { url: 'https://z.com/a.jpg' },
            { url: 'https://z.com/b.jpg', lane: '' },
          ],
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.photos?.uncategorized.count).toBe(2);
    expect(result.photos?.interior.count).toBe(0);
  });

  // ─── Lot area unit conversion ───────────────────────────────────────────────

  test('lot area in acres is converted to sqft (×43560)', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          lotAreaValue: 1.0,
          lotAreaUnits: 'Acres',
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.facts?.lotSqft).toBe(43560);
  });

  test('lot area in Square Feet is not converted', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          lotAreaValue: 12000,
          lotAreaUnits: 'Square Feet',
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.facts?.lotSqft).toBe(12000);
  });

  // ─── Apify failed in Adam — missing photos ──────────────────────────────────

  test('missing photos (Apify failed in Adam) → photos undefined, status=partial', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          address: FULL_FIXTURE.records[0].address,
          homeType: 'WAREHOUSE',
          livingArea: 42560,
          yearBuilt: 2008,
          // no photos field at all
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('partial');
    expect(result.photos).toBeUndefined();
    expect(result.facts?.sqft).toBe(42560);
  });

  test('empty photos array (Apify returned nothing) → photos undefined', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          photos: [],
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.photos).toBeUndefined();
  });

  // ─── ATTOM failed in Adam — missing facts ───────────────────────────────────

  test('missing facts (ATTOM failed in Adam) → status=missing', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          // Only photos, no ATTOM facts
          photos: [
            {
              url: 'https://z.com/photo.jpg',
              lane: 'exterior',
            },
          ],
          photos_source: 'apify_zillow',
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('missing');
    expect(result.error).toBeDefined();
  });

  test('empty records array → status=missing', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse({ artifact_type: 'property', records: [] }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('missing');
    expect(result.error).toContain('no records');
  });

  // ─── HTTP error status codes ─────────────────────────────────────────────────

  test('HTTP 400 from orchestrator → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        new Response('bad request', { status: 400 }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('400');
  });

  test('HTTP 401 from orchestrator → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        new Response('unauthorized', { status: 401 }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('401');
  });

  test('HTTP 403 from orchestrator → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        new Response('forbidden', { status: 403 }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('403');
  });

  test('HTTP 404 from orchestrator → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        new Response('not found', { status: 404 }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('404');
  });

  test('HTTP 500 from orchestrator → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        new Response('internal server error', { status: 500 }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('500');
  });

  test('HTTP 503 from orchestrator → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        new Response('service unavailable', { status: 503 }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('503');
  });

  // ─── Timeout ────────────────────────────────────────────────────────────────

  test('timeout (AbortError) → api_failure, error=timeout', async () => {
    __setFetchForTests(
      makeFetchMock(async (_url, init?: RequestInit) => {
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

    const result = await fetchAdamPropertyResearch({
      ...baseArgs(),
      timeoutMs: 5,
    });

    expect(result.status).toBe('api_failure');
    expect(result.error).toBe('timeout');
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ─── ORCHESTRATOR_URL missing ───────────────────────────────────────────────

  test('ORCHESTRATOR_URL not set in env → api_failure with descriptive error', async () => {
    delete process.env.ORCHESTRATOR_URL;
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('ORCHESTRATOR_URL not configured');
    // No network call should have been made
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('ORCHESTRATOR_URL set to empty string → api_failure', async () => {
    process.env.ORCHESTRATOR_URL = '';
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('ORCHESTRATOR_URL not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ─── Empty address ───────────────────────────────────────────────────────────

  test('empty address → api_failure before fetch', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchAdamPropertyResearch({
      ...baseArgs(),
      address: '',
    });

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('empty');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('whitespace-only address → api_failure before fetch', async () => {
    const fetchMock = jest.fn();
    __setFetchForTests(fetchMock as unknown as typeof fetch);

    const result = await fetchAdamPropertyResearch({
      ...baseArgs(),
      address: '   ',
    });

    expect(result.status).toBe('api_failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ─── Non-JSON response ───────────────────────────────────────────────────────

  test('non-JSON response from orchestrator → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(
        async () =>
          new Response('<html>Gateway Error</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toContain('JSON');
  });

  // ─── Network error ───────────────────────────────────────────────────────────

  test('network error (ECONNRESET) → api_failure without throwing', async () => {
    __setFetchForTests(
      makeFetchMock(async () => {
        throw new Error('ECONNRESET');
      }),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
    expect(result.error).toBeDefined();
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // ─── fetchedAt always present ────────────────────────────────────────────────

  test('fetchedAt is always a valid ISO timestamp regardless of outcome', async () => {
    const cases: Array<() => Promise<AdamPropertyResult>> = [
      () => {
        delete process.env.ORCHESTRATOR_URL;
        return fetchAdamPropertyResearch(baseArgs());
      },
      async () => {
        process.env.ORCHESTRATOR_URL = 'http://orchestrator.internal:8000';
        __setFetchForTests(
          makeFetchMock(async () => new Response('boom', { status: 500 })),
        );
        return fetchAdamPropertyResearch(baseArgs());
      },
    ];

    for (const fn of cases) {
      process.env.ORCHESTRATOR_URL = 'http://orchestrator.internal:8000';
      const r = await fn();
      expect(r.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      __setFetchForTests(undefined);
    }
  });

  // ─── Receipts pass-through (Law #2) ─────────────────────────────────────────

  test('receiptsFromAdam are passed through from response', async () => {
    const receipts = [
      { id: 'r1', provider: 'attom' },
      { id: 'r2', provider: 'apify' },
    ];
    const fixture = { ...FULL_FIXTURE, receipts };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.receiptsFromAdam).toEqual(receipts);
  });

  test('receiptsFromAdam is undefined when Adam sends no receipts', async () => {
    const fixture = { ...FULL_FIXTURE, receipts: undefined };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.receiptsFromAdam).toBeUndefined();
  });

  // ─── Partial facts (only some ATTOM fields) ──────────────────────────────────

  test('partial ATTOM response — some facts present → status=partial', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          homeType: 'WAREHOUSE',
          livingArea: 5000,
          // no yearBuilt, no zoning, no lot
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('partial');
    expect(result.facts?.sqft).toBe(5000);
    expect(result.facts?.propertyType).toBe('WAREHOUSE');
    expect(result.facts?.yearBuilt).toBeUndefined();
  });

  // ─── Malformed response ───────────────────────────────────────────────────────

  test('response is not an object → api_failure', async () => {
    __setFetchForTests(
      makeFetchMock(async () => jsonResponse('just a string')),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('api_failure');
  });

  test('records field is not an array → missing status', async () => {
    __setFetchForTests(
      makeFetchMock(async () =>
        jsonResponse({ artifact_type: 'property', records: null }),
      ),
    );

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.status).toBe('missing');
  });

  // ─── Bedrooms/bathrooms normalization ────────────────────────────────────────

  test('bedrooms and bathrooms are normalized from record', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          bedrooms: 3,
          bathrooms: 2,
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.facts?.bedrooms).toBe(3);
    expect(result.facts?.bathrooms).toBe(2);
  });

  // ─── Address normalization ───────────────────────────────────────────────────

  test('address.zip falls back to record.address.zip', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          address: {
            streetAddress: '456 Oak Ave',
            city: 'Denver',
            state: 'CO',
            zip: '80202',
            // no zipcode field
          },
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.facts?.address?.zip).toBe('80202');
  });

  // ─── Photo caption is optional ───────────────────────────────────────────────

  test('photos without caption are accepted', async () => {
    const fixture = {
      ...FULL_FIXTURE,
      records: [
        {
          ...FULL_FIXTURE.records[0],
          photos: [
            { url: 'https://z.com/nocap.jpg', lane: 'exterior' },
          ],
        },
      ],
    };
    __setFetchForTests(makeFetchMock(async () => jsonResponse(fixture)));

    const result = await fetchAdamPropertyResearch(baseArgs());

    expect(result.photos?.exterior.photos[0].caption).toBeUndefined();
    expect(result.photos?.exterior.photos[0].url).toBe('https://z.com/nocap.jpg');
  });
});
