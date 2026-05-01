import type { CallSession } from '@/types/frontdesk';

/**
 * Caller-ID lookup result returned by `GET /v1/calls/caller-id-lookup`.
 *
 * Priority order (resolved server-side):
 *   routing_contacts → sms_thread memory → recent call memory → unknown.
 *
 * Frontend renders display_name + role + a "last interaction" hint when
 * available; falls back to formatted E.164 if `contact_type === 'unknown'`.
 */
export type CallerIdContactType = 'routing' | 'sms' | 'call_history' | 'unknown';

export interface ResolvedCaller {
  /** Display name. `null` for unknown. */
  display_name: string | null;
  /** Role from routing_contacts (e.g. 'owner', 'sales'). `null` if unmatched. */
  role: string | null;
  /** Source of the resolution. Drives badge styling on the overlay. */
  contact_type: CallerIdContactType;
  /** ISO timestamp of last known interaction with this number. `null` if none. */
  last_interaction_at: string | null;
  /** Always-present formatted E.164 fallback for the raw number. */
  formatted_number: string;
}

/** Function the store calls to resolve a caller. Injected by the consumer
 *  (typically the overlay component, which has access to `useAuthFetch`).
 *  Returning `null` is a soft-fail — overlay falls back to `formatted_number`
 *  derived from the raw `from_number` on the call. */
export type CallerIdResolver = (
  phone: string,
  signal: AbortSignal,
) => Promise<ResolvedCaller | null>;

export interface IncomingCallOverlayState {
  visible: boolean;
  call: CallSession | null;
  /** Lookup result. `null` while pending or unresolved. */
  resolvedCaller: ResolvedCaller | null;
  /** True while a caller-ID lookup is in flight. */
  isResolving: boolean;
  isTest: boolean;
}

type Subscriber = (state: IncomingCallOverlayState) => void;

let state: IncomingCallOverlayState = {
  visible: false,
  call: null,
  resolvedCaller: null,
  isResolving: false,
  isTest: false,
};

const subscribers = new Set<Subscriber>();

/**
 * Active caller-ID lookup controller. Held at module scope so dismissing the
 * overlay can cancel a pending lookup without leaking pending fetches.
 */
let activeLookupController: AbortController | null = null;

/**
 * Resolver registered by the overlay component on mount. The store invokes
 * this when `triggerIncomingCall` fires; if no resolver is registered (e.g.
 * during SSR or before mount), the lookup is skipped and the overlay just
 * uses the formatted E.164 fallback.
 */
let resolver: CallerIdResolver | null = null;

function emit(): void {
  for (const sub of subscribers) {
    sub(state);
  }
}

function setState(next: Partial<IncomingCallOverlayState>): void {
  state = { ...state, ...next };
  emit();
}

export function subscribeIncomingCallOverlay(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  subscriber(state);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function getIncomingCallOverlayState(): IncomingCallOverlayState {
  return state;
}

/**
 * Register the caller-ID resolver. Called by the overlay component on mount.
 * Idempotent — calling twice replaces the resolver.
 */
export function registerCallerIdResolver(next: CallerIdResolver | null): void {
  resolver = next;
}

/**
 * Format a raw E.164-ish phone string into a display-ready value. Used as a
 * fail-open fallback when the lookup hasn't resolved yet (or never resolves).
 */
export function formatPhoneNumber(number: string | null): string {
  if (!number) return 'Unknown number';
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return number;
}

/**
 * Show the overlay (legacy entry point — used by `useFrontdeskCalls` polling
 * loop). Does NOT trigger a caller-ID lookup. Prefer `triggerIncomingCall`.
 *
 * Preserved for backward compatibility with existing tests + call sites.
 */
export function showIncomingCallOverlay(call: CallSession, isTest = false): void {
  // Cancel any pending lookup from a prior overlay
  if (activeLookupController) {
    activeLookupController.abort();
    activeLookupController = null;
  }
  state = {
    visible: true,
    call,
    resolvedCaller: null,
    isResolving: false,
    isTest,
  };
  emit();
}

/**
 * Show the overlay AND kick off a caller-ID lookup in parallel. Resolved
 * result lands in store via `setResolvedCaller`; overlay re-renders smoothly.
 * If no resolver is registered (or lookup fails), overlay falls back to
 * formatted E.164.
 */
export function triggerIncomingCall(call: CallSession, isTest = false): void {
  // Cancel any prior in-flight lookup
  if (activeLookupController) {
    activeLookupController.abort();
    activeLookupController = null;
  }

  state = {
    visible: true,
    call,
    resolvedCaller: null,
    isResolving: Boolean(resolver && call.from_number),
    isTest,
  };
  emit();

  // Fire lookup if we have a resolver + a phone number to look up
  if (!resolver || !call.from_number) return;

  const controller = new AbortController();
  activeLookupController = controller;

  resolver(call.from_number, controller.signal)
    .then((resolved) => {
      // Stale-result guard: only apply if this lookup is still the active one
      // AND the overlay hasn't been dismissed/replaced since.
      if (activeLookupController !== controller) return;
      if (!state.visible || state.call?.call_session_id !== call.call_session_id) return;

      setState({
        resolvedCaller: resolved,
        isResolving: false,
      });
    })
    .catch(() => {
      // Soft-fail: leave resolvedCaller null, overlay falls back to E.164.
      if (activeLookupController !== controller) return;
      if (!state.visible || state.call?.call_session_id !== call.call_session_id) return;
      setState({ isResolving: false });
    })
    .finally(() => {
      if (activeLookupController === controller) {
        activeLookupController = null;
      }
    });
}

/**
 * Manually inject a resolved-caller payload (used by demo fixtures + test
 * helpers). Skips the resolver entirely.
 */
export function setResolvedCaller(resolved: ResolvedCaller | null): void {
  setState({ resolvedCaller: resolved, isResolving: false });
}

export function dismissIncomingCallOverlay(): void {
  // Cancel pending lookup so we don't get late writes after dismissal
  if (activeLookupController) {
    activeLookupController.abort();
    activeLookupController = null;
  }
  state = {
    visible: false,
    call: null,
    resolvedCaller: null,
    isResolving: false,
    isTest: false,
  };
  emit();
}

export function triggerTestIncomingCall(): void {
  const now = new Date().toISOString();
  const testCall: CallSession = {
    call_session_id: `test-${Date.now()}`,
    suite_id: 'test-suite',
    business_line_id: 'test-line',
    owner_office_id: 'test-office',
    direction: 'inbound',
    status: 'ringing',
    from_number: '+15551234567',
    to_number: '+15557654321',
    caller_name: 'Test Caller',
    duration_seconds: null,
    provider: 'test',
    provider_call_id: `test-provider-${Date.now()}`,
    started_at: now,
    ended_at: null,
    recording_url: null,
    voicemail_url: null,
    metadata: { source: 'setup-test-button' },
    created_at: now,
    updated_at: now,
  };

  showIncomingCallOverlay(testCall, true);
}
