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
 * Universal minimum touch-target size (px) — covers Apple HIG (44pt min),
 * Material 3 Expressive 2026 (48dp), and WCAG 2.2 SC 2.5.8 (24px floor +
 * spacing) at once. Picking 48 means we never need per-platform branching.
 * Use for `hitSlop`, minimum button height/width, and tap-area calculations.
 *
 * Re-exported as a const here so callers in this module don't need to import
 * from `constants/tokens.ts`. Source of truth lives in tokens.
 */
export const MIN_TOUCH_TARGET = 48 as const;

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

// ─────────────────────────────────────────────────────────────────────────────
// Visual viewport — Safari iOS keyboard / iPad Stage Manager handling.
// `useWindowDimensions()` reads window.innerWidth/innerHeight which does NOT
// shrink when the iOS on-screen keyboard appears. `window.visualViewport` does.
// Use this hook for any layout that must reposition above the keyboard
// (login forms, chat composers, modal sheets) or that needs to react to iPad
// Stage Manager resize/scale events.
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualViewportSnapshot {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  scale: number;
  available: boolean;
}

const EMPTY_VISUAL_VIEWPORT: VisualViewportSnapshot = {
  width: 0,
  height: 0,
  offsetTop: 0,
  offsetLeft: 0,
  scale: 1,
  available: false,
};

export function useVisualViewport(): VisualViewportSnapshot {
  const isWeb = Platform.OS === 'web';
  const [snapshot, setSnapshot] = useState<VisualViewportSnapshot>(() => {
    if (!isWeb || typeof window === 'undefined' || !window.visualViewport) {
      return EMPTY_VISUAL_VIEWPORT;
    }
    const vv = window.visualViewport;
    return {
      width: vv.width,
      height: vv.height,
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
      scale: vv.scale,
      available: true,
    };
  });

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      setSnapshot({
        width: vv.width,
        height: vv.height,
        offsetTop: vv.offsetTop,
        offsetLeft: vv.offsetLeft,
        scale: vv.scale,
        available: true,
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isWeb]);

  return snapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tablet visibility guard — iPadOS 26 PWA backgrounding bug.
// When a PWA is backgrounded on iPadOS 26+, iOS resizes the webview to *card
// dimensions* (1024x1334) BEFORE `visibilitychange` fires. Layouts that
// recompute on every `resize` permanently degrade. Use this hook on any
// component that performs expensive layout recomputes — short-circuit when
// `visible === false`.
// Reference: code-server #7648 (Jan 2026).
// ─────────────────────────────────────────────────────────────────────────────

export function useDocumentVisible(): boolean {
  const isWeb = Platform.OS === 'web';
  const [visible, setVisible] = useState<boolean>(() => {
    if (!isWeb || typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  });

  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [isWeb]);

  return visible;
}

/**
 * Composite guard: returns true ONLY when document is visible AND the layout
 * is on a tablet (any orientation). Use to short-circuit expensive recomputes
 * when an iPadOS PWA backgrounds and resizes the webview to card dimensions.
 */
export function useIsTabletVisible(): boolean {
  const visible = useDocumentVisible();
  const { isTabletAny } = useTabletLayout();
  return visible && isTabletAny;
}
