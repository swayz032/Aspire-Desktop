import { renderHook, waitFor } from '@testing-library/react-native';
import { useBlueprintStory } from '@/hooks/useBlueprintStory';

// Mock the API module — keep BlueprintsApiError + types real (we need
// `instanceof BlueprintsApiError` to work inside the hook's error branch).
jest.mock('@/lib/api/blueprintsApi', () => {
  const actual = jest.requireActual('@/lib/api/blueprintsApi');
  return {
    ...actual,
    getStory: jest.fn().mockResolvedValue({
      project_id: 'p1',
      mean_confidence: 0.88,
      truth_distribution: {
        observed: 1, derived: 0, assumed: 0, missing: 0,
        field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0,
      },
      phases: [{ key: 'demo', title: 'Demo', body_md: 'tear it out', facts: [] }],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    }),
    getAssemblies: jest.fn().mockResolvedValue([]),
    getMaterials: jest.fn().mockResolvedValue([]),
    getMissingInputs: jest.fn().mockResolvedValue([]),
  };
});

// Authenticated fetch — stable reference (a new jest.fn() per render would
// invalidate the hook's useCallback deps and trigger an infinite fetch loop).
jest.mock('@/lib/authenticatedFetch', () => {
  const stableAuthFetch = jest.fn();
  return { useAuthFetch: () => ({ authenticatedFetch: stableAuthFetch }) };
});

// Tenant provider — minimal officeId shape (stable reference for the same reason).
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

// useBlueprintProjectPoll — minimal pass-through. Real hook is exercised
// elsewhere; here we only need a stable empty sheets array so the adapter
// has something to receive without doing actual polling.
jest.mock('@/hooks/useBlueprintProjectPoll', () => {
  const stableSheets: never[] = [];
  return {
    useBlueprintProjectPoll: () => ({
      project: null,
      sheets: stableSheets,
      statusResp: null,
      error: null,
      isLoading: false,
      isPolling: false,
      isFirstLoad: false,
      stageCompletedAt: {
        ingest: null, classify: null, see: null, reason: null, procure: null,
      },
      refresh: jest.fn(),
    }),
  };
});

describe('useBlueprintStory — storyV2 surface', () => {
  it('exposes storyV2 derived from legacy story via the adapter', async () => {
    const { result } = renderHook(() => useBlueprintStory('p1'));
    await waitFor(() => expect(result.current.story).not.toBeNull());
    expect(result.current.storyV2).not.toBeNull();
    expect(result.current.storyV2!.chapters).toHaveLength(1);
    expect(result.current.storyV2!.chapters[0].title).toBe('Demo');
  });

  it('storyV2 is null when story is null (no projectId)', () => {
    const { result } = renderHook(() => useBlueprintStory(null));
    expect(result.current.storyV2).toBeNull();
  });
});
