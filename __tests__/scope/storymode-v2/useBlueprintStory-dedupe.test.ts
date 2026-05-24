import { renderHook, waitFor } from '@testing-library/react-native';
import {
  useBlueprintStory,
  _resetBlueprintStoryRegistryForTests,
} from '@/hooks/useBlueprintStory';

// Jest hoists jest.mock() above imports — only variables prefixed with `mock`
// (case-insensitive) may be referenced inside the factory. Don't rename these.
const mockGetStory = jest.fn();
const mockGetAssemblies = jest.fn();
const mockGetMaterials = jest.fn();
const mockGetMissingInputs = jest.fn();

jest.mock('@/lib/api/blueprintsApi', () => {
  const actual = jest.requireActual('@/lib/api/blueprintsApi');
  return {
    ...actual,
    getStory: (...args: unknown[]) => mockGetStory(...args),
    getAssemblies: (...args: unknown[]) => mockGetAssemblies(...args),
    getMaterials: (...args: unknown[]) => mockGetMaterials(...args),
    getMissingInputs: (...args: unknown[]) => mockGetMissingInputs(...args),
  };
});

// Stable references — a new jest.fn() per render would invalidate the
// hook's useCallback deps and trigger an infinite subscribe/fetch loop.
jest.mock('@/lib/authenticatedFetch', () => {
  const stableAuthFetch = jest.fn();
  return { useAuthFetch: () => ({ authenticatedFetch: stableAuthFetch }) };
});

jest.mock('@/providers', () => {
  const stableTenant = { officeId: 'office-1' };
  const stableRefresh = jest.fn();
  return {
    useTenant: () => ({
      tenant: stableTenant,
      isLoading: false,
      error: null,
      refresh: stableRefresh,
    }),
  };
});

// useBlueprintProjectPoll — stable empty sheets so the adapter has a
// referentially-stable second argument.
jest.mock('@/hooks/useBlueprintProjectPoll', () => {
  const stableSheets: never[] = [];
  return {
    useBlueprintProjectPoll: () => ({
      project: null, sheets: stableSheets, statusResp: null, error: null,
      isLoading: false, isPolling: false, isFirstLoad: false,
      stageCompletedAt: { ingest: null, classify: null, see: null, reason: null, procure: null },
      refresh: jest.fn(),
    }),
  };
});

describe('useBlueprintStory dedupe', () => {
  beforeEach(() => {
    _resetBlueprintStoryRegistryForTests();
    mockGetStory.mockReset().mockResolvedValue({
      project_id: 'p1',
      mean_confidence: 0.8,
      truth_distribution: {
        observed: 0,
        derived: 0,
        field_confirmed: 0,
        vendor_confirmed: 0,
        permit_confirmed: 0,
        assumed: 0,
        missing: 0,
      },
      phases: [],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    });
    mockGetAssemblies.mockReset().mockResolvedValue([]);
    mockGetMaterials.mockReset().mockResolvedValue([]);
    mockGetMissingInputs.mockReset().mockResolvedValue([]);
  });

  it('fetches the four endpoints once when one hook mounts', async () => {
    const { result } = renderHook(() => useBlueprintStory('p1'));
    await waitFor(() => expect(result.current.story).not.toBeNull());
    expect(mockGetStory).toHaveBeenCalledTimes(1);
    expect(mockGetAssemblies).toHaveBeenCalledTimes(1);
    expect(mockGetMaterials).toHaveBeenCalledTimes(1);
    expect(mockGetMissingInputs).toHaveBeenCalledTimes(1);
  });

  it('does NOT refetch when a second hook mounts for the same projectId', async () => {
    const { result: r1 } = renderHook(() => useBlueprintStory('p1'));
    await waitFor(() => expect(r1.current.story).not.toBeNull());
    expect(mockGetStory).toHaveBeenCalledTimes(1);

    const { result: r2 } = renderHook(() => useBlueprintStory('p1'));
    // Second mount must NOT trigger another round of fetches.
    expect(mockGetStory).toHaveBeenCalledTimes(1);
    // Both hooks see the same data.
    expect(r2.current.story?.project_id).toBe('p1');
  });

  it('a third concurrent mount also shares the same fetch', async () => {
    const { result: r1 } = renderHook(() => useBlueprintStory('p1'));
    const { result: r2 } = renderHook(() => useBlueprintStory('p1'));
    const { result: r3 } = renderHook(() => useBlueprintStory('p1'));
    await waitFor(() => expect(r1.current.story).not.toBeNull());
    expect(mockGetStory).toHaveBeenCalledTimes(1);
    expect(r1.current.story).toBe(r2.current.story);
    expect(r2.current.story).toBe(r3.current.story);
  });

  it('different projectIds get separate fetches', async () => {
    const { result: r1 } = renderHook(() => useBlueprintStory('p1'));
    const { result: r2 } = renderHook(() => useBlueprintStory('p2'));
    await waitFor(() => expect(r1.current.story).not.toBeNull());
    await waitFor(() => expect(r2.current.story).not.toBeNull());
    expect(mockGetStory).toHaveBeenCalledTimes(2);
  });

  it('storyV2 surface still works after dedupe refactor', async () => {
    mockGetStory.mockResolvedValueOnce({
      project_id: 'p1',
      mean_confidence: 0.88,
      truth_distribution: {
        observed: 1,
        derived: 0,
        field_confirmed: 0,
        vendor_confirmed: 0,
        permit_confirmed: 0,
        assumed: 0,
        missing: 0,
      },
      phases: [{ key: 'demo', title: 'Demo', body_md: 'tear it out', facts: [] }],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    });
    const { result } = renderHook(() => useBlueprintStory('p1'));
    await waitFor(() => expect(result.current.storyV2).not.toBeNull());
    expect(result.current.storyV2!.chapters).toHaveLength(1);
    expect(result.current.storyV2!.chapters[0].title).toBe('Demo');
  });
});
