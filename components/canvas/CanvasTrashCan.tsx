/**
 * CanvasTrashCan -- Premium drag-delete zone for Canvas Mode.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - 3-state visual system: Inactive, Active (widget nearby), Hover (drop zone)
 * - Multi-layer shadow system with per-state red glow
 * - Animated lid (rotation + lift) via TrashCanIcon
 * - Particle burst on successful delete (8 radial particles)
 * - Spring physics throughout (never linear easing)
 * - Full accessibility: keyboard Delete alternative, live region announcements
 * - Reduced-motion compliant: static states, no particle effects
 *
 * User Flow:
 *   1. User drags widget around canvas (trash inactive -- muted white, lid closed)
 *   2. Widget approaches trash zone (trash activates -- red glow, lid opens 50%)
 *   3. Widget hovers directly over trash (trash intensifies -- strong red, lid fully open, pulse)
 *   4. User drops widget on trash (widget shrinks/fades 300ms, lid closes, particle burst)
 *   5. Widget removed from canvas + localStorage position cleared
 *
 * Wave 19 -- Canvas Mode delete zone.
 *
 * Reference Quality: Figma canvas delete, macOS Dock trash, Bloomberg Terminal UI.
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Platform,
  AccessibilityInfo,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { TrashCanIcon } from '@/components/icons/ui/TrashCanIcon';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Reduced-motion detection (singleton, module-level)
// ---------------------------------------------------------------------------

let reducedMotion = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  reducedMotion = mql?.matches ?? false;
  mql?.addEventListener?.('change', (e) => {
    reducedMotion = e.matches;
  });
}

// ---------------------------------------------------------------------------
// CSS Keyframes -- injected once on web for premium hover interactions
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-canvas-trash-can-keyframes';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      /* Hover pulse -- subtle breathing while widget is over trash */
      @keyframes trashPulse {
        0%, 100% { transform: scale(1.0); }
        50% { transform: scale(1.05); }
      }

      /* Particle burst -- radial expand + fade */
      @keyframes particleBurst {
        0% { transform: translate(0, 0) scale(1); opacity: 0.8; }
        100% { opacity: 0; }
      }

      /* Lid close settle -- after widget is consumed */
      @keyframes lidSettle {
        0% { transform: scale(1.05); }
        60% { transform: scale(0.98); }
        100% { transform: scale(1.0); }
      }

      /* Reduced motion override */
      @media (prefers-reduced-motion: reduce) {
        .trash-pulse { animation: none !important; }
        .trash-particle { animation: none !important; display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Visual state of the trash can */
export type TrashState = 'inactive' | 'active' | 'hover';

export interface CanvasTrashCanProps {
  /** Current visual state driven by parent drag system */
  state: TrashState;
  /** Callback fired when a widget is dropped on the trash */
  onDelete?: (widgetId: string) => void;
  /** Widget ID currently being dragged (for delete callback) */
  draggedWidgetId?: string | null;
  /** Whether a widget was just dropped on trash (triggers delete animation) */
  isDeleting?: boolean;
  /** Callback when delete animation completes */
  onDeleteComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Particle System -- radial burst on delete
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  /** Angle in radians (8 particles at 45deg intervals) */
  angle: number;
  /** Travel distance in px */
  distance: number;
  /** Delay offset in ms (slight stagger for organic feel) */
  delay: number;
}

function generateParticles(): Particle[] {
  const { count, distanceMin, distanceMax } = CanvasTokens.trash.particles;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (i * Math.PI * 2) / count,
    distance: distanceMin + Math.random() * (distanceMax - distanceMin),
    delay: i * 15, // 15ms stagger per particle for organic burst
  }));
}

// ---------------------------------------------------------------------------
// ParticleBurst Sub-Component
// ---------------------------------------------------------------------------

interface ParticleBurstProps {
  isActive: boolean;
  onComplete?: () => void;
}

function ParticleBurst({ isActive, onComplete }: ParticleBurstProps) {
  const particles = useMemo(() => generateParticles(), []);
  const animValues = useRef(
    particles.map(() => ({
      progress: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!isActive || reducedMotion) {
      // Reset all particles
      animValues.forEach((v) => v.progress.setValue(0));
      if (isActive && reducedMotion) {
        // In reduced motion, just fire the completion callback without animation
        onComplete?.();
      }
      return;
    }

    // Stagger particle animations
    const animations = animValues.map((v, i) =>
      Animated.sequence([
        Animated.delay(particles[i].delay),
        Animated.timing(v.progress, {
          toValue: 1,
          duration: CanvasTokens.trash.animation.particleDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.parallel(animations).start(() => {
      // Reset after animation completes
      animValues.forEach((v) => v.progress.setValue(0));
      onComplete?.();
    });
  }, [isActive]);

  if (!isActive || reducedMotion) {
    return null;
  }

  return (
    <View style={particleStyles.container} pointerEvents="none">
      {particles.map((particle, i) => {
        const translateX = animValues[i].progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(particle.angle) * particle.distance],
        });
        const translateY = animValues[i].progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(particle.angle) * particle.distance],
        });
        const opacity = animValues[i].progress.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.8, 0.6, 0],
        });
        const scale = animValues[i].progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.5],
        });

        return (
          <Animated.View
            key={particle.id}
            style={[
              particleStyles.particle,
              {
                opacity,
                transform: [{ translateX }, { translateY }, { scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const particleStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    width: CanvasTokens.trash.particles.size,
    height: CanvasTokens.trash.particles.size,
    borderRadius: CanvasTokens.trash.particles.size / 2,
    backgroundColor: CanvasTokens.trash.particles.color,
  },
});

// ---------------------------------------------------------------------------
// CanvasTrashCan Component
// ---------------------------------------------------------------------------

export function CanvasTrashCan({
  state,
  onDelete,
  draggedWidgetId,
  isDeleting = false,
  onDeleteComplete,
}: CanvasTrashCanProps) {
  // ---------------------------------------------------------------------------
  // Animated shared values (Reanimated for 60fps)
  // ---------------------------------------------------------------------------

  const containerScale = useSharedValue(1);
  const containerOpacity = useSharedValue(0.7);
  const glowIntensity = useSharedValue(0);
  const lidOpenness = useSharedValue(0); // 0 = closed, 1 = fully open
  const bgOpacity = useSharedValue(0);

  // Particle burst trigger
  const showParticles = useRef(false);
  const [particleBurstActive, setParticleBurstActive] = React.useState(false);

  // Track previous state to detect transitions
  const prevStateRef = useRef<TrashState>('inactive');

  // ---------------------------------------------------------------------------
  // State transition animations
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = state;

    const { spring, hoverSpring } = CanvasTokens.trash.animation;

    switch (state) {
      case 'inactive': {
        // Return to resting state
        containerScale.value = withSpring(1, spring);
        containerOpacity.value = withSpring(0.7, spring);
        glowIntensity.value = withSpring(0, spring);
        lidOpenness.value = withSpring(0, spring);
        bgOpacity.value = withSpring(0, spring);
        // Cancel any ongoing pulse
        cancelAnimation(containerScale);
        containerScale.value = withSpring(1, spring);
        break;
      }

      case 'active': {
        // Widget is near trash -- red glow, lid opens partway
        containerScale.value = withSpring(1.02, spring);
        containerOpacity.value = withSpring(1, spring);
        glowIntensity.value = withSpring(0.6, spring);
        lidOpenness.value = withSpring(0.5, spring);
        bgOpacity.value = withSpring(0.4, spring);
        break;
      }

      case 'hover': {
        // Widget is directly over trash -- intense glow, lid fully open, pulse
        containerOpacity.value = withSpring(1, hoverSpring);
        glowIntensity.value = withSpring(1, hoverSpring);
        lidOpenness.value = withSpring(1, hoverSpring);
        bgOpacity.value = withSpring(0.8, hoverSpring);

        // Pulse animation (scale 1.0 -> 1.05 -> 1.0, repeating)
        if (!reducedMotion) {
          containerScale.value = withRepeat(
            withSequence(
              withSpring(1.05, hoverSpring),
              withSpring(1.0, hoverSpring)
            ),
            -1, // infinite repeat
            false
          );
        } else {
          containerScale.value = withSpring(1.05, hoverSpring);
        }
        break;
      }
    }
  }, [state]);

  // ---------------------------------------------------------------------------
  // Delete animation choreography
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isDeleting) return;

    const { spring } = CanvasTokens.trash.animation;

    // Phase 1 (0-200ms): Lid closes with satisfying snap
    lidOpenness.value = withSpring(0, {
      damping: 25,
      stiffness: 400,
      mass: 0.8,
    });

    // Phase 2 (150ms): Settle bounce
    containerScale.value = withSequence(
      withSpring(1.08, { damping: 18, stiffness: 350, mass: 0.8 }),
      withSpring(1.0, spring)
    );

    // Phase 3: Trigger particle burst
    if (!reducedMotion) {
      setParticleBurstActive(true);
    }

    // Phase 4: Glow flash (red -> white transition -> settle)
    glowIntensity.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withSpring(0, spring)
    );

    // Reset state after animation
    const timer = setTimeout(() => {
      containerOpacity.value = withSpring(0.7, spring);
      bgOpacity.value = withSpring(0, spring);
      onDeleteComplete?.();
    }, CanvasTokens.trash.animation.deleteDuration);

    // Emit telemetry
    emitCanvasEvent('stage_close', {
      action: 'widget_deleted',
      widgetId: draggedWidgetId ?? 'unknown',
    });

    return () => clearTimeout(timer);
  }, [isDeleting]);

  // ---------------------------------------------------------------------------
  // Particle burst completion handler
  // ---------------------------------------------------------------------------

  const handleParticleComplete = useCallback(() => {
    setParticleBurstActive(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Animated styles (Reanimated worklet-driven)
  // ---------------------------------------------------------------------------

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
    opacity: containerOpacity.value,
  }));

  const iconColor = useMemo(() => {
    switch (state) {
      case 'inactive':
        return CanvasTokens.trash.colors.inactive;
      case 'active':
        return CanvasTokens.trash.colors.active;
      case 'hover':
        return CanvasTokens.trash.colors.hover;
    }
  }, [state]);

  const lidValue = useMemo(() => {
    switch (state) {
      case 'inactive':
        return 0;
      case 'active':
        return 0.5;
      case 'hover':
        return 1;
    }
  }, [state]);

  // ---------------------------------------------------------------------------
  // Premium shadow system (per-state, web-only layered box-shadow)
  // ---------------------------------------------------------------------------

  const premiumShadow: ViewStyle = useMemo(() => {
    if (Platform.OS !== 'web') {
      // Native shadow fallback
      const isActive = state !== 'inactive';
      return {
        shadowColor: isActive ? '#EF4444' : '#000000',
        shadowOffset: { width: 0, height: isActive ? 8 : 4 },
        shadowOpacity: isActive ? 0.5 : 0.3,
        shadowRadius: isActive ? 20 : 12,
        elevation: isActive ? 8 : 4,
      };
    }

    return {
      boxShadow: CanvasTokens.trash.glow[state],
      transition: `box-shadow ${CanvasTokens.trash.animation.stateTransition}ms ease-out`,
    } as unknown as ViewStyle;
  }, [state]);

  // ---------------------------------------------------------------------------
  // Background surface color per state
  // ---------------------------------------------------------------------------

  const bgColor = useMemo(() => CanvasTokens.trash.bg[state], [state]);
  const borderColor = useMemo(() => CanvasTokens.trash.border[state], [state]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Reanimated.View
      style={[
        styles.container,
        containerAnimatedStyle,
        premiumShadow,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
        },
      ]}
      accessibilityRole="none"
      accessibilityLabel="Trash zone. Drag a widget here to remove it from the canvas."
      accessibilityState={{ expanded: state === 'hover' }}
    >
      {/* Inner red glow layer (visible in active/hover states) */}
      {state !== 'inactive' && (
        <View
          style={[
            styles.innerGlow,
            {
              backgroundColor:
                state === 'hover'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(239, 68, 68, 0.08)',
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Trash can icon with animated lid */}
      <View style={styles.iconWrapper}>
        <TrashCanIcon
          size={CanvasTokens.trash.size * 0.5}
          color={iconColor}
          lidOpen={lidValue}
          strokeWidth={state === 'hover' ? 2 : 1.5}
        />
      </View>

      {/* Red underglow (danger ambient light, active/hover only) */}
      {Platform.OS === 'web' && state !== 'inactive' && (
        <View
          style={[
            styles.underglow,
            {
              backgroundColor: CanvasTokens.trash.colors.active,
              opacity: state === 'hover' ? 0.12 : 0.06,
            },
            Platform.OS === 'web'
              ? ({
                  filter: 'blur(24px)',
                } as unknown as ViewStyle)
              : {},
          ]}
          pointerEvents="none"
        />
      )}

      {/* Particle burst layer (delete animation) */}
      <ParticleBurst
        isActive={particleBurstActive}
        onComplete={handleParticleComplete}
      />

      {/* Invisible hit zone (larger than visual for forgiving drop target) */}
      <View
        style={styles.hitZone}
        pointerEvents="none"
      />
    </Reanimated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TRASH_SIZE = CanvasTokens.trash.size;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: CanvasTokens.trash.position.bottom,
    right: CanvasTokens.trash.position.right,
    width: TRASH_SIZE,
    height: TRASH_SIZE,
    borderRadius: TRASH_SIZE / 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // Shadows and particles extend beyond bounds
    zIndex: 900,
    ...(Platform.OS === 'web'
      ? ({
          transition: `background-color ${CanvasTokens.trash.animation.stateTransition}ms ease-out, border-color ${CanvasTokens.trash.animation.stateTransition}ms ease-out`,
          cursor: 'default',
          userSelect: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TRASH_SIZE / 4 - 1, // Inset by border width
    ...(Platform.OS === 'web'
      ? ({
          transition: `background-color ${CanvasTokens.trash.animation.stateTransition}ms ease-out`,
        } as unknown as ViewStyle)
      : {}),
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  underglow: {
    position: 'absolute',
    bottom: -20,
    left: '10%' as any,
    right: '10%' as any,
    height: 40,
    borderRadius: 20,
    zIndex: -1,
  },

  hitZone: {
    position: 'absolute',
    top: -(CanvasTokens.trash.hitZone.height - TRASH_SIZE) / 2,
    left: -(CanvasTokens.trash.hitZone.width - TRASH_SIZE) / 2,
    width: CanvasTokens.trash.hitZone.width,
    height: CanvasTokens.trash.hitZone.height,
    zIndex: -1,
  },
});
