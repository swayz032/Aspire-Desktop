import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { ParticipantTile, ConferenceParticipant } from './ParticipantTile';

interface ConferenceGridProps {
  participants: ConferenceParticipant[];
  layout?: 'gallery' | 'speaker';
  activeSpeakerId?: string;
  onParticipantPress?: (participant: ConferenceParticipant) => void;
  onParticipantLongPress?: (participant: ConferenceParticipant) => void;
  onLayoutToggle?: () => void;
}

export function ConferenceGrid({ 
  participants,
  layout = 'gallery',
  activeSpeakerId,
  onParticipantPress,
  onParticipantLongPress,
  onLayoutToggle,
}: ConferenceGridProps) {
  const { width: screenWidth } = Dimensions.get('window');
  const gridPadding = Spacing.md * 2;
  const gap = Spacing.sm;

  const getGridConfig = (count: number) => {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: 4 };
  };

  const { cols } = getGridConfig(participants.length);
  const tileWidth = (screenWidth - gridPadding - (gap * (cols - 1))) / cols;
  const tileHeight = tileWidth * 0.75;

  const activeSpeaker = participants.find(p => p.id === activeSpeakerId);
  const otherParticipants = participants.filter(p => p.id !== activeSpeakerId);

  if (layout === 'speaker' && activeSpeaker) {
    return (
      <View style={styles.container}>
        <View style={styles.layoutToggle}>
          <Pressable onPress={onLayoutToggle} style={styles.toggleButton}>
            <Ionicons name="grid-outline" size={18} color={Colors.text.secondary} />
            <Text style={styles.toggleText}>Gallery</Text>
          </Pressable>
        </View>

        <View style={styles.speakerStage}>
          <ParticipantTile
            participant={activeSpeaker}
            size="large"
            isActiveSpeaker={true}
            onPress={() => onParticipantPress?.(activeSpeaker)}
            onLongPress={() => onParticipantLongPress?.(activeSpeaker)}
          />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filmstrip}
          contentContainerStyle={styles.filmstripContent}
        >
          {otherParticipants.map((participant) => (
            <ParticipantTile
              key={participant.id}
              participant={participant}
              size="small"
              onPress={() => onParticipantPress?.(participant)}
              onLongPress={() => onParticipantLongPress?.(participant)}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.layoutToggle}>
        <Pressable onPress={onLayoutToggle} style={styles.toggleButton}>
          <Ionicons name="person-outline" size={18} color={Colors.text.secondary} />
          <Text style={styles.toggleText}>Speaker</Text>
        </Pressable>
        <View style={styles.participantCount}>
          <Ionicons name="people" size={14} color={Colors.text.muted} />
          <Text style={styles.countText}>{participants.length}</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {participants.map((participant) => (
            <View 
              key={participant.id} 
              style={[styles.tileWrapper, { width: tileWidth, height: tileHeight }]}
            >
              <ParticipantTile
                participant={participant}
                size={cols >= 3 ? 'small' : 'medium'}
                isActiveSpeaker={participant.id === activeSpeakerId}
                onPress={() => onParticipantPress?.(participant)}
                onLongPress={() => onParticipantLongPress?.(participant)}
              />
            </View>
          ))}
        </View>

        {participants.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.text.muted} />
            <Text style={styles.emptyText}>Waiting for participants...</Text>
            <Text style={styles.emptySubtext}>Invite others to join this conference</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  layoutToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  toggleText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  participantCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  gridContent: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tileWrapper: {
    overflow: 'hidden',
  },
  speakerStage: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmstrip: {
    maxHeight: 110,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  filmstripContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
});
