/**
 * useReducedMotion -- Detect and respond to prefers-reduced-motion media query.
 *
 * Returns `true` when the user has requested reduced motion in their OS settings.
 * Components should use this to:
 * - Replace spring animations with instant transitions
 * - Disable particle effects and continuous animations
 * - Ensure all state changes are still visible (opacity, color) without motion
 *
 * Web-only: Always returns `false` on native platforms (native Reanimated
 * handles reduced motion internally via `reduceMotion` config).
 *
 * WCAG 2.1 AA compliance -- 2.3.3 Animation from Interactions.
 *
 * Wave 20 -- Canvas Mode accessibility.
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * React hook that subscribes to the `prefers-reduced-motion` media query.
 *
 * @returns `true` if the user prefers reduced motion, `false` otherwise.
 *
 * @example
 * ```tsx
 * const reducedMotion = useReducedMotion();
 * const springConfig = reducedMotion
 *   ? { damping: 100, stiffness: 1000 } // Instant
 *   : { damping: 20, stiffness: 300 };   // Smooth
 * ```
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    return mql?.matches ?? false;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  return reducedMotion;
}

/**
 * Non-reactive module-level check for reduced motion.
 * Useful in non-component code (animation utilities, sound manager).
 * Updates automatically when the media query changes.
 */
let _reducedMotion = false;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  _reducedMotion = mql?.matches ?? false;
  mql?.addEventListener?.('change', (e) => {
    _reducedMotion = e.matches;
  });
}

export function getReducedMotion(): boolean {
  return _reducedMotion;
}
