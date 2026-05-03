/**
 * Twilio Voice SDK token helper — Call Room production wiring.
 *
 * Single function: pre-fetches a short-lived Twilio Voice Access Token
 * before navigating to /call-room. The Call Room route reads the token
 * from query params and hands it to the `useVoiceCall` hook to register
 * the SDK Device.
 *
 * Why pre-fetch from the Return Call page rather than from the Call Room
 * itself: the user gesture that authorizes mic/AudioContext in browsers
 * is the click on the Call button. Fetching the token there + opening
 * the SDK on the same gesture chain avoids the iOS Safari mic-block path
 * where any async hop loses the gesture window.
 */

import { API_BASE } from './officeMemory';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

export interface VoiceTokenResponse {
  /** JWT to hand to `new Device(token)`. */
  token: string;
  /** The identity Twilio will see — `aspire-{suite}-{user}`. */
  identity: string;
  /** ISO-8601 expiry; refresh before this if the call runs long. */
  expires_at: string;
  /** E.164 caller_id Twilio will surface to the dialed number. */
  caller_id: string;
  /** Pre-formatted display string, e.g. `+1 (415) 555-0198`. */
  caller_id_formatted: string;
  /** Receipt id chained back to the mint event. */
  receipt_id: string;
}

export class VoiceTokenError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VoiceTokenError';
  }
}

interface FetchOpts {
  authenticatedFetch: FetchFn;
  officeId: string;
  /** Stable per-user identity component. Defaults to suite_id when omitted. */
  userId?: string;
  signal?: AbortSignal;
}

export async function fetchVoiceToken(opts: FetchOpts): Promise<VoiceTokenResponse> {
  const url = `${API_BASE}/api/twilio/voice-token`;
  const resp = await opts.authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Office-Id': opts.officeId,
    },
    body: JSON.stringify({
      ...(opts.userId ? { user_id: opts.userId } : {}),
    }),
    signal: opts.signal,
  });
  if (!resp.ok) {
    let code = 'VOICE_TOKEN_FAILED';
    let message = `Voice token request failed (${resp.status})`;
    try {
      const body = await resp.json();
      code = body?.detail?.error ?? body?.error ?? code;
      message = body?.detail?.message ?? body?.message ?? message;
    } catch {
      /* fall through to defaults */
    }
    throw new VoiceTokenError(resp.status, code, message);
  }
  return (await resp.json()) as VoiceTokenResponse;
}
