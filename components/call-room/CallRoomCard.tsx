// components/call-room/CallRoomCard.tsx
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { CallState } from './types';
import { ClientMemoryPanel } from './ClientMemoryPanel';
import { AIAssistPanel } from './AIAssistPanel';
import { CallRoomControls } from './CallRoomControls';
import { CallRoomSummaryStrip } from './CallRoomSummaryStrip';
import { useRoomLight, type RoomLight } from './hooks/useRoomLight';
import { useCardTilt } from './hooks/useCardTilt';

export interface CallRoomCardProps {
  callState: CallState;
}

const GLASS_BG = 'rgba(15, 18, 24, 0.65)';
const GLASS_BORDER = 'rgba(120, 170, 220, 0.35)';

// Cool-blue and warm-amber glow stops, lerped by RoomLight.warmth.
// At warmth=0 -> cool blue; at warmth=1 -> warm amber.
const GLOW_COOL = { r: 120, g: 170, b: 220, a: 0.18 };
const GLOW_WARM = { r: 180, g: 150, b: 110, a: 0.22 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function glowColor(warmth: number): string {
  const r = Math.round(lerp(GLOW_COOL.r, GLOW_WARM.r, warmth));
  const g = Math.round(lerp(GLOW_COOL.g, GLOW_WARM.g, warmth));
  const b = Math.round(lerp(GLOW_COOL.b, GLOW_WARM.b, warmth));
  const a = lerp(GLOW_COOL.a, GLOW_WARM.a, warmth).toFixed(3);
  return `rgba(${r},${g},${b},${a})`;
}

function buildDynamicBoxShadow(light: RoomLight): string {
  // Shadow offset OPPOSITE to cursor on X (light source on the cursor side).
  // X: cursor right (+1) -> shadow left (-12px). Y: cursor up (-1) -> shadow down (+6px).
  const dx = -light.x * 12;
  const dy = -light.y * 6;
  const glow = glowColor(light.warmth);
  return (
    `${dx.toFixed(1)}px 2px 6px rgba(0,0,0,0.6), ` +
    `${dx.toFixed(1)}px ${(24 + dy).toFixed(1)}px 60px rgba(0,0,0,0.5), ` +
    `0 0 80px ${glow}, ` +
    `inset 0 1px 0 rgba(255,255,255,0.06), ` +
    `inset 0 -1px 0 rgba(0,0,0,0.4)`
  );
}

export function CallRoomCard({ callState }: CallRoomCardProps): React.ReactElement {
  const light = useRoomLight();
  const tilt = useCardTilt(2);
  const isWeb = Platform.OS === 'web';

  // Web-only dynamic styles. Native path (below) ignores `light`/`tilt` for perf —
  // updating elevation/shadowOffset/transform every frame would tank performance,
  // and rotateX/Y on Android causes jank until we A/B test on devices.
  const dynamicCardStyle =
    isWeb
      ? ({
          boxShadow: buildDynamicBoxShadow(light),
          transform: `perspective(1400px) rotateX(${tilt.rotateX.toFixed(
            2,
          )}deg) rotateY(${tilt.rotateY.toFixed(2)}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'box-shadow 200ms ease-out, transform 220ms ease-out',
        } as object)
      : undefined;

  // Refraction gradient angle: 105deg at center, 85deg at left, 125deg at right.
  const refractionAngle = 105 + light.x * 20;
  // Top highlight opacity: 0.10 at center, 0.14 at top, 0.06 at bottom.
  const topHighlightOpacity = clamp(0.1 - light.y * 0.04, 0.06, 0.14);

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
                background: `linear-gradient(180deg, rgba(255,255,255,${topHighlightOpacity.toFixed(
                  3,
                )}) 0%, rgba(255,255,255,0) 12%)`,
                transition: 'background 200ms ease-out',
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
                background: `linear-gradient(${refractionAngle.toFixed(
                  1,
                )}deg, rgba(212,165,116,0.06) 0%, rgba(120,170,220,0.03) 50%, transparent 100%)`,
                transition: 'background 200ms ease-out',
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
          {/* Avatar slot — T29 wires the real avatar with rings. Placeholder for now. */}
          <View style={cardStyles.avatarSlot} testID="avatar-slot" />
          <Text style={cardStyles.timer}>{formatDuration(callState.startedAt)}</Text>
          <Text style={cardStyles.callerName}>
            {callState.client.name ?? 'Unknown caller'}
          </Text>
          <Text style={cardStyles.callerPhone}>{formatPhoneE164(callState.client.phoneE164)}</Text>
        </View>

        <View style={[styles.column, styles.rightColumn]} testID="call-room-ai-assist">
          <AIAssistPanel />
        </View>
      </View>

      {/* Controls bar (T11) */}
      <CallRoomControls state={callState} />

      {/* Summary strip (T11) */}
      <CallRoomSummaryStrip client={callState.client} />
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
          // Premium thick 3D glass: blur + saturation lift. boxShadow is applied
          // dynamically per-frame from `useRoomLight` in the component body.
          backdropFilter: 'blur(18px) saturate(1.4) brightness(1.05)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.4) brightness(1.05)',
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
  avatarSlot: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(120, 170, 220, 0.4)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginTop: 10,
    marginBottom: 22,
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
