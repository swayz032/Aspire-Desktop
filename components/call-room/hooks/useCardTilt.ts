// components/call-room/hooks/useCardTilt.ts
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useCursor, useCursorRef, type CursorPosition, type ViewportSize } from './useParallax';

export interface CardTilt {
  /** Degrees, ±maxDeg. Positive = top edge tilts away from viewer (cursor at bottom). */
  rotateX: number;
  /** Degrees, ±maxDeg. Positive = right edge tilts toward viewer (cursor at right). */
  rotateY: number;
}

/**
 * Default max tilt amplitudes per device class. Pointer-precise surfaces
 * (desktop/laptop) get the full agency-grade ±14° swing; touch surfaces
 * (tablet via DeviceOrientation) get a softer ±9° so phone-style wobble
 * doesn't read as nausea-inducing.
 *
 * The legacy ±2° default produced a "card barely moves" complaint from
 * canary testing on Safari — boosted across the board, not just for
 * Safari, since the under-amplitude was global.
 */
// Pass D 2026-05-12 founder feedback: "moves too much" — ±14° was making
// the card feel nausea-inducing on a stationary laptop. Pulled back to a
// restrained ±5° (desktop/laptop) and ±4° (tablet). The card still feels
// alive on cursor move but no longer reads as a swinging billboard.
export const TILT_AMPLITUDE = {
  desktop: 5,
  laptop: 5,
  tablet: 4,
  reducedMotion: 0,
} as const;

/**
 * Compute a 3D tilt for the card based on cursor position relative
 * to viewport center. The card itself rotates ±maxDeg degrees on each axis.
 *
 * Math:
 *  - Cursor center            -> { rotateX: 0,         rotateY: 0 }
 *  - Cursor at top edge       -> { rotateX: -maxDeg,   ...        } (top tilts toward viewer)
 *  - Cursor at bottom edge    -> { rotateX: +maxDeg,   ...        }
 *  - Cursor at right edge     -> { ...,                rotateY: +maxDeg }
 *  - Cursor at left edge      -> { ...,                rotateY: -maxDeg }
 *  - viewport.{width,height}=0 -> { rotateX: 0, rotateY: 0 }  (safe / SSR)
 */
export function computeTilt(
  cursor: CursorPosition,
  viewport: ViewportSize,
  maxDeg: number = TILT_AMPLITUDE.desktop,
): CardTilt {
  if (viewport.width === 0 || viewport.height === 0) {
    return { rotateX: 0, rotateY: 0 };
  }

  const normX = (cursor.x / viewport.width) * 2 - 1; // [-1, 1]
  const normY = (cursor.y / viewport.height) * 2 - 1; // [-1, 1]

  return {
    rotateX: Math.max(-maxDeg, Math.min(maxDeg, normY * maxDeg)),
    rotateY: Math.max(-maxDeg, Math.min(maxDeg, normX * maxDeg)),
  };
}

/**
 * Tracks `prefers-reduced-motion: reduce`. When true we collapse tilt to
 * zero so motion-sensitive users get a static card. SSR-safe.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    // addEventListener is the modern API; older Safari uses addListener.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    // @ts-expect-error - legacy Safari fallback
    mq.addListener(handler);
    return () => {
      // @ts-expect-error - legacy Safari fallback
      mq.removeListener(handler);
    };
  }, []);

  return reduced;
}

/**
 * React hook returning the current card tilt for the cursor frame.
 * - SSR-safe (useCursor returns viewport={0,0} on the server, which yields zero tilt).
 * - Honors `prefers-reduced-motion: reduce` (returns zero tilt).
 *
 * `maxDeg` defaults to the desktop amplitude; callers should pass a
 * device-appropriate value from `TILT_AMPLITUDE`.
 *
 * NOTE: Prefer `useCardTiltRef` for production cards — that variant writes the
 * transform directly to a DOM element via rAF and never triggers a React
 * render. This hook re-renders on every cursor frame and is fine for small
 * components but causes visible jitter on heavy trees (e.g. CallRoomCard).
 */
export function useCardTilt(maxDeg: number = TILT_AMPLITUDE.desktop): CardTilt {
  const { cursor, viewport } = useCursor();
  const reducedMotion = useReducedMotion();
  const effectiveMax = reducedMotion ? TILT_AMPLITUDE.reducedMotion : maxDeg;
  return computeTilt(cursor, viewport, effectiveMax);
}

/**
 * Render-free 3D tilt — attaches a mousemove tracker + rAF loop that writes
 * `transform` directly to the returned ref's DOM node. Zero React renders
 * during cursor movement.
 *
 * Usage:
 *   const tiltRef = useCardTiltRef(TILT_AMPLITUDE.desktop);
 *   <View ref={tiltRef as any} style={baseStyle}>...</View>
 *
 * The element should have `transform-style: preserve-3d` and a parent with
 * `perspective(...)` set in CSS for the rotation to render in 3D.
 */
export function useCardTiltRef(maxDeg: number = TILT_AMPLITUDE.desktop) {
  const elementRef = useRef<HTMLElement | null>(null);
  const cursorRef = useCursorRef();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const effectiveMax = reducedMotion ? TILT_AMPLITUDE.reducedMotion : maxDeg;

    let frame: number | null = null;
    let lastX = 0;
    let lastY = 0;
    // Smoothed values — lerped toward the target each frame for buttery
    // glide (founder feedback "lags a lot" — root cause was the snap to
    // raw target). 0.12 = ~150ms ease-out feel at 60fps.
    let curX = 0;
    let curY = 0;
    const LERP = 0.12;

    // Hint the compositor + add translateZ(0) so the browser keeps the
    // card on its own GPU layer. Eliminates the CPU-layer flip jank that
    // was reading as "lag".
    const el0 = elementRef.current;
    if (el0) {
      el0.style.willChange = 'transform';
      el0.style.backfaceVisibility = 'hidden';
    }

    const tick = () => {
      const el = elementRef.current;
      if (el) {
        const { cursor, viewport } = cursorRef.current;
        const t = computeTilt(cursor, viewport, effectiveMax);
        // Lerp current → target. Cursor jumps no longer snap the card.
        curX += (t.rotateX - curX) * LERP;
        curY += (t.rotateY - curY) * LERP;
        if (Math.abs(curX - lastX) > 0.05 || Math.abs(curY - lastY) > 0.05) {
          lastX = curX;
          lastY = curY;
          el.style.transform = `translateZ(0) rotateX(${curX.toFixed(2)}deg) rotateY(${curY.toFixed(2)}deg)`;
        }
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      const el = elementRef.current;
      if (el) el.style.willChange = '';
    };
  }, [maxDeg, reducedMotion, cursorRef]);

  return elementRef;
}
