/**
 * ActionButton — Shared action button for research card components.
 * Two variants: primary (filled cyan) and secondary (outlined).
 */

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ActionButtonVariant = 'primary' | 'secondary';

interface ActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Button visual variant. Default: 'secondary' (outlined). */
  variant?: ActionButtonVariant;
}

export function ActionButton({ label, icon, onPress, variant = 'secondary' }: ActionButtonProps) {
  const scale = useSharedValue(1);
  const isPrimary = variant === 'primary';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (isPrimary) {
      scale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (isPrimary) {
      scale.value = withSpring(1, { damping: 20, stiffness: 300 });
    }
  };

  return (
    <AnimatedPressable
      style={[
        styles.btn,
        isPrimary ? styles.btnPrimary : styles.btnSecondary,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isPrimary ? Colors.text.primary : Colors.accent.cyan}
      />
      <Text
        style={[
          styles.text,
          isPrimary ? styles.textPrimary : styles.textSecondary,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
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
    minWidth: 44,
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.accent.cyan,
    borderWidth: 0,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textPrimary: {
    color: Colors.text.primary,
  },
  textSecondary: {
    color: Colors.accent.cyan,
  },
});
