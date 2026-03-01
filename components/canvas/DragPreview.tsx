/**
 * DragPreview — Premium floating widget preview during drag
 *
 * $10,000 UI/UX QUALITY:
 * - Momentum-based rotation (follows cursor velocity)
 * - Spring-based scale animation
 * - Multi-layer shadow system (VISIBLE depth)
 * - 60fps via Reanimated worklets
 * - Buttery-smooth physics (no linear easing)
 *
 * Reference: Figma drag preview, macOS Mission Control window drag
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { DragOverlay } from '@dnd-kit/core';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { WidgetContainer } from './WidgetContainer';
import { SPRING_CONFIG } from '@/lib/canvasDragDrop';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DragPreviewProps {
  widgetId: string | null;
  isDragging: boolean;
  velocity?: { x: number; y: number };
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max rotation in degrees (±2° based on velocity) */
const MAX_ROTATION = 2;

/** Velocity to rotation scale factor */
const VELOCITY_ROTATION_SCALE = 0.1;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DragPreview({
  widgetId,
  isDragging,
  velocity = { x: 0, y: 0 },
  children,
}: DragPreviewProps) {
  // Shared values for animations
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.4);
  const shadowRadius = useSharedValue(40);
  const glowOpacity = useSharedValue(0.12);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isDragging) {
      // Entrance: scale up + enhance shadow
      scale.value = withSpring(1.05, {
        damping: 25,
        stiffness: 300,
        mass: 0.9,
      });
      shadowOpacity.value = withTiming(0.6, { duration: 200 });
      shadowRadius.value = withTiming(60, { duration: 200 });
      glowOpacity.value = withTiming(0.2, { duration: 200 });
    } else {
      // Exit: scale down + reduce shadow
      scale.value = withSpring(1.0, {
        damping: 20,
        stiffness: 280,
        mass: 0.9,
      });
      shadowOpacity.value = withTiming(0.4, { duration: 150 });
      shadowRadius.value = withTiming(40, { duration: 150 });
      glowOpacity.value = withTiming(0.12, { duration: 150 });
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      // Momentum rotation follows velocity
      const targetRotation = Math.max(
        -MAX_ROTATION,
        Math.min(MAX_ROTATION, velocity.x * VELOCITY_ROTATION_SCALE)
      );

      rotation.value = withSpring(targetRotation, {
        damping: 30,
        stiffness: 400,
        mass: 0.8,
      });
    } else {
      // Reset rotation on drop
      rotation.value = withSpring(0, {
        damping: 25,
        stiffness: 350,
        mass: 0.9,
      });
    }
  }, [velocity.x, isDragging]);

  // ---------------------------------------------------------------------------
  // Animated Styles
  // ---------------------------------------------------------------------------

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'web') {
      return {
        shadowOpacity: shadowOpacity.value,
        shadowRadius: shadowRadius.value,
      } as any;
    }
    return {
      shadowOpacity: shadowOpacity.value,
      shadowRadius: shadowRadius.value,
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ---------------------------------------------------------------------------
  // Premium Shadow (Web)
  // ---------------------------------------------------------------------------

  const premiumShadow: ViewStyle =
    Platform.OS === 'web'
      ? ({
          boxShadow: `
            0 16px 48px rgba(0, 0, 0, 0.7),
            0 8px 24px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(59, 130, 246, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            inset 0 -1px 0 rgba(0, 0, 0, 0.4)
          `,
          transition: 'box-shadow 200ms ease-out',
        } as unknown as ViewStyle)
      : {};

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!widgetId) {
    return null;
  }

  return (
    <DragOverlay>
      <Reanimated.View style={[styles.previewContainer, animatedStyle]}>
        {/* Blue glow layer (ambient) */}
        <Reanimated.View style={[styles.glowLayer, glowStyle]} />

        {/* Widget preview */}
        <View style={[styles.preview, premiumShadow, shadowStyle]}>
          {children || (
            <WidgetContainer
              title={widgetId}
              size={{ width: 280, height: 200 }}
              position={{ x: 0, y: 0 }}
            >
              <View style={styles.placeholder} />
            </WidgetContainer>
          )}
        </View>
      </Reanimated.View>
    </DragOverlay>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  previewContainer: {
    position: 'relative',
  },

  glowLayer: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderRadius: 24,
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(40px)' } as unknown as ViewStyle)
      : {}),
    zIndex: 0,
  },

  preview: {
    position: 'relative',
    zIndex: 1,
    // Native shadow (fallback)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 48,
    elevation: 16,
  },

  placeholder: {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
});
