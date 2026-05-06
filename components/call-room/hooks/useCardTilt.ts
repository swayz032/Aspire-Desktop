// components/call-room/hooks/useCardTilt.ts
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useCursor, type CursorPosition, type ViewportSize } from './useParallax';

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
export const TILT_AMPLITUDE = {
  desktop: 14,
  laptop: 14,
  tablet: 9,
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
 */
export function useCardTilt(maxDeg: number = TILT_AMPLITUDE.desktop): CardTilt {
  const { cursor, viewport } = useCursor();
  const reducedMotion = useReducedMotion();
  const effectiveMax = reducedMotion ? TILT_AMPLITUDE.reducedMotion : maxDeg;
  return computeTilt(cursor, viewport, effectiveMax);
}
