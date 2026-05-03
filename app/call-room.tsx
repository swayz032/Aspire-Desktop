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
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useSupabase } from '@/providers/SupabaseProvider';
import { CallRoom } from '@/components/call-room/CallRoom';
import type { CallState, ClientContext } from '@/components/call-room/types';

interface CallRoomQuery {
  /** E.164 dialed number, e.g. "+15558675309". Required. */
  phone?: string;
  /** Known contact name if the number matched a CRM record. */
  name?: string;
  /** Twilio call session ID for end-call wiring. */
  callId?: string;
  /** Service / inquiry hint, if known from the contact record. */
  service?: string;
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
    };
  }, [rawParams]);

  const callState = useMemo<CallState>(() => buildCallState(params), [params]);

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
    // TODO: POST /api/frontdesk/end-call with params.callId once the
    // backend endpoint exists. For now back-navigation matches the
    // existing handleEndCall behavior in app/session/calls.tsx.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/session/calls');
    }
  };

  return (
    <>
      {/* Hide the route header — the Call Room is full-bleed immersive. */}
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <CallRoom visible callState={callState} onEnd={handleEnd} />
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
