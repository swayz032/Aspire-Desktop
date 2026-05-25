/**
 * PremiumBlueprintLoader — Lightswind RippleLoader port, Estimate Studio palette.
 *
 * Visual mirrors the Lightswind reference exactly:
 *   - 5 SOFT-FILLED disks (gradient fill, top-edge highlight border)
 *     stacked concentrically with inset 40% → 0% (outermost on top).
 *   - Each disk scales 1 → 1.3 → 1 on a 2s loop, staggered 200ms so the
 *     ripple cascades outward.
 *   - Animated drop shadow grows during scale-up (10px → 30px blur radius)
 *     producing the "elevation breathing" feel.
 *   - Soft amber center icon (blueprint-grid) sits above everything,
 *     opacity-cycles with the outermost ring.
 *
 * Departures from the Lightswind reference (necessary for our stack):
 *   - Palette swapped from neutral grey to Aspire amber-gold + dark glass.
 *   - framer-motion replaced with RN Animated (zero new deps; identical
 *     behavior on web + native).
 *   - Box-shadow animation uses CSS keyframes on web (RN Animated can't
 *     interpolate shadow blur radius), gated by Platform.OS === 'web';
 *     on native we fall back to static shadows since native shadow
 *     interpolation is platform-dependent.
 *
 * React #300 fix: previous version wrapped <Ionicons/> inside an
 * <Animated.Text> for color interpolation. Ionicons internally re-renders
 * on font load; combined with a JS-driven color tween on every frame this
 * cascaded into "too many re-renders". This version uses Animated.View
 * opacity tween over a static-color Ionicons — no re-render storm.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GOLD = '#fbbf24';

interface Props {
  /** Outer diameter in px. Default 240 (canvas hero size). */
  size?: number;
  /** Total animation period in ms. Default 2000. */
  duration?: number;
  /** Ionicons name for the center glyph. Default 'grid-outline'. */
  iconName?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}

// Per-ring config — matches Lightswind reference cascade:
// inset (depth) 40 → 30 → 20 → 10 → 0, delay 0 → 800ms.
// Outermost ring (inset 0) has highest zIndex so it covers the smaller
// rings underneath, but its fill is the most transparent so they all
// remain visible.
const RING_CONFIG = [
  { inset: 0,  z: 99, delay: 0,   borderOpacity: 1.0,  fillOpacity: 0.06, shadowKey: 'r0' },
  { inset: 10, z: 98, delay: 200, borderOpacity: 0.78, fillOpacity: 0.08, shadowKey: 'r1' },
  { inset: 20, z: 97, delay: 400, borderOpacity: 0.55, fillOpacity: 0.10, shadowKey: 'r2' },
  { inset: 30, z: 96, delay: 600, borderOpacity: 0.35, fillOpacity: 0.12, shadowKey: 'r3' },
  { inset: 40, z: 95, delay: 800, borderOpacity: 0.20, fillOpacity: 0.15, shadowKey: 'r4' },
] as const;

// 2026-05-25 — Web-only animated drop shadow via CSS keyframes. RN
// Animated can't interpolate shadowRadius/spread smoothly; CSS does it
// natively. One keyframe set drives all rings via the staggered
// animation-delay applied inline per ring.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'premium-loader-shadow-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      @keyframes premium-loader-shadow {
        0%   { box-shadow: 0 10px 18px 0 rgba(0, 0, 0, 0.30), 0 0 0 1px rgba(251, 191, 36, 0.12) inset; }
        50%  { box-shadow: 0 30px 36px 0 rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(251, 191, 36, 0.28) inset; }
        100% { box-shadow: 0 10px 18px 0 rgba(0, 0, 0, 0.30), 0 0 0 1px rgba(251, 191, 36, 0.12) inset; }
      }
      [data-premium-loader-disk="1"] {
        animation: premium-loader-shadow 2s ease-in-out infinite;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      }
    `;
    document.head.appendChild(styleEl);
  }
}

function BreatheDisk({
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
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay, duration]);

  // Match Lightswind reference: scale 1 → 1.3 → 1.
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.3] });

  const diskSize = size * (1 - (insetPct * 2) / 100);
  const offset = (size - diskSize) / 2;

  // Inline web styles for backdrop-blur + animated drop shadow. On native
  // the data-attribute is ignored and the keyframe animation is a no-op.
  const webOnlyStyle: ViewStyle =
    Platform.OS === 'web'
      ? (({
          // Negative animation-delay so all rings are already mid-cycle
          // on mount — matches the reference's "always already
          // happening" feel.
          animationDelay: `-${(2000 - delay) / 1000}s`,
        } as unknown) as ViewStyle)
      : {};

  return (
    <Animated.View
      pointerEvents="none"
      data-premium-loader-disk={Platform.OS === 'web' ? '1' : undefined}
      style={[
        {
          position: 'absolute',
          left: offset,
          top: offset,
          width: diskSize,
          height: diskSize,
          borderRadius: diskSize / 2,
          // Top-edge highlight (Lightswind uses `border-t`). On native we
          // approximate with a 1px top border + transparent sides — RN
          // can't do "border on one edge" cleanly so we use full border
          // with the side opacities matching the BG color.
          borderTopWidth: 1.5,
          borderLeftWidth: 0.5,
          borderRightWidth: 0.5,
          borderBottomWidth: 0,
          borderTopColor: `rgba(251,191,36,${borderOpacity})`,
          borderLeftColor: `rgba(251,191,36,${borderOpacity * 0.4})`,
          borderRightColor: `rgba(251,191,36,${borderOpacity * 0.4})`,
          // Soft gradient — approximated via solid amber tint. True
          // gradient fill requires SVG/LinearGradient; the disk depth
          // illusion comes mostly from the animated shadow stack.
          backgroundColor: `rgba(251,191,36,${fillOpacity})`,
          transform: [{ scale }],
          zIndex,
          // Native fallback shadow (static — CSS keyframes drive the
          // animated shadow on web).
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 14 },
        },
        webOnlyStyle,
      ]}
    />
  );
}

export function PremiumBlueprintLoader({
  size = 240,
  duration = 2000,
  iconName = 'grid-outline',
  testID = 'premium-loader',
}: Props): React.ReactElement {
  // Center icon opacity tween — sync with outermost ring's breathing
  // cycle so the whole composition pulses together.
  const iconPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [iconPulse, duration]);

  const iconOpacity = iconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.0] });
  const iconScale = iconPulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.0] });
  const iconSize = Math.round(size * 0.22);

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      testID={testID}
      // @ts-ignore — accessibilityRole accepts 'progressbar' on web
      accessibilityRole="progressbar"
      accessibilityLabel="Loading blueprint — Drew is preparing the canvas"
    >
      {RING_CONFIG.map((cfg, i) => (
        <BreatheDisk
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
      {/* Center icon — static-colored Ionicons (no Animated wrapping;
          previously caused React #300 due to Ionicons font-load
          re-renders cascading inside an Animated.Text). Opacity + scale
          tween via Animated.View parent. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          zIndex: 100,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: iconOpacity,
          transform: [{ scale: iconScale }],
        }}
      >
        <Ionicons name={iconName} size={iconSize} color={GOLD} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    // Outer halo — soft amber glow underneath the entire stack. Adds
    // depth without animating.
    ...(Platform.OS === 'web'
      ? (({
          filter: 'drop-shadow(0 18px 32px rgba(251, 191, 36, 0.18))',
        } as unknown) as ViewStyle)
      : {}),
  },
});

export default PremiumBlueprintLoader;
