/**
 * PremiumBlueprintLoader — Wave 11k loading state, hotfix v2.
 *
 * The canvas-based particle ribbon (v1) used `React.createElement('canvas', ...)`
 * which can crash inside react-native-web's reconciler under some bundler
 * configs, corrupting the parent UploadDropZone state (user-reported: pipeline
 * "broken" with "No sheets yet" empty card after upload). This v2 ships pure
 * React Native Animated primitives — runs identically on web and native, no
 * DOM dependencies, no crash surface.
 *
 * Visual: four concentric amber-gold rings pulsing outward, staggered by 350ms,
 * with a glowing center dot + soft halo. Looks distinctly more premium than a
 * thin spinner, while being bulletproof across platforms.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface Props {
  size?: number;
  /** Hue is locked to Aspire amber-gold (#fbbf24). Prop kept for forward-compat. */
  hueRange?: [number, number];
  particleCount?: number; // ignored in v2 — kept for API stability
  speed?: number;         // ignored in v2 — kept for API stability
  testID?: string;
}

const GOLD = '#fbbf24';

function PulseRing({
  size,
  delay,
  color,
  duration,
}: {
  size: number;
  delay: number;
  color: string;
  duration: number;
}): React.ReactElement {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
          delay,
        }),
        // instant reset
        Animated.timing(v, { toValue: 0, duration: 1, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay, duration]);

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.20, 1.0] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

export function PremiumBlueprintLoader({ size = 160, testID = 'premium-loader' }: Props): React.ReactElement {
  const dotPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dotPulse]);

  const dotScale = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  const dotOpacity = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      testID={testID}
      // @ts-ignore — aria valid on web
      accessibilityRole="progressbar"
      accessibilityLabel="Drew is analyzing your blueprint"
    >
      {/* Four staggered pulse rings, expanding outward — canvas IS the background. */}
      <PulseRing size={size} delay={0}    duration={2000} color={GOLD} />
      <PulseRing size={size} delay={500}  duration={2000} color="rgba(251,191,36,0.78)" />
      <PulseRing size={size} delay={1000} duration={2000} color="rgba(251,191,36,0.55)" />
      <PulseRing size={size} delay={1500} duration={2000} color="rgba(251,191,36,0.35)" />
      {/* Glowing center dot with breathing animation */}
      <Animated.View
        style={{
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: (size * 0.18) / 2,
          backgroundColor: GOLD,
          transform: [{ scale: dotScale }],
          opacity: dotOpacity,
          shadowColor: GOLD,
          shadowOpacity: 0.85,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      {/* Inner faint ring framing the dot — subtle premium detail */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: (size * 0.42) / 2,
          borderWidth: 1,
          borderColor: 'rgba(251,191,36,0.18)',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});

export default PremiumBlueprintLoader;
