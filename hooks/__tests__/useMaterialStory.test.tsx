/**
 * useMaterialStory — DV Pass 4 tests.
 *
 * Covers:
 *   1. Nothing-state when projectId is null (no fetch).
 *   2. Fetches when projectId is present.
 *   3. Pre-indexes materials by sheet_id and chapter key.
 *   4. Returns cached story synchronously within the 30s TTL window.
 *   5. Refetches after TTL expiry.
 *   6. Sets MaterialStoryFetchError on failed fetch.
 *   7. Dedupes concurrent fetches — 1 network call for 2 simultaneous mounts.
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useMaterialStory,
  MaterialStoryFetchError,
  _resetMaterialStoryCacheForTests,
  _expireMaterialStoryCacheEntryForTests,
} from '@/hooks/useMaterialStory';
import type {
  MaterialInstance,
  MaterialStoryResponse,
} from '@/lib/api/blueprintsStoryV2';

// ---- Mock authenticatedFetch ---------------------------------------------

const mockFetch = jest.fn();

jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: mockFetch }),
}));

// ---- Fixtures -------------------------------------------------------------

function makeMaterial(
  overrides: Partial<MaterialInstance> & Pick<MaterialInstance, 'instance_id' | 'sheet_id'>,
): MaterialInstance {
  return {
    sheet_code: 'A-101',
    symbol_name: 'Single-pole switch',
    legend_label: 'S1',
    legend_specification: 'Lutron CA-1PSH-WH',
    cluster_id: 'c-1',
    motif_hash: 'm-1',
    resolution_source: 'topology_match',
    confidence: 0.91,
    instance_count: 1,
    tier: 'GREEN',
    receipt_id: 'r-1',
    ...overrides,
  };
}

function makeStory(projectId: string): MaterialStoryResponse {
  return {
    project_id: projectId,
    updated_at: '2026-05-25T12:00:00Z',
    chapters: [
      {
        key: 'electrical',
        materials: [
          makeMaterial({ instance_id: 'i-1', sheet_id: 'sheet-A' }),
          makeMaterial({ instance_id: 'i-2', sheet_id: 'sheet-A' }),
          makeMaterial({ instance_id: 'i-3', sheet_id: 'sheet-B' }),
        ],
      },
      {
        key: 'plumbing',
        materials: [
          makeMaterial({
            instance_id: 'i-4',
            sheet_id: 'sheet-C',
            symbol_name: 'Toilet — wall hung',
            legend_label: 'WC-2',
          }),
        ],
      },
    ],
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
  _resetMaterialStoryCacheForTests();
});

// ---- Cases ----------------------------------------------------------------

describe('useMaterialStory', () => {
  it('returns nothing-state when projectId is null (no fetch)', () => {
    const { result } = renderHook(() => useMaterialStory(null));
    expect(result.current.story).toBeNull();
    expect(result.current.materialsBySheet.size).toBe(0);
    expect(result.current.materialsByChapter.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches when projectId is present', async () => {
    const story = makeStory('p-1');
    mockFetch.mockResolvedValueOnce(okResponse(story));

    const { result } = renderHook(() => useMaterialStory('p-1'));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.story).toEqual(story);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/v1/blueprints/projects/p-1/material-story');
  });

  it('pre-indexes materials by sheet_id and chapter key', async () => {
    const story = makeStory('p-1');
    mockFetch.mockResolvedValueOnce(okResponse(story));

    const { result } = renderHook(() => useMaterialStory('p-1'));
    await waitFor(() => expect(result.current.story).not.toBeNull());

    const bySheet = result.current.materialsBySheet;
    expect(bySheet.size).toBe(3);
    expect(bySheet.get('sheet-A')).toHaveLength(2);
    expect(bySheet.get('sheet-A')?.map((m) => m.instance_id)).toEqual(['i-1', 'i-2']);
    expect(bySheet.get('sheet-B')).toHaveLength(1);
    expect(bySheet.get('sheet-B')?.[0].instance_id).toBe('i-3');
    expect(bySheet.get('sheet-C')?.[0].legend_label).toBe('WC-2');

    const byChapter = result.current.materialsByChapter;
    expect(byChapter.size).toBe(2);
    expect(byChapter.get('electrical')).toHaveLength(3);
    expect(byChapter.get('plumbing')).toHaveLength(1);
  });

  it('returns cached story synchronously within 30s TTL window', async () => {
    const story = makeStory('p-cache');
    mockFetch.mockResolvedValueOnce(okResponse(story));

    // First mount — primes the cache.
    const first = renderHook(() => useMaterialStory('p-cache'));
    await waitFor(() => expect(first.result.current.story).not.toBeNull());
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second mount within TTL — synchronous cache hit, no refetch, no flicker.
    const second = renderHook(() => useMaterialStory('p-cache'));
    expect(second.result.current.story).toEqual(story);
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refetches after TTL expires', async () => {
    const storyV1 = makeStory('p-ttl');
    const storyV2: MaterialStoryResponse = {
      ...storyV1,
      updated_at: '2026-05-25T13:00:00Z',
    };
    mockFetch.mockResolvedValueOnce(okResponse(storyV1));

    const first = renderHook(() => useMaterialStory('p-ttl'));
    await waitFor(() => expect(first.result.current.story).not.toBeNull());
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Backdate the cache entry past the 30s window.
    _expireMaterialStoryCacheEntryForTests('p-ttl');
    mockFetch.mockResolvedValueOnce(okResponse(storyV2));

    const second = renderHook(() => useMaterialStory('p-ttl'));
    await waitFor(() => expect(second.result.current.story?.updated_at).toBe('2026-05-25T13:00:00Z'));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sets MaterialStoryFetchError on failed fetch', async () => {
    mockFetch.mockResolvedValueOnce(errResponse(500));

    const { result } = renderHook(() => useMaterialStory('p-bad'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.story).toBeNull();
    expect(result.current.error).toBeInstanceOf(MaterialStoryFetchError);
    expect((result.current.error as MaterialStoryFetchError).status).toBe(500);
    expect((result.current.error as MaterialStoryFetchError).projectId).toBe('p-bad');
  });

  it('dedupes concurrent fetches — 1 network call for 2 simultaneous mounts', async () => {
    const story = makeStory('p-concurrent');
    let resolveFetch: (r: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    mockFetch.mockReturnValueOnce(pending);

    const a = renderHook(() => useMaterialStory('p-concurrent'));
    const b = renderHook(() => useMaterialStory('p-concurrent'));

    expect(a.result.current.isLoading).toBe(true);
    expect(b.result.current.isLoading).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(okResponse(story));
      await pending;
    });

    await waitFor(() => expect(a.result.current.story).not.toBeNull());
    await waitFor(() => expect(b.result.current.story).not.toBeNull());
    expect(a.result.current.story).toEqual(story);
    expect(b.result.current.story).toEqual(story);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
