/**
 * useChapterAnnotations — owns bullet ↔ region hover wiring for a
 * single chapter. Left pane registers bullet hovers; right pane reads
 * the active region key and pulses the matching region (and vice
 * versa). Pure UI state, no side effects.
 *
 * Setters are stable across renders (useCallback) so consumers can
 * pass them into memoized children without invalidating memoization.
 *
 * Law #7: render-layer state only.
 */
import { useCallback, useState } from 'react';

export interface ChapterAnnotationsApi {
  hoverBulletKey: string | null;
  hoverRegionKey: string | null;
  setHoverBulletKey: (key: string | null) => void;
  setHoverRegionKey: (key: string | null) => void;
}

export function useChapterAnnotations(): ChapterAnnotationsApi {
  const [hoverBulletKey, _setHoverBulletKey] = useState<string | null>(null);
  const [hoverRegionKey, _setHoverRegionKey] = useState<string | null>(null);
  const setHoverBulletKey = useCallback((k: string | null) => _setHoverBulletKey(k), []);
  const setHoverRegionKey = useCallback((k: string | null) => _setHoverRegionKey(k), []);
  return { hoverBulletKey, hoverRegionKey, setHoverBulletKey, setHoverRegionKey };
}
