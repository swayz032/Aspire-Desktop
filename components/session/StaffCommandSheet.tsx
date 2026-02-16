import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { STAFF_COMMANDS } from '@/data/session';
import { SessionStaffMember, StaffTaskState } from '@/types/session';

interface StaffCommandSheetProps {
  visible: boolean;
  onClose: () => void;
  staff: SessionStaffMember | null;
  onCommand: (commandId: string) => void;
}

const STATE_COLORS: Record<StaffTaskState, { bg: string; text: string }> = {
  idle: { bg: 'rgba(107, 114, 128, 0.2)', text: '#9CA3AF' },
  working: { bg: 'rgba(59, 130, 246, 0.2)', text: Colors.accent.cyan },
  done: { bg: 'rgba(34, 197, 94, 0.2)', text: Colors.semantic.success },
};

export function StaffCommandSheet({ visible, onClose, staff, onCommand }: StaffCommandSheetProps) {
  if (!staff) return null;

  const stateColor = STATE_COLORS[staff.state];

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
          
          <View style={styles.staffHeader}>
            <View style={[styles.avatar, { backgroundColor: staff.avatarColor + '20' }]}>
              <Text style={[styles.avatarText, { color: staff.avatarColor }]}>
                {staff.name.charAt(0)}
              </Text>
              {staff.outputCount > 0 && (
                <View style={styles.outputBadge}>
                  <Text style={styles.outputBadgeText}>{staff.outputCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.staffInfo}>
              <Text style={styles.staffName}>{staff.name}</Text>
              <Text style={styles.staffRole}>{staff.role}</Text>
            </View>
            <View style={[styles.stateBadge, { backgroundColor: stateColor.bg }]}>
              <Text style={[styles.stateText, { color: stateColor.text }]}>
                {staff.state.charAt(0).toUpperCase() + staff.state.slice(1)}
              </Text>
            </View>
          </View>
          
          {staff.currentTask && (
            <View style={styles.currentTaskContainer}>
              <Ionicons name="sync" size={14} color={Colors.accent.cyan} />
              <Text style={styles.currentTaskText}>{staff.currentTask}</Text>
            </View>
          )}
          
          <Text style={styles.sectionTitle}>Assign Task</Text>
          
          <View style={styles.commandsList}>
            {STAFF_COMMANDS.map((command) => (
              <Pressable
                key={command.id}
                style={({ pressed }) => [styles.commandOption, pressed && styles.pressed]}
                onPress={() => {
                  onCommand(command.id);
                  onClose();
                }}
              >
                <View style={styles.commandIcon}>
                  <Ionicons 
                    name={command.icon as keyof typeof Ionicons.glyphMap} 
                    size={18} 
                    color={Colors.accent.cyan} 
                  />
                </View>
                <Text style={styles.commandLabel}>{command.label}</Text>
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
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.headline,
    fontWeight: '700',
  },
  outputBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent.cyan,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background.secondary,
  },
  outputBadgeText: {
    ...Typography.micro,
    color: Colors.text.primary,
    fontWeight: '700',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    ...Typography.title,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  staffRole: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  stateBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  stateText: {
    ...Typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentTaskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.cyanDark,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  currentTaskText: {
    ...Typography.small,
    color: Colors.text.primary,
    flex: 1,
  },
  sectionTitle: {
    ...Typography.small,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  commandsList: {
    gap: Spacing.sm,
  },
  commandOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  commandIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  commandLabel: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
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
  pressed: {
    opacity: 0.7,
  },
});
