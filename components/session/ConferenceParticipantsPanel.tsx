/**
 * ConferenceParticipantsPanel — slide-in panel showing participant list.
 * Shows Nora AI (always first), then Zoom participants with mic/camera status.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/tokens';
import type { ZoomParticipant } from './ZoomConferenceProvider';
import { getInitials, getAvatarColor } from '@/utils/avatar';

interface ParticipantsPanelProps {
  visible: boolean;
  participants: ZoomParticipant[];
  activeSpeakerId: number | null;
  networkQuality?: { uplink: number; downlink: number };
  onClose: () => void;
}

function getNetworkIcon(level: number): { icon: string; color: string } {
  if (level >= 4) return { icon: 'wifi', color: '#22C55E' };
  if (level >= 3) return { icon: 'wifi', color: '#F59E0B' };
  if (level >= 2) return { icon: 'wifi', color: '#EF4444' };
  return { icon: 'wifi', color: '#6e6e73' };
}

export function ConferenceParticipantsPanel({ visible, participants, activeSpeakerId, networkQuality, onClose }: ParticipantsPanelProps) {
  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Participants ({participants.length + 1})</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close participants panel">
          <Ionicons name="close" size={20} color={Colors.text.secondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {/* Nora AI — always first */}
        <View style={styles.participantRow}>
          <View style={[styles.avatarCircle, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
            <Ionicons name="sparkles" size={14} color="#3B82F6" />
          </View>
          <View style={styles.participantInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.participantName}>Nora</Text>
              <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>AI</Text></View>
            </View>
            <Text style={styles.participantRole}>AI Assistant</Text>
          </View>
          <Ionicons name="mic" size={14} color="#22C55E" />
        </View>

        {/* Zoom participants */}
        {participants.map(p => {
          const isSpeaking = activeSpeakerId === p.userId;
          return (
            <View key={p.userId} style={[styles.participantRow, isSpeaking && styles.speakingRow]}>
              <View style={[styles.avatarCircle, { backgroundColor: getAvatarColor(p.displayName) + '33' }]}>
                <Text style={styles.avatarInitials}>{getInitials(p.displayName)}</Text>
                {isSpeaking && <View style={styles.speakingDot} />}
              </View>
              <View style={styles.participantInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.participantName, isSpeaking && styles.speakingName]} numberOfLines={1}>{p.displayName}</Text>
                  {p.isLocal && <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>You</Text></View>}
                  {p.isHost && <View style={[styles.roleBadge, styles.hostBadge]}><Text style={[styles.roleBadgeText, styles.hostBadgeText]}>Host</Text></View>}
                </View>
                {p.isLocal && networkQuality && (
                  <View style={styles.networkRow}>
                    <Ionicons
                      name={getNetworkIcon(Math.min(networkQuality.uplink, networkQuality.downlink)).icon as any}
                      size={10}
                      color={getNetworkIcon(Math.min(networkQuality.uplink, networkQuality.downlink)).color}
                    />
                    <Text style={styles.networkText}>
                      {Math.min(networkQuality.uplink, networkQuality.downlink) >= 4 ? 'Good' : Math.min(networkQuality.uplink, networkQuality.downlink) >= 3 ? 'Fair' : 'Poor'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.indicators}>
                <Ionicons
                  name={p.isMuted ? 'mic-off' : 'mic'}
                  size={14}
                  color={p.isMuted ? '#EF4444' : '#22C55E'}
                />
                <Ionicons
                  name={p.isVideoOn ? 'videocam' : 'videocam-off'}
                  size={14}
                  color={p.isVideoOn ? '#22C55E' : '#6e6e73'}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 56,
    bottom: 72,
    right: 0,
    width: 320,
    backgroundColor: 'rgba(14,14,16,0.95)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    zIndex: 200,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}),
  } as any,
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  panelTitle: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  list: { flex: 1, padding: 8 },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  participantInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantName: { fontSize: 14, fontWeight: '500', color: Colors.text.secondary, maxWidth: 180 },
  participantRole: { fontSize: 11, color: Colors.text.muted, marginTop: 1 },
  roleBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: '#3B82F6' },
  indicators: { flexDirection: 'row', gap: 8 },
  speakingRow: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderRadius: 8,
  },
  speakingDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: 'rgba(14,14,16,0.95)',
  },
  speakingName: {
    color: Colors.text.primary,
  },
  hostBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  hostBadgeText: {
    color: '#F59E0B',
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  networkText: {
    fontSize: 10,
    color: Colors.text.muted,
  },
});
