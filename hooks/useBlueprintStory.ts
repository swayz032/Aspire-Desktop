/**
 * useBlueprintStory — Wave 7.
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
 * Law compliance:
 *   Law #6 — `officeId` derives from the tenant context; never a user input.
 *   Law #7 — pure data hook: no decisions, no side-effects beyond setState.
 *   Law #9 — fetch errors logged with code only, never request bodies.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface UseBlueprintStoryResult {
  story: BlueprintStory | null;
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

export function useBlueprintStory(projectId: string | null): UseBlueprintStoryResult {
  const { authenticatedFetch } = useAuthFetch();
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';

  const [story, setStory] = useState<BlueprintStory | null>(null);
  const [assemblies, setAssemblies] = useState<BlueprintAssembly[]>([]);
  const [materials, setMaterials] = useState<BlueprintMaterial[]>([]);
  const [missingInputs, setMissingInputs] = useState<BlueprintMissingInput[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendDeployed, setBackendDeployed] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async (): Promise<void> => {
    if (!projectId || !officeId) {
      setStory(null);
      setAssemblies([]);
      setMaterials([]);
      setMissingInputs([]);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const [storyResult, assembliesResult, materialsResult, missingResult] =
        await Promise.allSettled([
          getStory(authenticatedFetch, projectId, officeId, controller.signal),
          getAssemblies(authenticatedFetch, projectId, officeId, {}, controller.signal),
          getMaterials(authenticatedFetch, projectId, officeId, {}, controller.signal),
          getMissingInputs(authenticatedFetch, projectId, officeId, {}, controller.signal),
        ]);

      // 404 across-the-board means Wave 2.7 backend hasn't shipped yet.
      const all404 = [storyResult, assembliesResult, materialsResult, missingResult].every(
        (r) =>
          r.status === 'rejected' &&
          r.reason instanceof BlueprintsApiError &&
          r.reason.status === 404,
      );

      if (all404) {
        setBackendDeployed(false);
        setStory(null);
        setAssemblies([]);
        setMaterials([]);
        setMissingInputs([]);
        return;
      }

      setBackendDeployed(true);

      if (storyResult.status === 'fulfilled') {
        setStory(storyResult.value);
      } else if (
        storyResult.reason instanceof BlueprintsApiError &&
        storyResult.reason.status === 404
      ) {
        setStory(null);
      } else if (storyResult.reason instanceof Error) {
        setError({
          code:
            storyResult.reason instanceof BlueprintsApiError
              ? storyResult.reason.code
              : 'STORY_FETCH_FAILED',
          message: storyResult.reason.message,
        });
      }

      if (assembliesResult.status === 'fulfilled') {
        setAssemblies(assembliesResult.value);
      } else {
        setAssemblies([]);
      }

      if (materialsResult.status === 'fulfilled') {
        setMaterials(materialsResult.value);
      } else {
        setMaterials([]);
      }

      if (missingResult.status === 'fulfilled') {
        setMissingInputs(missingResult.value);
      } else {
        setMissingInputs([]);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError({
        code: e instanceof BlueprintsApiError ? e.code : 'UNKNOWN_ERROR',
        message: e instanceof Error ? e.message : 'Unknown fetch error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedFetch, officeId, projectId]);

  // Initial fetch + project_id change handler.
  useEffect(() => {
    void fetchAll();
    return () => {
      abortRef.current?.abort();
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchAll]);

  // 2s poll while REASON is in_progress.
  const isPolling = story?.status === 'in_progress';
  useEffect(() => {
    if (!isPolling) {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    pollTimerRef.current = setTimeout(() => {
      void fetchAll();
    }, POLL_MS);
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isPolling, fetchAll]);

  return {
    story,
    assemblies,
    materials,
    missingInputs,
    isLoading,
    isPolling,
    backendDeployed,
    error,
    refetch: fetchAll,
  };
}
