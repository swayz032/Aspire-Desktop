import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

interface BottomSheetOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  disabled?: boolean;
}

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: BottomSheetOption[];
  onSelect: (optionId: string) => void;
}

export function BottomSheet({ visible, onClose, title, options, onSelect }: BottomSheetProps) {
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
          <Text style={styles.title}>{title}</Text>
          
          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {options.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [
                  styles.option, 
                  option.disabled && styles.optionDisabled,
                  pressed && styles.optionPressed
                ]}
                onPress={() => {
                  if (!option.disabled) {
                    onSelect(option.id);
                    onClose();
                  }
                }}
                disabled={option.disabled}
              >
                <View style={[styles.iconContainer, option.destructive && styles.iconDestructive]}>
                  <Ionicons 
                    name={option.icon} 
                    size={20} 
                    color={option.destructive ? Colors.semantic.error : Colors.accent.cyan} 
                  />
                </View>
                <Text style={[
                  styles.optionLabel,
                  option.destructive && styles.optionLabelDestructive,
                  option.disabled && styles.optionLabelDisabled
                ]}>
                  {option.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
              </Pressable>
            ))}
          </ScrollView>
          
          <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.optionPressed]} onPress={onClose}>
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
    marginBottom: Spacing.lg,
  },
  optionsList: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  iconDestructive: {
    backgroundColor: Colors.semantic.errorDark,
  },
  optionLabel: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
  optionLabelDestructive: {
    color: Colors.semantic.error,
  },
  optionLabelDisabled: {
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
  optionPressed: {
    opacity: 0.7,
  },
});
