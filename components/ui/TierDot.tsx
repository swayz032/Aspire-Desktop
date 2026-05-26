import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View, StyleSheet } from 'react-native';
import type { ConfidenceTier } from '@/lib/api/blueprintsStoryV2';

interface TierDotProps {
  tier: ConfidenceTier;
  size?: number;
  pulse?: boolean;
  testID?: string;
}

const TIER_COLOR: Record<ConfidenceTier, string> = {
  GREEN: '#22c55e',
  YELLOW: '#fbbf24',
  RED: '#ef4444',
};

const TIER_LABEL: Record<ConfidenceTier, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
};

const TIER_GLOW: Partial<Record<ConfidenceTier, string>> = {
  GREEN: '0 0 6px rgba(34,197,94,0.6)',
  RED: '0 0 6px rgba(239,68,68,0.6)',
};

export function TierDot({
  tier,
  size = 8,
  pulse,
  testID,
}: TierDotProps): React.ReactElement {
  const shouldPulse = (pulse ?? (tier === 'YELLOW')) && tier === 'YELLOW';
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shouldPulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [shouldPulse, scale]);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: TIER_COLOR[tier],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  };

  const webGlow =
    Platform.OS === 'web' && TIER_GLOW[tier]
      ? ({ boxShadow: TIER_GLOW[tier] } as any)
      : {};

  const a11y = {
    accessibilityRole: 'image' as const,
    accessibilityLabel: `Confidence: ${TIER_LABEL[tier]}`,
  };

  if (shouldPulse) {
    return (
      <Animated.View
        testID={testID}
        {...a11y}
        style={[baseStyle, webGlow, { transform: [{ scale }] }]}
      />
    );
  }

  return <View testID={testID} {...a11y} style={[baseStyle, webGlow]} />;
}

// Silence unused-import lint in environments that strip StyleSheet
void StyleSheet;
