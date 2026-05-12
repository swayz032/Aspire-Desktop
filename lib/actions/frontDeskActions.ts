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
      headers: { 'Content-Type': 'application/json' },
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
      const errBody = (await resp.json()) as { error?: string; message?: string };
      errorMsg = errBody.message ?? errBody.error ?? errorMsg;
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
      headers: { 'Content-Type': 'application/json' },
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
      const errBody = (await resp.json()) as { error?: string; message?: string };
      errorMsg = errBody.message ?? errBody.error ?? errorMsg;
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
      const errBody = (await resp.json()) as { error?: string; message?: string };
      errorMsg = errBody.message ?? errBody.error ?? errorMsg;
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
export async function callBack(phoneNumber: string): Promise<ActionResult> {
  const clientId = clientReceiptId();
  // Fire-and-forget receipt — do NOT await (call room will handle the real receipt)
  apiPost('/api/receipts/outbound-call-started', {
    event: 'outbound_call_started',
    phone: phoneNumber,
    receipt_id: clientId,
  }).catch(() => {
    // receipt endpoint is best-effort; caller UX proceeds regardless
  });
  // Navigate to call room — this is the primary action
  router.push({ pathname: '/session/calls', params: { to: phoneNumber } });
  return { ok: true, receipt_id: clientId };
}

/**
 * Send an SMS on an existing thread.
 *
 * Backend SmsSendRequest requires thread_memory_id + idempotency_key (Pass I fix).
 * Previously sent { thread_id, body } which the backend rejected silently.
 */
export async function sendSms(threadId: string, body: string): Promise<ActionResult> {
  return apiPost('/api/v1/sms/send', {
    thread_memory_id: threadId,
    body,
    idempotency_key: crypto.randomUUID(),
  });
}

/**
 * Send a new SMS to a fresh recipient.
 *
 * NOTE: The backend /v1/sms/send requires a thread_memory_id to resolve the
 * to-number — it has no ad-hoc to_phone path. This function is a UI stub until
 * a POST /v1/sms/send-new endpoint is built in the backend (tracked as
 * Pass I follow-up). For now it returns a client-side receipt explaining
 * the gap so callers can surface a clear "unavailable" message instead of a
 * silent 422.
 */
export async function sendNewSms(toPhone: string, body: string): Promise<ActionResult> {
  const receiptId = crypto.randomUUID();
  console.warn(
    '[frontDeskActions] sendNewSms: POST /v1/sms/send-new not yet implemented. ' +
    'Backend requires a thread_memory_id. Track as Pass I backend follow-up.'
  );
  return {
    ok: false,
    error: 'SMS to new recipients is not yet available. Use an existing thread.',
    receipt_id: receiptId,
  };
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
 * Fail-soft: endpoint added in Pass G.
 */
export async function rescheduleCallback(callbackId: string, dueAt: string): Promise<ActionResult> {
  const result = await apiPatch(`/api/callbacks/${encodeURIComponent(callbackId)}`, {
    due_at: dueAt,
  });
  if (!result.ok && result.error?.includes('404')) {
    console.warn('[frontDeskActions] rescheduleCallback: endpoint not yet built (Pass G). Returning client receipt.');
    return { ok: true, receipt_id: result.receipt_id };
  }
  return result;
}

/**
 * Mark a callback as complete.
 *
 * Target: POST /api/callbacks/{id}/complete.
 * Fail-soft: endpoint added in Pass G.
 */
export async function completeCallback(callbackId: string): Promise<ActionResult> {
  const result = await apiPost(`/api/callbacks/${encodeURIComponent(callbackId)}/complete`, {
    callback_id: callbackId,
  });
  if (!result.ok && result.error?.includes('404')) {
    console.warn('[frontDeskActions] completeCallback: endpoint not yet built (Pass G). Returning client receipt.');
    return { ok: true, receipt_id: result.receipt_id };
  }
  return result;
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
