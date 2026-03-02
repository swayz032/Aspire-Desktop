import type { CallSession } from '@/types/frontdesk';

export interface IncomingCallOverlayState {
  visible: boolean;
  call: CallSession | null;
  isTest: boolean;
}

type Subscriber = (state: IncomingCallOverlayState) => void;

let state: IncomingCallOverlayState = {
  visible: false,
  call: null,
  isTest: false,
};

const subscribers = new Set<Subscriber>();

function emit(): void {
  for (const sub of subscribers) {
    sub(state);
  }
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

export function showIncomingCallOverlay(call: CallSession, isTest = false): void {
  state = {
    visible: true,
    call,
    isTest,
  };
  emit();
}

export function dismissIncomingCallOverlay(): void {
  state = {
    visible: false,
    call: null,
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

