/**
 * /call-room — Production route for an active outbound call.
 *
 * Entered by `app/session/calls.tsx::handleCall` after a successful POST
 * to /api/frontdesk/outbound-call. Receives the dialed number, optional
 * known contact name, and the Twilio call session ID via query params,
 * builds a CallState, and renders the immersive Call Room.
 *
 * Auth: any authenticated tenant member. The route does NOT founder-gate
 * (unlike /_dev/call-room which is the demo preview); production calls
 * must be reachable by the actual operator using Aspire.
 *
 * Voice activity: TODO — wire to the active Twilio audio track level
 * subscription. For now the prop is left undefined (silence/static ring).
 *
 * End Call: navigates back. Real Twilio termination via /api/frontdesk
 * end-call endpoint will be wired here once that endpoint exists; until
 * then the back-navigation lets the user exit while the call continues
 * on the Twilio side (matches the prior calls.tsx behavior).
 */
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useSupabase } from '@/providers/SupabaseProvider';
import { CallRoom } from '@/components/call-room/CallRoom';
import type { CallState, ClientContext, VoiceState } from '@/components/call-room/types';
import { useVoiceCall } from '@/lib/voice/useVoiceCall';

interface CallRoomQuery {
  /** E.164 dialed number, e.g. "+15558675309". Required. */
  phone?: string;
  /** Known contact name if the number matched a CRM record. */
  name?: string;
  /** Twilio call session ID for end-call wiring. */
  callId?: string;
  /** Service / inquiry hint, if known from the contact record. */
  service?: string;
  /** Twilio Voice SDK JWT, pre-fetched on the Return Call page. */
  voiceToken?: string;
  /** E.164 caller_id Twilio will surface (the office's Aspire number). */
  callerId?: string;
}

function buildCallState(query: CallRoomQuery): CallState {
  const client: ClientContext = {
    id: query.callId ? `call:${query.callId}` : 'call:unknown',
    name: query.name?.trim() || null,
    phoneE164: query.phone?.trim() || '+10000000000',
    photoUrl: null,
    avatarMode: 'contact',
    service: query.service?.trim() || null,
    urgency: null,
    note: null,
  };

  return {
    status: 'connected',
    startedAt: Date.now(),
    hostAgent: {
      id: 'agent_sarah',
      name: 'Sarah',
      photoUrl: null,
    },
    client,
    isMuted: false,
    isOnHold: false,
  };
}

export default function CallRoomRoute(): React.ReactElement {
  const router = useRouter();
  const { session, isLoading } = useSupabase();
  const rawParams = useLocalSearchParams();
  const params: CallRoomQuery = useMemo(() => {
    const pick = (k: string): string | undefined => {
      const v = rawParams[k];
      return Array.isArray(v) ? v[0] : v;
    };
    return {
      phone: pick('phone'),
      name: pick('name'),
      callId: pick('callId'),
      service: pick('service'),
      voiceToken: pick('voiceToken'),
      callerId: pick('callerId'),
    };
  }, [rawParams]);

  // ----- Live voice call --------------------------------------------------
  // Navigate back to the Return Call page when the SDK reports an end
  // (caller hung up, error, or local hangup).
  const navigateBackOnEnd = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/session/calls');
    }
  }, [router]);

  const voice = useVoiceCall({
    token: params.voiceToken ?? null,
    destination: params.phone ?? null,
    onEnd: navigateBackOnEnd,
  });

  const baseCallState = useMemo<CallState>(() => buildCallState(params), [params]);
  const callState = useMemo<CallState>(() => {
    // Mirror SDK status into the existing CallState shape consumed by
    // CallRoomCard / Controls. Where the SDK reports a more specific
    // status than 'connected' (idle/dialing/ringing/on_hold/ended/error),
    // we surface it; otherwise the fixture default 'connected' stands.
    const sdkStatus = voice.status;
    const mapped: CallState['status'] =
      sdkStatus === 'idle'
        ? 'connected'
        : sdkStatus === 'error'
          ? 'ended'
          : sdkStatus;
    return {
      ...baseCallState,
      status: mapped,
      isMuted: voice.isMuted,
      isOnHold: sdkStatus === 'on_hold',
    };
  }, [baseCallState, voice.status, voice.isMuted]);

  // Audio-level driven pulse ring. VoiceState is a simple discriminator
  // ('silence' | 'caller' | 'host'); we threshold the SDK output volume
  // (0..1, the destination's voice) so the avatar pulses while they speak.
  const voiceState = useMemo<VoiceState>(() => {
    if (voice.status !== 'connected') return 'silence';
    return voice.audioLevel > 0.05 ? 'caller' : 'silence';
  }, [voice.status, voice.audioLevel]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  // Any authenticated tenant member can be on a call. Unauthenticated -> /.
  if (!session) {
    return <Redirect href="/" />;
  }

  // No phone provided -> nothing to display, send back to the calls page.
  if (!params.phone) {
    return <Redirect href="/session/calls" />;
  }

  const handleEnd = () => {
    // Cleanly hang up via the SDK if connected; the SDK's 'disconnect'
    // event fires onEnd which navigates back. Calling navigateBackOnEnd
    // directly here as a fallback when the SDK never connected.
    voice.hangup();
    if (voice.status === 'idle' || voice.status === 'error') {
      navigateBackOnEnd();
    }
  };

  return (
    <>
      {/* Hide the route header — the Call Room is full-bleed immersive. */}
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <CallRoom
        visible
        callState={callState}
        voiceState={voiceState}
        onEnd={handleEnd}
        onMute={() => voice.mute()}
        onHold={() => voice.hold()}
        onSendDigit={(d) => voice.sendDigits(d)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
