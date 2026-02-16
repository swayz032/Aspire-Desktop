import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { AVAILABLE_STAFF } from '@/data/session';

interface AddStaffSheetProps {
  visible: boolean;
  onClose: () => void;
  currentStaffIds: string[];
  onAddStaff: (staffId: string, staffName: string) => void;
}

export function AddStaffSheet({ visible, onClose, currentStaffIds, onAddStaff }: AddStaffSheetProps) {
  const availableToAdd = AVAILABLE_STAFF.filter(s => !currentStaffIds.includes(s.id));

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
          <Text style={styles.title}>Add AI Staff to Session</Text>
          
          <Text style={styles.subtitle}>
            {availableToAdd.length > 0 
              ? 'Select staff members to join the session'
              : 'All available staff are already in the session'
            }
          </Text>
          
          <ScrollView style={styles.staffList} showsVerticalScrollIndicator={false}>
            {availableToAdd.map((staff) => (
              <Pressable
                key={staff.id}
                style={({ pressed }) => [styles.staffItem, pressed && styles.pressed]}
                onPress={() => {
                  onAddStaff(staff.id, staff.name);
                  onClose();
                }}
              >
                <View style={[styles.avatar, { backgroundColor: staff.avatarColor + '20' }]}>
                  <Text style={[styles.avatarText, { color: staff.avatarColor }]}>
                    {staff.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{staff.name}</Text>
                  <Text style={styles.staffRole}>{staff.role}</Text>
                </View>
                <View style={styles.addButton}>
                  <Ionicons name="add" size={20} color={Colors.accent.cyan} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
          
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
    maxHeight: '70%',
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
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  staffList: {
    maxHeight: 300,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.body,
    fontWeight: '600',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  staffRole: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
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
