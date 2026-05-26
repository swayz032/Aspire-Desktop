/**
 * useExtractionReceipt — DV Pass 3 tests.
 *
 * Covers:
 *   1. Nothing-state when projectId or receiptId is null (no fetch).
 *   2. Fetches when both ids are present.
 *   3. Returns cached receipt synchronously on second mount with same id.
 *   4. Sets error with status=404 on 404 response.
 *   5. Dedupes concurrent fetches — 1 network call for 2 simultaneous mounts.
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useExtractionReceipt,
  ReceiptFetchError,
  _resetExtractionReceiptCacheForTests,
} from '@/hooks/useExtractionReceipt';
import type { ExtractionReceipt } from '@/lib/api/blueprintsStoryV2';

// ---- Mock authenticatedFetch ---------------------------------------------

const mockFetch = jest.fn();

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: mockFetch }),
}));

// ---- Fixtures -------------------------------------------------------------

function makeReceipt(receiptId: string): ExtractionReceipt {
  return {
    receipt_id: receiptId,
    sheet_id: 'sheet-1',
    doc_hash: 'abc123',
    pipeline_version: 'v29-r9',
    tier: 'GREEN',
    routing_action: 'AUTO_POPULATE',
    disqualifier_codes: [],
    evidence_ocr_tokens: [
      { text: 'A-101', confidence: 0.97, bbox: [10, 20, 100, 30] },
    ],
    cluster_bbox: [0, 0, 200, 100],
    iou: 0.82,
    primitive_recall: 0.85,
    primitive_precision: 0.81,
    ocr_engine: 'paddleocr',
    runtime_ms: 412,
    cost_usd: 0.0012,
    trajectory_class: 'FOLLOW',
    audit_trail: 's3://aspire/audit/r-1.jsonl',
    created_at: '2026-05-25T12:00:00Z',
  };
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function errResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'fail' }),
  } as unknown as Response;
}

// ---- Test setup -----------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset();
  _resetExtractionReceiptCacheForTests();
});

// ---- Cases ----------------------------------------------------------------

describe('useExtractionReceipt', () => {
  it('returns nothing-state when projectId is null (no fetch)', () => {
    const { result } = renderHook(() => useExtractionReceipt(null, 'r-1'));
    expect(result.current.receipt).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns nothing-state when receiptId is null (no fetch)', () => {
    const { result } = renderHook(() => useExtractionReceipt('p-1', null));
    expect(result.current.receipt).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches when both projectId and receiptId are present', async () => {
    const receipt = makeReceipt('r-1');
    mockFetch.mockResolvedValueOnce(okResponse(receipt));

    const { result } = renderHook(() => useExtractionReceipt('p-1', 'r-1'));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.receipt).toEqual(receipt);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/v1/blueprints/projects/p-1/receipts/r-1');
  });

  it('returns cached receipt synchronously on second mount with same id', async () => {
    const receipt = makeReceipt('r-cached');
    mockFetch.mockResolvedValueOnce(okResponse(receipt));

    // First mount — primes the cache.
    const first = renderHook(() => useExtractionReceipt('p-1', 'r-cached'));
    await waitFor(() => expect(first.result.current.receipt).not.toBeNull());
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second mount — should serve from cache, no new fetch, no loading flicker.
    const second = renderHook(() => useExtractionReceipt('p-1', 'r-cached'));
    expect(second.result.current.receipt).toEqual(receipt);
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sets ReceiptFetchError with status=404 on 404 response', async () => {
    mockFetch.mockResolvedValueOnce(errResponse(404));

    const { result } = renderHook(() => useExtractionReceipt('p-1', 'r-missing'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.receipt).toBeNull();
    expect(result.current.error).toBeInstanceOf(ReceiptFetchError);
    expect((result.current.error as ReceiptFetchError).status).toBe(404);
  });

  it('surfaces 401 distinctly via ReceiptFetchError.status', async () => {
    mockFetch.mockResolvedValueOnce(errResponse(401));

    const { result } = renderHook(() => useExtractionReceipt('p-1', 'r-unauth'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(ReceiptFetchError);
    expect((result.current.error as ReceiptFetchError).status).toBe(401);
  });

  it('dedupes concurrent fetches — 1 network call for 2 simultaneous mounts', async () => {
    const receipt = makeReceipt('r-concurrent');
    // Defer resolution so both mounts subscribe to the same in-flight promise.
    let resolveFetch: (r: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetch.mockReturnValueOnce(pending);

    const a = renderHook(() => useExtractionReceipt('p-1', 'r-concurrent'));
    const b = renderHook(() => useExtractionReceipt('p-1', 'r-concurrent'));

    expect(a.result.current.isLoading).toBe(true);
    expect(b.result.current.isLoading).toBe(true);
    // Even after two mounts, only ONE fetch should be in flight.
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(okResponse(receipt));
      await pending;
    });

    await waitFor(() => expect(a.result.current.receipt).not.toBeNull());
    await waitFor(() => expect(b.result.current.receipt).not.toBeNull());
    expect(a.result.current.receipt).toEqual(receipt);
    expect(b.result.current.receipt).toEqual(receipt);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
