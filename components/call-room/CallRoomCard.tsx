// components/call-room/CallRoomCard.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CallState, ClientContext, VoiceState } from './types';
import { ClientMemoryPanel } from './ClientMemoryPanel';
import { AIAssistPanel } from './AIAssistPanel';
import { KeypadPanel } from './KeypadPanel';
import { TransferPanel } from './TransferPanel';
import { ContactsPanel } from './ContactsPanel';
import { CallRoomControls } from './CallRoomControls';
import { useCardTilt } from './hooks/useCardTilt';
import type { TimeOfDayState } from './types';

type RightPanel = 'ai-assist' | 'keypad' | 'transfer' | 'contacts';

export interface CallRoomCardProps {
  callState: CallState;
  // Kept for prop-shape compat with parent; the card itself is time-agnostic.
  // The screen-glow night effect lives on CallRoom (above the card).
  forcedTimeOfDay?: TimeOfDayState;
  /** Live voice-activity flag. Drives the avatar pulse ring. */
  voiceState?: VoiceState;
  /** End Call handler — terminates the call leg and exits the room. */
  onEnd?: () => void;
  /** Toggle mute on the active SDK call. */
  onMute?: () => void;
  /** Toggle hold (v1: mute outgoing audio + status='on_hold'). */
  onHold?: () => void;
  /** Send a single DTMF digit on the active SDK call. */
  onSendDigit?: (digit: string) => void;
}

const GLASS_BG = 'rgba(15, 18, 24, 0.65)';
const GLASS_BORDER = 'rgba(120, 170, 220, 0.35)';
const ASPIRE_GLOW = 'rgba(120, 170, 220, 0.18)';

export function CallRoomCard({
  callState,
  voiceState,
  onEnd,
  onMute,
  onHold,
  onSendDigit,
}: CallRoomCardProps): React.ReactElement {
  const tilt = useCardTilt(2);
  const isWeb = Platform.OS === 'web';
  const [rightPanel, setRightPanel] = useState<RightPanel>('ai-assist');

  const toggleRightPanel = (panel: Exclude<RightPanel, 'ai-assist'>) =>
    setRightPanel((current) => (current === panel ? 'ai-assist' : panel));
  const backToAssist = () => setRightPanel('ai-assist');

  // Web-only: subtle card tilt for depth (no cursor light tracking).
  const dynamicCardStyle =
    isWeb
      ? ({
          transform: `perspective(1400px) rotateX(${tilt.rotateX.toFixed(
            2,
          )}deg) rotateY(${tilt.rotateY.toFixed(2)}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 220ms ease-out',
        } as object)
      : undefined;

  return (
    <View style={[styles.card, dynamicCardStyle]} testID="call-room-card">
      {/* Edge highlight + refraction (web-only premium glass layers) */}
      {isWeb && (
        <>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 18,
                // @ts-expect-error - web-only
                background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 12%)',
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: 18,
                // @ts-expect-error - web-only
                background:
                  'linear-gradient(105deg, rgba(212,165,116,0.06) 0%, rgba(120,170,220,0.03) 50%, transparent 100%)',
              },
            ]}
          />

        </>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Front Desk Call Room</Text>
        <Text style={styles.headerSubtitle}>
          {callState.hostAgent.name} hosting · Outbound call in progress
        </Text>
      </View>

      {/* Body — 3 columns: Client Memory · Center Stage · AI Assist */}
      <View style={styles.body}>
        <View style={[styles.column, styles.leftColumn]} testID="call-room-client-memory">
          <ClientMemoryPanel client={callState.client} />
        </View>

        <View style={[styles.column, styles.centerColumn]} testID="call-room-center">
          <CallerAvatar client={callState.client} voiceState={voiceState} />
          <Text style={cardStyles.timer}>{formatDuration(callState.startedAt)}</Text>
          <Text style={cardStyles.callerName}>
            {callState.client.name ?? 'Unknown caller'}
          </Text>
          <Text style={cardStyles.callerPhone}>{formatPhoneE164(callState.client.phoneE164)}</Text>
        </View>

        <View style={[styles.column, styles.rightColumn]} testID="call-room-ai-assist">
          {rightPanel === 'keypad' ? (
            <KeypadPanel
              onBack={backToAssist}
              onOpenContacts={() => setRightPanel('contacts')}
              onAddCall={(_digits) => backToAssist()}
              onDtmf={(d) => onSendDigit?.(d)}
            />
          ) : rightPanel === 'transfer' ? (
            <TransferPanel onBack={backToAssist} onTransferred={backToAssist} />
          ) : rightPanel === 'contacts' ? (
            <ContactsPanel
              onBack={() => setRightPanel('keypad')}
              onAddCall={(_contactId) => backToAssist()}
            />
          ) : (
            <AIAssistPanel client={callState.client} />
          )}
        </View>
      </View>

      {/* Controls bar (T11) */}
      <CallRoomControls
        state={callState}
        keypadActive={rightPanel === 'keypad'}
        transferActive={rightPanel === 'transfer'}
        onMute={onMute}
        onHold={onHold}
        onKeypad={() => toggleRightPanel('keypad')}
        onTransfer={() => toggleRightPanel('transfer')}
        onEnd={onEnd}
      />
    </View>
  );
}

// Recessed glass-orb avatar slot. Layers (back -> front):
//   1. Outer container — Aspire-blue glow halo + drop shadow (orb floats)
//   2. Radial depth gradient — simulates light from above hitting the cavity
//   3. Avatar PNG (transparent BG) — head fills upper portion, shoulders fade
//   4. Inner-rim shadow + highlight — recessed lip, makes the orb feel concave
function CallerAvatar({
  client,
  voiceState,
}: {
  client: ClientContext;
  voiceState?: VoiceState;
}): React.ReactElement {
  const isWeb = Platform.OS === 'web';
  const isSpeaking = voiceState === 'caller';

  // Breathing pulse — drives scale + opacity of the outer ring. Loops only
  // while the caller is talking; stops + resets when they go silent.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isSpeaking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 750,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isSpeaking, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  // Production avatar routing — 2 modes only:
  //   1. 'photo'   - render client.photoUrl
  //   2. 'contact' - vector person silhouette on glass orb (universal default)
  // The wrapper provides 3D orb depth (gradient + bevel + halo); the inner
  // content is either a photo Image or a vector Ionicon.
  const inner: React.ReactElement =
    client.avatarMode === 'photo' && client.photoUrl ? (
      <Image
        source={{ uri: client.photoUrl }}
        style={cardStyles.avatarImg}
        resizeMode="cover"
        testID="avatar-photo"
      />
    ) : (
      <Ionicons
        name="person-outline"
        size={132}
        color="rgba(225,235,245,0.55)"
        style={cardStyles.avatarContactIcon}
        testID="avatar-contact"
      />
    );

  return (
    <View style={cardStyles.avatarWrap} testID="avatar-wrap">
      {/* Voice-activity pulse ring — sits OUTSIDE the slot so the orb's
          overflow:hidden doesn't clip it. Animates only when caller is
          talking; static (invisible) otherwise. */}
      {isSpeaking && (
        <Animated.View
          pointerEvents="none"
          testID="avatar-pulse-ring"
          style={[
            cardStyles.pulseRing,
            { opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
      )}

      <View style={cardStyles.avatarSlot} testID="avatar-slot">
      {/* 1. Subtle 3D depth that MATCHES the card's glass material — soft
          light from above, gentle darken at edges. Tinted to the card's
          rgba(15,18,24) palette so it reads as the same material, not a
          dark disc. */}
      {isWeb && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: 120,
              // @ts-expect-error - web-only CSS gradient
              background:
                'radial-gradient(circle at 50% 28%, rgba(255,255,255,0.05) 0%, rgba(15,18,24,0.18) 55%, rgba(15,18,24,0.42) 100%)',
            },
          ]}
        />
      )}

      {/* 2. Avatar — transparent PNG sits on the depth gradient. */}
      <View style={cardStyles.avatarInner}>{inner}</View>

      {/* 3. Inner-rim bevel — top highlight + soft bottom inner shadow.
          Adds the recessed-orb feel without darkening the avatar itself. */}
      {isWeb && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: 120,
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -3px 12px rgba(0,0,0,0.22)',
            },
          ]}
        />
      )}
      </View>
    </View>
  );
}

function formatDuration(startedAt: number | null): string {
  if (!startedAt) return '00:00';
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatPhoneE164(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 640,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 24,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(18px) saturate(1.4) brightness(1.05)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.4) brightness(1.05)',
          boxShadow:
            '0 2px 6px rgba(0,0,0,0.6), 0 24px 60px rgba(0,0,0,0.5), 0 0 80px ' +
            ASPIRE_GLOW +
            ', inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.4)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.6,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 24,
        }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  headerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
  body: {
    flexDirection: 'row',
    gap: 16,
    // Hug content. Panels carry their own minHeight so they match each other
    // visually without forcing the body to stretch toward the controls bar.
    alignItems: 'flex-start',
  },
  // Columns are layout slots only — no tinted background.
  // The panel components inside each column carry their own background
  // and use alignSelf: 'flex-start' so they hug content (don't stretch
  // down to touch the controls bar).
  column: { flex: 1, borderRadius: 12 },
  leftColumn: { backgroundColor: 'transparent' },
  centerColumn: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  rightColumn: { backgroundColor: 'transparent' },
});

const cardStyles = StyleSheet.create({
  // Non-clipping outer wrap — hosts the avatar slot + the voice-activity
  // pulse ring as siblings. Positioning lives here so the ring can extend
  // beyond the slot's overflow-hidden bounds.
  avatarWrap: {
    width: 240,
    height: 240,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Pulse ring — drawn outside the slot's circle. Aspire-blue border with
  // a glow halo (web). Animated scale + opacity drive the breathing effect
  // when voiceState === 'caller'.
  pulseRing: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: 'rgba(120, 170, 220, 0.85)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 28px rgba(120,170,220,0.55), inset 0 0 12px rgba(120,170,220,0.18)',
        } as object)
      : {}),
  },
  avatarSlot: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: 'rgba(120, 170, 220, 0.45)',
    // Transparent — the card's glass shows through the circle, so the
    // avatar reads as floating on the same glass as the rest of the card.
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 60px rgba(120, 170, 220, 0.22), 0 14px 36px rgba(0,0,0,0.55)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.55,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        }),
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({ objectFit: 'cover', objectPosition: 'center top' } as object)
      : {}),
  },
  // Contact silhouette — vector glyph centered on the orb's depth gradient.
  // Slight downward nudge so the head sits at visual upper-third (chin
  // anchors near the orb's mid-line, like a portrait crop).
  avatarContactIcon: {
    marginTop: 12,
  },
  timer: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  callerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  callerPhone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginTop: 2,
  },
});
