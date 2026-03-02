import {
  dismissIncomingCallOverlay,
  getIncomingCallOverlayState,
  showIncomingCallOverlay,
  subscribeIncomingCallOverlay,
  triggerTestIncomingCall,
} from '../incomingCallOverlayStore';
import type { CallSession } from '@/types/frontdesk';

function mockCall(id: string): CallSession {
  const now = new Date().toISOString();
  return {
    call_session_id: id,
    suite_id: 'suite-1',
    business_line_id: 'line-1',
    owner_office_id: 'office-1',
    direction: 'inbound',
    status: 'ringing',
    from_number: '+15551234567',
    to_number: '+15557654321',
    caller_name: 'Caller',
    duration_seconds: null,
    provider: 'test',
    provider_call_id: `provider-${id}`,
    started_at: now,
    ended_at: null,
    recording_url: null,
    voicemail_url: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
}

describe('incomingCallOverlayStore', () => {
  beforeEach(() => {
    dismissIncomingCallOverlay();
  });

  it('shows and dismisses overlay state', () => {
    const call = mockCall('call-1');
    showIncomingCallOverlay(call, false);
    const shown = getIncomingCallOverlayState();
    expect(shown.visible).toBe(true);
    expect(shown.call?.call_session_id).toBe('call-1');

    dismissIncomingCallOverlay();
    const hidden = getIncomingCallOverlayState();
    expect(hidden.visible).toBe(false);
    expect(hidden.call).toBeNull();
  });

  it('notifies subscribers', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeIncomingCallOverlay(callback);

    showIncomingCallOverlay(mockCall('call-2'), false);
    expect(callback).toHaveBeenCalled();

    unsubscribe();
  });

  it('creates test incoming call', () => {
    triggerTestIncomingCall();
    const state = getIncomingCallOverlayState();
    expect(state.visible).toBe(true);
    expect(state.isTest).toBe(true);
    expect(state.call?.status).toBe('ringing');
  });
});

