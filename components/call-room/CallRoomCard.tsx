// components/call-room/CallRoomCard.tsx
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { CallState } from './types';
import { ClientMemoryPanel } from './ClientMemoryPanel';
import { AIAssistPanel } from './AIAssistPanel';
import { CallRoomControls } from './CallRoomControls';
import { CallRoomSummaryStrip } from './CallRoomSummaryStrip';

export interface CallRoomCardProps {
  callState: CallState;
}

const GLASS_BG = 'rgba(15, 18, 24, 0.65)';
const GLASS_BORDER = 'rgba(120, 170, 220, 0.35)';
const ASPIRE_GLOW = 'rgba(120, 170, 220, 0.18)';

export function CallRoomCard({ callState }: CallRoomCardProps): React.ReactElement {
  return (
    <View style={styles.card} testID="call-room-card">
      {/* Edge highlight + refraction (web-only premium glass layers) */}
      {Platform.OS === 'web' && (
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
          // Premium thick 3D glass: blur, saturation lift, layered shadows + Aspire glow
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
    // Body hugs its content (the panels) so the controls bar sits close.
    // alignItems defaults to 'stretch' which makes left/right panels match each other in height.
    alignItems: 'stretch',
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
