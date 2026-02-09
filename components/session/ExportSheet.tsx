import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

interface ExportSheetProps {
  visible: boolean;
  onClose: () => void;
  transcriptLength: number;
  onExport: (format: 'pdf' | 'txt' | 'json') => void;
}

const EXPORT_OPTIONS = [
  { id: 'pdf' as const, label: 'Export as PDF', icon: 'document' as keyof typeof Ionicons.glyphMap, description: 'Formatted document with timestamps' },
  { id: 'txt' as const, label: 'Export as Text', icon: 'document-text' as keyof typeof Ionicons.glyphMap, description: 'Plain text transcript' },
  { id: 'json' as const, label: 'Export as JSON', icon: 'code' as keyof typeof Ionicons.glyphMap, description: 'Structured data format' },
];

export function ExportSheet({ visible, onClose, transcriptLength, onExport }: ExportSheetProps) {
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
          <Text style={styles.title}>Export Transcript</Text>
          
          <View style={styles.infoCard}>
            <Ionicons name="document-text" size={24} color={Colors.accent.cyan} />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>{transcriptLength} entries</Text>
              <Text style={styles.infoDescription}>Session transcript ready to export</Text>
            </View>
          </View>
          
          <View style={styles.optionsList}>
            {EXPORT_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [styles.exportOption, pressed && styles.pressed]}
                onPress={() => {
                  onExport(option.id);
                  onClose();
                }}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={option.icon} size={20} color={Colors.accent.cyan} />
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
    marginBottom: Spacing.lg,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.cyanDark,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    ...Typography.body,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  infoDescription: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  optionsList: {
    gap: Spacing.sm,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.tertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
