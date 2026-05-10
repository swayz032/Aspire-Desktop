import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

// Desktop-only mode: Always return true for desktop detection
// Mobile views have been permanently removed

export function useDesktop(): boolean {
  return true;
}

export function useDesktopWithMounted(): { isDesktop: boolean; mounted: boolean } {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return { isDesktop: true, mounted };
}

/**
 * Apple HIG 2026 minimum touch target size (px). Use for `hitSlop`,
 * minimum button height/width, and tap-area calculations on tablets/touch devices.
 *
 * Re-exported as a const here so callers in this module don't need to import
 * from `constants/tokens.ts`. Source of truth lives in tokens.
 */
export const MIN_TOUCH_TARGET = 44 as const;

/**
 * Legacy coarse breakpoints — DO NOT MODIFY KEY NAMES.
 * Existing consumers (`useBreakpoint()` -> `isTablet`, `isLaptop`, `isDesktop`,
 * `isWide`) depend on these. New code wanting finer granularity should use
 * `useTabletLayout()` and the explicit width tokens in `constants/tokens.ts`
 * (TABLET_PORTRAIT_MIN_WIDTH, TABLET_LANDSCAPE_MIN_WIDTH, DESKTOP_MIN_WIDTH).
 */
const BREAKPOINTS = {
  tablet: 0,
  laptop: 768,
  desktop: 1024,
  wide: 1920,
  // New finer-grained bands (additive — do not remove the legacy keys above):
  tabletPortrait: 768,
  tabletLandscape: 1024,
} as const;

function getWidth(): number {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return document.documentElement.clientWidth || window.innerWidth;
  }
  return 1440;
}

function classify(width: number) {
  return {
    isWide: width >= BREAKPOINTS.wide,
    isDesktop: width >= BREAKPOINTS.desktop,
    isLaptop: width >= BREAKPOINTS.laptop && width < BREAKPOINTS.desktop,
    isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.laptop,
    isMobile: false as const, // mobile permanently removed — kept for backward compat
  };
}

export function useBreakpoint() {
  const [width, setWidth] = useState(1440); // SSR-safe default
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef(0);

  const handleResize = useCallback(() => {
    if (rafRef.current) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      setWidth(getWidth());
      rafRef.current = 0;
    });
  }, []);

  useEffect(() => {
    setWidth(getWidth());
    setMounted(true);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [handleResize]);

  return {
    ...classify(width),
    width,
    mounted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tablet-aware finer-grained hooks (additive — do NOT replace useBreakpoint).
// ─────────────────────────────────────────────────────────────────────────────

export type ViewportOrientation = 'portrait' | 'landscape';

export interface TabletLayout {
  /** Width is in the portrait-tablet band (>= 768 and < 1024). */
  isTabletPortrait: boolean;
  /** Width is in the landscape-tablet band (>= 1024 and < 1280) — NOT a real desktop. */
  isTabletLandscape: boolean;
  /** True for any tablet form factor (portrait OR landscape). */
  isTabletAny: boolean;
  /** Derived from width vs height ratio. */
  orientation: ViewportOrientation;
  /** Raw dimensions (kept for callers that need them without a second hook). */
  width: number;
  height: number;
}

/**
 * Pure classification — exported for unit tests and for callers that already
 * have width/height in hand (e.g. measured layout events) and don't need a
 * hook subscription. The hook below is a thin wrapper around this.
 */
export function classifyTabletLayout(width: number, height: number): TabletLayout {
  const isTabletPortrait =
    width >= BREAKPOINTS.tabletPortrait && width < BREAKPOINTS.tabletLandscape;
  const isTabletLandscape = width >= BREAKPOINTS.tabletLandscape && width < 1280;
  const isTabletAny = isTabletPortrait || isTabletLandscape;
  const orientation: ViewportOrientation = width >= height ? 'landscape' : 'portrait';

  return {
    isTabletPortrait,
    isTabletLandscape,
    isTabletAny,
    orientation,
    width,
    height,
  };
}

/**
 * Finer-grained tablet detection. Resolves the gap in the legacy `useBreakpoint`
 * where 1024px portrait iPads classify as `isDesktop`.
 *
 * Bands:
 *   - tabletPortrait: 768 <= w < 1024
 *   - tabletLandscape: 1024 <= w < 1280  (e.g. iPad Pro landscape)
 *   - desktop: w >= 1280
 *
 * Orientation is derived from current width vs height (true viewport, not
 * device-fixed), so split-screen and desktop window resizing behave correctly.
 */
export function useTabletLayout(): TabletLayout {
  const { width, height } = useWindowDimensions();
  return classifyTabletLayout(width, height);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic viewport height — solves Safari iOS 100vh bug where the URL bar
// inflates `vh` and pushes content under the chrome.
// ─────────────────────────────────────────────────────────────────────────────

const DVH_CSS_VAR = '--dvh-100';

function applyDvhCssVar() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const h = window.innerHeight;
  document.documentElement.style.setProperty(DVH_CSS_VAR, `${h}px`);
}

let dvhInstalled = false;
function installDvhListenerOnce() {
  if (dvhInstalled) return;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  dvhInstalled = true;
  applyDvhCssVar();
  window.addEventListener('resize', applyDvhCssVar);
  window.addEventListener('orientationchange', applyDvhCssVar);
}

/**
 * Returns a height value in pixels that matches the *visual* viewport, not the
 * inflated `100vh` reported by Safari iOS when the URL bar is visible.
 *
 * Strategy:
 *   - On web in browsers that support `dvh`, we set CSS var `--dvh-100` to
 *     `window.innerHeight` on mount + resize + orientationchange so callers
 *     can use `height: var(--dvh-100)` in CSS.
 *   - This hook returns the numeric height for use in inline `style={{ height }}`
 *     props, which works on every platform including native.
 *
 * The CSS var is installed exactly once per app lifecycle (idempotent).
 */
export function useDynamicViewportHeight(): number {
  const { height } = useWindowDimensions();

  useEffect(() => {
    installDvhListenerOnce();
  }, []);

  return height;
}
