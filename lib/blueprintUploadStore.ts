/**
 * Blueprint Upload Store — Wave 6A.
 *
 * Tiny module-level listener-based store (matches the uiStore pattern). The
 * Plans & Photos tab publishes its current upload state here so the Tim
 * Rail Context tab can render the pipeline status, discipline counts,
 * and last-upload metadata without a prop-drilled provider.
 *
 * Law #6: state is wiped on suite_id change (via reset). Nothing persists
 * to localStorage — this is ephemeral session state only.
 *
 * Law #7: store is a render bus only — no decisions, no side-effects.
 */
import { useEffect, useState } from 'react';
import type { UploadBlueprintResponse, StageProgress } from '@/lib/api/blueprintsApi';
import type { UploadPhase } from '@/hooks/useBlueprintUpload';

export interface BlueprintUploadSnapshot {
  phase: UploadPhase;
  filename: string | null;
  uploadedAt: number | null;
  response: UploadBlueprintResponse | null;
  stageProgress: StageProgress;
  error: { code: string; message: string } | null;
  /** 0-1 upload ratio (only meaningful during reading/uploading). */
  uploadRatio: number;
  /** Epoch ms when the current busy run started; null when idle/done/error. */
  startedAtMs: number | null;
  /**
   * Wave 6.5 — Project ID once INGEST succeeds. Drives `useBlueprintProjectPoll`
   * so the Tim Rail Context tab can fetch live sheets / counts / revision
   * chain while SEE / REASON / PROCURE complete asynchronously.
   */
  projectId: string | null;
}

const INITIAL_STAGE: StageProgress = {
  ingest: 'pending',
  classify: 'pending',
  see: 'pending',
  reason: 'pending',
  procure: 'pending',
};

const INITIAL: BlueprintUploadSnapshot = {
  phase: 'idle',
  filename: null,
  uploadedAt: null,
  response: null,
  stageProgress: INITIAL_STAGE,
  error: null,
  uploadRatio: 0,
  startedAtMs: null,
  projectId: null,
};

let state: BlueprintUploadSnapshot = INITIAL;
const listeners = new Set<(snap: BlueprintUploadSnapshot) => void>();

function emit(): void {
  listeners.forEach((l) => l(state));
}

export function getBlueprintUpload(): BlueprintUploadSnapshot {
  return state;
}

export function setBlueprintUpload(
  patch: Partial<BlueprintUploadSnapshot>,
): void {
  state = { ...state, ...patch };
  emit();
}

export function resetBlueprintUpload(): void {
  state = INITIAL;
  emit();
}

/** Subscribe + re-render hook for the Tim Rail Context payload. */
export function useBlueprintUploadSnapshot(): BlueprintUploadSnapshot {
  const [snap, setSnap] = useState<BlueprintUploadSnapshot>(state);
  useEffect(() => {
    const l = (next: BlueprintUploadSnapshot): void => setSnap(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}
