/**
 * Blueprint Upload Store — Wave 6A + Wave 11m persistence patch.
 *
 * Tiny module-level listener-based store (matches the uiStore pattern). The
 * Plans & Photos tab publishes its current upload state here so the Tim
 * Rail Context tab can render the pipeline status, discipline counts,
 * and last-upload metadata without a prop-drilled provider.
 *
 * Wave 11m: NOW PERSISTED to localStorage so the in-flight projectId
 * survives:
 *   - page reloads / hard refreshes
 *   - tab/navigation thrash (Expo Router can unmount + remount routes)
 *   - any sequence that re-initializes the module
 *
 * Without persistence the user was seeing "No sheets yet" mid-flight
 * because state was being wiped between upload and poll. The `file`
 * reference cannot be serialized — it is intentionally dropped on
 * restore (file is for retry-from-failure-card only; restored sessions
 * fall back to "Start over" if they hit a failure).
 *
 * Law #6: state is wiped on suite_id change (via reset).
 * Law #7: store is a render bus only — no decisions, no side-effects.
 */
import { useEffect, useState } from 'react';
import type { UploadBlueprintResponse, StageProgress } from '@/lib/api/blueprintsApi';
import type { UploadPhase } from '@/hooks/useBlueprintUpload';

const STORAGE_KEY = 'aspire.blueprint.upload.v1';

/**
 * Persist the serializable fields of the snapshot. Skips `file` (a browser
 * File object is not safely JSON-serializable). Wrapped in try/catch so a
 * full localStorage quota or SSR environment never throws.
 */
function _persist(snap: BlueprintUploadSnapshot): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const { file, ...persistable } = snap;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // Quota exceeded or storage unavailable — best effort, swallow.
  }
}

function _readPersisted(): Partial<BlueprintUploadSnapshot> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BlueprintUploadSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

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
  /**
   * Retained File reference so the canvas failure card can re-upload the
   * same file on retry without forcing the user to drop it again. Kept
   * for the entire lifecycle (idle → processing → failed → retry). Wiped
   * by `resetBlueprintUpload()` and replaced on each new `upload(file)`
   * call. The browser-native `File` object is structurally cheap (a
   * reference, not a copy) so retaining it has no real memory cost.
   */
  file: File | null;
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
  file: null,
};

// Wave 11m: restore persisted state on module load (before any subscriber).
// The restored snapshot may have stale `phase` (e.g. 'ingesting') from a
// previous session — that is INTENTIONAL. The poll hook (useBlueprintProjectPoll)
// runs against the restored projectId, sees terminal stages, and updates the
// UI accordingly. Worst case: user sees a brief flash of stale phase before
// the live poll lands, which is far better than "No sheets yet" forever.
const _persisted = _readPersisted();
let state: BlueprintUploadSnapshot = _persisted
  ? { ...INITIAL, ...(_persisted as BlueprintUploadSnapshot), file: null }
  : INITIAL;
const listeners = new Set<(snap: BlueprintUploadSnapshot) => void>();

function emit(): void {
  _persist(state);
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
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best effort
    }
  }
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
