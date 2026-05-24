/**
 * useBlueprintStory — Wave 7 + Followup B.
 *
 * Fetches the four REASON/PROCURE read endpoints in parallel for the Scope tab:
 *   - GET /api/v1/blueprints/projects/:id/story
 *   - GET /api/v1/blueprints/projects/:id/assemblies
 *   - GET /api/v1/blueprints/projects/:id/materials
 *   - GET /api/v1/blueprints/projects/:id/missing_inputs
 *
 * Polls every 2s while REASON is in_progress; stops on done/error/no-project.
 * On 404 (Wave 2.7 backend not yet deployed), degrades to an empty state with
 * `backendDeployed=false` — UI surfaces the deferred-backend banner.
 *
 * Followup B (dedupe): ScopeTab + ScopeContextPayload + TimRailContextTab all
 * mount this hook for the SAME projectId on the Scope route. To avoid
 * 3× redundant fetch fan-out + 3× poll loops, this module owns a singleton
 * registry keyed by `${officeId}:${projectId}`. All mounts subscribe via
 * `useSyncExternalStore` and share a single fetch + a single poll timer.
 * The first subscriber kicks off the fetch; the last unsubscriber aborts +
 * clears the poll timer (but the slice stays cached for fast remount).
 *
 * Law compliance:
 *   Law #6 — `officeId` derives from the tenant context; never a user input.
 *   Law #7 — pure data hook: no decisions, no side-effects beyond setState.
 *   Law #9 — fetch errors logged with code only, never request bodies.
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  BlueprintsApiError,
  getAssemblies,
  getMaterials,
  getMissingInputs,
  getStory,
  type BlueprintAssembly,
  type BlueprintMaterial,
  type BlueprintMissingInput,
  type BlueprintStory,
  type TruthClass,
} from '@/lib/api/blueprintsApi';
// Story Mode v2: chapter-shaped projection over the legacy story.
import { adaptLegacyStoryToV2, type BlueprintStoryV2 } from '@/lib/api/blueprintsStoryV2';

export interface UseBlueprintStoryResult {
  story: BlueprintStory | null;
  /** Story Mode v2 projection of `story` via `adaptLegacyStoryToV2`. Null
   *  iff `story` is null. Sheets are empty until Drew emits chapters[]. */
  storyV2: BlueprintStoryV2 | null;
  assemblies: BlueprintAssembly[];
  materials: BlueprintMaterial[];
  missingInputs: BlueprintMissingInput[];
  isLoading: boolean;
  isPolling: boolean;
  /** True iff backend Wave 2.7 endpoints are reachable (not 404).
   *  Drives the "Story rendering requires Wave 2.7 backend reads" banner. */
  backendDeployed: boolean;
  error: { code: string; message: string } | null;
  /** Manually refetch all four endpoints (e.g. after resolveMissingInput). */
  refetch: () => Promise<void>;
}

const POLL_MS = 2000;

export const EMPTY_TRUTH_DIST: Record<TruthClass, number> = {
  observed: 0,
  derived: 0,
  assumed: 0,
  missing: 0,
  field_confirmed: 0,
  vendor_confirmed: 0,
  permit_confirmed: 0,
};

// ---------------------------------------------------------------------------
// Module-level singleton registry — one fetch loop + one poll timer per
// (officeId, projectId) key, shared across all hook mounts.
// ---------------------------------------------------------------------------

interface StorySlice {
  story: BlueprintStory | null;
  assemblies: BlueprintAssembly[];
  materials: BlueprintMaterial[];
  missingInputs: BlueprintMissingInput[];
  isLoading: boolean;
  backendDeployed: boolean;
  error: { code: string; message: string } | null;
}

type AuthFetch = ReturnType<typeof useAuthFetch>['authenticatedFetch'];

interface RegistryEntry {
  slice: StorySlice;
  listeners: Set<() => void>;
  abortController: AbortController | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  authenticatedFetch: AuthFetch | null;
}

const registry = new Map<string, RegistryEntry>();

const EMPTY_SLICE: StorySlice = {
  story: null,
  assemblies: [],
  materials: [],
  missingInputs: [],
  isLoading: false,
  backendDeployed: true,
  error: null,
};

function keyFor(officeId: string, projectId: string | null): string | null {
  return projectId ? `${officeId}:${projectId}` : null;
}

function getOrCreateEntry(key: string): RegistryEntry {
  let e = registry.get(key);
  if (!e) {
    e = {
      slice: { ...EMPTY_SLICE },
      listeners: new Set(),
      abortController: null,
      pollTimer: null,
      authenticatedFetch: null,
    };
    registry.set(key, e);
  }
  return e;
}

function emit(key: string): void {
  const e = registry.get(key);
  if (e) {
    for (const l of e.listeners) l();
  }
}

function updateSlice(key: string, patch: Partial<StorySlice>): void {
  const e = registry.get(key);
  if (!e) return;
  e.slice = { ...e.slice, ...patch };
  emit(key);
}

async function fetchAllForKey(
  key: string,
  projectId: string,
  officeId: string,
): Promise<void> {
  const e = registry.get(key);
  if (!e || !e.authenticatedFetch) return;
  e.abortController?.abort();
  const controller = new AbortController();
  e.abortController = controller;
  updateSlice(key, { isLoading: true, error: null });
  try {
    const [storyR, asmR, matR, missR] = await Promise.allSettled([
      getStory(e.authenticatedFetch, projectId, officeId, controller.signal),
      getAssemblies(e.authenticatedFetch, projectId, officeId, {}, controller.signal),
      getMaterials(e.authenticatedFetch, projectId, officeId, {}, controller.signal),
      getMissingInputs(e.authenticatedFetch, projectId, officeId, {}, controller.signal),
    ]);
    const all404 = [storyR, asmR, matR, missR].every(
      (r) =>
        r.status === 'rejected' &&
        r.reason instanceof BlueprintsApiError &&
        r.reason.status === 404,
    );
    if (all404) {
      updateSlice(key, {
        backendDeployed: false,
        story: null,
        assemblies: [],
        materials: [],
        missingInputs: [],
      });
      return;
    }
    const patch: Partial<StorySlice> = { backendDeployed: true };
    if (storyR.status === 'fulfilled') {
      patch.story = storyR.value;
    } else if (
      storyR.reason instanceof BlueprintsApiError &&
      storyR.reason.status === 404
    ) {
      patch.story = null;
    } else if (storyR.reason instanceof Error) {
      patch.error = {
        code:
          storyR.reason instanceof BlueprintsApiError
            ? storyR.reason.code
            : 'STORY_FETCH_FAILED',
        message: storyR.reason.message,
      };
    }
    patch.assemblies = asmR.status === 'fulfilled' ? asmR.value : [];
    patch.materials = matR.status === 'fulfilled' ? matR.value : [];
    patch.missingInputs = missR.status === 'fulfilled' ? missR.value : [];
    updateSlice(key, patch);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    updateSlice(key, {
      error: {
        code: err instanceof BlueprintsApiError ? err.code : 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : 'Unknown fetch error',
      },
    });
  } finally {
    updateSlice(key, { isLoading: false });
    // If REASON is still in_progress, schedule the next poll. Only poll while
    // someone is still subscribed — otherwise the unsubscribe path would have
    // had to chase down a stale timer.
    const cur = registry.get(key);
    if (cur && cur.slice.story?.status === 'in_progress' && cur.listeners.size > 0) {
      if (cur.pollTimer) clearTimeout(cur.pollTimer);
      cur.pollTimer = setTimeout(() => {
        void fetchAllForKey(key, projectId, officeId);
      }, POLL_MS);
    }
  }
}

function subscribeToKey(
  key: string,
  projectId: string,
  officeId: string,
  authenticatedFetch: AuthFetch,
  listener: () => void,
): () => void {
  const e = getOrCreateEntry(key);
  // Latest authenticatedFetch wins (tenant refresh case).
  e.authenticatedFetch = authenticatedFetch;
  const wasEmpty = e.listeners.size === 0;
  e.listeners.add(listener);
  if (wasEmpty) {
    void fetchAllForKey(key, projectId, officeId);
  }
  return () => {
    e.listeners.delete(listener);
    if (e.listeners.size === 0) {
      e.abortController?.abort();
      e.abortController = null;
      if (e.pollTimer) {
        clearTimeout(e.pollTimer);
        e.pollTimer = null;
      }
      // Keep the slice cached in the registry — a fast remount within
      // the same session reuses the data and triggers a refresh fetch
      // only if needed. Do NOT delete the key from the map.
    }
  };
}

/**
 * Test helper — wipe the registry so tests don't leak state across
 * `describe` blocks. The underscore prefix signals "not for production use".
 */
export function _resetBlueprintStoryRegistryForTests(): void {
  for (const e of registry.values()) {
    e.abortController?.abort();
    if (e.pollTimer) clearTimeout(e.pollTimer);
  }
  registry.clear();
}

// ---------------------------------------------------------------------------
// React surface — useSyncExternalStore subscription over the shared registry.
// ---------------------------------------------------------------------------

export function useBlueprintStory(projectId: string | null): UseBlueprintStoryResult {
  const { authenticatedFetch } = useAuthFetch();
  // Wave 18f fix: useTenant() returns {tenant, isLoading, error, refresh}.
  const tenantCtx = useTenant();
  const officeId = tenantCtx.tenant?.officeId ?? '';
  const key = keyFor(officeId, projectId);

  // HOTFIX 2026-05-23 — `authenticatedFetch` is recreated whenever the
  // Supabase session refreshes (its useCallback deps include session/suiteId).
  // If we include it in the subscribe dep array, useSyncExternalStore tears
  // down + re-subscribes on every session tick → fetch → emit → re-render →
  // React error #300 (too many re-renders). Hold it in a ref so the subscribe
  // callback stays referentially stable; subscribeToKey writes the latest
  // function into the registry entry, so live fetches always use the freshest
  // auth-fetch impl.
  const authenticatedFetchRef = useRef(authenticatedFetch);
  authenticatedFetchRef.current = authenticatedFetch;

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!key || !projectId) return () => {};
      return subscribeToKey(key, projectId, officeId, authenticatedFetchRef.current, listener);
    },
    [key, projectId, officeId],
  );

  const getSnapshot = useCallback(
    (): StorySlice => (key ? (registry.get(key)?.slice ?? EMPTY_SLICE) : EMPTY_SLICE),
    [key],
  );

  const slice = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refetch = useCallback(async (): Promise<void> => {
    if (key && projectId) await fetchAllForKey(key, projectId, officeId);
  }, [key, projectId, officeId]);

  // Story Mode v2 surface. Sheets are intentionally empty — the hook does not
  // currently poll sheets, and coverage reads sheets_total: 0 by design until
  // Drew backend emits real chapters[] (see plan §3.1).
  const storyV2 = useMemo<BlueprintStoryV2 | null>(
    () => adaptLegacyStoryToV2(slice.story, []),
    [slice.story],
  );

  const isPolling = slice.story?.status === 'in_progress';

  return {
    story: slice.story,
    storyV2,
    assemblies: slice.assemblies,
    materials: slice.materials,
    missingInputs: slice.missingInputs,
    isLoading: slice.isLoading,
    isPolling,
    backendDeployed: slice.backendDeployed,
    error: slice.error,
    refetch,
  };
}
