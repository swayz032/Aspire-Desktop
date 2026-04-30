/**
 * Office Memory API client — shared helpers.
 *
 * Pass 17 (plan §17.A/B): wires `useMemorySearch` and `useMemoryDetail` to the
 * real backend at `/v1/office-memory/search-memory` (and the equivalent
 * detail-by-id path).
 *
 * Frontend talks to same-origin `/api/v1/...` proxy routes; the Express server
 * (server/routes.ts pattern) injects the capability token + Gateway-trusted
 * scope headers (`X-Tenant-Id`, `X-Suite-Id`, `X-Office-Id`) before forwarding
 * to the Python orchestrator. This matches the existing `/api/tools/...`
 * proxy pattern (see server/routes.ts:7918 enrich-product). The frontend never
 * sees the signing key.
 *
 * Auth headers come from `useAuthFetch` (JWT + suite_id + trace ids).
 *
 * Backend response shapes are documented inline; the mapper below converts
 * `MemoryObjectOut` → frontend `MemorySummary` / `MemoryDetail`.
 *
 * Law compliance:
 *   Law #5 — capability tokens minted server-side, never exposed to client.
 *   Law #6 — scope headers injected from JWT, not from client input.
 *   Law #9 — error messages do not leak backend internals.
 */

import type {
  MemoryDetail,
  MemorySummary,
  MemoryStatus,
  MemoryType,
} from '@/components/office-memory/types';

// ---------------------------------------------------------------------------
// API_BASE — same-origin in production. Lets dev override via env.
// ---------------------------------------------------------------------------

export const API_BASE: string = process.env.EXPO_PUBLIC_API_URL || '';

// ---------------------------------------------------------------------------
// Backend response shapes (mirror schemas/memory_v1.py MemoryObjectOut)
// ---------------------------------------------------------------------------

export interface BackendMemoryObject {
  memory_id: string;
  scope: {
    tenant_id: string;
    suite_id: string;
    office_id: string;
    actor_id?: string | null;
    user_id?: string | null;
  };
  memory_type: string;
  title?: string | null;
  summary: string;
  detail?: Record<string, unknown>;
  status?: string | null;
  visibility_scope?: 'office' | 'finance';
  confidence?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  thread_id?: string | null;
  linked_receipt_ids?: string[];
  linked_approval_ids?: string[];
  linked_artifact_ids?: string[];
  linked_workflow_run_ids?: string[];
  event_at?: string | null;
  created_at?: string;
  last_activity_at?: string;
  source_updated_at?: string | null;
  provenance?: {
    source_surface?: string | null;
    source_agent?: string | null;
    runtime_family?: string | null;
    channel?: string | null;
    correlation_id?: string;
    trace_id?: string;
  };
}

export interface BackendSearchResponse {
  results: BackendMemoryObject[];
  total: number;
  note?: string | null;
}

export interface BackendThreadMemoryResponse {
  objects: BackendMemoryObject[];
  brief: unknown | null;
  total: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MemoryApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MemoryApiError';
  }
}

// ---------------------------------------------------------------------------
// Type narrowing helpers
// ---------------------------------------------------------------------------

const KNOWN_MEMORY_TYPES = new Set<MemoryType>([
  'meeting',
  'call',
  'session_summary',
  'transcript',
  'sms_thread',
  'note',
  'document',
  'contract',
  'invoice',
  'quote',
  'strategy',
  'research',
  'task',
  'summary',
  'decision_fact',
  'handoff_note',
  'pending_intent',
  'authority_context',
  'thread_summary',
  'office_brief',
  'finance_brief',
  'risk_flag',
  'followup_task',
  'timeline_event',
  'artifact_reference',
  'receipt_reference',
  'workflow_reference',
]);

function narrowMemoryType(raw: string | undefined): MemoryType {
  if (raw && KNOWN_MEMORY_TYPES.has(raw as MemoryType)) {
    return raw as MemoryType;
  }
  return 'note';
}

const KNOWN_STATUSES = new Set<MemoryStatus>([
  'requested',
  'drafted',
  'pending_approval',
  'approved',
  'executed',
  'rejected',
  'superseded',
  'failed',
  'promoted',
]);

function narrowStatus(raw: string | null | undefined): MemoryStatus | undefined {
  if (raw && KNOWN_STATUSES.has(raw as MemoryStatus)) {
    return raw as MemoryStatus;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Map a backend `MemoryObjectOut` to a frontend `MemorySummary`. Tags, entity
 * name, and project are derived from `detail` per the backend contract — the
 * `detail` blob carries free-form fields the UI surfaces but the spine schema
 * does not formalize.
 */
export function mapMemorySummary(obj: BackendMemoryObject): MemorySummary {
  const detail = (obj.detail ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(detail.tags) ? (detail.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [];
  const entityName = typeof detail.entity_name === 'string' ? detail.entity_name : undefined;
  const projectName = typeof detail.project_name === 'string' ? detail.project_name : undefined;
  const projectId = typeof detail.project_id === 'string' ? detail.project_id : undefined;

  const entity = obj.entity_id
    ? { id: obj.entity_id, name: entityName ?? 'Unknown' }
    : undefined;
  const project = projectId && projectName ? { id: projectId, name: projectName } : undefined;

  return {
    id: obj.memory_id,
    type: narrowMemoryType(obj.memory_type),
    title: obj.title ?? '(Untitled)',
    summary: obj.summary,
    entity,
    project,
    date: obj.event_at ?? obj.last_activity_at ?? obj.created_at ?? new Date().toISOString(),
    tags,
    bookmarked: detail.bookmarked === true,
    status: narrowStatus(obj.status),
  };
}

/**
 * Map to a `MemoryDetail`. Falls back gracefully on missing fields so detail
 * components never render blank center columns (per Pass 15 §15.E).
 */
export function mapMemoryDetail(obj: BackendMemoryObject): MemoryDetail {
  const summary = mapMemorySummary(obj);
  const detail = (obj.detail ?? {}) as Record<string, unknown>;

  const participants = Array.isArray(detail.participants)
    ? (detail.participants as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];

  const createdBy = typeof detail.created_by === 'string'
    ? detail.created_by
    : (obj.provenance?.source_agent ?? 'system');

  return {
    ...summary,
    duration: typeof detail.duration === 'string' ? detail.duration : undefined,
    participants,
    location: typeof detail.location === 'string' ? detail.location : undefined,
    createdBy,
    keyDecisions: Array.isArray(detail.key_decisions) ? (detail.key_decisions as MemoryDetail['keyDecisions']) : [],
    linkedFacts: Array.isArray(detail.linked_facts) ? (detail.linked_facts as MemoryDetail['linkedFacts']) : [],
    activityFiles: Array.isArray(detail.activity_files) ? (detail.activity_files as MemoryDetail['activityFiles']) : [],
    rawContent: typeof detail.raw_content === 'string' ? detail.raw_content : undefined,
    body: typeof detail.body === 'string' ? detail.body : undefined,
    bodyFormat: detail.body_format === 'markdown' || detail.body_format === 'plaintext' || detail.body_format === 'html'
      ? detail.body_format
      : undefined,
    file: typeof detail.file === 'object' && detail.file !== null
      ? (detail.file as MemoryDetail['file'])
      : undefined,
    versionHistory: Array.isArray(detail.version_history)
      ? (detail.version_history as MemoryDetail['versionHistory'])
      : undefined,
    recording: typeof detail.recording === 'object' && detail.recording !== null
      ? (detail.recording as MemoryDetail['recording'])
      : undefined,
    transcript: Array.isArray(detail.transcript)
      ? (detail.transcript as MemoryDetail['transcript'])
      : undefined,
    lineItems: Array.isArray(detail.line_items)
      ? (detail.line_items as MemoryDetail['lineItems'])
      : undefined,
    totals: typeof detail.totals === 'object' && detail.totals !== null
      ? (detail.totals as MemoryDetail['totals'])
      : undefined,
    statusTimeline: Array.isArray(detail.status_timeline)
      ? (detail.status_timeline as MemoryDetail['statusTimeline'])
      : undefined,
    linkedMemories: Array.isArray(detail.linked_memories)
      ? (detail.linked_memories as MemoryDetail['linkedMemories'])
      : undefined,
    decisionTags: Array.isArray(detail.decision_tags)
      ? (detail.decision_tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : undefined,
    sources: Array.isArray(detail.sources)
      ? (detail.sources as MemoryDetail['sources'])
      : undefined,
    confidenceScore: typeof obj.confidence === 'number' ? obj.confidence : undefined,
    task: typeof detail.task === 'object' && detail.task !== null
      ? (detail.task as MemoryDetail['task'])
      : undefined,
    period: typeof detail.period === 'string' ? detail.period : undefined,
    agent: typeof detail.agent === 'object' && detail.agent !== null
      ? (detail.agent as MemoryDetail['agent'])
      : undefined,
    intents: Array.isArray(detail.intents)
      ? (detail.intents as unknown[]).filter((i): i is string => typeof i === 'string')
      : undefined,
    narrative: typeof detail.narrative === 'string' ? detail.narrative : undefined,
    toolCalls: Array.isArray(detail.tool_calls)
      ? (detail.tool_calls as MemoryDetail['toolCalls'])
      : undefined,
    linkedReceipts: Array.isArray(detail.linked_receipts)
      ? (detail.linked_receipts as MemoryDetail['linkedReceipts'])
      : undefined,
    handoff: typeof detail.handoff === 'object' && detail.handoff !== null
      ? (detail.handoff as MemoryDetail['handoff'])
      : undefined,
    messages: Array.isArray(detail.messages)
      ? (detail.messages as MemoryDetail['messages'])
      : undefined,
    contact: typeof detail.contact === 'object' && detail.contact !== null
      ? (detail.contact as MemoryDetail['contact'])
      : undefined,
  };
}
