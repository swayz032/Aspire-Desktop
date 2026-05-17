/**
 * useBlueprintProject — Wave 6.5 STUB.
 *
 * Wave 6A leaves this as a thin scaffold so call-sites can import the hook
 * shape today. The full implementation polls
 * `GET /api/v1/blueprints/projects/:id/status` at 2s intervals while any
 * stage is still in-flight, and fans the project + sheets into the rail.
 *
 * Backend gap: GET endpoints land in Wave 2.5 (separate backend PR).
 * Once that ships, this hook gets a real fetch loop + stop-on-complete logic.
 */
import { useMemo } from 'react';
import type { BlueprintProject, BlueprintSheet, StageProgress } from '@/lib/api/blueprintsApi';

export interface UseBlueprintProjectResult {
  project: BlueprintProject | null;
  sheets: BlueprintSheet[];
  stageProgress: StageProgress;
  isLoading: boolean;
  error: { code: string; message: string } | null;
  /** When true, polling will run while stages are in-flight (Wave 6.5). */
  isPolling: boolean;
}

const EMPTY_STAGE: StageProgress = {
  ingest: 'pending',
  classify: 'pending',
  see: 'pending',
  reason: 'pending',
  procure: 'pending',
};

/**
 * Wave 6A: returns an empty shape. Wave 6.5 will replace with a real fetch
 * + 2s poll loop. `projectId` is accepted today so call-sites typecheck.
 */
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
