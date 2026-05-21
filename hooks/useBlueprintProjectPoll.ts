/**
 * useBlueprintProjectPoll — Wave 6.5.
 *
 * Live polling loop for the Plans & Photos canvas + the Tim Rail Context tab.
 * Fetches:
 *   - GET /api/v1/blueprints/projects/:id           (project + stage_progress + sheet_count)
 *   - GET /api/v1/blueprints/projects/:id/sheets?active_only=false   (all sheets incl. chain)
 *   - GET /api/v1/blueprints/projects/:id/status    (lightweight counts for polling)
 *
 * Cadence:
 *   - 2s while ANY of the 5 pipeline stages is `running`.
 *   - 10s after PROCURE complete (idle health-check tail).
 *   - Stops entirely when the project errors out or all stages reach terminal.
 *
 * Cancellation:
 *   - Aborts in-flight requests + clears the timer on unmount.
 *   - Aborts + restarts when `projectId` changes.
 *
 * Wave 6.5 deliverables (Wave 6.5 plan §1):
 *   - {project, sheets, revisions, stageProgress, refresh()} surface
 *   - merges with `blueprintUploadStore` so the optimistic upload state
 *     transitions cleanly to live polled state (no UI flash).
 *
 * Law compliance:
 *   - Law #6: backend route enforces suite_id from JWT — client never sets it.
 *   - Law #7: hook is a render bus — no autonomous decisions.
 *   - Law #9: never logs response bodies; only logs error code + status.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  getProject,
  getProjectStatus,
  listSheets,
  BlueprintsApiError,
  STAGE_TERMINAL,
  type BlueprintFailureSummary,
  type BlueprintProject,
  type BlueprintProjectStatusResponse,
  type BlueprintSheetRead,
  type StageKey,
  type StageProgress,
  type StageStatus,
} from '@/lib/api/blueprintsApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single revision chain — predecessors -> current -> any addenda that
 * superseded the current. Derived client-side from the `supersedes_id` graph
 * across the full (active_only=false) sheet list.
 */
export interface RevisionChain {
  /** UUID of the chain's current/active sheet (the one with no successor). */
  currentSheetId: string;
  /** Ordered predecessors → ... → current. Length 2+ when a chain exists. */
  sheets: BlueprintSheetRead[];
}

export interface UseBlueprintProjectPollResult {
  project: BlueprintProject | null;
  sheets: BlueprintSheetRead[];
  /** Map: currentSheetId -> chain (only includes sheets that have ancestors). */
  revisions: RevisionChain[];
  stageProgress: StageProgress;
  status: BlueprintProjectStatusResponse | null;
  /** True while at least one fetch is in flight. */
  isLoading: boolean;
  /**
   * True until the first successful poll response is received for the current
   * projectId.  Pass this (not `isLoading`) to SheetThumbnailGrid.isLoading so
   * the shimmer only renders on initial mount, never between subsequent polls.
   */
  isFirstLoad: boolean;
  /** True while the periodic timer is active. */
  isPolling: boolean;
  error: { code: string; message: string } | null;
  /**
   * True when ANY stage in stage_progress has reached the `error` terminal
   * state. Polling stops as soon as this flips true — there is no point
   * burning requests on a dead project. Mirrored to the canvas so the
   * `<BlueprintFailureCard />` mounts in place of the shimmer.
   */
  hasFailed: boolean;
  /**
   * First stage (in pipeline order) found in the `error` state, or `null`
   * when nothing has failed. Drives the per-stage copy on the failure card
   * and the red error icon in the Tim Rail Context pipeline timeline.
   */
  failedStage: StageKey | null;
  /**
   * Structured failure detail pulled from the project / status response.
   * MAY be `null` even when `hasFailed === true` if the backend hasn't yet
   * emitted structured error fields — the UI renders generic copy in that
   * case (graceful degradation contract).
   */
  failureSummary: BlueprintFailureSummary | null;
  /**
   * Wave 9e (P2-8) — timestamp each stage transitioned to 'ok' (terminal-success).
   * Downstream hooks (useBlueprintStory, useTakeoffMaterials, useTakeoffSymbols —
   * not in this hook's scope) SHOULD read these values and include them in
   * their `useEffect` dependency arrays so they refetch when their upstream
   * stage completes. Currently set on first observation of a stage in 'ok';
   * remains stable thereafter (no thrash on subsequent successful polls).
   *
   * TODO (Wave 9f): wire downstream hooks to consume this signal.
   */
  stageCompletedAt: Record<StageKey, number | null>;
  /** Force an out-of-band refresh (e.g. after a manual action). */
  refresh: () => void;
}

const EMPTY_STAGE: StageProgress = {
  ingest: 'pending',
  classify: 'pending',
  see: 'pending',
  reason: 'pending',
  procure: 'pending',
};

const STAGE_KEYS = ['ingest', 'classify', 'see', 'reason', 'procure'] as const;

// ---------------------------------------------------------------------------
// Cadence helpers
// ---------------------------------------------------------------------------

/** True when any stage is still mid-flight. */
function _isStageRunning(p: StageProgress | null): boolean {
  if (!p) return false;
  return STAGE_KEYS.some((k) => p[k] === 'running');
}

/** True when every stage has reached a terminal state. */
function _isAllTerminal(p: StageProgress | null): boolean {
  if (!p) return false;
  return STAGE_KEYS.every((k) => {
    const s: StageStatus = p[k];
    return s === 'ok' || s === 'error' || s === 'stub';
  });
}

/** True when the procure stage finished (ok|stub|error). */
function _isProcureDone(p: StageProgress | null): boolean {
  if (!p) return false;
  const s: StageStatus = p.procure;
  return s === 'ok' || s === 'stub' || s === 'error';
}

/**
 * Return the first stage (in canonical pipeline order) that has reached the
 * `error` terminal state, or `null` if none have failed. Pipeline order is
 * meaningful here: a failure in INGEST should always win over a downstream
 * stage that happens to also be marked `error`, because the upstream root
 * cause is what we want to surface on the failure card.
 */
function _firstFailedStage(p: StageProgress | null): StageKey | null {
  if (!p) return null;
  for (const k of STAGE_KEYS) {
    if (p[k] === 'error') return k;
  }
  return null;
}

/**
 * Wave 9e (P1-2) — decide whether to abort the poll loop on a given error.
 * Returns a user-facing error code when we should stop, or `null` to keep
 * polling. Stop conditions:
 *   - 401 / 403 immediately (auth dead — won't recover via retry)
 *   - 410 immediately (gone)
 *   - any 5xx after SERVER_ERROR_CEILING consecutive failures
 *   - any kind after ERROR_CEILING consecutive failures (~10s at 2s)
 */
export function _shouldStopOnError(
  err: BlueprintsApiError | null,
  consecutiveCount: number,
  errorCeiling: number,
  serverErrorCeiling: number,
): 'POLL_AUTH_LOST' | 'POLL_NOT_FOUND' | 'POLL_SERVER_DOWN' | 'POLL_LOST' | null {
  if (err) {
    if (err.status === 401 || err.status === 403) return 'POLL_AUTH_LOST';
    if (err.status === 410) return 'POLL_NOT_FOUND';
    if (err.status >= 500 && consecutiveCount >= serverErrorCeiling) {
      return 'POLL_SERVER_DOWN';
    }
  }
  if (consecutiveCount >= errorCeiling) return 'POLL_LOST';
  return null;
}

/** Pick the next poll interval in ms. Null = stop polling. */
function _nextIntervalMs(p: StageProgress | null): number | null {
  if (!p) return 2_000; // still booting — try again soon
  // Fail-closed: once ANY stage has errored, stop polling. Burning requests
  // on a dead project is what made the user stare at a spinner for 8 minutes.
  if (_firstFailedStage(p) !== null) return null;
  if (_isStageRunning(p)) return 2_000;
  if (_isProcureDone(p)) return 10_000;
  if (_isAllTerminal(p)) return null; // all done, no procure expected
  return 2_000;
}

// ---------------------------------------------------------------------------
// Revision chain derivation
// ---------------------------------------------------------------------------

/**
 * Build the per-sheet chains from a flat list. The backend gives us
 * `supersedes_id` = "predecessor". A "current" sheet has no successor (i.e.
 * no other sheet's supersedes_id points to it). Walk back along predecessors
 * to produce an ordered chain.
 */
export function deriveRevisionChains(
  sheets: BlueprintSheetRead[],
): RevisionChain[] {
  if (sheets.length === 0) return [];

  const byId = new Map<string, BlueprintSheetRead>();
  const successors = new Set<string>();
  for (const s of sheets) {
    byId.set(s.id, s);
    if (s.supersedes_id) successors.add(s.supersedes_id);
  }

  // A "current" sheet has at least one predecessor (`supersedes_id` set) AND
  // is itself not a predecessor (no other sheet points at it). Build chains.
  const chains: RevisionChain[] = [];
  for (const s of sheets) {
    if (successors.has(s.id)) continue; // not a leaf — keep walking from successors
    if (!s.supersedes_id) continue; // standalone original — no chain to show

    // Walk back along supersedes_id
    const trail: BlueprintSheetRead[] = [s];
    let cursor: string | null = s.supersedes_id;
    const seen = new Set<string>([s.id]);
    while (cursor && !seen.has(cursor)) {
      const prev = byId.get(cursor);
      if (!prev) break;
      trail.unshift(prev);
      seen.add(cursor);
      cursor = prev.supersedes_id ?? null;
    }
    if (trail.length >= 2) {
      chains.push({ currentSheetId: s.id, sheets: trail });
    }
  }
  return chains;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBlueprintProjectPoll(
  projectId: string | null,
): UseBlueprintProjectPollResult {
  const { authenticatedFetch } = useAuthFetch();
  // Wave 18f fix: useTenant() returns {tenant, isLoading, error, refresh}.
  const tenantCtx = useTenant();
  const officeId = tenantCtx.tenant?.officeId ?? '';

  const [project, setProject] = useState<BlueprintProject | null>(null);
  const [sheets, setSheets] = useState<BlueprintSheetRead[]>([]);
  const [statusResp, setStatusResp] = useState<BlueprintProjectStatusResponse | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  // True until the very first successful poll response is received for the
  // current projectId.  Resets to true whenever projectId changes.  Controls
  // whether SheetThumbnailGrid renders the shimmer (first load) vs. retaining
  // the last-known data between subsequent polls.
  const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);
  // Wave 9e (P2-8) — per-stage completion timestamps. Sticky once set; reset
  // to all-null when projectId changes (handled in the reset effect below).
  const [stageCompletedAt, setStageCompletedAt] = useState<
    Record<StageKey, number | null>
  >({
    ingest: null,
    classify: null,
    see: null,
    reason: null,
    procure: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef<boolean>(true);
  // Tick counter forces an immediate re-fetch when `refresh()` is called.
  const [tick, setTick] = useState<number>(0);

  // Cleanup on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Reset state when projectId changes.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setProject(null);
    setSheets([]);
    setStatusResp(null);
    setError(null);
    setIsLoading(false);
    setIsPolling(false);
    // Mark as first load so shimmer shows immediately for the new project.
    setIsFirstLoad(true);
    setStageCompletedAt({
      ingest: null,
      classify: null,
      see: null,
      reason: null,
      procure: null,
    });
  }, [projectId]);

  // Main fetch loop.
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPolling(true);

    // Wave 9e (P1-2): consecutive-error counter governs the give-up rule.
    // Reset to 0 on any successful response; increment in catch; stop
    // polling after the configured ceiling — see `_shouldStopOnError`.
    let consecutiveErrorCount = 0;
    const ERROR_CEILING = 5; // ~10s at 2s cadence
    const SERVER_ERROR_CEILING = 3; // 5xx ride-out before giving up

    const runOnce = async (): Promise<void> => {
      if (cancelled) return;
      setIsLoading(true);
      // Freshest snapshot of the just-fetched project, captured for the
      // `finally` cadence calc (P0-8 — avoid stale `project` closure read).
      let freshProject: BlueprintProject | null = null;
      try {
        // Wave 9e (P1-4): use allSettled so a transient /sheets 500 does NOT
        // revert the visible grid. Each settled value is applied independently.
        const [projRes, sheetRes, statRes] = await Promise.allSettled([
          getProject(authenticatedFetch, projectId, officeId, controller.signal),
          listSheets(
            authenticatedFetch,
            projectId,
            officeId,
            { activeOnly: false }, // need full chain for revision UI
            controller.signal,
          ),
          getProjectStatus(authenticatedFetch, projectId, officeId, controller.signal),
        ]);
        if (cancelled || !mountedRef.current) return;

        let projOk = false;
        let projForError: BlueprintsApiError | null = null;

        if (projRes.status === 'fulfilled') {
          freshProject = projRes.value;
          setProject(projRes.value);
          projOk = true;
        } else if (projRes.reason instanceof BlueprintsApiError) {
          projForError = projRes.reason;
        }

        let sheetsOk = false;
        if (sheetRes.status === 'fulfilled') {
          const sheetList = sheetRes.value;
          // Only update sheets when the new list is non-empty OR when the
          // pipeline has reached a terminal ingest state (Wave 9e P0-9:
          // compare against normalized values, not the pre-normalized
          // backend strings).
          const newIngestState: StageStatus =
            (freshProject?.stage_progress?.ingest as StageStatus | undefined) ?? 'pending';
          const newIngestTerminal = STAGE_TERMINAL.has(newIngestState);
          if (sheetList.length > 0 || newIngestTerminal) {
            setSheets(sheetList);
          }
          sheetsOk = true;
        }

        let statOk = false;
        if (statRes.status === 'fulfilled') {
          setStatusResp(statRes.value);
          statOk = true;
        }

        if (projOk || sheetsOk || statOk) {
          // At least one succeeded — reset error counter + clear surfaced error.
          consecutiveErrorCount = 0;
          setError(null);
          setIsFirstLoad(false);
        } else {
          // All three failed. Bubble first error to UI; decide whether to stop.
          consecutiveErrorCount += 1;
          const firstErr =
            projRes.status === 'rejected'
              ? projRes.reason
              : sheetRes.status === 'rejected'
                ? sheetRes.reason
                : statRes.status === 'rejected'
                  ? statRes.reason
                  : null;
          const stopCode = _shouldStopOnError(
            projForError ?? (firstErr instanceof BlueprintsApiError ? firstErr : null),
            consecutiveErrorCount,
            ERROR_CEILING,
            SERVER_ERROR_CEILING,
          );
          if (stopCode) {
            setError({
              code: stopCode,
              message:
                stopCode === 'POLL_AUTH_LOST'
                  ? 'Session expired. Reload and sign in again.'
                  : stopCode === 'POLL_NOT_FOUND'
                    ? 'Project no longer exists.'
                    : stopCode === 'POLL_SERVER_DOWN'
                      ? 'Server unavailable. Try refreshing in a moment.'
                      : 'Lost contact with the server. Try refreshing.',
            });
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
            setIsPolling(false);
            setIsLoading(false);
            return; // skip the finally re-schedule
          }
          if (firstErr instanceof BlueprintsApiError) {
            setError({ code: firstErr.code, message: firstErr.message });
          } else if (firstErr instanceof Error) {
            setError({ code: 'NETWORK_ERROR', message: firstErr.message });
          } else {
            setError({ code: 'NETWORK_ERROR', message: 'Network error.' });
          }
        }
      } catch (err) {
        // Defensive — allSettled itself should never throw, but keep this
        // branch so an unexpected synchronous throw doesn't break cadence.
        if (cancelled || !mountedRef.current) return;
        if (controller.signal.aborted) return;
        consecutiveErrorCount += 1;
        if (err instanceof BlueprintsApiError) {
          setError({ code: err.code, message: err.message });
        } else if (err instanceof Error) {
          setError({ code: 'NETWORK_ERROR', message: err.message });
        } else {
          setError({ code: 'NETWORK_ERROR', message: 'Network error.' });
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
          // Schedule next tick based on the freshest stage state — P0-8 fix.
          // Read from `freshProject` (the just-fetched local), NOT from the
          // closure `project` which is one cycle stale.
          const nextMs = _nextIntervalMs(freshProject?.stage_progress ?? null);
          if (timerRef.current) clearTimeout(timerRef.current);
          if (nextMs == null) {
            setIsPolling(false);
          } else {
            timerRef.current = setTimeout(runOnce, nextMs);
          }
        }
      }
    };

    // Kick off immediately.
    void runOnce();

    return () => {
      cancelled = true;
      controller.abort();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // Re-run when projectId or refresh tick changes; officeId is stable per tenant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tick, authenticatedFetch, officeId]);

  // Re-evaluate cadence whenever stage_progress shifts so the very first
  // "running -> ok" transition flips us to the 10s tail without waiting an
  // extra 2s tick. (The above runOnce reads `project?.stage_progress` which
  // is stale-by-one-cycle; that's fine for the SLA but this effect smooths
  // the boundary.)
  useEffect(() => {
    if (!projectId) return;
    const sp = project?.stage_progress ?? null;
    const nextMs = _nextIntervalMs(sp);
    if (nextMs == null) {
      // Tear down the in-flight controller too — `_nextIntervalMs` returns
      // null on hard failure, so we want to ensure the current request and
      // any pending re-fetch are both cancelled.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (_firstFailedStage(sp) !== null) {
        abortRef.current?.abort();
      }
      setIsPolling(false);
    }
  }, [project?.stage_progress, projectId]);

  const revisions = useMemo(() => deriveRevisionChains(sheets), [sheets]);
  const stageProgress = project?.stage_progress ?? EMPTY_STAGE;

  // Wave 9e (P2-8) — stamp stageCompletedAt the first time each stage hits
  // 'ok'. Sticky: once set, never reset (the value is the moment of completion).
  useEffect(() => {
    const sp = project?.stage_progress;
    if (!sp) return;
    setStageCompletedAt((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of STAGE_KEYS) {
        if (sp[k] === 'ok' && next[k] == null) {
          next[k] = Date.now();
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [project?.stage_progress]);

  // ─── Failure derivation ──────────────────────────────────────────────
  // hasFailed flips true as soon as ANY stage in stage_progress is 'error'.
  // failedStage picks the FIRST failed stage in canonical pipeline order so
  // upstream root causes win over downstream cascading errors. failureSummary
  // prefers status response (richer) then project. Both MAY be null on older
  // backends — UI must degrade gracefully.
  const failedStage = useMemo(
    () => _firstFailedStage(project?.stage_progress ?? null),
    [project?.stage_progress],
  );
  const hasFailed = failedStage !== null;
  const failureSummary: BlueprintFailureSummary | null =
    statusResp?.failure_summary ?? project?.failure_summary ?? null;

  return {
    project,
    sheets,
    revisions,
    stageProgress,
    status: statusResp,
    isLoading,
    isFirstLoad,
    isPolling,
    error,
    hasFailed,
    failedStage,
    failureSummary,
    stageCompletedAt,
    refresh,
  };
}
