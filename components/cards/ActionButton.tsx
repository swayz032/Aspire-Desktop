/**
 * ActionButton — Shared action button for research card components.
 * Outlined style with cyan accent, consistent across all card types.
 */

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';

interface ActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export function ActionButton({ label, icon, onPress }: ActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Ionicons name={icon} size={16} color={Colors.accent.cyan} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
  },
  btnPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  text: {
    color: Colors.accent.cyan,
    fontSize: 13,
    fontWeight: '600',
  },
});
