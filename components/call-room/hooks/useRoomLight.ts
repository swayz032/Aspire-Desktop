// components/call-room/hooks/useRoomLight.ts
import { useCursor, type CursorPosition, type ViewportSize } from './useParallax';

export interface RoomLight {
  /** -1..1, normalized horizontal cursor position relative to viewport center */
  x: number;
  /** -1..1, normalized vertical cursor position */
  y: number;
  /**
   * 0..1, hint of golden-hour feel that strengthens toward the right side
   * (where the windows are in the office image). 0 = cool/neutral, 1 = warmest.
   */
  warmth: number;
  /** 0..1, fixed at 1 for now (future: time-of-day dimming) */
  intensity: number;
}

const SAFE_DEFAULT: RoomLight = { x: 0, y: 0, warmth: 0.5, intensity: 1 };

/**
 * Compute lighting hints for the floating glass card based on cursor position.
 *
 * Math:
 *  - Normalize cursor.x and cursor.y to [-1, 1] relative to viewport center
 *  - warmth interpolates: x=-1 -> 0.2, x=0 -> 0.5, x=1 -> 1.0 (right side
 *    of the office has the windows / warm light source)
 *  - intensity is fixed at 1 for now
 *
 * Safe defaults are returned when viewport.width === 0 (SSR / pre-mount).
 */
export function computeLight(
  cursor: CursorPosition,
  viewport: ViewportSize,
): RoomLight {
  if (viewport.width === 0 || viewport.height === 0) {
    return SAFE_DEFAULT;
  }

  const normX = (cursor.x / viewport.width) * 2 - 1;
  const normY = (cursor.y / viewport.height) * 2 - 1;

  const x = clamp(normX, -1, 1);
  const y = clamp(normY, -1, 1);

  // warmth: piecewise-linear so the left edge stays slightly warm (0.2) instead
  // of going fully cool, and the right edge reaches 1.0 (golden-hour window light).
  const warmth = x >= 0 ? 0.5 + 0.5 * x : 0.5 + 0.3 * x;

  return {
    x,
    y,
    warmth: clamp(warmth, 0, 1),
    intensity: 1,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * React hook returning the current `RoomLight` derived from cursor position.
 * SSR-safe: returns center defaults when `useCursor` reports no viewport yet.
 */
export function useRoomLight(): RoomLight {
  const { cursor, viewport } = useCursor();
  return computeLight(cursor, viewport);
}
