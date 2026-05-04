/**
 * PortalReveal — Apple-style "container transform" reveal for the Call Room.
 *
 * The user clicks the Call button on /session/calls; that handler captures the
 * button's bounding rect and passes it to /call-room as query params. On Call
 * Room mount, this overlay renders FIRST, sitting at the captured rect in the
 * Aspire accent color (#3B82F6). On the next paint it morphs to fullscreen via
 * a CSS transition, then fades to transparent — revealing the Call Room as if
 * the user stepped through the button itself.
 *
 * Why imperative React state + CSS transition (Option B) instead of Reanimated
 * worklets: Reanimated worklets have been flaky on RN-Web (the previous door
 * transition shipped but the rotateY worklet didn't fire — user saw a static
 * gold glare for 2s, then the room popped in). CSS transitions on real DOM
 * properties (left/top/width/height/border-radius/opacity) are deterministic
 * across every browser, GPU-accelerated where the browser decides to be, and
 * cannot fail to run.
 *
 * Phases:
 *   - 'initial'  → overlay sits at the button's rect, pill shape, opaque
 *   - 'expanded' → overlay fills the viewport, square, fading to transparent
 *   - 'done'     → overlay unmounts, Call Room is fully exposed
 *
 * If `origin` is null (user landed via direct URL, refresh, or native), we
 * skip the morph and play a 200ms cross-fade in the same accent color so the
 * brand still flashes through the seam.
 *
 * Children render IMMEDIATELY underneath the overlay (zIndex 0), so the heavy
 * Call Room tree has the full ~550ms morph window to mount + settle. The
 * moment the overlay's opacity hits zero, the room is already interactive.
 *
 * Native (iOS/Android): 200ms accent-color cross-fade. Native isn't where v1
 * places real calls, and `getBoundingClientRect` is web-only, so the rect
 * geometry doesn't apply there. The fallback keeps the brand moment.
 *
 * Reduced motion: respected via the matchMedia check on web. We collapse to
 * the cross-fade path (still shows the accent flash, just no rect morph).
 * WCAG 2.3.3.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/tokens';

// ─── Origin geometry (provided by /session/calls handleCall) ────────────────
export interface PortalOrigin {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortalRevealProps {
  children: React.ReactNode;
  /**
   * Bounding rect of the source button at click time, in viewport coords.
   * Null = direct URL / native / refresh — fall back to a simple cross-fade.
   */
  origin: PortalOrigin | null;
  /** Fires once after the overlay has fully unmounted. */
  onRevealComplete?: () => void;
}

// ─── Timing ─────────────────────────────────────────────────────────────────
// Apple's container-transform feel: ~550ms with their out-spring-equivalent
// cubic-bezier (0.32, 0.72, 0, 1). Opacity fades over the LAST ~200ms so the
// accent fill stays opaque while the room is still mounting underneath.
const MORPH_MS = 550;
const FADE_MS = 200;
const FADE_DELAY_MS = 350; // accent stays solid for the first 350ms of the morph
const TOTAL_MS = MORPH_MS + 50; // small buffer past full-open
const NATIVE_FALLBACK_MS = 200;
const APPLE_BEZIER = 'cubic-bezier(0.32, 0.72, 0, 1)';
// Aspire accent — verified from constants/tokens.ts → Colors.accent.cyan = '#3B82F6'.
const ACCENT = Colors.accent.cyan;

// ─── Reduced-motion (web only) ──────────────────────────────────────────────
function prefersReducedMotion(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ─── Web morph (Option B: React state + CSS transition) ─────────────────────
//
// We render the overlay at `origin` on the first paint. On the next animation
// frame (a double rAF guarantees the browser has committed the initial layout
// before we change properties — single rAF can race in Chrome) we flip the
// state to 'expanded', and the CSS `transition: all 550ms ...` interpolates
// every changed property simultaneously: left/top/width/height/borderRadius
// AND opacity (with its own delay). The overlay becomes fullscreen and
// transparent in lockstep — the room emerges through it.
function PortalRevealWeb({
  origin,
  onDone,
}: {
  origin: PortalOrigin;
  onDone: () => void;
}): React.ReactElement {
  const [phase, setPhase] = useState<'initial' | 'expanded'>('initial');

  useEffect(() => {
    // Double-rAF: one frame to commit the 'initial' style, the next to
    // flip to 'expanded' so the transition has two distinct values to tween.
    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(() => setPhase('expanded'));
    });
    // Worst-case unmount safety net — ~50ms past the morph end.
    const t = setTimeout(onDone, TOTAL_MS);
    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      clearTimeout(t);
    };
  }, [onDone]);

  const style = useMemo(() => {
    // Common transition spec: every animatable prop morphs on the same
    // bezier; opacity has its own delay so the accent stays solid until the
    // overlay is most of the way grown.
    const transition = `left ${MORPH_MS}ms ${APPLE_BEZIER}, top ${MORPH_MS}ms ${APPLE_BEZIER}, width ${MORPH_MS}ms ${APPLE_BEZIER}, height ${MORPH_MS}ms ${APPLE_BEZIER}, border-radius ${MORPH_MS}ms ${APPLE_BEZIER}, opacity ${FADE_MS}ms ease-out ${FADE_DELAY_MS}ms`;

    if (phase === 'initial') {
      return {
        position: 'absolute' as const,
        left: origin.x,
        top: origin.y,
        width: origin.w,
        height: origin.h,
        // Pill shape: full radius = half of the smaller dimension. Matches
        // the visual of a circular call button at rest.
        borderRadius: Math.min(origin.w, origin.h) / 2,
        backgroundColor: ACCENT,
        opacity: 1,
        zIndex: 100,
        // Web-only CSS, cast through `any` because RN's StyleProp doesn't
        // expose `transition`/`pointerEvents:'none'` as plain strings.
        transition,
        pointerEvents: 'none' as const,
        // Subtle lift while the morph is in flight — makes the button feel
        // like it's pulling forward through the screen, not sliding.
        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.45)',
      } as unknown as object;
    }
    return {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: '100%' as const,
      height: '100%' as const,
      borderRadius: 0,
      backgroundColor: ACCENT,
      opacity: 0,
      zIndex: 100,
      transition,
      pointerEvents: 'none' as const,
      boxShadow: 'none',
    } as unknown as object;
  }, [phase, origin]);

  return <View style={style as object} pointerEvents="none" />;
}

// ─── Cross-fade fallback (native + reduced-motion + null origin) ────────────
//
// Same accent color, no rect math: a full-bleed solid that fades from opaque
// to transparent over 200ms. Driven by Reanimated since native doesn't honor
// CSS transitions and we want one code path that works in every fallback
// case (RN-Web with reduced motion, iOS, Android, direct URL, refresh).
function PortalRevealCrossfade({
  onDone,
}: {
  onDone: () => void;
}): React.ReactElement {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(
      0,
      { duration: NATIVE_FALLBACK_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
    // Safety net in case the worklet completion never lands.
    const t = setTimeout(onDone, NATIVE_FALLBACK_MS + 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.fallbackOverlay, animStyle]}
      pointerEvents="none"
    />
  );
}

export function PortalReveal({
  children,
  origin,
  onRevealComplete,
}: PortalRevealProps): React.ReactElement {
  const [done, setDone] = useState(false);
  const reducedMotion = prefersReducedMotion();

  // Decide path once on mount. If we have a rect on web AND the user hasn't
  // requested reduced motion, run the morph; otherwise cross-fade.
  const useMorph =
    Platform.OS === 'web' && origin !== null && !reducedMotion;

  // Fire completion exactly once on the done=true edge.
  useEffect(() => {
    if (done) onRevealComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const handleDone = () => setDone(true);

  return (
    <View style={styles.root}>
      {/* Children mount IMMEDIATELY beneath the overlay — the Call Room has
          the full morph window to settle while the accent fill is still
          covering it. */}
      <View style={styles.childrenLayer}>{children}</View>

      {!done && useMorph && origin ? (
        <PortalRevealWeb origin={origin} onDone={handleDone} />
      ) : !done ? (
        <PortalRevealCrossfade onDone={handleDone} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  childrenLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  fallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ACCENT,
    zIndex: 100,
  },
});
