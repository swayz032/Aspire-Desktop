/**
 * useBlueprintProject — DEPRECATED stub.
 *
 * Superseded by `useBlueprintProjectPoll` in Wave 6.5. Kept as a thin
 * re-export for any straggler call-sites — delete after Wave 7.
 */
import { useMemo } from 'react';
import type { BlueprintProject, BlueprintSheetRead, StageProgress } from '@/lib/api/blueprintsApi';

export interface UseBlueprintProjectResult {
  project: BlueprintProject | null;
  sheets: BlueprintSheetRead[];
  stageProgress: StageProgress;
  isLoading: boolean;
  error: { code: string; message: string } | null;
  isPolling: boolean;
}

const EMPTY_STAGE: StageProgress = {
  ingest: 'pending',
  classify: 'pending',
  see: 'pending',
  reason: 'pending',
  procure: 'pending',
};

export function useBlueprintProject(_projectId: string | null): UseBlueprintProjectResult {
  return useMemo(
    () => ({
      project: null,
      sheets: [],
      stageProgress: EMPTY_STAGE,
      isLoading: false,
      error: null,
      isPolling: false,
    }),
    [],
  );
}
