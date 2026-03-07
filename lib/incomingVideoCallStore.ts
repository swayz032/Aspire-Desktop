/**
 * Incoming Video Call Store
 *
 * Listener-based store for FaceTime-style incoming video call notifications.
 * Follows the exact pattern of incomingCallOverlayStore.ts.
 *
 * Flow: Supabase Realtime INSERT → useRealtimeConferenceInvitations → showIncomingVideoCall
 *       → IncomingVideoCallOverlay renders → user accepts/declines → PATCH API
 */

export interface VideoCallInvitation {
  id: string;
  inviterName: string;
  inviterAvatarUrl: string | null;
  inviterSuiteDisplayId: string;
  inviterOfficeDisplayId: string;
  inviterBusinessName: string | null;
  roomName: string;
  serverUrl: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

interface IncomingVideoCallState {
  visible: boolean;
  invitation: VideoCallInvitation | null;
}

type Subscriber = (state: IncomingVideoCallState) => void;

let state: IncomingVideoCallState = {
  visible: false,
  invitation: null,
};

const subscribers = new Set<Subscriber>();

function emit(): void {
  for (const sub of subscribers) {
    sub(state);
  }
}

export function subscribeIncomingVideoCall(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  subscriber(state);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function getIncomingVideoCallState(): IncomingVideoCallState {
  return state;
}

export function showIncomingVideoCall(invitation: VideoCallInvitation): void {
  state = {
    visible: true,
    invitation,
  };
  emit();
}

export function dismissIncomingVideoCall(): void {
  state = {
    visible: false,
    invitation: null,
  };
  emit();
}

export function getCurrentVideoCallInvitation(): VideoCallInvitation | null {
  return state.invitation;
}

/**
 * Accept a video call invitation via the PATCH endpoint.
 * Returns the LiveKit token, server URL, and room name for joining.
 *
 * Law #3: Fail Closed — accessToken is required for auth. Requests without
 * a valid Bearer token are rejected 401 by Express middleware.
 */
export async function acceptVideoCall(
  invitationId: string,
  accessToken: string,
  suiteId?: string,
): Promise<{ token: string; serverUrl: string; roomName: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
  if (suiteId) headers['X-Suite-Id'] = suiteId;

  const res = await fetch(`/api/conference/invite-internal/${invitationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'accept' }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Failed to accept invitation' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  dismissIncomingVideoCall();
  return { token: data.token, serverUrl: data.serverUrl, roomName: data.roomName };
}

/**
 * Decline a video call invitation via the PATCH endpoint.
 *
 * Law #3: Fail Closed — accessToken is required for auth.
 */
export async function declineVideoCall(
  invitationId: string,
  accessToken: string,
  suiteId?: string,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
  if (suiteId) headers['X-Suite-Id'] = suiteId;

  const res = await fetch(`/api/conference/invite-internal/${invitationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ action: 'decline' }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Failed to decline invitation' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  dismissIncomingVideoCall();
}
