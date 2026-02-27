import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
  type GestureResponderEvent,
} from 'react-native';
import { Canvas, Shadows } from '@/constants/tokens';
import { useImmersion } from '@/lib/immersionStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImmersionLayerProps {
  children: React.ReactNode;
  /** 0-3 depth level — scales parallax intensity (default 1) */
  depth?: number;
}

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
    // silent — matchMedia unavailable
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PARALLAX_MAX = Canvas.depth.parallaxMax; // 4px
const SPRING = Canvas.motion.spring;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImmersionLayer({
  children,
  depth = 1,
}: ImmersionLayerProps): React.ReactElement {
  const { mode } = useImmersion();

  // Animated values for parallax translation (canvas mode only)
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Track whether we've attached listeners
  const listenerRef = useRef<((e: MouseEvent) => void) | null>(null);

  // Scale factor: depth 0 = no parallax, depth 3 = full parallax
  const depthScale = Math.min(Math.max(depth, 0), 3) / 3;

  // ---------------------------------------------------------------------------
  // Mouse-based parallax (web only, canvas mode only)
  // ---------------------------------------------------------------------------

  const animateToTarget = useCallback(
    (targetX: number, targetY: number) => {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: targetX,
          damping: SPRING.damping,
          stiffness: SPRING.stiffness,
          mass: SPRING.mass,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: targetY,
          damping: SPRING.damping,
          stiffness: SPRING.stiffness,
          mass: SPRING.mass,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [translateX, translateY],
  );

  useEffect(() => {
    // Only attach parallax on web + canvas mode + motion allowed
    if (Platform.OS !== 'web' || mode !== 'canvas' || reducedMotion) {
      // Reset position when leaving canvas mode
      if (listenerRef.current) {
        window.removeEventListener('mousemove', listenerRef.current);
        listenerRef.current = null;
      }
      animateToTarget(0, 0);
      return;
    }

    const handler = (e: MouseEvent) => {
      // Normalize pointer position to [-1, 1] range from viewport center
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = (e.clientY / window.innerHeight) * 2 - 1;

      const targetX = normX * PARALLAX_MAX * depthScale;
      const targetY = normY * PARALLAX_MAX * depthScale;

      animateToTarget(targetX, targetY);
    };

    listenerRef.current = handler;
    window.addEventListener('mousemove', handler, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handler);
      listenerRef.current = null;
    };
  }, [mode, depthScale, animateToTarget]);

  // ---------------------------------------------------------------------------
  // Shadow style per mode
  // ---------------------------------------------------------------------------

  const shadowStyle = useMemo((): ViewStyle => {
    if (mode === 'off') return {};
    if (mode === 'depth') return Shadows.md;
    // Canvas mode — deeper shadows
    return Shadows.lg;
  }, [mode]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Off mode: pure passthrough, zero overhead
  if (mode === 'off') {
    return <>{children}</>;
  }

  // Depth mode: just shadow enhancement, no animation
  if (mode === 'depth') {
    return <View style={[styles.wrapper, shadowStyle]}>{children}</View>;
  }

  // Canvas mode: parallax + shadow
  return (
    <Animated.View
      style={[
        styles.wrapper,
        shadowStyle,
        {
          transform: [{ translateX }, { translateY }],
        },
      ]}
      accessibilityLabel="Immersive canvas layer"
      accessibilityRole="none"
    >
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    // No flex: 1 — wrapper must not alter layout sizing inside ScrollView
  },
});
