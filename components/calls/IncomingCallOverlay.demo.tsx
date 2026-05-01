/**
 * IncomingCallOverlay.demo — Storybook-style fixtures for the phone overlay.
 *
 * Used by `app/demo/incoming-call.tsx` to drive the visual diff against
 * `IncomingVideoCallOverlay` (≤5% pixel delta target per plan §3.10).
 *
 * Three fixtures cover the resolution priority order:
 *   1. KNOWN_ROUTING_CONTACT — `routing_contacts` exact match (highest priority)
 *   2. RECENT_SMS_CONTACT     — matched via `sms_thread` memory contacts
 *   3. UNKNOWN_CALLER          — no match; raw E.164 only
 *
 * Each fixture pairs a `CallSession` with a corresponding `ResolvedCaller`
 * payload. The demo page injects them via the store's `triggerIncomingCall`
 * + `setResolvedCaller` helpers without going near the real backend.
 */

import type { CallSession } from '@/types/frontdesk';
import type { ResolvedCaller } from '@/lib/incomingCallOverlayStore';

export interface IncomingCallFixture {
  id: string;
  label: string;
  description: string;
  call: CallSession;
  /** Resolved caller payload to inject after the overlay shows. `null`
   *  simulates a 404 / fail-open path (overlay falls back to formatted E.164). */
  resolved: ResolvedCaller | null;
  /** Optional simulated lookup latency in ms — drives the realistic
   *  "is calling you" → resolved transition. */
  resolveDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Helper: build a synthetic CallSession with deterministic field defaults
// ---------------------------------------------------------------------------

function buildCall(overrides: Partial<CallSession> & { from_number: string }): CallSession {
  const now = new Date().toISOString();
  return {
    call_session_id: `demo-${overrides.from_number}-${Date.now()}`,
    suite_id: 'demo-suite',
    business_line_id: 'demo-line',
    owner_office_id: 'demo-office',
    direction: 'inbound',
    status: 'ringing',
    to_number: '+18445550100',
    caller_name: null,
    duration_seconds: null,
    provider: 'demo',
    provider_call_id: `demo-provider-${Date.now()}`,
    started_at: now,
    ended_at: null,
    recording_url: null,
    voicemail_url: null,
    metadata: { source: 'demo-fixture' },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture 1 — Known routing contact: highest-priority match path
// ---------------------------------------------------------------------------

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export const KNOWN_ROUTING_CONTACT_FIXTURE: IncomingCallFixture = {
  id: 'known-routing',
  label: 'Routing contact',
  description: 'Owner number from routing_contacts (highest priority match).',
  call: buildCall({ from_number: '+14045551234' }),
  resolved: {
    display_name: 'Tonio Scott',
    role: 'owner',
    contact_type: 'routing',
    last_interaction_at: new Date(Date.now() - TWO_DAYS_MS).toISOString(),
    formatted_number: '+1 (404) 555-1234',
  },
  resolveDelayMs: 220,
};

// ---------------------------------------------------------------------------
// Fixture 2 — Recent SMS contact: matched via sms_thread memory
// ---------------------------------------------------------------------------

const SIX_DAYS_MS = 1000 * 60 * 60 * 24 * 6;

export const RECENT_SMS_CONTACT_FIXTURE: IncomingCallFixture = {
  id: 'recent-sms',
  label: 'Recent SMS contact',
  description: 'Matched from a recent SMS thread (no role assigned).',
  call: buildCall({ from_number: '+13125550182' }),
  resolved: {
    display_name: 'Acme Painters',
    role: null,
    contact_type: 'sms',
    last_interaction_at: new Date(Date.now() - SIX_DAYS_MS).toISOString(),
    formatted_number: '+1 (312) 555-0182',
  },
  resolveDelayMs: 320,
};

// ---------------------------------------------------------------------------
// Fixture 3 — Unknown caller: no match, raw E.164 fallback
// ---------------------------------------------------------------------------

export const UNKNOWN_CALLER_FIXTURE: IncomingCallFixture = {
  id: 'unknown',
  label: 'Unknown caller',
  description: 'No directory match — raw formatted E.164 only.',
  call: buildCall({ from_number: '+19175550199' }),
  resolved: {
    display_name: null,
    role: null,
    contact_type: 'unknown',
    last_interaction_at: null,
    formatted_number: '+1 (917) 555-0199',
  },
  resolveDelayMs: 180,
};

// ---------------------------------------------------------------------------
// Ordered registry — used by the demo page tab strip
// ---------------------------------------------------------------------------

export const INCOMING_CALL_FIXTURES: IncomingCallFixture[] = [
  KNOWN_ROUTING_CONTACT_FIXTURE,
  RECENT_SMS_CONTACT_FIXTURE,
  UNKNOWN_CALLER_FIXTURE,
];
