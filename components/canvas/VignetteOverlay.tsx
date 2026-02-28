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

// Spec Appendix A: mode transitions at 150ms ease-in-out
const TRANSITION_MS = Canvas.modeTransition.durationMs;

// CSS radial gradient per mode — depth is barely perceptible, canvas is atmospheric
const WEB_VIGNETTE_DEPTH = `radial-gradient(ellipse at center, transparent 55%, ${Canvas.vignette.colorDepth} 100%)`;
const WEB_VIGNETTE_CANVAS = `radial-gradient(ellipse at center, transparent 45%, ${Canvas.vignette.colorCanvas} 100%)`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VignetteOverlay(): React.ReactElement | null {
  const { mode } = useImmersion();
  const opacity = useRef(new Animated.Value(0)).current;
  const isVisible = mode === 'depth' || mode === 'canvas';

  // Per-mode target opacity: depth is very subtle, canvas is more atmospheric
  const targetOpacity = mode === 'canvas'
    ? Canvas.vignette.opacityCanvas
    : mode === 'depth'
      ? Canvas.vignette.opacityDepth
      : 0;

  useEffect(() => {
    if (reducedMotion) {
      // Skip animation, snap to target
      opacity.setValue(targetOpacity);
      return;
    }

    Animated.timing(opacity, {
      toValue: targetOpacity,
      duration: TRANSITION_MS,
      useNativeDriver: true,
    }).start();
  }, [targetOpacity, opacity]);

  // Don't mount at all when permanently off (avoids unnecessary layer)
  if (mode === 'off') return null;

  // Select gradient variant based on mode — depth uses wider transparent center
  const webBg = mode === 'canvas' ? WEB_VIGNETTE_CANVAS : WEB_VIGNETTE_DEPTH;

  // Web: CSS radial gradient (GPU composited, no extra canvas/svg)
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        style={[
          styles.overlay,
          webOverlayStyle,
          { opacity },
          { background: webBg } as unknown as ViewStyle,
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  // Native: expo-linear-gradient approximation (top/bottom edge darkening)
  // Depth mode uses lighter edge colors than canvas
  const edgeColor = mode === 'canvas' ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.08)';
  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={[edgeColor, 'transparent', 'transparent', edgeColor]}
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
    // Native: absolute fill within parent
  },
});

// Web override: use fixed positioning to cover the full viewport
const webOverlayStyle = Platform.OS === 'web'
  ? ({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    } as unknown as ViewStyle)
  : {};

// Web gradient is now applied inline per mode (depth vs canvas variant).
// No static webStyles needed — gradient string is dynamic.
