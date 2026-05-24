/**
 * useChapterAnnotations — owns bullet ↔ region hover wiring for a
 * single chapter. Left pane registers bullet hovers; right pane reads
 * the active region key and pulses the matching region (and vice
 * versa). Pure UI state, no side effects.
 *
 * React guarantees `useState` setters are referentially stable across
 * renders, so we expose them directly without a useCallback wrapper.
 * Consumers can still pass these setters into memoized children safely.
 *
 * Law #7: render-layer state only.
 */
import { useState } from 'react';

export interface ChapterAnnotationsApi {
  hoverBulletKey: string | null;
  hoverRegionKey: string | null;
  setHoverBulletKey: (key: string | null) => void;
  setHoverRegionKey: (key: string | null) => void;
}

export function useChapterAnnotations(): ChapterAnnotationsApi {
  const [hoverBulletKey, setHoverBulletKey] = useState<string | null>(null);
  const [hoverRegionKey, setHoverRegionKey] = useState<string | null>(null);
  return { hoverBulletKey, hoverRegionKey, setHoverBulletKey, setHoverRegionKey };
}
