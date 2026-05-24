/**
 * useBlueprintStory — stability regression for the hotfix on 2026-05-23.
 *
 * Production hit React error #300 ("Too many re-renders. React limits the
 * number of renders to prevent an infinite loop") on the Scope route because
 * `useAuthFetch` recreates `authenticatedFetch` whenever the Supabase session
 * refreshes, and the previous `subscribe` callback included
 * `authenticatedFetch` in its dep array. Every session tick → new subscribe
 * → useSyncExternalStore tears down + re-subscribes → fetch → emit →
 * re-render → loop.
 *
 * The fix wraps `authenticatedFetch` in a ref so the subscribe callback only
 * depends on the string primitives (key/projectId/officeId). This test
 * proves the hook does NOT re-fetch when only `authenticatedFetch` identity
 * changes — exactly the production scenario.
 */
import { act, renderHook } from '@testing-library/react-native';
import {
  useBlueprintStory,
  _resetBlueprintStoryRegistryForTests,
} from '@/hooks/useBlueprintStory';

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

// Unstable mock: every render of useAuthFetch returns a FRESH
// `authenticatedFetch` function (simulates the Supabase-session-tick scenario
// that broke production). The pre-hotfix code looped here; the post-hotfix
// code tolerates this.
jest.mock('@/lib/authenticatedFetch', () => ({
  useAuthFetch: () => ({ authenticatedFetch: jest.fn() }),
}));

jest.mock('@/providers', () => {
  const stableTenant = { officeId: 'office-1' };
  return {
    useTenant: () => ({
      tenant: stableTenant,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    }),
  };
});

describe('useBlueprintStory — stable subscription under authenticatedFetch churn', () => {
  beforeEach(() => {
    _resetBlueprintStoryRegistryForTests();
    mockGetStory.mockReset().mockResolvedValue({
      project_id: 'p1',
      mean_confidence: 0.8,
      truth_distribution: {
        observed: 0, derived: 0, field_confirmed: 0, vendor_confirmed: 0,
        permit_confirmed: 0, assumed: 0, missing: 0,
      },
      phases: [],
      updated_at: '2026-05-22T00:00:00Z',
      status: 'done',
    });
    mockGetAssemblies.mockReset().mockResolvedValue([]);
    mockGetMaterials.mockReset().mockResolvedValue([]);
    mockGetMissingInputs.mockReset().mockResolvedValue([]);
  });

  it('does NOT re-fetch when authenticatedFetch identity changes across renders', async () => {
    // Mount the hook and let the first fetch settle.
    const { rerender } = renderHook(() => useBlueprintStory('p1'));
    // Force a microtask flush so the initial fetch resolves.
    await act(async () => {
      await Promise.resolve();
    });
    const initialFetchCount = mockGetStory.mock.calls.length;
    expect(initialFetchCount).toBeGreaterThanOrEqual(1);

    // Force several re-renders. Each render asks useAuthFetch for a fresh
    // function (per the mock above), simulating session-refresh churn.
    rerender({});
    rerender({});
    rerender({});
    await act(async () => {
      await Promise.resolve();
    });

    // Critical assertion: no additional fetches were issued. Pre-hotfix this
    // count would balloon (or React would crash with #300 before we got here).
    expect(mockGetStory.mock.calls.length).toBe(initialFetchCount);
  });
});
