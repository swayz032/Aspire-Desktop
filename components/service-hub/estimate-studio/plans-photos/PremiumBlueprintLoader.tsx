/**
 * PremiumBlueprintLoader — Wave 11k → 2026-05-25 redesign.
 *
 * Ripple-style breathing loader in Estimate Studio amber-gold over dark.
 * Replaces the previous expanding-rings design with the concentric-stack
 * pattern from the Lightswind RippleLoader spec, ported to React Native
 * primitives so it runs identically on web + native and has zero DOM
 * dependencies (no framer-motion, no canvas).
 *
 * Visual:
 *   - 5 concentric circles, each one inset 10% deeper than the last,
 *     stacked z-9..z-5 so the outermost is on top.
 *   - All 5 are visible simultaneously and "breathe" (scale 1.0 → 1.08
 *     → 1.0) on a 2s loop, staggered by 200ms so the ripple cascades
 *     outward continuously.
 *   - Subtle amber gradient fill + amber rim per ring (intensity fades
 *     with depth).
 *   - Center: amber blueprint-grid icon that pulses between gold and
 *     near-white in sync with the rings.
 *
 * Law #7: render layer only. Pure animation, no state writes, no I/O.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GOLD = '#fbbf24';

interface Props {
  /** Outer diameter in px. Default 240 — sized for canvas hero usage. */
  size?: number;
  /** Total animation period in ms. Default 2000 (2s). */
  duration?: number;
  /** Ionicons icon name for the center glyph. Default 'grid-outline'
   *  (reads as "blueprint grid" to a contractor). */
  iconName?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}

// Per-ring config: inset percentage from the outer container, z-stack
// order (outermost on top), animation delay (staggered cascade),
// fill+border opacity (fades with depth).
const RING_CONFIG = [
  { inset: 0,  z: 9, delay: 0,   borderOpacity: 1.0,  fillOpacity: 0.10 },
  { inset: 10, z: 8, delay: 200, borderOpacity: 0.78, fillOpacity: 0.10 },
  { inset: 20, z: 7, delay: 400, borderOpacity: 0.55, fillOpacity: 0.10 },
  { inset: 30, z: 6, delay: 600, borderOpacity: 0.35, fillOpacity: 0.10 },
  { inset: 40, z: 5, delay: 800, borderOpacity: 0.20, fillOpacity: 0.10 },
] as const;

function BreatheRing({
  size,
  insetPct,
  borderOpacity,
  fillOpacity,
  delay,
  duration,
  zIndex,
}: {
  size: number;
  insetPct: number;
  borderOpacity: number;
  fillOpacity: number;
  delay: number;
  duration: number;
  zIndex: number;
}): React.ReactElement {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay, duration]);

  // Breathe scale 1.0 → 1.08 → 1.0
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.08] });

  const ringSize = size * (1 - (insetPct * 2) / 100);
  const offset = (size - ringSize) / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: offset,
        top: offset,
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        borderWidth: 1.25,
        borderColor: `rgba(251,191,36,${borderOpacity})`,
        backgroundColor: `rgba(251,191,36,${fillOpacity})`,
        transform: [{ scale }],
        zIndex,
        // Web-only soft amber glow per ring — the platform splat below
        // ignores shadow props on native so this is safe to keep at the
        // top level (native skips shadowOpacity gracefully).
        shadowColor: GOLD,
        shadowOpacity: borderOpacity * 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

export function PremiumBlueprintLoader({
  size = 240,
  duration = 2000,
  iconName = 'grid-outline',
  testID = 'premium-loader',
}: Props): React.ReactElement {
  // Center icon color cross-fades between amber and near-white in sync
  // with the outermost ring's breathing cycle.
  const iconPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false, // color interpolation needs JS driver
        }),
        Animated.timing(iconPulse, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [iconPulse, duration]);

  const iconColor = iconPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [GOLD, '#fef3c7'], // amber-300 → amber-50
  });

  const iconSize = size * 0.22;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      testID={testID}
      // @ts-ignore — accessibilityRole accepts 'progressbar' on web
      accessibilityRole="progressbar"
      accessibilityLabel="Loading blueprint — Drew is preparing the canvas"
    >
      {RING_CONFIG.map((cfg, i) => (
        <BreatheRing
          key={i}
          size={size}
          insetPct={cfg.inset}
          borderOpacity={cfg.borderOpacity}
          fillOpacity={cfg.fillOpacity}
          delay={cfg.delay}
          duration={duration}
          zIndex={cfg.z}
        />
      ))}
      {/* Center icon — blueprint grid by default, pulses amber↔white in
          the ring cadence. zIndex above all rings. */}
      <View
        style={{
          position: 'absolute',
          zIndex: 100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <Animated.Text
          style={{
            color: iconColor,
            fontSize: iconSize,
            // Ionicons uses fontFamily — Animated.Text wraps it cleanly.
            // The actual icon is rendered via the Ionicons component
            // below; this Animated.Text drives the color tween.
            includeFontPadding: false,
          }}
        >
          <Ionicons name={iconName} size={iconSize} />
        </Animated.Text>
      </View>
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
