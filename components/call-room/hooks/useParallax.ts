// components/call-room/hooks/useParallax.ts
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface CursorPosition {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ParallaxOffset {
  x: number;
  y: number;
}

/**
 * Compute a layer's pixel offset based on cursor position relative to viewport center.
 *
 * Math:
 *  - Normalize cursor to [-1, 1] relative to viewport center
 *  - Multiply by parallaxRange × intensity
 *  - Clamp to ±parallaxRange × intensity (cursor outside viewport stays bounded)
 *
 * @param cursor      Cursor position in pixels from viewport top-left
 * @param viewport    Viewport dimensions in pixels
 * @param parallaxRange Max pixel offset for this layer
 * @param intensity   Global multiplier (0 = no parallax, 1 = full, 2 = exaggerated)
 */
export function computeLayerOffset(
  cursor: CursorPosition,
  viewport: ViewportSize,
  parallaxRange: number,
  intensity: number,
): ParallaxOffset {
  if (viewport.width === 0 || viewport.height === 0) {
    return { x: 0, y: 0 };
  }
  if (parallaxRange === 0 || intensity === 0) {
    return { x: 0, y: 0 };
  }

  const normX = (cursor.x / viewport.width) * 2 - 1; // [-1, 1]
  const normY = (cursor.y / viewport.height) * 2 - 1; // [-1, 1]

  const max = parallaxRange * intensity;
  const rawX = normX * max;
  const rawY = normY * max;

  return {
    x: Math.max(-max, Math.min(max, rawX)),
    y: Math.max(-max, Math.min(max, rawY)),
  };
}

interface CursorState {
  cursor: CursorPosition;
  viewport: ViewportSize;
}

/**
 * Tracks cursor position and viewport size on web. On native, returns a static
 * "cursor at center" state (no parallax movement) since touch devices don't
 * have a hover cursor.
 */
export function useCursor(): CursorState {
  const isWeb = Platform.OS === 'web';
  const initialViewport: ViewportSize =
    isWeb && typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 0, height: 0 };
  const initialCursor: CursorPosition = {
    x: initialViewport.width / 2,
    y: initialViewport.height / 2,
  };

  const [state, setState] = useState<CursorState>({
    cursor: initialCursor,
    viewport: initialViewport,
  });

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      setState((prev) => ({
        ...prev,
        cursor: { x: event.clientX, y: event.clientY },
      }));
    };

    const handleResize = () => {
      setState((prev) => ({
        ...prev,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [isWeb]);

  return state;
}
