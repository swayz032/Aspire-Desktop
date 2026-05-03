// components/call-room/hooks/useCardTilt.ts
import { useCursor, type CursorPosition, type ViewportSize } from './useParallax';

export interface CardTilt {
  /** Degrees, ±maxDeg. Positive = top edge tilts away from viewer (cursor at bottom). */
  rotateX: number;
  /** Degrees, ±maxDeg. Positive = right edge tilts toward viewer (cursor at right). */
  rotateY: number;
}

/**
 * Compute a subtle 3D tilt for the card based on cursor position relative
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
  maxDeg: number = 2,
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
 * React hook returning the current card tilt for the cursor frame.
 * SSR-safe (useCursor returns viewport={0,0} on the server, which yields zero tilt).
 */
export function useCardTilt(maxDeg: number = 2): CardTilt {
  const { cursor, viewport } = useCursor();
  return computeTilt(cursor, viewport, maxDeg);
}
