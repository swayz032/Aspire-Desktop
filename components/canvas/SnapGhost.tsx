/**
 * SnapGhost — Visual indicator for grid snap position during drag
 *
 * $10,000 UI/UX QUALITY:
 * - Dashed border ghost at snap position
 * - Blue glow when valid, red when collision detected
 * - Fade-in/out with spring physics
 * - Grid-aligned positioning (32px snap)
 *
 * Reference: Figma smart guides, Sketch snap indicators
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnapGhostProps {
  position: { x: number; y: number } | null;
  size: { width: number; height: number };
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BORDER_RADIUS = 12;
const BORDER_WIDTH = 2;

const VALID_COLOR = 'rgba(59, 130, 246, 0.4)'; // Blue
const INVALID_COLOR = 'rgba(239, 68, 68, 0.4)'; // Red

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnapGhost({ position, size, isValid }: SnapGhostProps) {
  // Shared values
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const glowOpacity = useSharedValue(0);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (position) {
      // Fade in with spring
      opacity.value = withSpring(1, {
        damping: 25,
        stiffness: 300,
        mass: 0.8,
      });
      scale.value = withSpring(1, {
        damping: 20,
        stiffness: 280,
        mass: 0.9,
      });
      glowOpacity.value = withTiming(isValid ? 0.15 : 0.08, { duration: 200 });
    } else {
      // Fade out
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withSpring(0.95, {
        damping: 30,
        stiffness: 350,
      });
      glowOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [position, isValid]);

  // ---------------------------------------------------------------------------
  // Animated Styles
  // ---------------------------------------------------------------------------

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!position) {
    return null;
  }

  const borderColor = isValid ? VALID_COLOR : INVALID_COLOR;
  const glowColor = isValid ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)';

  // Premium web styles
  const webStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({
          borderStyle: 'dashed',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as unknown as ViewStyle)
      : {};

  const webGlowStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({
          filter: 'blur(20px)',
        } as unknown as ViewStyle)
      : {};

  return (
    <Reanimated.View
      style={[
        styles.ghost,
        animatedStyle,
        webStyle,
        {
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          borderColor,
        },
      ]}
      pointerEvents="none"
    >
      {/* Glow layer */}
      <Reanimated.View
        style={[
          styles.glow,
          glowStyle,
          webGlowStyle,
          {
            backgroundColor: glowColor,
          },
        ]}
      />
    </Reanimated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    borderWidth: BORDER_WIDTH,
    borderRadius: BORDER_RADIUS,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 999,
  },

  glow: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: BORDER_RADIUS + 12,
    zIndex: -1,
  },
});
