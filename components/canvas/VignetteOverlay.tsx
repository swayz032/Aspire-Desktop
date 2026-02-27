import React, { useRef, useEffect } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas } from '@/constants/tokens';
import { useImmersion } from '@/lib/immersionStore';

// ---------------------------------------------------------------------------
// Reduced-motion detection (web only, singleton)
// ---------------------------------------------------------------------------

let reducedMotion = false;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mql.matches;
    mql.addEventListener('change', (e) => {
      reducedMotion = e.matches;
    });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSITION_MS = Canvas.motion.modeTransition; // 250ms

// CSS radial gradient for web — more performant than LinearGradient for radial
const WEB_VIGNETTE_BG = `radial-gradient(ellipse at center, transparent 50%, ${Canvas.vignette.color} 100%)`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VignetteOverlay(): React.ReactElement | null {
  const { mode } = useImmersion();
  const opacity = useRef(new Animated.Value(0)).current;
  const isVisible = mode === 'depth' || mode === 'canvas';

  useEffect(() => {
    if (reducedMotion) {
      // Skip animation, snap to target
      opacity.setValue(isVisible ? Canvas.vignette.opacity : 0);
      return;
    }

    Animated.timing(opacity, {
      toValue: isVisible ? Canvas.vignette.opacity : 0,
      duration: TRANSITION_MS,
      useNativeDriver: true,
    }).start();
  }, [isVisible, opacity]);

  // Don't mount at all when permanently off (avoids unnecessary layer)
  if (mode === 'off') return null;

  // Web: CSS radial gradient (GPU composited, no extra canvas/svg)
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        style={[styles.overlay, { opacity }, webStyles.radialBg]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  // Native: expo-linear-gradient approximation (top/bottom edge darkening)
  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.12)', 'transparent', 'transparent', 'rgba(0,0,0,0.12)']}
        locations={[0, 0.25, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

// Web-only styles — radial gradient background
const webStyles = {
  radialBg: {
    background: WEB_VIGNETTE_BG,
  } as unknown as ViewStyle,
};
