/**
 * DoorOpeningTransition -- Cinematic 3D door-opening reveal for the Call Room.
 *
 * Two full-screen dark doors cover the children on mount. After a 50ms hold
 * (so the heavy CallRoom can finish mounting behind them), the doors swing
 * outward in 3D -- left door rotates around its left edge to ~-110deg, right
 * door rotates around its right edge to ~+110deg -- revealing the room.
 *
 * The doors are not flat black slabs. They have:
 *   - A vertical ambient gradient (light from above, deeper at the floor)
 *   - A warm bevel highlight along the seam-side inner edge
 *   - Subtle hairline horizontal grain (5 strokes, very low opacity)
 *   - A face-shadow overlay that darkens as each door tilts away from camera
 *   - A floor vignette implying room depth where the door meets the ground
 *   - A warm seam light that pulses up during the hold, blooms wider as the
 *     doors part, and a soft radial halo behind the seam suggesting the room
 *     beyond is lit
 *
 * The children mount BEHIND a black mask overlay that fades from opaque to
 * transparent during the second half of the swing -- so the room appears to
 * emerge THROUGH the parting doors rather than being there from frame zero.
 *
 * Why: hides the blank-screen lag while CallRoom mounts (Twilio + audio
 * pipeline + voice subscriptions). The doors are an additive overlay -- the
 * Call Room mounts immediately and is fully interactive the moment the doors
 * leave. Total animation is ~900ms; doors unmount entirely after that so
 * there's zero ongoing cost.
 *
 * Web: full 3D perspective + rotateY swing.
 * Native (iOS/Android): 200ms cross-fade fallback. RN's RCTView doesn't
 * uniformly support `transformOrigin` + perspective composition without
 * occasional artifacts, and v1 only places real calls on web -- so we keep
 * native correct (no crash) without chasing pixel parity.
 *
 * Reduced motion: when `prefers-reduced-motion: reduce` is set, the doors
 * skip the swing and play a 200ms cross-fade instead (same code path as
 * native fallback). WCAG 2.3.3 compliance.
 *
 * Usage:
 *   <DoorOpeningTransition onOpenComplete={() => log('entered')}>
 *     <CallRoom ... />
 *   </DoorOpeningTransition>
 *
 * The component renders children behind the door overlay. Once the doors
 * unmount (single React re-render flip), the children are exposed with no
 * lingering wrapper besides a transparent passthrough View.
 */

import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  DoorBodyColors,
  FloorVignetteColors,
  HaloColors,
  LeftDoorBevelColors,
  RightDoorBevelColors,
  SeamBloomColors,
  SeamCoreColors,
  styles,
} from './DoorOpeningTransition.styles';

// ─── Timing (must match the values documented at the call site) ─────────────
const HOLD_MS = 50; // settle time before doors begin to swing
const SWING_MS = 700; // rotateY 0 -> ±110deg
const FADE_START_MS = 550; // door opacity starts fading at this offset
const FADE_MS = 200; // door opacity fade duration
const TOTAL_MS = HOLD_MS + SWING_MS + 150; // ~900ms; small buffer past full open
const NATIVE_FALLBACK_MS = 200; // simple cross-fade duration on iOS/Android + reduced motion

// out-quint: strong start, soft settle. No bounce, no overshoot. Real
// hardwood doors sweep open and decelerate into their final tilt — they
// don't oscillate, they don't ease in. This curve sells "weighty wood".
const OUT_QUINT = Easing.bezier(0.22, 1, 0.36, 1);

// out-cubic: a softer settle for the opacity fade than the rotation curve.
// Decoupling the two gives the door's *body* (the rotation) a different
// sense of physicality from its *visibility* (the fade) — the door feels
// like it's catching less light as it tilts away rather than dissolving.
const OUT_CUBIC = Easing.bezier(0.33, 1, 0.68, 1);

// Maximum rotation. >90deg fully removes the door from view; ~110deg gives a
// bit of "kicked back" feel without exposing a thin edge sliver.
const MAX_ROT_DEG = 110;

// Web perspective. Lower = more dramatic; 1200 reads as "weighty room door".
const PERSPECTIVE = 1200;

// Five hairline grain stroke positions (vertical %), evenly distributed but
// not perfectly so — slight irregularity reads more like real material.
const GRAIN_POSITIONS = ['11%', '27%', '46%', '68%', '88%'] as const;
// Mark a couple as "stronger" so the grain isn't perfectly uniform.
const GRAIN_STRONG_INDICES = new Set([1, 3]);

export interface DoorOpeningTransitionProps {
  children: React.ReactNode;
  /** Fires when the door overlay has fully unmounted. */
  onOpenComplete?: () => void;
}

// ─── Worklet helpers ───────────────────────────────────────────────────────
// Door opacity fades over the FADE_START..FADE_START+FADE window of the swing.
// Using a separate easing on the fade lets the body and the visibility decay
// at different rates — see OUT_CUBIC comment above.
function fadeForProgress(p: number): number {
  'worklet';
  const fadeStart = FADE_START_MS / (HOLD_MS + SWING_MS);
  const fadeEnd = (FADE_START_MS + FADE_MS) / (HOLD_MS + SWING_MS);
  if (p <= fadeStart) return 1;
  if (p >= fadeEnd) return 0;
  const t = (p - fadeStart) / (fadeEnd - fadeStart);
  // out-cubic: 1 - (1 - t)^3
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Web implementation: real 3D rotateY around the outer edge of each door,
 * plus a layered surface treatment (gradient body + bevel + grain + face
 * shadow + floor vignette) and a warm seam light with bloom + halo.
 */
function DoorsWeb({ onDone }: { onDone: () => void }): React.ReactElement {
  // 0 = closed, 1 = fully open. Drives rotation, opacity, face shadow,
  // children unmask, and seam fade-out.
  const progress = useSharedValue(0);
  // Seam light pulse: 0 -> 1 during hold, brightens to 1.0 in the early
  // swing as the gap widens, then drops to 0 as doors clear the frame.
  const seamPulse = useSharedValue(0);

  useEffect(() => {
    // Seam: pulse up during the hold, hold near peak briefly as the doors
    // begin parting (light spilling through the widening gap), then collapse
    // to zero before the doors are fully out of view.
    seamPulse.value = withSequence(
      // Ramp up during the hold so something feels alive before doors move.
      withTiming(0.7, {
        duration: HOLD_MS + 60,
        easing: Easing.out(Easing.quad),
      }),
      // Brief peak as the gap widens — hottest core of the warm light.
      withTiming(1, {
        duration: 140,
        easing: Easing.inOut(Easing.quad),
      }),
      // Then fade as doors clear the frame.
      withTiming(0, {
        duration: 360,
        easing: Easing.in(Easing.cubic),
      }),
    );

    // Hold, then swing.
    progress.value = withDelay(
      HOLD_MS,
      withTiming(
        1,
        { duration: SWING_MS, easing: OUT_QUINT },
        (finished) => {
          if (finished) {
            runOnJS(onDone)();
          }
        },
      ),
    );
    // Effect runs once on mount; shared values are stable identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Left door: rotates negative around its left edge.
  const leftDoorStyle = useAnimatedStyle(() => {
    const rot = -MAX_ROT_DEG * progress.value;
    return {
      opacity: fadeForProgress(progress.value),
      transform: [
        { perspective: PERSPECTIVE },
        { rotateY: `${rot}deg` },
      ],
    };
  });

  const rightDoorStyle = useAnimatedStyle(() => {
    const rot = MAX_ROT_DEG * progress.value;
    return {
      opacity: fadeForProgress(progress.value),
      transform: [
        { perspective: PERSPECTIVE },
        { rotateY: `${rot}deg` },
      ],
    };
  });

  // Face shadow: as the door rotates away, its visible face catches less
  // light. Opacity scales with |rotation|/MAX up to 0.55 max.
  const leftFaceShadowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.55,
  }));
  const rightFaceShadowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.55,
  }));

  // Seam core: 1px hairline that brightens with seamPulse and cuts off as
  // doors part past 40%.
  const seamCoreStyle = useAnimatedStyle(() => {
    const occluded = Math.max(0, 1 - progress.value * 1.4);
    return {
      opacity: seamPulse.value * occluded,
    };
  });

  // Seam wrap: width animates 2 -> 12 -> 0 so the bloom widens with the gap.
  const seamWrapStyle = useAnimatedStyle(() => {
    // Width grows with progress up to a peak around 25% open, then
    // collapses to 0 as the doors clear the frame.
    const width = interpolate(
      progress.value,
      [0, 0.05, 0.25, 0.7],
      [2, 6, 12, 0],
      'clamp',
    );
    return {
      width,
      marginLeft: -width / 2,
      // The wrap itself fades with the seam — keeps it from stranding 2px
      // of shadow when seamPulse hasn't caught up.
      opacity: seamPulse.value,
    };
  });

  // Halo: soft volumetric bloom behind the seam center. Peaks slightly later
  // than the core hairline (the core is a sharp slit; the halo is the
  // diffused rim around it).
  const haloStyle = useAnimatedStyle(() => {
    const haloIntensity = interpolate(
      progress.value,
      [0, 0.1, 0.35, 0.65],
      [0, 0.7, 1, 0],
      'clamp',
    );
    return {
      opacity: seamPulse.value * haloIntensity,
    };
  });

  // Children mask: black overlay above the children, fades 1 -> 0 over the
  // second half of the swing so the room emerges THROUGH the parting doors.
  const childrenMaskStyle = useAnimatedStyle(() => {
    const reveal = interpolate(
      progress.value,
      [0.35, 0.85],
      [1, 0],
      'clamp',
    );
    return { opacity: reveal };
  });

  return (
    <>
      {/* Black mask above children — fades out as doors part. Sits between
          children (z:0) and door overlay (z:10). */}
      <Animated.View
        style={[styles.childrenMask, childrenMaskStyle]}
        pointerEvents="none"
      />

      <View style={styles.overlay} pointerEvents="none">
        {/* ─── Left door ────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.doorBase,
            styles.leftDoor,
            // transformOrigin: rotate around the LEFT edge of the left door.
            // RN web (Expo SDK 54 / RN 0.81) supports this via the web shim.
            ({ transformOrigin: 'left center' } as object),
            leftDoorStyle,
          ]}
        >
          {/* Body: vertical ambient gradient (light from above). */}
          <LinearGradient
            colors={DoorBodyColors as unknown as readonly [string, string, string]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Bevel: warm highlight along the seam-side (right) edge. */}
          <LinearGradient
            colors={LeftDoorBevelColors as unknown as readonly [string, string, string]}
            locations={[0, 0.85, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.bevel}
          />
          {/* Grain: 5 hairline strokes at irregular vertical positions. */}
          {GRAIN_POSITIONS.map((top, i) => (
            <View
              key={`l-grain-${i}`}
              style={[
                GRAIN_STRONG_INDICES.has(i)
                  ? styles.grainLineStrong
                  : styles.grainLine,
                { top },
              ]}
            />
          ))}
          {/* Floor vignette: implies depth at the bottom edge. */}
          <LinearGradient
            colors={FloorVignetteColors as unknown as readonly [string, string]}
            locations={[0, 1]}
            style={styles.floorVignette}
          />
          {/* Seam-side hairline: warm glow on the inner edge. */}
          <View style={styles.leftDoorSeamShadow} />
          {/* Face shadow: darkens as the door tilts away. */}
          <Animated.View style={[styles.faceShadow, leftFaceShadowStyle]} />
        </Animated.View>

        {/* ─── Right door (mirrored layer order) ────────────────────── */}
        <Animated.View
          style={[
            styles.doorBase,
            styles.rightDoor,
            ({ transformOrigin: 'right center' } as object),
            rightDoorStyle,
          ]}
        >
          <LinearGradient
            colors={DoorBodyColors as unknown as readonly [string, string, string]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={RightDoorBevelColors as unknown as readonly [string, string, string]}
            locations={[0, 0.15, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.bevel}
          />
          {GRAIN_POSITIONS.map((top, i) => (
            <View
              key={`r-grain-${i}`}
              style={[
                GRAIN_STRONG_INDICES.has(i)
                  ? styles.grainLineStrong
                  : styles.grainLine,
                { top },
              ]}
            />
          ))}
          <LinearGradient
            colors={FloorVignetteColors as unknown as readonly [string, string]}
            locations={[0, 1]}
            style={styles.floorVignette}
          />
          <View style={styles.rightDoorSeamShadow} />
          <Animated.View style={[styles.faceShadow, rightFaceShadowStyle]} />
        </Animated.View>

        {/* ─── Seam halo ────────────────────────────────────────────── */}
        {/* Stacked horizontal + vertical 3-stop gradients approximate a soft
            radial bloom. Two layers compose the volumetric falloff. */}
        <Animated.View style={[styles.seamHalo, haloStyle]} pointerEvents="none">
          <LinearGradient
            colors={HaloColors as unknown as readonly [string, string, string]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.haloLayer}
          />
          <LinearGradient
            colors={HaloColors as unknown as readonly [string, string, string]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.haloLayer}
          />
        </Animated.View>

        {/* ─── Seam core hairline ───────────────────────────────────── */}
        {/* Width animates with progress (2→12→0). Two stacked horizontal
            gradients give the band a hot core + softer bleed. */}
        <Animated.View style={[styles.seamWrap, seamWrapStyle]} pointerEvents="none">
          <Animated.View style={[StyleSheet.absoluteFill, seamCoreStyle]}>
            {/* Outer warm bleed */}
            <LinearGradient
              colors={SeamCoreColors as unknown as readonly [string, string, string]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.seamBand}
            />
            {/* Hot core, narrower band */}
            <LinearGradient
              colors={SeamBloomColors as unknown as readonly [string, string, string]}
              locations={[0.35, 0.5, 0.65]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.seamBand}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </>
  );
}

/**
 * Cross-fade fallback: simple opacity fade. Used on iOS/Android (where 3D
 * perspective composition is unreliable) AND on web when the user has
 * `prefers-reduced-motion: reduce` set (WCAG 2.3.3).
 *
 * Same dark gradient surface so the visual brand is preserved; just no 3D.
 */
function DoorsCrossfade({ onDone }: { onDone: () => void }): React.ReactElement {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      HOLD_MS,
      withTiming(
        0,
        { duration: NATIVE_FALLBACK_MS, easing: OUT_CUBIC },
        (finished) => {
          if (finished) {
            runOnJS(onDone)();
          }
        },
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.overlay, fadeStyle]} pointerEvents="none">
      <LinearGradient
        colors={DoorBodyColors as unknown as readonly [string, string, string]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export function DoorOpeningTransition({
  children,
  onOpenComplete,
}: DoorOpeningTransitionProps): React.ReactElement {
  const [done, setDone] = useState(false);
  const reducedMotion = useReducedMotion();

  // Safety net: if the worklet completion callback ever fails to fire (e.g.
  // a backgrounded tab pausing rAF), force-unmount after the worst-case
  // duration. This guarantees the doors never strand the user.
  useEffect(() => {
    if (done) return;
    // Reduced-motion / native cross-fade is much shorter; use the smaller
    // worst-case to avoid leaving an unnecessary mask up.
    const worstCase =
      reducedMotion || Platform.OS !== 'web'
        ? HOLD_MS + NATIVE_FALLBACK_MS + 200
        : TOTAL_MS + 200;
    const t = setTimeout(() => {
      setDone(true);
    }, worstCase);
    return () => clearTimeout(t);
  }, [done, reducedMotion]);

  // Fire the completion callback exactly once, after the door overlay has
  // fully unmounted from the React tree.
  useEffect(() => {
    if (done) onOpenComplete?.();
    // onOpenComplete identity is caller-controlled; we intentionally fire
    // only on the done=true edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const handleDoorsDone = () => setDone(true);

  // Selection: web + full motion → 3D swing. Otherwise → cross-fade.
  const useFullMotion = Platform.OS === 'web' && !reducedMotion;

  return (
    <View style={styles.root}>
      {/* Children mount IMMEDIATELY behind the doors so the heavy CallRoom
          tree has 50ms+ to settle before reveal. */}
      <View style={styles.childrenLayer}>{children}</View>

      {!done && useFullMotion ? (
        <DoorsWeb onDone={handleDoorsDone} />
      ) : !done ? (
        <DoorsCrossfade onDone={handleDoorsDone} />
      ) : null}
    </View>
  );
}
