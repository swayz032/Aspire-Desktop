/**
 * SMS API client — Pass 17 §17.D.
 *
 * Wraps the Pass 16 backend route:
 *   POST /v1/sms/send  — Yellow tier outbound SMS (capability token required).
 *
 * Request goes through same-origin `/api/v1/sms/send` so the Express server
 * mints the capability token (scope = `telephony:sms_send`) + injects scope
 * headers before forwarding to the orchestrator.
 *
 * Backend contract (verified):
 *   request:  { thread_memory_id, body, idempotency_key }
 *   response: { success, message_sid, status, receipt_id }
 *
 * Idempotency key format per backend §16.E: SHA256(thread_id||body||
 * timestamp_minute). We compute it client-side in `buildSmsIdempotencyKey`.
 */

import { API_BASE } from './officeMemory';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SmsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SmsApiError';
  }
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface SmsSendResponse {
  message_sid: string;
  status: string; // queued | sent | delivered | failed | undelivered
  receipt_id: string;
}

// ---------------------------------------------------------------------------
// Idempotency key — keep client-side derivation minimal; server is authoritative.
// ---------------------------------------------------------------------------

/**
 * Build a minute-bucketed idempotency key. Hash strength is not security-
 * critical here — server enforces uniqueness; this just prevents accidental
 * dupes from double-clicks within the same minute.
 *
 * Web has `crypto.subtle.digest`; native (RN) does not. We fall back to a
 * deterministic non-crypto string for native builds; the server still
 * enforces uniqueness on the value as a string (10-128 chars), so a
 * non-hashed deterministic key is acceptable.
 */
export async function buildSmsIdempotencyKey(threadId: string, body: string): Promise<string> {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const raw = `${threadId}|${body}|${minuteBucket}`;
  if (typeof crypto !== 'undefined' && typeof (crypto as Crypto).subtle?.digest === 'function') {
    try {
      const data = new TextEncoder().encode(raw);
      const digest = await (crypto as Crypto).subtle.digest('SHA-256', data);
      const bytes = Array.from(new Uint8Array(digest));
      return 'sms_' + bytes.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 60);
    } catch {
      // fall through
    }
  }
  // Native fallback: deterministic but non-crypto. Server-side is the
  // authoritative dedupe boundary anyway.
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return `sms_${minuteBucket}_${Math.abs(h).toString(36)}`.slice(0, 64);
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

interface SendSmsOpts {
  authenticatedFetch: FetchFn;
  officeId: string;
  threadMemoryId: string;
  body: string;
  signal?: AbortSignal;
}

/**
 * Yellow tier — server mints capability token before forwarding to orchestrator.
 *
 * Caller is responsible for the explicit user-confirmation UX before invoking
 * this function (per Aspire Law #4).
 */
export async function sendSMS(opts: SendSmsOpts): Promise<SmsSendResponse> {
  const idempotency_key = await buildSmsIdempotencyKey(opts.threadMemoryId, opts.body);
  const url = `${API_BASE}/api/v1/sms/send`;

  const resp = await opts.authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({
      thread_memory_id: opts.threadMemoryId,
      body: opts.body,
      idempotency_key,
    }),
    signal: opts.signal,
  });

  if (!resp.ok) {
    let code = 'SMS_SEND_FAILED';
    let message = `SMS send failed (${resp.status})`;
    try {
      const errBody = await resp.json();
      code = errBody?.detail?.error ?? errBody?.error ?? code;
      message = errBody?.detail?.message ?? errBody?.message ?? message;
    } catch {
      // ignore
    }
    throw new SmsApiError(resp.status, code, message);
  }

  const json = (await resp.json()) as { message_sid: string; status: string; receipt_id: string };
  return {
    message_sid: json.message_sid,
    status: json.status,
    receipt_id: json.receipt_id,
  };
}
