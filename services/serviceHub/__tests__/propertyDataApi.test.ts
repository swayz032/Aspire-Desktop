/**
 * propertyDataApi tests — Service Hub Phase 3, Pass 3.2.
 *
 * Covers the discriminated-union return shape for each upstream status.
 */
import {
  fetchPropertyData,
  __setFetchForTests,
  type PropertyData,
} from '../propertyDataApi';

const sampleData: PropertyData = {
  address: { formatted: '1234 Industrial Way, Austin, TX 78701' },
  coords: { lat: 30.2672, lng: -97.7431 },
  hero: {},
  facts: { sqft: 2400, yearBuilt: 1998 },
  photos: {
    interior: { count: 0, photos: [] },
    exterior: { count: 0, photos: [] },
    roof: { count: 0, photos: [] },
    streetView: { count: 0, photos: [] },
  },
  signals: { materials: [] },
  costBand: { low: 100_000, high: 200_000, currency: 'USD' },
  evidenceGaps: [],
  fetchedAt: '2026-05-10T00:00:00Z',
  sources: [
    { name: 'addressValidation', fetchedAt: '2026-05-10T00:00:00Z', status: 'ok' },
    { name: 'adam', fetchedAt: '2026-05-10T00:00:00Z', status: 'ok' },
  ],
};

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchPropertyData', () => {
  afterEach(() => {
    __setFetchForTests(null);
  });

  it('returns kind=ok on 200 with PropertyData', async () => {
    __setFetchForTests(async () => mockResponse(200, sampleData));
    const result = await fetchPropertyData({ address: '1234 Industrial Way' });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data.address.formatted).toContain('Industrial Way');
    }
  });

  it('returns kind=needs_correction on 200 with propertyData=null', async () => {
    __setFetchForTests(async () =>
      mockResponse(200, {
        suggestedAddress: '1234 Industrial Way, Austin, TX 78701-1234',
        components: { city: 'Austin', state: 'TX', zip: '78701' },
        propertyData: null,
      }),
    );
    const result = await fetchPropertyData({ address: '1234 Industrial Way Austin' });
    expect(result.kind).toBe('needs_correction');
    if (result.kind === 'needs_correction') {
      expect(result.suggestedAddress).toContain('78701-1234');
    }
  });

  it('returns kind=invalid on 422', async () => {
    __setFetchForTests(async () =>
      mockResponse(422, {
        verdict: {
          status: 'invalid',
          fetchedAt: '2026-05-10T00:00:00Z',
          reason: 'Could not match address',
        },
        message: 'Address could not be validated',
      }),
    );
    const result = await fetchPropertyData({ address: 'asdf' });
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.verdict.status).toBe('invalid');
      expect(result.message).toBe('Address could not be validated');
    }
  });

  it('returns kind=invalid on 422 with malformed body', async () => {
    __setFetchForTests(async () => new Response('not json', { status: 422 }));
    const result = await fetchPropertyData({ address: 'asdf' });
    expect(result.kind).toBe('invalid');
  });

  it('returns kind=error on 500', async () => {
    __setFetchForTests(async () =>
      mockResponse(500, { error: 'AGGREGATOR_FAILURE', message: 'upstream timeout' }),
    );
    const result = await fetchPropertyData({ address: '1234 Industrial Way' });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.status).toBe(500);
      expect(result.message).toBe('upstream timeout');
    }
  });

  it('returns kind=error when fetch throws (network)', async () => {
    __setFetchForTests(async () => {
      throw new Error('connection refused');
    });
    const result = await fetchPropertyData({ address: '1234 Industrial Way' });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.status).toBe(0);
      expect(result.message).toBe('connection refused');
    }
  });

  it('propagates AbortError from fetch', async () => {
    __setFetchForTests(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    await expect(
      fetchPropertyData({ address: '1234 Industrial Way' }),
    ).rejects.toThrow('aborted');
  });

  it('forwards forceRefresh in request body', async () => {
    let captured: any = null;
    __setFetchForTests(async (_url, init) => {
      captured = init?.body ? JSON.parse(init.body as string) : null;
      return mockResponse(200, sampleData);
    });
    await fetchPropertyData({ address: '1234 Industrial Way', forceRefresh: true });
    expect(captured).toEqual({
      address: '1234 Industrial Way',
      forceRefresh: true,
    });
  });

  it('defaults forceRefresh to false', async () => {
    let captured: any = null;
    __setFetchForTests(async (_url, init) => {
      captured = init?.body ? JSON.parse(init.body as string) : null;
      return mockResponse(200, sampleData);
    });
    await fetchPropertyData({ address: '1234 Industrial Way' });
    expect(captured.forceRefresh).toBe(false);
  });

  it('uses POST + credentials=include for tenant cookie isolation', async () => {
    let capturedInit: RequestInit | undefined;
    __setFetchForTests(async (_url, init) => {
      capturedInit = init;
      return mockResponse(200, sampleData);
    });
    await fetchPropertyData({ address: '1234 Industrial Way' });
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.credentials).toBe('include');
  });
});
