/**
 * Blueprints API client — Wave 6A (Plans & Photos production upload).
 *
 * Wraps `POST /api/v1/blueprints/upload` (Express proxy that mints a
 * capability token + forwards to Drew via the Python orchestrator's
 * `/v1/agents/invoke` endpoint).
 *
 * Wave 6A scope:
 *   - uploadBlueprint(): full INGEST + auto-chained CLASSIFY in one call.
 *
 * Wave 6.5 (deferred — backend GET endpoints not yet wired):
 *   - getProject(): GET /api/v1/blueprints/projects/:id
 *   - listSheets(): GET /api/v1/blueprints/projects/:id/sheets
 *   - getProjectStatus(): GET /api/v1/blueprints/projects/:id/status
 *
 * These three are declared with their full types so call-sites can be
 * sketched ahead of Wave 6.5 wiring, but the implementations throw
 * `NotImplementedError` until the backend reads land. See
 * docs/plans/serene-seeking-hollerith for the cross-wave plan.
 *
 * Law compliance:
 *   Law #5 — capability token minted server-side by the Express proxy.
 *   Law #6 — suite_id derives from authenticated session; client never sets it.
 *   Law #3 — 50 MB file cap enforced client + server side (fail-closed).
 *   Law #9 — file contents never logged; only filename + size.
 */

import { API_BASE } from './officeMemory';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class BlueprintsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'BlueprintsApiError';
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max raw file size (50 MB). Base64 inflates ~33% so the JSON body cap on
 *  the server route is set higher — see server/routes.ts blueprints upload. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** MIME types accepted by the upload route. */
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

// ---------------------------------------------------------------------------
// Stage progress — 5-stage pipeline (Wave 6A real: ingest, classify;
// Wave 3/4/5: see, reason, procure)
// ---------------------------------------------------------------------------

export type StageKey = 'ingest' | 'classify' | 'see' | 'reason' | 'procure';
export type StageStatus = 'pending' | 'running' | 'ok' | 'error' | 'stub';

export interface StageProgress {
  ingest: StageStatus;
  classify: StageStatus;
  see: StageStatus;
  reason: StageStatus;
  procure: StageStatus;
}

// ---------------------------------------------------------------------------
// Wire types (Drew via /api/v1/blueprints/upload)
// ---------------------------------------------------------------------------

/** Drew INGEST result (Wave 2A real implementation). */
export interface IngestResult {
  status: 'ok' | 'error' | 'dedup';
  stage: 'ingest';
  project_id?: string;
  sheet_count?: number;
  sheet_ids?: string[];
  provider_mix?: Record<string, number>;
  reason?: string;
}

/** Drew CLASSIFY result (Wave 2A real implementation). */
export interface ClassifyResult {
  status: 'ok' | 'error';
  stage: 'classify';
  project_id?: string;
  discipline_counts?: Record<string, number>;
  revisions?: number;
  needs_review_count?: number;
  reason?: string;
}

/** Server-side composed response: INGEST + auto-chained CLASSIFY. */
export interface UploadBlueprintResponse {
  success: boolean;
  project_id: string;
  filename: string;
  size_bytes: number;
  correlation_id: string;
  /** Real raw INGEST result from Drew (Wave 2A). */
  ingest: IngestResult;
  /** CLASSIFY auto-chained on the server. May be `null` if INGEST errored. */
  classify: ClassifyResult | null;
  /** Composed 5-stage indicator the UI can hand straight to UploadProgressInline.
   *  Wave 6A: ingest + classify reflect real backend status; see/reason/procure
   *  are always 'pending' (Wave 3/4/5 will light them up). */
  stage_progress: StageProgress;
}

/** Wave 6.5 — getProject() response (declared early for type-stability). */
export interface BlueprintProject {
  project_id: string;
  suite_id: string;
  office_id: string;
  filename: string;
  uploaded_at: string;
  sheet_count: number;
  stage_progress: StageProgress;
}

/** Wave 6.5 — listSheets() response item. */
export interface BlueprintSheet {
  sheet_id: string;
  sheet_number: string;
  discipline: string | null;
  /** Higher = newer; superseded sheets have `superseded_by_sheet_id` set. */
  revision: number;
  superseded_by_sheet_id?: string | null;
  thumbnail_url?: string | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

export interface UploadBlueprintParams {
  /** Raw file bytes — already validated client-side for size + MIME type. */
  fileBytes: Uint8Array;
  filename: string;
  mimeType: AcceptedMimeType;
  officeId: string;
  /** Optional client-generated idempotency key for retry safety. */
  idempotencyKey?: string;
  /** Optional abort signal. */
  signal?: AbortSignal;
}

/** Base64-encode a Uint8Array without blowing the call stack on large files.
 *  apply() with a 50MB array hits "Maximum call stack size exceeded" on V8;
 *  chunk to ~64KB and concat. */
function _uint8ToBase64(bytes: Uint8Array): string {
  // Use Buffer on Node (server-side) for speed; on browser fall back to chunked btoa.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  // eslint-disable-next-line no-restricted-globals
  return btoa(bin);
}

/** Upload a blueprint PDF/image. Server-side proxy:
 *    1) Validates size + MIME.
 *    2) Mints capability token (Law #5).
 *    3) Calls Drew INGEST.
 *    4) On INGEST ok → auto-chains Drew CLASSIFY.
 *    5) Returns the composed response. */
export async function uploadBlueprint(
  authenticatedFetch: FetchFn,
  params: UploadBlueprintParams,
): Promise<UploadBlueprintResponse> {
  if (params.fileBytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new BlueprintsApiError(
      413,
      'FILE_TOO_LARGE',
      `File exceeds ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB cap`,
    );
  }
  if (!ACCEPTED_MIME_TYPES.includes(params.mimeType)) {
    throw new BlueprintsApiError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      `MIME type ${params.mimeType} not supported`,
    );
  }

  const body = {
    filename: params.filename,
    mime_type: params.mimeType,
    pdf_b64: _uint8ToBase64(params.fileBytes),
    idempotency_key: params.idempotencyKey,
  };

  const resp = await authenticatedFetch(`${API_BASE}/api/v1/blueprints/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': params.officeId,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!resp.ok) {
    let code = 'BLUEPRINT_UPLOAD_FAILED';
    let message = `Blueprint upload failed (${resp.status})`;
    let correlationId: string | undefined;
    try {
      const parsed = await resp.json();
      code = parsed?.detail?.error ?? parsed?.error ?? parsed?.code ?? code;
      message = parsed?.detail?.message ?? parsed?.message ?? message;
      correlationId = parsed?.correlation_id;
    } catch {
      // non-JSON error body
    }
    throw new BlueprintsApiError(resp.status, code, message, correlationId);
  }

  return (await resp.json()) as UploadBlueprintResponse;
}

// ---------------------------------------------------------------------------
// Wave 6.5 stubs — types declared, implementations throw
// ---------------------------------------------------------------------------

/** Wave 6.5 — fetch a single project's metadata + progress.
 *  Throws until backend GET endpoint lands. */
export async function getProject(
  _authenticatedFetch: FetchFn,
  _projectId: string,
  _officeId: string,
): Promise<BlueprintProject> {
  throw new BlueprintsApiError(
    501,
    'NOT_IMPLEMENTED_WAVE_6_5',
    'getProject() lands in Wave 6.5 alongside backend GET /v1/blueprints/projects/:id',
  );
}

/** Wave 6.5 — list sheets for a project (with thumbnails + revision chain).
 *  Throws until backend GET endpoint lands. */
export async function listSheets(
  _authenticatedFetch: FetchFn,
  _projectId: string,
  _officeId: string,
): Promise<BlueprintSheet[]> {
  throw new BlueprintsApiError(
    501,
    'NOT_IMPLEMENTED_WAVE_6_5',
    'listSheets() lands in Wave 6.5 alongside backend GET /v1/blueprints/projects/:id/sheets',
  );
}

/** Wave 6.5 — poll project pipeline stage progress.
 *  Throws until backend GET endpoint lands. */
export async function getProjectStatus(
  _authenticatedFetch: FetchFn,
  _projectId: string,
  _officeId: string,
): Promise<{ stage_progress: StageProgress }> {
  throw new BlueprintsApiError(
    501,
    'NOT_IMPLEMENTED_WAVE_6_5',
    'getProjectStatus() lands in Wave 6.5 alongside backend GET /v1/blueprints/projects/:id/status',
  );
}
