/**
 * AnimatedDot — Pagination dot that animates to a pill shape when active.
 * Active dot expands width to 24px with spring physics.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors, BorderRadius } from '@/constants/tokens';

const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 24;
const SPRING_CONFIG = { damping: 18, stiffness: 200 };

interface AnimatedDotProps {
  isActive: boolean;
  onPress: () => void;
  index: number;
}

export function AnimatedDot({ isActive, onPress, index }: AnimatedDotProps) {
  const width = useSharedValue(isActive ? DOT_ACTIVE_WIDTH : DOT_SIZE);
  const opacity = useSharedValue(isActive ? 1 : 0.4);

  useEffect(() => {
    width.value = withSpring(isActive ? DOT_ACTIVE_WIDTH : DOT_SIZE, SPRING_CONFIG);
    opacity.value = withSpring(isActive ? 1 : 0.4, SPRING_CONFIG);
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
    backgroundColor: isActive ? Colors.text.primary : Colors.text.muted,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Go to card ${index + 1}`}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View style={[styles.dot, animatedStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dot: {
    height: DOT_SIZE,
    borderRadius: BorderRadius.full,
    minWidth: DOT_SIZE,
  },
});
