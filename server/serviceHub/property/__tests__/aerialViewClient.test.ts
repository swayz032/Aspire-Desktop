/**
 * aerialViewClient.test.ts — Unit tests for the Google Aerial View client.
 *
 * Test categories:
 *   Happy paths (3):
 *     1. Cache-hit path (tested at route layer, but client contract for
 *        ACTIVE lookup-hit is tested here)
 *     2. Lookup returns ACTIVE immediately → 'ready'
 *     3. Lookup NOT_FOUND → render → poll → ACTIVE → 'ready'
 *
 *   Sad paths (3):
 *     4. Provider returns FAILED on lookup → 'unavailable'
 *     5. Render + poll exhausts budget → 'processing'
 *     6. API key missing → 'error' with API_KEY_MISSING code
 *
 *   Evil / security paths (3):
 *     7. API key must never appear in returned error messages
 *     8. fetchAerialVideo does NOT internally retry (returns error, not loop)
 *     9. PROVIDER_TIMEOUT error → 'error' with PROVIDER_TIMEOUT code
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// We test via the compiled module; mock global fetch before importing.
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Store original env to restore after each test
let originalApiKey: string | undefined;

beforeEach(() => {
  originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = 'test-api-key-do-not-log';
  mockFetch.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
  jest.useRealTimers();
});

// Dynamic import so env is set before module evaluates getApiKey()
const getClient = () => import('../aerialViewClient');

/** Build a minimal mock Response. */
function mockResponse(status: number, body: object): Response {
  return {
    ok:     status >= 200 && status < 300,
    status,
    text:   () => Promise.resolve(JSON.stringify(body)),
    json:   () => Promise.resolve(body),
  } as unknown as Response;
}

const ACTIVE_RESPONSE = {
  state: 'ACTIVE',
  uris: {
    videoH264: { mediaLink: 'https://storage.googleapis.com/aerial/test.mp4' },
    videoH265: { mediaLink: 'https://storage.googleapis.com/aerial/test-h265.mp4' },
    image:     { mediaLink: 'https://storage.googleapis.com/aerial/thumb.jpg' },
  },
};

const PROCESSING_RESPONSE = { state: 'PROCESSING' };
const FAILED_RESPONSE     = { state: 'FAILED', error: { status: 'FAILED' } };
const NOT_FOUND_RESPONSE  = { state: 'FAILED', error: { status: 'NOT_FOUND' } };

// ─── Happy Path 1: Lookup returns ACTIVE immediately ─────────────────────────
describe('fetchAerialVideo — lookup ACTIVE', () => {
  it('returns ready with videoUrl when lookupVideo is ACTIVE', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, ACTIVE_RESPONSE));
    const { fetchAerialVideo } = await getClient();
    const result = await fetchAerialVideo('123 Main St, Austin, TX');

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.videoUrl).toBe('https://storage.googleapis.com/aerial/test.mp4');
      expect(result.videoH265Url).toBe('https://storage.googleapis.com/aerial/test-h265.mp4');
      expect(result.thumbnailUrl).toBe('https://storage.googleapis.com/aerial/thumb.jpg');
    }
    // Only one fetch call — the lookup, no render
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Happy Path 2: NOT_FOUND → render → poll → ACTIVE ───────────────────────
describe('fetchAerialVideo — render then poll ACTIVE', () => {
  it('calls renderVideo then polls until ACTIVE', async () => {
    // 1. lookup → NOT_FOUND (404)
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') } as unknown as Response);
    // 2. render → PROCESSING
    mockFetch.mockResolvedValueOnce(mockResponse(200, PROCESSING_RESPONSE));
    // 3. poll 1 → ACTIVE
    mockFetch.mockResolvedValueOnce(mockResponse(200, ACTIVE_RESPONSE));

    const { fetchAerialVideo } = await getClient();

    const resultPromise = fetchAerialVideo('456 Oak Ave, Dallas, TX');
    // Advance timers to skip POLL_INTERVAL_MS waits
    jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.videoUrl).toBe('https://storage.googleapis.com/aerial/test.mp4');
    }
    // 3 total: lookup + render + 1 poll
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ─── Happy Path 3: Render returns ACTIVE immediately (cached re-render) ───────
describe('fetchAerialVideo — render immediately ACTIVE', () => {
  it('returns ready when renderVideo itself returns ACTIVE', async () => {
    // 1. lookup → NOT_FOUND
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') } as unknown as Response);
    // 2. render → ACTIVE immediately
    mockFetch.mockResolvedValueOnce(mockResponse(200, ACTIVE_RESPONSE));

    const { fetchAerialVideo } = await getClient();
    const result = await fetchAerialVideo('789 Pine Rd, Houston, TX');

    expect(result.status).toBe('ready');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ─── Sad Path 1: Lookup returns FAILED (non NOT_FOUND) ───────────────────────
describe('fetchAerialVideo — provider FAILED', () => {
  it('returns unavailable when lookup state is FAILED', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, FAILED_RESPONSE));
    const { fetchAerialVideo } = await getClient();
    const result = await fetchAerialVideo('Rural Route 9, Nowhere, TX');

    expect(result.status).toBe('unavailable');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Sad Path 2: Poll budget exhausted — still PROCESSING ────────────────────
describe('fetchAerialVideo — poll timeout', () => {
  it('returns processing when poll budget exhausted', async () => {
    // 1. lookup → NOT_FOUND
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') } as unknown as Response);
    // 2. render → PROCESSING
    mockFetch.mockResolvedValueOnce(mockResponse(200, PROCESSING_RESPONSE));
    // All subsequent poll attempts → PROCESSING
    mockFetch.mockResolvedValue(mockResponse(200, PROCESSING_RESPONSE));

    const { fetchAerialVideo } = await getClient();
    const resultPromise = fetchAerialVideo('New Remote Ranch Rd, West TX');
    jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe('processing');
    if (result.status === 'processing') {
      expect(result.message).toMatch(/being generated/i);
    }
  });
});

// ─── Sad Path 3: API key missing ─────────────────────────────────────────────
describe('fetchAerialVideo — missing API key', () => {
  it('returns error with API_KEY_MISSING when env var unset', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const { fetchAerialVideo, AerialViewErrorCode } = await getClient();
    const result = await fetchAerialVideo('1 Test St, Austin, TX');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe(AerialViewErrorCode.API_KEY_MISSING);
    }
    // Provider was never called — key check is pre-flight
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Evil Path 1: API key must never appear in error messages ────────────────
describe('security — API key redaction', () => {
  it('never includes the API key in returned error messages', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network failure'));
    const { fetchAerialVideo } = await getClient();
    const result = await fetchAerialVideo('1 Sec Test, TX');

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('test-api-key-do-not-log');
    expect(serialized).not.toContain('GOOGLE_MAPS_API_KEY');
  });

  it('provider error response body is truncated — key cannot appear in message', async () => {
    const fakeKey = 'test-api-key-do-not-log';
    // Simulate a provider response that echoes the key back (should be sliced off)
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 403,
      text: () => Promise.resolve(`forbidden: key=${fakeKey} is invalid`),
    } as unknown as Response);

    const { fetchAerialVideo } = await getClient();
    const result = await fetchAerialVideo('1 Sec Test 2, TX');

    // The client wraps provider errors without echoing the full body in the
    // returned result.message — verify the key string is absent
    const serialized = JSON.stringify(result);
    // key in the URL (appended by getApiKey) is never returned to caller
    expect(serialized).not.toContain(fakeKey);
  });
});

// ─── Evil Path 2: Adapter never internally retries ───────────────────────────
describe('security — no autonomous retry', () => {
  it('returns error immediately on network failure without retrying', async () => {
    // Reject the first call — a well-behaved adapter returns error, not retry
    mockFetch.mockRejectedValueOnce(new Error('connection refused'));
    const { fetchAerialVideo } = await getClient();
    await fetchAerialVideo('1 Retry Test, TX');

    // Only 1 fetch call — the lookup. No retry means no second call.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Evil Path 3: Provider timeout → PROVIDER_TIMEOUT error code ─────────────
describe('security — provider timeout', () => {
  it('returns error with PROVIDER_TIMEOUT when fetch aborts', async () => {
    // Simulate AbortController abort (same as real timeout)
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortErr);

    const { fetchAerialVideo, AerialViewErrorCode } = await getClient();
    const result = await fetchAerialVideo('1 Timeout Test, TX');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe(AerialViewErrorCode.PROVIDER_TIMEOUT);
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
