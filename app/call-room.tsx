/**
 * /call-room — Production route for an active outbound call.
 *
 * Entered by `app/session/calls.tsx::handleCall` after a successful
 * /api/twilio/voice-token mint. Receives the dialed number, the Voice
 * SDK JWT, the caller_id (Aspire number), an optional known contact
 * name, and the source button's bounding rect (for the portal-reveal
 * morph) via query params, builds a CallState, and renders the
 * immersive Call Room.
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useSupabase } from '@/providers/SupabaseProvider';
import { CallRoom } from '@/components/call-room/CallRoom';
import { PortalReveal, type PortalOrigin } from '@/components/call-room/PortalReveal';
import type { CallState, ClientContext, VoiceState } from '@/components/call-room/types';
import { useVoiceCall } from '@/lib/voice/useVoiceCall';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { fetchVoiceToken, VoiceTokenError } from '@/lib/api/voice';

interface CallRoomQuery {
  /** E.164 dialed number, e.g. "+15558675309". Required. */
  phone?: string;
  /** Known contact name if the number matched a CRM record. */
  name?: string;
  /** Twilio call session ID for end-call wiring. */
  callId?: string;
  /** Service / inquiry hint, if known from the contact record. */
  service?: string;
  /**
   * Office ID — required to mint the voice token. Replaces the legacy
   * pre-fetched voiceToken/callerId pattern (which forced a 200-800ms HTTP
   * wait on the dial pad before navigation, producing a black-screen lag).
   */
  officeId?: string;
  /** Source button bounding rect (web only) for the portal-reveal morph. */
  originX?: string;
  originY?: string;
  originW?: string;
  originH?: string;
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
      officeId: pick('officeId'),
      originX: pick('originX'),
      originY: pick('originY'),
      originW: pick('originW'),
      originH: pick('originH'),
    };
  }, [rawParams]);

  // Fetch the Twilio Voice SDK token internally so navigation stays
  // instant. Previously calls.tsx awaited fetchVoiceToken() before
  // router.push — that 200-800ms HTTP round-trip showed as a frozen dial
  // pad followed by a black screen. Now the CallRoom shell + connecting UI
  // appear immediately, and the token resolves in parallel behind it.
  const { authenticatedFetch } = useAuthFetch();
  const [voiceToken, setVoiceToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.phone || !params.officeId) return;
    let cancelled = false;
    setTokenError(null);
    setVoiceToken(null);

    fetchVoiceToken({
      authenticatedFetch,
      officeId: params.officeId,
    })
      .then((tok) => {
        if (cancelled) return;
        setVoiceToken(tok.token);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof VoiceTokenError) {
          if (err.code === 'NO_ASPIRE_NUMBER') {
            setTokenError(err.message);
          } else if (err.code === 'VOICE_NOT_CONFIGURED') {
            setTokenError(
              'In-browser calls aren’t configured for this account yet. Contact support.',
            );
          } else {
            setTokenError(err.message || 'Couldn’t set up the call.');
          }
        } else {
          setTokenError('Network error — could not set up the call.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.phone, params.officeId, authenticatedFetch]);

  // Parse the source-button rect for the portal-reveal morph. If any of the
  // four values is missing or non-numeric, drop the rect entirely — the
  // reveal falls back to a 200ms accent cross-fade on the next render. This
  // is the path on direct-URL hits, refresh, and native.
  const portalOrigin: PortalOrigin | null = useMemo(() => {
    const x = Number(params.originX);
    const y = Number(params.originY);
    const w = Number(params.originW);
    const h = Number(params.originH);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      w <= 0 ||
      h <= 0
    ) {
      return null;
    }
    return { x, y, w, h };
  }, [params.originX, params.originY, params.originW, params.originH]);

  // ----- Live voice call --------------------------------------------------
  // We only auto-navigate back when the call ENDED CLEANLY (caller hung up
  // or local hangup completed). On error/cancel we keep the user on the
  // Call Room screen so the error message stays visible — that's how we
  // diagnosed the v0 silent-failure regression.
  const navigateBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/session/calls');
    }
  }, [router]);

  const handleVoiceEnd = useCallback(
    (reason: 'completed' | 'error' | 'cancelled') => {
      if (reason === 'completed') {
        navigateBack();
      }
      // On 'error' or 'cancelled' — stay on the Call Room. The error
      // banner + status are already surfaced via voice.error / voice.status.
    },
    [navigateBack],
  );

  const voice = useVoiceCall({
    token: voiceToken,
    destination: params.phone ?? null,
    onEnd: handleVoiceEnd,
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
    // User-initiated hangup (End Call button). Always navigate back —
    // unlike SDK-initiated 'error' which keeps the user on the screen.
    voice.hangup();
    navigateBack();
  };

  return (
    <>
      {/* Hide the route header — the Call Room is full-bleed immersive. */}
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      {/* Portal-reveal: the source Call button's rect (captured by
          /session/calls handleCall) morphs to fullscreen in the Aspire
          accent, then fades — the user feels like they're entering THROUGH
          the button. CallRoom mounts beneath the overlay so it's already
          interactive when the accent fade completes. Direct-URL / refresh /
          native fall back to a 200ms accent cross-fade. */}
      <PortalReveal origin={portalOrigin}>
        <CallRoom
          visible
          callState={callState}
          voiceState={voiceState}
          onEnd={handleEnd}
          onMute={() => voice.mute()}
          onHold={() => voice.hold()}
          onSendDigit={(d) => voice.sendDigits(d)}
          errorBanner={tokenError ?? voice.error}
        />
      </PortalReveal>
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
