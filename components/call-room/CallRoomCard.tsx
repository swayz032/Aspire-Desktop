// components/call-room/CallRoomCard.tsx
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { CallState } from './types';

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

      {/* Body — 3 empty columns (T10 fills these) */}
      <View style={styles.body}>
        <View style={[styles.column, styles.leftColumn]} testID="call-room-client-memory" />
        <View style={[styles.column, styles.centerColumn]} testID="call-room-center" />
        <View style={[styles.column, styles.rightColumn]} testID="call-room-ai-assist" />
      </View>

      {/* Controls placeholder (T11) */}
      <View style={styles.controlsPlaceholder} testID="call-room-controls-slot" />

      {/* Summary placeholder (T11) */}
      <View style={styles.summaryPlaceholder} testID="call-room-summary-slot" />
    </View>
  );
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
    flex: 1,
    minHeight: 320,
  },
  column: { flex: 1, borderRadius: 12 },
  leftColumn: { backgroundColor: 'rgba(255,255,255,0.03)' },
  centerColumn: { backgroundColor: 'transparent' },
  rightColumn: { backgroundColor: 'rgba(255,255,255,0.03)' },
  controlsPlaceholder: {
    height: 64,
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  summaryPlaceholder: {
    height: 72,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
