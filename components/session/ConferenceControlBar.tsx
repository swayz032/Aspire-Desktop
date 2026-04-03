/**
 * ConferenceControlBar — footer control bar for video conference.
 * Buttons: Mic, Camera, Screen Share, Record, Chat, Participants, View Toggle, Leave.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

interface ControlBarProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  viewMode: 'gallery' | 'speaker';
  unreadCount: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleView: () => void;
  onLeave: () => void;
}

function ControlButton({
  icon,
  label,
  isActive,
  isDestructive,
  isWarning,
  badge,
  onPress,
}: {
  icon: string;
  label: string;
  isActive?: boolean;
  isDestructive?: boolean;
  isWarning?: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const bgColor = isDestructive
    ? '#DC2626'
    : isWarning
    ? 'rgba(239,68,68,0.15)'
    : isActive
    ? 'rgba(59,130,246,0.2)'
    : 'rgba(28,28,30,0.9)';

  const iconColor = isDestructive
    ? '#fff'
    : isWarning
    ? '#EF4444'
    : isActive
    ? '#3B82F6'
    : '#fff';

  const borderColor = isActive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)';

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.controlButton,
        { backgroundColor: bgColor, borderColor },
        hovered && !isDestructive && styles.controlButtonHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon as any} size={22} color={iconColor} />
      <Text style={[styles.controlLabel, { color: iconColor }]}>{label}</Text>
      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function ConferenceControlBar(props: ControlBarProps) {
  return (
    <View style={styles.controlBar}>
      <View style={styles.controlGroup}>
        <ControlButton
          icon={props.isMuted ? 'mic-off' : 'mic'}
          label={props.isMuted ? 'Unmute' : 'Mute'}
          isWarning={props.isMuted}
          onPress={props.onToggleMic}
        />
        <ControlButton
          icon={props.isCameraOff ? 'videocam-off' : 'videocam'}
          label={props.isCameraOff ? 'Start Video' : 'Stop Video'}
          isWarning={props.isCameraOff}
          onPress={props.onToggleCamera}
        />
        <ControlButton
          icon={props.isScreenSharing ? 'share' : 'share-outline'}
          label={props.isScreenSharing ? 'Stop Share' : 'Share'}
          isActive={props.isScreenSharing}
          onPress={props.onToggleScreenShare}
        />
        <ControlButton
          icon="radio-button-on"
          label={props.isRecording ? 'Stop Rec' : 'Record'}
          isActive={props.isRecording}
          onPress={props.onToggleRecording}
        />
      </View>

      <View style={styles.controlGroup}>
        <ControlButton
          icon="chatbubble"
          label="Chat"
          isActive={props.isChatOpen}
          badge={props.unreadCount}
          onPress={props.onToggleChat}
        />
        <ControlButton
          icon="people"
          label="People"
          isActive={props.isParticipantsOpen}
          onPress={props.onToggleParticipants}
        />
        <ControlButton
          icon={props.viewMode === 'gallery' ? 'expand' : 'grid'}
          label={props.viewMode === 'gallery' ? 'Speaker' : 'Gallery'}
          onPress={props.onToggleView}
        />
      </View>

      <ControlButton
        icon="call"
        label="Leave"
        isDestructive
        onPress={props.onLeave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controlBar: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  } as any,
  controlGroup: { flexDirection: 'row', gap: 6 },
  controlButton: {
    width: 64,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 2,
  },
  controlButtonHover: {
    opacity: 0.85,
  },
  controlLabel: { fontSize: 9, fontWeight: '500', letterSpacing: 0.3 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.accent.cyan,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#000' },
});
