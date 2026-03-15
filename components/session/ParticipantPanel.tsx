import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { ConferenceParticipant } from './ParticipantTile';

interface ParticipantPanelProps {
  visible: boolean;
  onClose: () => void;
  participants: ConferenceParticipant[];
  onMuteParticipant?: (participantId: string) => void;
  onRemoveParticipant?: (participantId: string) => void;
  onMakeHost?: (participantId: string) => void;
  onInvite?: () => void;
}

export function ParticipantPanel({ 
  visible, 
  onClose, 
  participants,
  onMuteParticipant,
  onRemoveParticipant,
  onMakeHost,
  onInvite,
}: ParticipantPanelProps) {
  const hosts = participants.filter(p => p.isHost);
  const others = participants.filter(p => !p.isHost);

  const renderParticipant = (participant: ConferenceParticipant) => {
    const initials = participant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
      <View key={participant.id} style={styles.participantRow}>
        <View style={[styles.avatar, { backgroundColor: participant.avatarColor || Colors.accent.cyan }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.participantInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.participantName}>{participant.name}</Text>
            {participant.isHost && (
              <View style={styles.hostBadge}>
                <Ionicons name="star" size={10} color={Colors.semantic.warning} />
              </View>
            )}
          </View>
          {participant.role && (
            <Text style={styles.participantRole}>{participant.role}</Text>
          )}
          <View style={styles.avaStatus}>
            <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
            <Text style={styles.avaText}>Ava active</Text>
            {(participant.avaTaskCount ?? 0) > 0 && (
              <View style={styles.taskBadge}>
                <Text style={styles.taskCount}>{participant.avaTaskCount}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.participantActions}>
          {participant.isHandRaised && (
            <View style={styles.handIndicator}>
              <Text style={styles.handEmoji}>✋</Text>
            </View>
          )}
          <TouchableOpacity 
            style={[styles.actionButton, participant.isMuted && styles.actionButtonActive]}
            onPress={() => onMuteParticipant?.(participant.id)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={participant.isMuted ? 'mic-off' : 'mic'} 
              size={16} 
              color={participant.isMuted ? Colors.semantic.error : Colors.text.secondary} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Participants</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{participants.length}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {hosts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hosts</Text>
                {hosts.map(renderParticipant)}
              </View>
            )}

            {others.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Participants</Text>
                {others.map(renderParticipant)}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.inviteButton} onPress={onInvite} activeOpacity={0.7}>
              <Ionicons name="person-add" size={18} color={Colors.accent.cyan} />
              <Text style={styles.inviteText}>Invite Participant</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.title.fontSize,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  countBadge: {
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  participantInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  hostBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantRole: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  avaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  avaText: {
    fontSize: 10,
    color: Colors.accent.cyan,
  },
  taskBadge: {
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  taskCount: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  participantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  handIndicator: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handEmoji: {
    fontSize: 14,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.tertiary,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyanLight,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  inviteText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
});
