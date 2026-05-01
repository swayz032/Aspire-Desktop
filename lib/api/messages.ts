/**
 * Messages API client — Lane E6 (plan §3.9.9).
 *
 * Typed wrappers around the 9 gateway routes Lane E1 mounted under
 * `/api/messages/*`. The Express server proxies each call to the Python
 * orchestrator after minting a capability token (scope =
 * `telephony:sms_read` for reads, `telephony:sms_manage` for write,
 * `telephony:sms_send` for send) — same pattern as `frontDesk.ts` /
 * `sms.ts`. The frontend never holds the signing key (Law #5).
 *
 * Auth headers (`Authorization: Bearer <jwt>`, `X-Suite-Id`) come from the
 * caller-supplied `authenticatedFetch` (returned by `useAuthFetch()`).
 * `X-Office-Id` is added per call for office-scoped queries.
 *
 * Backend response shapes mirror plan §3.9.9 contract verbatim.
 */
import { API_BASE } from './officeMemory';
import type {
  ContactSearchResult,
  ContactSource,
} from '@/components/messages/ContactAutocomplete';
import type {
  MessageThreadSummary,
  RoutingRole,
} from '@/components/messages/fixtures';
import type {
  MessageTemplate,
  TemplateToken,
} from '@/components/messages/MessageTemplatePicker';
import type { MessageSuggestion } from '@/components/messages/MessagesSuggestedActions';
import type {
  ThreadMessage,
  TenantA2pStatus,
} from '@/components/messages/MessagesThreadView';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MessagesApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MessagesApiError';
  }
}

async function expectJson<T>(resp: Response, fallbackCode: string): Promise<T> {
  if (!resp.ok) {
    let code = fallbackCode;
    let message = `${fallbackCode} (${resp.status})`;
    try {
      const errBody = await resp.json();
      code = errBody?.detail?.error ?? errBody?.error ?? errBody?.code ?? code;
      message =
        errBody?.detail?.message ?? errBody?.message ?? errBody?.detail ?? message;
    } catch {
      // fall through
    }
    throw new MessagesApiError(resp.status, code, message);
  }
  return (await resp.json()) as T;
}

// ---------------------------------------------------------------------------
// Wire types — mirror gateway response shapes (Lane E1, plan §3.9.9)
// ---------------------------------------------------------------------------

/**
 * `GET /api/messages/threads` response.
 *
 * `nextCursor` is omitted when the page is the last page; the caller stops
 * paginating when it's missing.
 */
export interface ThreadsListResponse {
  threads: MessageThreadSummary[];
  nextCursor?: string;
}

/** `GET /api/messages/threads/{threadId}/messages` response. */
export interface ThreadMessagesResponse {
  messages: ThreadMessage[];
  nextCursor?: string;
}

/** `PATCH /api/messages/threads/{threadId}/pin` response. */
export interface TogglePinResponse {
  is_pinned: boolean;
  receipt_id?: string;
}

/** `PATCH /api/messages/threads/{threadId}/archive` response. */
export interface ToggleArchiveResponse {
  is_archived: boolean;
  receipt_id?: string;
}

/** `GET /api/messages/contacts/search` response. */
export interface ContactsSearchResponse {
  results: ContactSearchResult[];
}

/** `GET /api/messages/templates` response. */
export interface TemplatesResponse {
  templates: MessageTemplate[];
}

/** `GET /api/messages/suggestions` response. */
export interface SuggestionsResponse {
  suggestions: MessageSuggestion[];
}

/** `POST /api/messages/send` response. */
export interface SendMessageResponse {
  thread_id: string;
  message_id: string;
  /** Server returns 'sent' | 'queued' | 'failed' on success. */
  status: 'sent' | 'queued' | 'failed';
  receipt_id?: string;
}

/** `GET /api/tenant/a2p-status` response. */
export interface TenantA2pStatusResponse {
  status: TenantA2pStatus | 'rejected';
}

// ---------------------------------------------------------------------------
// Filter type — kept symmetric with the messages page filter tab type
// ---------------------------------------------------------------------------

export type MessageThreadsFilter = 'all' | 'unread' | 'pinned' | 'archived';

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const API_PREFIX = '/api/messages';

interface FetchOpts {
  authenticatedFetch: FetchFn;
  /** Tenant office id — added as `X-Office-Id` header for office-scoped reads. */
  officeId: string;
  signal?: AbortSignal;
}

/**
 * `GET /api/messages/threads?filter=...&cursor=...&limit=...`
 *
 * Reads with capability scope `telephony:sms_read` (server-minted).
 */
export async function fetchThreads(
  opts: FetchOpts & {
    filter: MessageThreadsFilter;
    cursor?: string;
    limit?: number;
  },
): Promise<ThreadsListResponse> {
  const params = new URLSearchParams({ filter: opts.filter });
  if (opts.cursor) params.set('cursor', opts.cursor);
  if (typeof opts.limit === 'number') params.set('limit', String(opts.limit));
  const url = `${API_BASE}${API_PREFIX}/threads?${params.toString()}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  return expectJson<ThreadsListResponse>(resp, 'MESSAGES_THREADS_LIST_FAILED');
}

/**
 * `GET /api/messages/threads/{threadId}/messages?before=...&limit=...`
 *
 * Cursor pagination — `before` carries the cursor returned by the previous
 * page. Reads with capability scope `telephony:sms_read`.
 */
export async function fetchThreadMessages(
  opts: FetchOpts & {
    threadId: string;
    before?: string;
    limit?: number;
  },
): Promise<ThreadMessagesResponse> {
  const params = new URLSearchParams();
  if (opts.before) params.set('before', opts.before);
  if (typeof opts.limit === 'number') params.set('limit', String(opts.limit));
  const qs = params.toString();
  const url = `${API_BASE}${API_PREFIX}/threads/${encodeURIComponent(
    opts.threadId,
  )}/messages${qs ? `?${qs}` : ''}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  return expectJson<ThreadMessagesResponse>(
    resp,
    'MESSAGES_THREAD_MESSAGES_FAILED',
  );
}

/**
 * `PATCH /api/messages/threads/{threadId}/read` — marks the thread read.
 * Server cuts an `sms_thread_read` receipt (Law #2). Capability scope
 * `telephony:sms_manage`.
 */
export async function markThreadRead(
  opts: FetchOpts & { threadId: string },
): Promise<void> {
  const url = `${API_BASE}${API_PREFIX}/threads/${encodeURIComponent(
    opts.threadId,
  )}/read`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({}),
    signal: opts.signal,
  });
  if (!resp.ok) {
    // Even no-body responses must be checked for status.
    await expectJson<unknown>(resp, 'MESSAGES_THREAD_READ_FAILED');
  }
}

/**
 * `PATCH /api/messages/threads/{threadId}/pin` — toggles pin state. Returns
 * the new boolean. Capability scope `telephony:sms_manage`.
 */
export async function togglePinThread(
  opts: FetchOpts & { threadId: string },
): Promise<TogglePinResponse> {
  const url = `${API_BASE}${API_PREFIX}/threads/${encodeURIComponent(
    opts.threadId,
  )}/pin`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({}),
    signal: opts.signal,
  });
  return expectJson<TogglePinResponse>(resp, 'MESSAGES_THREAD_PIN_FAILED');
}

/**
 * `PATCH /api/messages/threads/{threadId}/archive` — toggles archive state.
 * Returns the new boolean. Capability scope `telephony:sms_manage`.
 */
export async function toggleArchiveThread(
  opts: FetchOpts & { threadId: string },
): Promise<ToggleArchiveResponse> {
  const url = `${API_BASE}${API_PREFIX}/threads/${encodeURIComponent(
    opts.threadId,
  )}/archive`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({}),
    signal: opts.signal,
  });
  return expectJson<ToggleArchiveResponse>(
    resp,
    'MESSAGES_THREAD_ARCHIVE_FAILED',
  );
}

/**
 * `GET /api/messages/contacts/search?q=...&limit=...`
 *
 * Searches across `routing_contacts` + `sms_thread` contacts + recent calls,
 * ranked by source priority. Reads with capability scope `telephony:sms_read`.
 *
 * Empty query returns the unranked default set (used by ContactsSidePanel
 * to drive routing/recentSms/recentCalls sections from a single endpoint).
 */
export async function searchContacts(
  opts: FetchOpts & { query: string; limit?: number },
): Promise<ContactSearchResult[]> {
  const params = new URLSearchParams({ q: opts.query });
  if (typeof opts.limit === 'number') params.set('limit', String(opts.limit));
  const url = `${API_BASE}${API_PREFIX}/contacts/search?${params.toString()}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  const json = await expectJson<ContactsSearchResponse>(
    resp,
    'MESSAGES_CONTACTS_SEARCH_FAILED',
  );
  return json.results ?? [];
}

/**
 * `GET /api/messages/templates` — the 5 V1 templates (plan §3.9.7).
 * Capability scope `telephony:sms_read`.
 */
export async function fetchTemplates(
  opts: FetchOpts,
): Promise<MessageTemplate[]> {
  const url = `${API_BASE}${API_PREFIX}/templates`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  const json = await expectJson<TemplatesResponse>(
    resp,
    'MESSAGES_TEMPLATES_FAILED',
  );
  return json.templates ?? [];
}

/**
 * `GET /api/messages/suggestions?limit=...`
 *
 * Ava-recommended follow-ups from the proactive_candidate engine.
 * Capability scope `telephony:sms_read`.
 */
export async function fetchSuggestions(
  opts: FetchOpts & { limit?: number },
): Promise<MessageSuggestion[]> {
  const params = new URLSearchParams();
  if (typeof opts.limit === 'number') params.set('limit', String(opts.limit));
  const qs = params.toString();
  const url = `${API_BASE}${API_PREFIX}/suggestions${qs ? `?${qs}` : ''}`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  const json = await expectJson<SuggestionsResponse>(
    resp,
    'MESSAGES_SUGGESTIONS_FAILED',
  );
  return json.suggestions ?? [];
}

/**
 * `POST /api/messages/send` — outbound SMS. Yellow-tier; the caller is
 * responsible for the explicit user-confirmation UX (Law #4). Capability
 * scope `telephony:sms_send` (server-minted before forwarding).
 *
 * @param idempotencyKey caller-supplied UUID (10–128 chars). Server enforces
 *                       uniqueness; same key = same response.
 */
export async function sendMessage(
  opts: FetchOpts & {
    phone: string;
    body: string;
    idempotencyKey: string;
  },
): Promise<SendMessageResponse> {
  const url = `${API_BASE}${API_PREFIX}/send`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({
      phone: opts.phone,
      body: opts.body,
      idempotency_key: opts.idempotencyKey,
    }),
    signal: opts.signal,
  });
  return expectJson<SendMessageResponse>(resp, 'MESSAGES_SEND_FAILED');
}

/**
 * `GET /api/tenant/a2p-status` — registration status for the tenant. Used
 * to gate the composer + show banner. May not be exposed by Lane B yet —
 * caller (`useTenantA2pStatus`) handles 404 gracefully by defaulting to
 * `'unregistered'`.
 */
export async function fetchTenantA2pStatus(
  opts: FetchOpts,
): Promise<TenantA2pStatus> {
  const url = `${API_BASE}/api/tenant/a2p-status`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'GET',
    headers: { 'X-Office-Id': opts.officeId },
    signal: opts.signal,
  });
  if (resp.status === 404) {
    // Lane B route not yet deployed — fail safe (caller treats as unreg).
    throw new MessagesApiError(404, 'A2P_STATUS_NOT_AVAILABLE', 'A2P status route not yet exposed');
  }
  const json = await expectJson<TenantA2pStatusResponse>(
    resp,
    'TENANT_A2P_STATUS_FAILED',
  );
  // `'rejected'` is a valid backend state but the UI only knows
  // unregistered/pending/registered — collapse rejected→unregistered with the
  // banner copy reading "registration required" (matches the unregistered UX).
  if (json.status === 'rejected') return 'unregistered';
  return json.status;
}

// Re-export the consumer-shape types to keep imports tidy.
export type {
  ContactSearchResult,
  ContactSource,
  MessageThreadSummary,
  RoutingRole,
  MessageTemplate,
  TemplateToken,
  MessageSuggestion,
  ThreadMessage,
  TenantA2pStatus,
};
