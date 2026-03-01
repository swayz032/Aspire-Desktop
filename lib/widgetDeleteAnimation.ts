/**
 * Widget Delete Animation -- 4-phase choreography for Canvas Mode widget deletion.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - Phase 1 (0-100ms): Subtle shake + slight shrink (widget "reacts" to danger)
 * - Phase 2 (100-200ms): Accelerating shrink + rotation tilt (falling into trash)
 * - Phase 3 (200-300ms): Rapid fade + scale collapse (consumed)
 * - Phase 4 (300ms): Cleanup callback (remove from state)
 *
 * Uses react-native-reanimated SharedValues for 60fps worklet-driven animations.
 * Respects prefers-reduced-motion (instant removal, no animation).
 *
 * Wave 19 -- Canvas Mode delete choreography.
 */

import {
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  type SharedValue,
  Easing,
} from 'react-native-reanimated';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeleteAnimationTargets {
  /** Widget scale (1 -> 0) */
  scale: SharedValue<number>;
  /** Widget opacity (1 -> 0) */
  opacity: SharedValue<number>;
  /** Widget rotation in degrees (0 -> tilt) */
  rotation: SharedValue<number>;
  /** Widget vertical offset (0 -> drift down) */
  translateY: SharedValue<number>;
}

export interface DeleteAnimationConfig {
  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;
  /** Total choreography duration in ms (default 300) */
  duration?: number;
  /** Callback when animation completes (runs on JS thread) */
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default choreography timing */
const PHASE_1_DURATION = 100; // Reaction
const PHASE_2_DURATION = 100; // Falling
const PHASE_3_DURATION = 100; // Consumed
const TOTAL_DURATION = PHASE_1_DURATION + PHASE_2_DURATION + PHASE_3_DURATION;

/** Spring physics for shake/shrink (snappy, premium) */
const REACTION_SPRING = {
  damping: 15,
  stiffness: 400,
  mass: 0.8,
};

// ---------------------------------------------------------------------------
// Animation Function
// ---------------------------------------------------------------------------

/**
 * Execute the 4-phase widget delete animation.
 *
 * Call this when a widget is dropped on the trash can. The animation
 * manipulates the provided SharedValues and calls onComplete when done.
 *
 * @example
 * ```ts
 * animateWidgetDelete(
 *   { scale, opacity, rotation, translateY },
 *   {
 *     onComplete: () => removeWidget(widgetId),
 *   }
 * );
 * ```
 */
export function animateWidgetDelete(
  targets: DeleteAnimationTargets,
  config: DeleteAnimationConfig,
): void {
  const { reducedMotion = false, onComplete } = config;

  // Reduced motion: instant removal
  if (reducedMotion) {
    targets.scale.value = 0;
    targets.opacity.value = 0;
    targets.rotation.value = 0;
    targets.translateY.value = 0;
    runOnJS(onComplete)();
    return;
  }

  // Phase 1 (0-100ms): Reaction -- slight shrink + shake
  targets.scale.value = withSpring(0.85, REACTION_SPRING);
  targets.opacity.value = withTiming(0.7, { duration: PHASE_1_DURATION });
  targets.rotation.value = withSequence(
    withTiming(-3, { duration: 40, easing: Easing.inOut(Easing.quad) }),
    withTiming(3, { duration: 40, easing: Easing.inOut(Easing.quad) }),
    withTiming(0, { duration: 20 }),
  );

  // Phase 2 (100-200ms): Falling -- accelerating shrink + tilt
  targets.scale.value = withDelay(
    PHASE_1_DURATION,
    withTiming(0.5, { duration: PHASE_2_DURATION, easing: Easing.in(Easing.quad) }),
  );
  targets.opacity.value = withDelay(
    PHASE_1_DURATION,
    withTiming(0.4, { duration: PHASE_2_DURATION }),
  );
  targets.rotation.value = withDelay(
    PHASE_1_DURATION,
    withTiming(-8, { duration: PHASE_2_DURATION, easing: Easing.in(Easing.quad) }),
  );
  targets.translateY.value = withDelay(
    PHASE_1_DURATION,
    withTiming(12, { duration: PHASE_2_DURATION, easing: Easing.in(Easing.quad) }),
  );

  // Phase 3 (200-300ms): Consumed -- rapid fade + collapse
  targets.scale.value = withDelay(
    PHASE_1_DURATION + PHASE_2_DURATION,
    withTiming(0, { duration: PHASE_3_DURATION, easing: Easing.in(Easing.cubic) }),
  );
  targets.opacity.value = withDelay(
    PHASE_1_DURATION + PHASE_2_DURATION,
    withTiming(0, { duration: PHASE_3_DURATION, easing: Easing.in(Easing.cubic) }),
  );
  targets.translateY.value = withDelay(
    PHASE_1_DURATION + PHASE_2_DURATION,
    withTiming(24, { duration: PHASE_3_DURATION }),
  );

  // Phase 4 (300ms): Cleanup -- execute callback on JS thread
  // Use withDelay on opacity as the "last" animation to trigger callback
  targets.opacity.value = withDelay(
    TOTAL_DURATION,
    withTiming(0, {
      duration: 1, // Minimal duration to trigger completion
    }),
  );

  // Schedule cleanup on JS thread
  setTimeout(() => {
    onComplete();
  }, TOTAL_DURATION + 50); // Small buffer for animation frame alignment
}

/**
 * Reset widget animation values to their default state.
 * Used when cancelling a delete or restoring from storage.
 */
export function resetWidgetAnimation(targets: DeleteAnimationTargets): void {
  targets.scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  targets.opacity.value = withTiming(1, { duration: 200 });
  targets.rotation.value = withSpring(0, { damping: 20, stiffness: 300 });
  targets.translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
}

// Export timing constants for tests
export { PHASE_1_DURATION, PHASE_2_DURATION, PHASE_3_DURATION, TOTAL_DURATION };
