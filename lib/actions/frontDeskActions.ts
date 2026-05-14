/**
 * frontDeskActions.ts — Pass F shared action layer.
 *
 * Every workspace footer button, modal footer button, and dial-pad Call
 * button calls one of these typed functions.  Each function returns
 * `Promise<ActionResult>` — never throws to callers.
 *
 * Law #2 compliance: every action returns a receipt_id.  If the backing
 * endpoint doesn't exist yet (Pass G), the action issues a client-generated
 * receipt and returns ok:true so the UX flow is unblocked.  Pass H's
 * receipt-ledger-auditor will flag missing real receipts.
 *
 * Law #7: adapters are hands — this module NEVER retries, falls back, or
 * makes autonomous decisions.  The orchestrator (LangGraph) owns retries.
 */

import { router } from 'expo-router';
import { API_BASE } from '@/lib/api/officeMemory';
import { createRoutingContact } from '@/lib/api/frontDesk';
import type { RoutingContactCreatePayload } from '@/lib/api/frontDesk';
import { supabase } from '@/lib/supabase';

/** Build headers with current Supabase Bearer token. Best-effort; if the
 *  session lookup fails the request goes out unauthenticated and the server
 *  returns a clean 401 that apiPost/apiPatch/apiDelete surface as an error. */
async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  } catch {
    // swallow — let server respond 401
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Result shape — every action returns this
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok: boolean;
  receipt_id?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Stable base URL for client-side /api/* calls. */
const BASE = API_BASE;

/**
 * A client-generated UUID that uniquely identifies a UI-originated
 * receipt prior to server confirmation.  Surfaced in the "Verified ✓"
 * toast immediately; the real server receipt may overwrite it.
 */
function clientReceiptId(): string {
  return crypto.randomUUID();
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;

  const body = payload as {
    error?: unknown;
    message?: unknown;
    detail?: unknown;
  };

  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (typeof body.error === 'string' && body.error.trim()) return body.error;

  if (body.detail && typeof body.detail === 'object') {
    const detail = body.detail as { error?: unknown; message?: unknown };
    if (typeof detail.message === 'string' && detail.message.trim()) return detail.message;
    if (typeof detail.error === 'string' && detail.error.trim()) return detail.error;
  }

  return fallback;
}

/**
 * Generic fire-and-forget fetch with timeout enforcement (<5 s).
 * Returns `{ ok, receipt_id, error }` — never throws.
 */
async function apiPost(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 5_000,
): Promise<ActionResult> {
  const clientId = clientReceiptId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      let receipt_id = clientId;
      try {
        const data = (await resp.json()) as { receipt_id?: string };
        if (data.receipt_id) receipt_id = data.receipt_id;
      } catch {
        // response body parse failure — use client id
      }
      return { ok: true, receipt_id };
    }
    // 4xx / 5xx
    let errorMsg = `HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      errorMsg = readErrorMessage(errBody, errorMsg);
    } catch {
      // ignore
    }
    return { ok: false, receipt_id: clientId, error: errorMsg };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorMsg = isAbort ? 'Request timed out' : (err instanceof Error ? err.message : 'Unknown error');
    console.warn(`[frontDeskActions] apiPost ${path} failed:`, errorMsg);
    return { ok: false, receipt_id: clientId, error: errorMsg };
  }
}

/**
 * Generic fire-and-forget fetch for PATCH/DELETE with timeout enforcement.
 * Returns `{ ok, receipt_id, error }` — never throws.
 */
async function apiPatch(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 5_000,
): Promise<ActionResult> {
  const clientId = clientReceiptId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      let receipt_id = clientId;
      try {
        const data = (await resp.json()) as { receipt_id?: string };
        if (data.receipt_id) receipt_id = data.receipt_id;
      } catch {
        // ignore
      }
      return { ok: true, receipt_id };
    }
    let errorMsg = `HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      errorMsg = readErrorMessage(errBody, errorMsg);
    } catch {
      // ignore
    }
    return { ok: false, receipt_id: clientId, error: errorMsg };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorMsg = isAbort ? 'Request timed out' : (err instanceof Error ? err.message : 'Unknown error');
    console.warn(`[frontDeskActions] apiPatch ${path} failed:`, errorMsg);
    return { ok: false, receipt_id: clientId, error: errorMsg };
  }
}

async function apiDelete(
  path: string,
  timeoutMs = 5_000,
): Promise<ActionResult> {
  const clientId = clientReceiptId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: await authHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      let receipt_id = clientId;
      try {
        const data = (await resp.json()) as { receipt_id?: string };
        if (data.receipt_id) receipt_id = data.receipt_id;
      } catch {
        // ignore
      }
      return { ok: true, receipt_id };
    }
    let errorMsg = `HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      errorMsg = readErrorMessage(errBody, errorMsg);
    } catch {
      // ignore
    }
    return { ok: false, receipt_id: clientId, error: errorMsg };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorMsg = isAbort ? 'Request timed out' : (err instanceof Error ? err.message : 'Unknown error');
    console.warn(`[frontDeskActions] apiDelete ${path} failed:`, errorMsg);
    return { ok: false, receipt_id: clientId, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// Public action functions
// ---------------------------------------------------------------------------

/**
 * Initiate an outbound call by navigating to the call room.
 *
 * Fires a fire-and-forget receipt POST to /api/receipts/voice-session
 * immediately and returns ok:true with a client receipt_id.  The call
 * room handles the real session mint.
 */
export async function callBack(
  phoneNumber: string,
  opts?: { officeId?: string },
): Promise<ActionResult> {
  const clientId = clientReceiptId();
  const cleaned = phoneNumber.replace(/\D/g, '');
  const toE164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;
  apiPost('/api/receipts/outbound-call-started', {
    event: 'outbound_call_started',
    phone: toE164,
    receipt_id: clientId,
  }).catch(() => {
    // receipt endpoint is best-effort; caller UX proceeds regardless
  });
  router.push({
    pathname: '/call-room',
    params: { phone: toE164, ...(opts?.officeId ? { officeId: opts.officeId } : {}) },
  } as never);
  return { ok: true, receipt_id: clientId };
}

/**
 * Send an SMS on an existing thread.
 *
 * Backend SmsSendRequest requires thread_memory_id + idempotency_key (Pass I fix).
 * Previously sent { thread_id, body } which the backend rejected silently.
 */
export async function sendSms(threadId: string, body: string): Promise<ActionResult> {
  // 50s client timeout — same as sendNewSms. The default apiPost timeout
  // is 5s, which aborts the request before Twilio's cold path (5-20s)
  // completes and the founder sees a fake "504". Server-side proxy has
  // a 45s budget so 50s here covers it cleanly.
  return apiPost('/api/v1/sms/send', {
    thread_memory_id: threadId,
    body,
    idempotency_key: crypto.randomUUID(),
  }, 50_000);
}

/**
 * Normalize a raw phone string to E.164 (+1XXXXXXXXXX for US/CA).
 * Returns null if normalization is not possible.
 *
 * Accepts:
 *   - 10-digit US number: '9175550200' → '+19175550200'
 *   - 11-digit (1+10):   '19175550200' → '+19175550200'
 *   - Already E.164:     '+19175550200' → '+19175550200' (pass-through)
 *
 * Rejects anything else (returns null — caller surfaces an error, never guesses).
 * Law #3: fail closed on ambiguous inputs.
 */
function normalizeToE164(raw: string): string | null {
  const stripped = raw.replace(/[^\d+]/g, '').trim();
  if (stripped.startsWith('+')) {
    const digits = stripped.slice(1);
    return /^\d{7,15}$/.test(digits) ? stripped : null;
  }
  const digits = stripped.replace(/\D/g, '');
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

/**
 * Send a new SMS to a fresh recipient (no existing thread required).
 *
 * Calls POST /api/v1/sms/send-new. The backend creates a new memory_objects
 * thread row and delegates to send_sms so all receipt/Law #2 invariants hold.
 * Returns ActionResult — never throws.
 */
export async function sendNewSms(toPhone: string, body: string): Promise<ActionResult> {
  const e164 = normalizeToE164(toPhone);
  if (!e164) {
    console.warn(
      '[frontDeskActions] sendNewSms: could not normalize to E.164.',
      'Input (truncated):', toPhone.slice(0, 20),
    );
    return {
      ok: false,
      error: 'Invalid phone number. Provide a 10-digit US number or full E.164 (+1...).',
      receipt_id: crypto.randomUUID(),
    };
  }
  // Cold-path Twilio /Messages.json can take 5-20s on first request.
  // Server-side proxy budgets 45s; client budget needs to be larger than
  // the slowest happy path or we abort before the send completes.
  return apiPost('/api/v1/sms/send-new', {
    to_phone: e164,
    body,
    idempotency_key: crypto.randomUUID(),
  }, 50_000);
}

/**
 * Mark a voicemail as reviewed.
 *
 * Target: POST /api/voicemail/{id}/mark-reviewed (Pass I — endpoint now exists).
 * Backend sets read_at; idempotent.
 */
export async function markVoicemailReviewed(voicemailId: string): Promise<ActionResult> {
  return apiPost(`/api/voicemail/${encodeURIComponent(voicemailId)}/mark-reviewed`, {
    voicemail_id: voicemailId,
  });
}

/**
 * Soft-delete a voicemail (sets archived_at; row is preserved for audit).
 *
 * Target: DELETE /api/voicemail/{id} (Pass I — endpoint now exists).
 * Yellow tier; idempotent.
 */
export async function deleteVoicemail(voicemailId: string): Promise<ActionResult> {
  return apiDelete(`/api/voicemail/${encodeURIComponent(voicemailId)}`);
}

/**
 * Reschedule a callback to a new due time.
 *
 * Target: PATCH /api/callbacks/{id}.
 *
 * Pass I P0 #4: removed the 404 fail-soft branch that rewrote a real 404 to
 * a fake `ok:true` (Law #3 fail-closed violation). The real endpoint MUST
 * exist post-backend-agent's Pass I work. If it 404s now, the error
 * surfaces inline via useAction's lastError.
 *
 * DEPENDENCY: backend agent's Pass I PR (PATCH /api/callbacks/{id} +
 * gateway proxy) must land for this to return ok:true at runtime.
 */
export async function rescheduleCallback(callbackId: string, dueAt: string): Promise<ActionResult> {
  return apiPatch(`/api/callbacks/${encodeURIComponent(callbackId)}`, {
    due_at: dueAt,
  });
}

/**
 * Mark a callback as complete.
 *
 * Target: POST /api/callbacks/{id}/complete.
 * Pass I P0 #4: no 404 fail-soft. Same dependency on backend agent's PR.
 */
export async function completeCallback(callbackId: string): Promise<ActionResult> {
  return apiPost(`/api/callbacks/${encodeURIComponent(callbackId)}/complete`, {
    callback_id: callbackId,
  });
}

/**
 * Add a phone number to routing contacts.
 *
 * Uses the existing `createRoutingContact` helper which targets
 * POST /v1/front-desk/routing-contacts (exists).
 *
 * NOTE: createRoutingContact requires `authenticatedFetch` + officeId
 * which we don't have at the action layer (not context-aware). We
 * fall back to a direct fetch so the action layer stays stateless.
 */
export async function addToContacts(record: {
  phone: string;
  name?: string;
  entity?: string;
}): Promise<ActionResult> {
  return apiPost('/api/v1/front-desk/routing-contacts', {
    role: record.entity ?? 'contact',
    label: record.name ?? record.phone,
    phone: record.phone,
  });
}

// Re-export RoutingContactCreatePayload for any callers that compose contacts directly
export type { RoutingContactCreatePayload };
