// components/call-room/hooks/useParallax.ts
import { useEffect, useRef, useState } from 'react';
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

export interface CursorRef {
  cursor: { x: number; y: number };
  viewport: { width: number; height: number };
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
 *
 * State updates are coalesced to one per animation frame (~16ms @ 60fps)
 * instead of one per mousemove event (60-200/sec), which previously thrashed
 * the React tree and caused visible jitter on the 3D card.
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

    let pendingFrame: number | null = null;
    let pendingCursor: CursorPosition | null = null;

    const flush = () => {
      pendingFrame = null;
      if (pendingCursor) {
        const next = pendingCursor;
        pendingCursor = null;
        setState((prev) =>
          prev.cursor.x === next.x && prev.cursor.y === next.y
            ? prev
            : { ...prev, cursor: next },
        );
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      pendingCursor = { x: event.clientX, y: event.clientY };
      if (pendingFrame === null) {
        pendingFrame = window.requestAnimationFrame(flush);
      }
    };

    const handleResize = () => {
      setState((prev) => ({
        ...prev,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }));
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [isWeb]);

  return state;
}

/**
 * Ref-based cursor tracker — never triggers a React render. Use this when you
 * want to apply cursor-driven transforms via direct DOM mutation inside an
 * rAF loop instead of going through the React reconciliation cycle.
 *
 * Caller pattern:
 *   const cursorRef = useCursorRef();
 *   useEffect(() => {
 *     let frame: number;
 *     const tick = () => {
 *       const { cursor, viewport } = cursorRef.current;
 *       // ...compute transform, write to elementRef.current.style.transform
 *       frame = requestAnimationFrame(tick);
 *     };
 *     frame = requestAnimationFrame(tick);
 *     return () => cancelAnimationFrame(frame);
 *   }, []);
 */
export function useCursorRef(): { current: CursorRef } {
  const isWeb = Platform.OS === 'web';
  const ref = useRef<CursorRef>({
    cursor:
      isWeb && typeof window !== 'undefined'
        ? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        : { x: 0, y: 0 },
    viewport:
      isWeb && typeof window !== 'undefined'
        ? { width: window.innerWidth, height: window.innerHeight }
        : { width: 0, height: 0 },
  });

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;

    const onMove = (event: MouseEvent) => {
      ref.current.cursor.x = event.clientX;
      ref.current.cursor.y = event.clientY;
    };
    const onResize = () => {
      ref.current.viewport.width = window.innerWidth;
      ref.current.viewport.height = window.innerHeight;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
    };
  }, [isWeb]);

  return ref;
}
