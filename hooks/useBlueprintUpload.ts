/**
 * useBlueprintUpload — Wave 6A.
 *
 * Owns the upload state machine for the Plans & Photos tab:
 *   idle → reading-file → uploading → ingesting → classifying → success
 *                                                            ↘ error
 *
 * Wave 6A scope:
 *   - Single-file upload (PDF / JPG / PNG / HEIC, ≤ 50 MB).
 *   - Reads the File into a Uint8Array, calls `uploadBlueprint()`, surfaces
 *     real INGEST + CLASSIFY status from the proxy response.
 *
 * Wave 6.5+:
 *   - Polling-based SEE / REASON / PROCURE status (separate hook).
 *
 * Law compliance:
 *   Law #3 — size + MIME validated before upload.
 *   Law #5 — capability token stays server-side.
 *   Law #6 — officeId/suiteId come from useTenant().
 *   Law #9 — file bytes never logged; only filename + size.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import { setBlueprintUpload, resetBlueprintUpload } from '@/lib/blueprintUploadStore';
import {
  requestSignedUpload,
  completeUpload,
  isDispatchResponse,
  BlueprintsApiError,
  MAX_UPLOAD_BYTES,
  ACCEPTED_MIME_TYPES,
  type AcceptedMimeType,
  type UploadBlueprintResponse,
  type StageProgress,
  type StageStatus,
} from '@/lib/api/blueprintsApi';

export type UploadPhase =
  | 'idle'
  | 'reading'
  | 'init'
  | 'uploading'
  | 'completing'
  | 'ingesting'
  | 'classifying'
  | 'success'
  | 'error';

export interface UploadProgress {
  /** 0-1 — only meaningful during 'reading' + 'uploading'. */
  ratio: number;
  /** Bytes read / sent so far. */
  bytesDone: number;
  /** Total bytes to send. */
  bytesTotal: number;
}

export interface UseBlueprintUploadResult {
  phase: UploadPhase;
  progress: UploadProgress;
  filename: string | null;
  response: UploadBlueprintResponse | null;
  /** Composed 5-stage progress — drives <UploadProgressInline />. Falls back
   *  to all-pending when no upload has run. */
  stageProgress: StageProgress;
  error: { code: string; message: string } | null;
  upload: (file: File) => Promise<void>;
  /**
   * Re-run `upload()` with the LAST file the user dropped. Used by the
   * canvas `<BlueprintFailureCard />` retry button. No-op when no file has
   * been retained yet (e.g. retry after a full reset, or a brand-new
   * session).
   */
  retry: () => Promise<void>;
  reset: () => void;
}

/**
 * Wave 9e (P1-1) — max time the hook will sit in `ingesting` before
 * giving up and surfacing a watchdog timeout. 10 minutes safely covers
 * INGEST (~8 min worst-case) + CLASSIFY (~2 min). Anything past this is
 * a poll silently dying — show the user a real error rather than spinning
 * forever.
 */
const INGEST_WATCHDOG_MS = 10 * 60 * 1000;

const INITIAL_PROGRESS: UploadProgress = { ratio: 0, bytesDone: 0, bytesTotal: 0 };
const INITIAL_STAGE_PROGRESS: StageProgress = {
  ingest: 'pending',
  classify: 'pending',
  see: 'pending',
  reason: 'pending',
  procure: 'pending',
};

function _validateFile(
  file: File,
): { ok: true; mimeType: AcceptedMimeType } | { ok: false; code: string; message: string } {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB.`,
    };
  }
  const type = (file.type || '').toLowerCase();
  // Some browsers report HEIC as empty; fall back to extension.
  let mimeType: AcceptedMimeType | null = null;
  if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(type)) {
    mimeType = type as AcceptedMimeType;
  } else {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (lower.endsWith('.png')) mimeType = 'image/png';
    else if (lower.endsWith('.heic') || lower.endsWith('.heif')) mimeType = 'image/heic';
  }
  if (!mimeType) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Only PDF, JPG, PNG, and HEIC files are accepted.',
    };
  }
  return { ok: true, mimeType };
}

/**
 * Direct browser→Supabase Storage PUT with real upload-progress events.
 *
 * We use XMLHttpRequest (not fetch) because the Fetch spec does NOT expose
 * upload-side progress events — the only way to drive a progress bar from
 * bytes-actually-sent is `xhr.upload.onprogress`. The promise resolves on
 * 2xx, rejects on network error / abort / non-2xx status.
 */
function _putFileXhr(
  url: string,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new BlueprintsApiError(
            xhr.status,
            'STORAGE_PUT_FAILED',
            `Storage PUT returned ${xhr.status}`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new BlueprintsApiError(0, 'STORAGE_PUT_NETWORK', 'Network error uploading file'));
    xhr.onabort = () =>
      reject(new BlueprintsApiError(0, 'STORAGE_PUT_ABORTED', 'Upload aborted'));

    if (signal.aborted) {
      // Reject synchronously-ish; XHR not opened.
      reject(new BlueprintsApiError(0, 'STORAGE_PUT_ABORTED', 'Upload aborted'));
      return;
    }
    signal.addEventListener('abort', () => {
      try {
        xhr.abort();
      } catch {
        // ignore — already finished
      }
    });

    xhr.send(file);
  });
}

export function useBlueprintUpload(): UseBlueprintUploadResult {
  const { authenticatedFetch } = useAuthFetch();
  // Note: mirrors useMaterialsSearch.ts — `officeId` is part of the Tenant
  // payload at runtime but isn't exposed on the TenantContextType interface
  // (pre-existing typing gap, see useMaterialsSearch:269). Same `as any`
  // shape; the runtime value is read correctly.
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';

  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState<UploadProgress>(INITIAL_PROGRESS);
  const [filename, setFilename] = useState<string | null>(null);
  const [response, setResponse] = useState<UploadBlueprintResponse | null>(null);
  const [stageProgress, setStageProgress] = useState<StageProgress>(INITIAL_STAGE_PROGRESS);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Retain the last File the user dropped so the canvas failure card can
  // retry without re-prompting. Stored in a ref (not state) to avoid
  // unnecessary re-renders — the snapshot store mirrors it for consumers.
  const lastFileRef = useRef<File | null>(null);
  // Locked at the first transition out of idle so the Tim Rail Context tab
  // (and any other consumer) can render a stable elapsed timer. Cleared on
  // any non-busy phase so the next upload starts a fresh clock.
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  useEffect(() => {
    const isBusy =
      phase === 'reading' ||
      phase === 'init' ||
      phase === 'uploading' ||
      phase === 'completing' ||
      phase === 'ingesting' ||
      phase === 'classifying';
    if (isBusy && startedAtMs == null) {
      setStartedAtMs(Date.now());
    } else if (!isBusy && startedAtMs != null) {
      setStartedAtMs(null);
    }
  }, [phase, startedAtMs]);

  // Publish state changes to the module-level store so the Tim Rail Context
  // tab can observe them without a provider.
  useEffect(() => {
    // project_id appears on the response as soon as INGEST returns 'ok' or
    // 'dedup'; fall back to the top-level project_id the proxy echoes.
    const projectId =
      response?.ingest?.project_id ?? response?.project_id ?? null;
    setBlueprintUpload({
      phase,
      filename,
      response,
      stageProgress,
      error,
      uploadedAt: phase === 'success' ? Date.now() : null,
      uploadRatio: progress.ratio,
      startedAtMs,
      projectId,
      file: lastFileRef.current,
    });
  }, [phase, filename, response, stageProgress, error, progress.ratio, startedAtMs]);

  // Wave 9e (P1-1) — watchdog timer for the `ingesting` phase. If the poll
  // hook silently dies (network blip, server-side worker death, paused tab
  // throttle that never resumes), the user otherwise stares at a spinner
  // forever. After INGEST_WATCHDOG_MS we transition to error with a clear
  // code so the failure card / retry CTA render.
  useEffect(() => {
    if (phase !== 'ingesting') return;
    if (startedAtMs == null) return;
    const elapsed = Date.now() - startedAtMs;
    const remaining = INGEST_WATCHDOG_MS - elapsed;
    if (remaining <= 0) {
      setPhase('error');
      setError({
        code: 'INGEST_WATCHDOG_TIMEOUT',
        message: 'Pipeline took too long. Try again or contact support.',
      });
      return;
    }
    const id = setTimeout(() => {
      setPhase('error');
      setError({
        code: 'INGEST_WATCHDOG_TIMEOUT',
        message: 'Pipeline took too long. Try again or contact support.',
      });
    }, remaining);
    return () => clearTimeout(id);
  }, [phase, startedAtMs]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Clear retained file too — "Start over" should not silently retry
    // the same file on the next failure.
    lastFileRef.current = null;
    setPhase('idle');
    setProgress(INITIAL_PROGRESS);
    setFilename(null);
    setResponse(null);
    setStageProgress(INITIAL_STAGE_PROGRESS);
    setError(null);
    resetBlueprintUpload();
  }, []);

  const upload = useCallback(
    async (file: File) => {
      // Reset prior state but keep `filename` showing immediately for premium UX.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Retain the file so retry from the failure card re-sends the same
      // bytes without a new drop. Set BEFORE validation so even rejected
      // uploads (e.g. wrong MIME) leave the previous good file intact;
      // the immediate setFilename below replaces the prior reference, so
      // this also serves as "retry uses whatever the user just tried".
      lastFileRef.current = file;
      setFilename(file.name);
      setError(null);
      setResponse(null);

      const validation = _validateFile(file);
      if (!validation.ok) {
        setPhase('error');
        setError({ code: validation.code, message: validation.message });
        return;
      }

      // ────────────────────────────────────────────────────────────────
      // 3-step signed-upload flow (2026-05-19):
      //   1) init        — POST metadata → signed PUT URL.
      //   2) uploading   — direct browser → Supabase Storage PUT (XHR progress).
      //   3) completing  — POST upload_id → backend verifies + dispatches Drew.
      // The polling hook drives stage_progress past `ingesting`.
      // ────────────────────────────────────────────────────────────────

      // ── 1) init ──
      setPhase('init');
      setProgress({ ratio: 0, bytesDone: 0, bytesTotal: file.size });
      let init: Awaited<ReturnType<typeof requestSignedUpload>>;
      try {
        init = await requestSignedUpload(authenticatedFetch, {
          filename: file.name,
          mimeType: validation.mimeType,
          sizeBytes: file.size,
          officeId,
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof BlueprintsApiError) {
          setPhase('error');
          setError({ code: err.code, message: err.message });
        } else {
          setPhase('error');
          setError({
            code: 'SIGNED_UPLOAD_INIT_FAILED',
            message: err instanceof Error ? err.message : 'Could not start upload.',
          });
        }
        return;
      }

      // ── 2) uploading — direct PUT to Storage ──
      setPhase('uploading');
      setProgress({ ratio: 0, bytesDone: 0, bytesTotal: file.size });
      try {
        await _putFileXhr(
          init.signed_url,
          file,
          (loaded, total) => {
            setProgress({
              ratio: total > 0 ? loaded / total : 0,
              bytesDone: loaded,
              bytesTotal: total,
            });
          },
          controller.signal,
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof BlueprintsApiError) {
          setPhase('error');
          setError({ code: err.code, message: err.message });
        } else {
          setPhase('error');
          setError({
            code: 'STORAGE_PUT_FAILED',
            message: err instanceof Error ? err.message : 'Upload failed.',
          });
        }
        return;
      }
      setProgress({ ratio: 1, bytesDone: file.size, bytesTotal: file.size });

      // ── 3) completing — confirm + dispatch ──
      setPhase('completing');
      setStageProgress({
        ingest: 'running',
        classify: 'pending',
        see: 'pending',
        reason: 'pending',
        procure: 'pending',
      });

      try {
        const result = await completeUpload(authenticatedFetch, {
          upload_id: init.upload_id,
          filename: file.name,
          officeId,
          correlationId: init.correlation_id,
          signal: controller.signal,
        });

        // Wave 9e (P0-6) — `status: 'dedup'` means the SHA-256 hash matched
        // an existing project. There is no fresh pipeline to wait on; the
        // poll hook will load whatever real state already lives in the DB.
        // Skip the 'ingesting' phase entirely and jump to success so the
        // user is not stuck on a spinner that will never advance.
        const isDedup =
          isDispatchResponse(result) && result.status === 'dedup';

        if (isDedup) {
          setPhase('success');
          setResponse(null);
          setStageProgress({
            ingest: 'ok',
            classify: 'pending',
            see: 'pending',
            reason: 'pending',
            procure: 'pending',
          });
          setBlueprintUpload({
            phase: 'success',
            filename: file.name,
            response: null,
            stageProgress: {
              // Poll hook will populate real terminal values; show optimistic
              // 'ok' on ingest so the success card doesn't look half-done.
              ingest: 'ok',
              classify: 'pending',
              see: 'pending',
              reason: 'pending',
              procure: 'pending',
            },
            error: null,
            uploadedAt: Date.now(),
            uploadRatio: 1,
            startedAtMs: null,
            projectId: result.project_id,
            file: lastFileRef.current,
          });
          return;
        }

        // Normal queued path — backend persisted the project + enqueued
        // Drew's pipeline. Hop into 'ingesting' so the polling hook
        // (useBlueprintProjectPoll) drives terminal state from stage_progress.
        setResponse(null);
        setPhase('ingesting');
        setBlueprintUpload({
          phase: 'ingesting',
          filename: file.name,
          response: null,
          stageProgress: {
            ingest: 'running',
            classify: 'pending',
            see: 'pending',
            reason: 'pending',
            procure: 'pending',
          },
          error: null,
          uploadedAt: null,
          uploadRatio: 1,
          startedAtMs: Date.now(),
          projectId: result.project_id,
          file: lastFileRef.current,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof BlueprintsApiError) {
          setStageProgress((prev) => ({ ...prev, ingest: 'error' }));
          setPhase('error');
          setError({ code: err.code, message: err.message });
        } else {
          setStageProgress((prev) => ({ ...prev, ingest: 'error' }));
          setPhase('error');
          setError({
            code: 'COMPLETE_UPLOAD_FAILED',
            message: err instanceof Error ? err.message : 'Could not finalize upload.',
          });
        }
      }
    },
    [authenticatedFetch, officeId],
  );

  const retry = useCallback(async (): Promise<void> => {
    const f = lastFileRef.current;
    if (!f) return;
    await upload(f);
  }, [upload]);

  return {
    phase,
    progress,
    filename,
    response,
    stageProgress,
    error,
    upload,
    retry,
    reset,
  };
}
