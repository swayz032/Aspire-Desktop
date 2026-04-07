/**
 * ImageSkeleton — Pulsing opacity placeholder shown while hero images load.
 * Uses reanimated for a smooth 0.3-0.7 opacity pulse on a 1.5s cycle.
 * Crossfades out when the real image finishes loading.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/tokens';

const PULSE_DURATION = 750; // half-cycle = 750ms, full = 1.5s

interface ImageSkeletonProps {
  /** When true, the skeleton fades out */
  loaded: boolean;
}

export function ImageSkeleton({ loaded }: ImageSkeletonProps) {
  const pulse = useSharedValue(0.3);
  const fadeOut = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: PULSE_DURATION }),
        withTiming(0.3, { duration: PULSE_DURATION }),
      ),
      -1,
      true,
    );
  }, []);

  useEffect(() => {
    if (loaded) {
      fadeOut.value = withTiming(0, { duration: 200 });
    }
  }, [loaded]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * fadeOut.value,
  }));

  if (loaded) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.skeleton, animatedStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading image"
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.surface.cardBorder,
    zIndex: 1,
  },
});
