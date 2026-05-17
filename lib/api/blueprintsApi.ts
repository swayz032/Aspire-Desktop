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
 * Wave 7 scope (this file):
 *   - Project/sheet/status GETs (Wave 2.5 backend reads)
 *   - Story / assemblies / materials / missing_inputs GETs (Wave 2.7)
 *   - resolveMissingInput POST (Wave 2.7 — YELLOW tier; scope=
 *     `blueprints:resolve_missing_input`)
 *
 * Until Wave 2.5 / 2.7 backend PRs merge, the Express proxy returns 404 for
 * these routes. Callers (hooks) MUST catch `BlueprintsApiError.status === 404`
 * and degrade to an empty render path. See docs/plans/serene-seeking-hollerith.
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
// Wave 7 — Story / Assemblies / Materials / Missing Inputs (REASON + PROCURE)
// ---------------------------------------------------------------------------

/** Confidence class for a fact in the story / assembly / material chain. */
export type TruthClass =
  | 'observed'
  | 'derived'
  | 'assumed'
  | 'missing'
  | 'field_confirmed'
  | 'vendor_confirmed'
  | 'permit_confirmed';

/** A single phase of the project's work narrative. */
export interface BlueprintStoryPhase {
  key: string;
  title: string;
  /** Plain-English narrative markdown body. */
  body_md: string;
  facts: BlueprintStoryFact[];
}

/** A single inline fact in a phase narrative. Renders as a TruthBadge chip. */
export interface BlueprintStoryFact {
  key: string;
  label: string;
  truth: TruthClass;
  /** Optional 0..1 confidence (derived / assumed). */
  confidence?: number;
  /** Optional missing_input_id when truth === 'assumed' or 'missing'. */
  missing_input_id?: string | null;
}

export interface BlueprintStory {
  project_id: string;
  /** Overall project mean confidence (0..1). */
  mean_confidence: number;
  /** Counts by truth class for the truth-distribution bar. */
  truth_distribution: Record<TruthClass, number>;
  phases: BlueprintStoryPhase[];
  updated_at: string | null;
  /** REASON pipeline stage state — UI polls until 'done' or 'error'. */
  status: 'pending' | 'in_progress' | 'done' | 'error';
}

/** An assembly line item Drew identified (e.g. "drywall partition"). */
export interface BlueprintAssembly {
  assembly_id: string;
  assembly_type: string;
  label: string;
  quantity: number;
  unit: string;
  truth: TruthClass;
  confidence?: number;
  /** True if part of the base scope; false if alternate / not-in-base. */
  in_base_scope: boolean;
  alternate_note?: string | null;
}

/** A material line item Drew / PROCURE identified. */
export interface BlueprintMaterial {
  material_id: string;
  label: string;
  quantity: number;
  unit: string;
  truth: TruthClass;
  tariff_flagged: boolean;
  tariff_note?: string | null;
  /** Estimated $ impact for the tariff line (PROCURE; null until Wave 5). */
  tariff_impact_usd?: number | null;
  supplier_hint?: string | null;
}

/** A known-unknown that needs field confirmation / RFI / owner input. */
export interface BlueprintMissingInput {
  input_id: string;
  description: string;
  suggested_resolution?: string | null;
  status: 'open' | 'resolved';
  resolved_value?: string | null;
  resolved_at?: string | null;
}

export interface GetAssembliesOptions {
  activeOnly?: boolean;
}

export interface GetMaterialsOptions {
  tariffOnly?: boolean;
  hasSupplier?: boolean;
}

export interface GetMissingInputsOptions {
  unresolvedOnly?: boolean;
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
// Wave 6.5 / Wave 7 — real GET clients (graceful 404 via BlueprintsApiError)
//
// The Express proxy + Python orchestrator endpoints land in:
//   Wave 2.5 — GET /api/v1/blueprints/projects/:id, /sheets, /status
//   Wave 2.7 — GET /story, /assemblies, /materials, /missing_inputs +
//              POST /missing_inputs/:input_id/resolve
//
// Until those PRs merge, the proxy returns 404. Callers (hooks) must catch
// `BlueprintsApiError.status === 404` and degrade to an empty render path
// rather than treating it as a real failure.
// ---------------------------------------------------------------------------

async function _getJson<T>(
  authenticatedFetch: FetchFn,
  url: string,
  officeId: string,
  signal?: AbortSignal,
): Promise<T> {
  const resp = await authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': officeId },
    signal,
  });

  if (!resp.ok) {
    let code = 'BLUEPRINT_GET_FAILED';
    let message = `Blueprint GET failed (${resp.status})`;
    let correlationId: string | undefined;
    try {
      const parsed = await resp.json();
      code = parsed?.error ?? parsed?.code ?? code;
      message = parsed?.message ?? parsed?.detail?.message ?? message;
      correlationId = parsed?.correlation_id;
    } catch {
      // non-JSON error body
    }
    throw new BlueprintsApiError(resp.status, code, message, correlationId);
  }

  return (await resp.json()) as T;
}

/** Fetch a single project's metadata + progress. */
export async function getProject(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  signal?: AbortSignal,
): Promise<BlueprintProject> {
  return _getJson<BlueprintProject>(
    authenticatedFetch,
    `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}`,
    officeId,
    signal,
  );
}

/** List sheets for a project (with thumbnails + revision chain). */
export async function listSheets(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  signal?: AbortSignal,
): Promise<BlueprintSheet[]> {
  return _getJson<BlueprintSheet[]>(
    authenticatedFetch,
    `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}/sheets`,
    officeId,
    signal,
  );
}

/** Poll project pipeline stage progress. */
export async function getProjectStatus(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  signal?: AbortSignal,
): Promise<{ stage_progress: StageProgress }> {
  return _getJson<{ stage_progress: StageProgress }>(
    authenticatedFetch,
    `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}/status`,
    officeId,
    signal,
  );
}

/** Wave 7 — fetch the phased story narrative (REASON output). */
export async function getStory(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  signal?: AbortSignal,
): Promise<BlueprintStory> {
  return _getJson<BlueprintStory>(
    authenticatedFetch,
    `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}/story`,
    officeId,
    signal,
  );
}

/** Wave 7 — fetch project assemblies. */
export async function getAssemblies(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  options: GetAssembliesOptions = {},
  signal?: AbortSignal,
): Promise<BlueprintAssembly[]> {
  const params = new URLSearchParams();
  if (options.activeOnly) params.set('active_only', 'true');
  const qs = params.toString();
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(
    projectId,
  )}/assemblies${qs ? `?${qs}` : ''}`;
  return _getJson<BlueprintAssembly[]>(authenticatedFetch, url, officeId, signal);
}

/** Wave 7 — fetch project materials. */
export async function getMaterials(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  options: GetMaterialsOptions = {},
  signal?: AbortSignal,
): Promise<BlueprintMaterial[]> {
  const params = new URLSearchParams();
  if (options.tariffOnly) params.set('tariff_only', 'true');
  if (options.hasSupplier) params.set('has_supplier', 'true');
  const qs = params.toString();
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(
    projectId,
  )}/materials${qs ? `?${qs}` : ''}`;
  return _getJson<BlueprintMaterial[]>(authenticatedFetch, url, officeId, signal);
}

/** Wave 7 — fetch project missing inputs. */
export async function getMissingInputs(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  options: GetMissingInputsOptions = {},
  signal?: AbortSignal,
): Promise<BlueprintMissingInput[]> {
  const params = new URLSearchParams();
  if (options.unresolvedOnly) params.set('unresolved_only', 'true');
  const qs = params.toString();
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(
    projectId,
  )}/missing_inputs${qs ? `?${qs}` : ''}`;
  return _getJson<BlueprintMissingInput[]>(authenticatedFetch, url, officeId, signal);
}

/** Wave 7 — confirm a missing input with a field-collected value (YELLOW tier).
 *
 *  Server-side proxy (Wave 2.7):
 *    1) Validates JWT.
 *    2) Mints capability token (scope=`blueprints:resolve_missing_input`).
 *    3) Forwards to Drew with task=RESOLVE_MISSING_INPUT.
 *    4) Writes blueprint_receipt (Law #2) + returns the updated row. */
export async function resolveMissingInput(
  authenticatedFetch: FetchFn,
  projectId: string,
  inputId: string,
  value: string,
  officeId: string,
  signal?: AbortSignal,
): Promise<BlueprintMissingInput> {
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(
    projectId,
  )}/missing_inputs/${encodeURIComponent(inputId)}/resolve`;

  const resp = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': officeId,
    },
    body: JSON.stringify({ value }),
    signal,
  });

  if (!resp.ok) {
    let code = 'RESOLVE_MISSING_INPUT_FAILED';
    let message = `Resolve missing input failed (${resp.status})`;
    let correlationId: string | undefined;
    try {
      const parsed = await resp.json();
      code = parsed?.error ?? parsed?.code ?? code;
      message = parsed?.message ?? parsed?.detail?.message ?? message;
      correlationId = parsed?.correlation_id;
    } catch {
      // non-JSON error body
    }
    throw new BlueprintsApiError(resp.status, code, message, correlationId);
  }

  return (await resp.json()) as BlueprintMissingInput;
}
// ---------------------------------------------------------------------------
// Wave 8 additions — Takeoff (Commercial Blueprint mode)
// ---------------------------------------------------------------------------
//
// Wave 8 reads + push-to-materials. Depends on Wave 2.7 backend (symbols,
// assemblies, materials). Reads degrade gracefully — when the backend
// returns 404/501 the call returns `{ endpointMissing: true, ...empty }`
// and the Takeoff tab shows a "Wave 2.7 pending" banner.
//
// Push-to-materials is YELLOW: Express proxy mints a `materials.bundle.add`
// capability token (Law #5). The caller must show a confirmation modal
// BEFORE invoking. Server-side scope enforcement is the real gate.
//
// NOTE on naming: Wave 7 (parallel branch) also adds `BlueprintAssembly`
// and `BlueprintMaterial` interfaces with a different shape (REASON/PROCURE
// truth model). To avoid collision at merge time, Wave 8 prefixes its types
// with `Takeoff*` (TakeoffSymbol, TakeoffAssembly, TakeoffMaterial).
// ---------------------------------------------------------------------------

export type TakeoffSymbolTruth = 'asserted' | 'derived' | 'assumed';
export type TakeoffTariffFlag =
  | 'steel'
  | 'aluminum'
  | 'softwood'
  | 'hardwood'
  | 'copper'
  | 'none';

/** Wave 8 — one detected symbol on a sheet. Bbox is normalised 0-1 to the
 *  parent sheet's rendered image, so the overlay scales with zoom. */
export interface TakeoffSymbol {
  symbol_id: string;
  sheet_id: string;
  /** e.g. "electrical.outlet.duplex", "plumbing.fixture.toilet", "structural.column.steel". */
  class: string;
  /** 0..1 — drives overlay opacity. */
  confidence: number;
  /** Normalised 0..1 bounding box. */
  bbox: { x: number; y: number; w: number; h: number };
  /** Optional user override label after Confirm/Reclassify. */
  override_class?: string;
  /** Detection lifecycle status. */
  status?: 'detected' | 'confirmed' | 'reclassified' | 'dropped';
}

/** Wave 8 — one derived assembly. */
export interface TakeoffAssembly {
  assembly_id: string;
  /** Display label, e.g. 'Type A interior partition'. */
  type: string;
  quantity: number;
  unit: string;
  truth: TakeoffSymbolTruth;
  /** Sheet that anchors this assembly's derivation. */
  source_sheet_id?: string | null;
  /** When truth=assumed, confidence reflects derivation strength. */
  confidence?: number;
}

/** Wave 8 — one derived material line item. */
export interface TakeoffMaterial {
  material_id: string;
  line_item: string;
  quantity: number;
  unit: string;
  truth: TakeoffSymbolTruth;
  /** Mapped tariff exposure category. */
  tariff_flag: TakeoffTariffFlag;
  /** Supplier preview if a default is suggested (procure not yet run = null). */
  supplier_name?: string | null;
  /** True if this material has been pushed to the bundle already. */
  in_bundle?: boolean;
}

export interface ListTakeoffSymbolsOptions {
  sheet_id?: string;
  /** Filter to confidences >= floor (0..1). */
  confidence_floor?: number;
  /** Filter by class-prefix, e.g. "electrical." or "plumbing.fixture.". */
  class_prefix?: string;
}

export interface PushToMaterialsResult {
  success: boolean;
  added_count: number;
  /** Material IDs successfully added to the bundle. */
  added_material_ids: string[];
  /** Material IDs that the server rejected (already in bundle, malformed, etc.). */
  rejected: Array<{ material_id: string; reason: string }>;
  bundle_id?: string;
  correlation_id?: string;
}

/** Wave 8 — fetch symbols for a project / single sheet. Degrades gracefully. */
export async function getTakeoffSymbols(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
  opts: ListTakeoffSymbolsOptions = {},
): Promise<{ symbols: TakeoffSymbol[]; endpointMissing: boolean }> {
  const qs = new URLSearchParams();
  if (opts.sheet_id) qs.set('sheet_id', opts.sheet_id);
  if (opts.confidence_floor != null) qs.set('confidence_floor', String(opts.confidence_floor));
  if (opts.class_prefix) qs.set('class_prefix', opts.class_prefix);
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}/symbols${
    qs.toString() ? `?${qs.toString()}` : ''
  }`;

  const resp = await authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': officeId },
  });

  if (resp.status === 404 || resp.status === 501) {
    return { symbols: [], endpointMissing: true };
  }
  if (!resp.ok) {
    let code = 'GET_SYMBOLS_FAILED';
    let message = `getTakeoffSymbols failed (${resp.status})`;
    try {
      const parsed = await resp.json();
      code = parsed?.error ?? parsed?.code ?? code;
      message = parsed?.message ?? message;
    } catch {
      /* non-JSON */
    }
    throw new BlueprintsApiError(resp.status, code, message);
  }
  const data = (await resp.json()) as { symbols?: TakeoffSymbol[] };
  return { symbols: Array.isArray(data.symbols) ? data.symbols : [], endpointMissing: false };
}

/** Wave 8 — fetch derived assemblies for a project. Degrades gracefully. */
export async function getTakeoffAssemblies(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
): Promise<{ assemblies: TakeoffAssembly[]; endpointMissing: boolean }> {
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}/assemblies`;
  const resp = await authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': officeId },
  });
  if (resp.status === 404 || resp.status === 501) {
    return { assemblies: [], endpointMissing: true };
  }
  if (!resp.ok) {
    let code = 'GET_ASSEMBLIES_FAILED';
    let message = `getTakeoffAssemblies failed (${resp.status})`;
    try {
      const parsed = await resp.json();
      code = parsed?.error ?? code;
      message = parsed?.message ?? message;
    } catch {
      /* non-JSON */
    }
    throw new BlueprintsApiError(resp.status, code, message);
  }
  const data = (await resp.json()) as { assemblies?: TakeoffAssembly[] };
  return {
    assemblies: Array.isArray(data.assemblies) ? data.assemblies : [],
    endpointMissing: false,
  };
}

/** Wave 8 — fetch derived materials for a project. Degrades gracefully. */
export async function getTakeoffMaterials(
  authenticatedFetch: FetchFn,
  projectId: string,
  officeId: string,
): Promise<{ materials: TakeoffMaterial[]; endpointMissing: boolean }> {
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}/materials`;
  const resp = await authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': officeId },
  });
  if (resp.status === 404 || resp.status === 501) {
    return { materials: [], endpointMissing: true };
  }
  if (!resp.ok) {
    let code = 'GET_MATERIALS_FAILED';
    let message = `getTakeoffMaterials failed (${resp.status})`;
    try {
      const parsed = await resp.json();
      code = parsed?.error ?? code;
      message = parsed?.message ?? message;
    } catch {
      /* non-JSON */
    }
    throw new BlueprintsApiError(resp.status, code, message);
  }
  const data = (await resp.json()) as { materials?: TakeoffMaterial[] };
  return {
    materials: Array.isArray(data.materials) ? data.materials : [],
    endpointMissing: false,
  };
}

/** Wave 8 — push selected blueprint-derived materials to the project's
 *  materials bundle. YELLOW tier: the Express proxy mints a capability token
 *  with scope=`materials.bundle.add` (Law #5). The caller MUST have shown
 *  a confirmation modal BEFORE calling this method. */
export async function pushToMaterialsBundle(
  authenticatedFetch: FetchFn,
  projectId: string,
  materialIds: string[],
  officeId: string,
): Promise<PushToMaterialsResult> {
  if (!projectId) {
    throw new BlueprintsApiError(400, 'INVALID_PROJECT_ID', 'projectId is required');
  }
  if (!Array.isArray(materialIds) || materialIds.length === 0) {
    throw new BlueprintsApiError(400, 'EMPTY_MATERIAL_IDS', 'At least one material_id required');
  }
  const url = `${API_BASE}/api/v1/blueprints/projects/${encodeURIComponent(projectId)}/push-to-materials`;
  const resp = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': officeId,
    },
    body: JSON.stringify({ material_ids: materialIds }),
  });
  if (!resp.ok) {
    let code = 'PUSH_TO_MATERIALS_FAILED';
    let message = `pushToMaterialsBundle failed (${resp.status})`;
    let correlationId: string | undefined;
    try {
      const parsed = await resp.json();
      code = parsed?.error ?? parsed?.code ?? code;
      message = parsed?.message ?? message;
      correlationId = parsed?.correlation_id;
    } catch {
      /* non-JSON */
    }
    throw new BlueprintsApiError(resp.status, code, message, correlationId);
  }
  const data = (await resp.json()) as PushToMaterialsResult;
  return {
    success: !!data.success,
    added_count: data.added_count ?? 0,
    added_material_ids: Array.isArray(data.added_material_ids) ? data.added_material_ids : [],
    rejected: Array.isArray(data.rejected) ? data.rejected : [],
    bundle_id: data.bundle_id,
    correlation_id: data.correlation_id,
  };
}
