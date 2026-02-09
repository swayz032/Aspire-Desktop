import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  onShare: (type: 'screen' | 'file' | 'link' | 'whiteboard') => void;
}

const SHARE_OPTIONS = [
  { id: 'screen' as const, label: 'Share Screen', icon: 'desktop' as keyof typeof Ionicons.glyphMap, description: 'Present your screen to participants' },
  { id: 'file' as const, label: 'Share File', icon: 'document-attach' as keyof typeof Ionicons.glyphMap, description: 'Upload and share a document' },
  { id: 'whiteboard' as const, label: 'Open Whiteboard', icon: 'create' as keyof typeof Ionicons.glyphMap, description: 'Collaborate on a shared canvas' },
  { id: 'link' as const, label: 'Copy Room Link', icon: 'link' as keyof typeof Ionicons.glyphMap, description: 'Share link to join this session' },
];

export function ShareSheet({ visible, onClose, roomId, onShare }: ShareSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { pointerEvents: 'auto' }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share</Text>
          
          <View style={styles.roomInfo}>
            <View style={styles.roomBadge}>
              <Ionicons name="videocam" size={16} color={Colors.accent.cyan} />
              <Text style={styles.roomId}>Room {roomId}</Text>
            </View>
          </View>
          
          <View style={styles.optionsList}>
            {SHARE_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [styles.shareOption, pressed && styles.pressed]}
                onPress={() => {
                  onShare(option.id);
                  onClose();
                }}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={option.icon} size={22} color={Colors.accent.cyan} />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
              </Pressable>
            ))}
          </View>
          
          <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  sheet: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    zIndex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  roomInfo: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.cyanDark,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  roomId: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '500',
  },
  optionsList: {
    gap: Spacing.sm,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  optionDescription: {
    ...Typography.micro,
    color: Colors.text.muted,
  },
  cancelButton: {
    backgroundColor: Colors.background.tertiary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
});
