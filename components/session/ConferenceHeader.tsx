/**
 * ConferenceHeader — top bar for video conference.
 * Shows: encrypted badge, room name, participant count, duration timer,
 * recording indicator, network quality bars.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

interface ConferenceHeaderProps {
  roomName: string;
  participantCount: number;
  duration: string;
  isRecording: boolean;
  networkQuality: { uplink: number; downlink: number };
}

export function ConferenceHeader({
  roomName,
  participantCount,
  duration,
  isRecording,
  networkQuality,
}: ConferenceHeaderProps) {
  const qualityLevel = Math.min(networkQuality.uplink, networkQuality.downlink);
  const qualityColor = qualityLevel >= 4 ? '#22C55E' : qualityLevel >= 2 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Ionicons name="lock-closed" size={14} color={Colors.text.muted} />
        <Text style={styles.encryptedLabel}>Encrypted</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.roomName} numberOfLines={1}>{roomName}</Text>
      </View>

      <View style={styles.headerCenter}>
        <Ionicons name="people" size={14} color={Colors.text.tertiary} />
        <Text style={styles.participantCount}>{participantCount}</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.duration}>{duration}</Text>
      </View>

      <View style={styles.headerRight}>
        {isRecording && (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        )}
        <View style={styles.networkBars}>
          {[1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[
                styles.networkBar,
                { height: 4 + i * 3, backgroundColor: i <= qualityLevel ? qualityColor : '#333' },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  } as any,
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' },
  encryptedLabel: { fontSize: 12, color: Colors.text.muted },
  separator: { fontSize: 12, color: Colors.text.muted },
  roomName: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary, maxWidth: 200 },
  participantCount: { fontSize: 13, color: Colors.text.tertiary },
  duration: { fontSize: 13, color: Colors.text.tertiary, fontVariant: ['tabular-nums'] } as any,
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  recText: { fontSize: 11, fontWeight: '700', color: '#EF4444', letterSpacing: 0.5 },
  networkBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  networkBar: { width: 3, borderRadius: 1 },
});
