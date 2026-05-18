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
  uploadBlueprint,
  BlueprintsApiError,
  MAX_UPLOAD_BYTES,
  ACCEPTED_MIME_TYPES,
  type AcceptedMimeType,
  type UploadBlueprintResponse,
  type StageProgress,
} from '@/lib/api/blueprintsApi';

export type UploadPhase =
  | 'idle'
  | 'reading'
  | 'uploading'
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
  reset: () => void;
}

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

function _readFileWithProgress(
  file: File,
  onProgress: (loaded: number, total: number) => void,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.onload = () => {
      const buf = reader.result;
      if (buf instanceof ArrayBuffer) resolve(new Uint8Array(buf));
      else reject(new Error('FileReader returned non-ArrayBuffer'));
    };
    reader.readAsArrayBuffer(file);
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
  // Locked at the first transition out of idle so the Tim Rail Context tab
  // (and any other consumer) can render a stable elapsed timer. Cleared on
  // any non-busy phase so the next upload starts a fresh clock.
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  useEffect(() => {
    const isBusy =
      phase === 'reading' ||
      phase === 'uploading' ||
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
    });
  }, [phase, filename, response, stageProgress, error, progress.ratio, startedAtMs]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
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

      setFilename(file.name);
      setError(null);
      setResponse(null);

      const validation = _validateFile(file);
      if (!validation.ok) {
        setPhase('error');
        setError({ code: validation.code, message: validation.message });
        return;
      }

      // ── reading ──
      setPhase('reading');
      setProgress({ ratio: 0, bytesDone: 0, bytesTotal: file.size });
      let bytes: Uint8Array;
      try {
        bytes = await _readFileWithProgress(file, (loaded, total) => {
          setProgress({ ratio: total > 0 ? loaded / total : 0, bytesDone: loaded, bytesTotal: total });
        });
      } catch (err) {
        setPhase('error');
        setError({
          code: 'FILE_READ_FAILED',
          message: err instanceof Error ? err.message : 'Could not read file.',
        });
        return;
      }

      // ── uploading → ingesting → classifying (server-side chain) ──
      setPhase('uploading');
      setProgress({ ratio: 1, bytesDone: bytes.byteLength, bytesTotal: bytes.byteLength });
      setStageProgress({
        ingest: 'running',
        classify: 'pending',
        see: 'pending',
        reason: 'pending',
        procure: 'pending',
      });

      // The proxy returns a single response once both INGEST + CLASSIFY are done.
      // We hop the phase to 'ingesting' immediately for UX (a true in-flight
      // INGEST is what the server is doing for ~70% of total time per Drew
      // Wave 2A timings) and let `setStageProgress` resolve the final state.
      setPhase('ingesting');

      try {
        const result = await uploadBlueprint(authenticatedFetch, {
          fileBytes: bytes,
          filename: file.name,
          mimeType: validation.mimeType,
          officeId: officeId,
          signal: controller.signal,
        });

        // Drew may return status:'error' inline (HTTP 200) for in-band failures
        // like missing payload keys; treat that as terminal here.
        if (result.ingest.status === 'error') {
          setStageProgress({
            ingest: 'error',
            classify: 'pending',
            see: 'pending',
            reason: 'pending',
            procure: 'pending',
          });
          setPhase('error');
          setError({
            code: 'INGEST_FAILED',
            message: result.ingest.reason ?? 'Ingest step failed.',
          });
          return;
        }

        setPhase('classifying');
        setStageProgress(result.stage_progress);
        setResponse(result);
        setPhase('success');
      } catch (err) {
        if (controller.signal.aborted) {
          // Caller hit reset() — already cleared via reset; do nothing.
          return;
        }
        if (err instanceof BlueprintsApiError) {
          setStageProgress((prev) => ({ ...prev, ingest: 'error' }));
          setPhase('error');
          setError({ code: err.code, message: err.message });
        } else {
          setStageProgress((prev) => ({ ...prev, ingest: 'error' }));
          setPhase('error');
          setError({
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Network error.',
          });
        }
      }
    },
    [authenticatedFetch, officeId],
  );

  return {
    phase,
    progress,
    filename,
    response,
    stageProgress,
    error,
    upload,
    reset,
  };
}
