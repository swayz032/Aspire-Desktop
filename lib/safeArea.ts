/**
 * Safe-area utilities — single source of truth for `env(safe-area-inset-*)`
 * on web and `react-native-safe-area-context` on native.
 *
 * Components MUST import from this module rather than reading raw `env()`
 * values or duplicating useSafeAreaInsets() boilerplate, so that future
 * platform fixes (e.g. iPad Stage Manager corner radii, Android display
 * cutouts) can be applied in exactly one place.
 *
 * On web, we install CSS variables once at module load:
 *   --sai-top, --sai-right, --sai-bottom, --sai-left
 * pointing at `env(safe-area-inset-*)`. Callers can use these in stylesheet
 * strings; the `useSafeAreaInsetsCompat()` hook returns the numeric pixel
 * values for use in inline `style={{ paddingTop }}` props.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  useSafeAreaInsets as useNativeSafeAreaInsets,
  type EdgeInsets,
} from 'react-native-safe-area-context';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const CSS_VAR_NAMES = {
  top: '--sai-top',
  right: '--sai-right',
  bottom: '--sai-bottom',
  left: '--sai-left',
} as const;

let webCssVarsInstalled = false;

function installWebSafeAreaCssVars() {
  if (webCssVarsInstalled) return;
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  webCssVarsInstalled = true;

  // Inject a stylesheet so the CSS vars resolve to the live env() values.
  // We can't write env() into a JS-set inline style; it must be in a CSS
  // declaration to be evaluated by the engine.
  const style = document.createElement('style');
  style.setAttribute('data-aspire-safe-area', 'true');
  style.textContent = `:root {
  ${CSS_VAR_NAMES.top}: env(safe-area-inset-top, 0px);
  ${CSS_VAR_NAMES.right}: env(safe-area-inset-right, 0px);
  ${CSS_VAR_NAMES.bottom}: env(safe-area-inset-bottom, 0px);
  ${CSS_VAR_NAMES.left}: env(safe-area-inset-left, 0px);
}`;
  document.head.appendChild(style);
}

function readWebInsets(): SafeAreaInsets {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return ZERO_INSETS;
  }
  const cs = window.getComputedStyle(document.documentElement);
  const parse = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: parse(cs.getPropertyValue(CSS_VAR_NAMES.top)),
    right: parse(cs.getPropertyValue(CSS_VAR_NAMES.right)),
    bottom: parse(cs.getPropertyValue(CSS_VAR_NAMES.bottom)),
    left: parse(cs.getPropertyValue(CSS_VAR_NAMES.left)),
  };
}

function useWebSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(ZERO_INSETS);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    installWebSafeAreaCssVars();
    setInsets(readWebInsets());

    if (typeof window === 'undefined') return;
    const update = () => setInsets(readWebInsets());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return insets;
}

/**
 * Returns numeric safe-area insets for the current platform.
 *
 * - Web: reads CSS vars `--sai-*` (installed once at module load) which
 *   evaluate `env(safe-area-inset-*)`. Updates on resize/orientationchange.
 * - Native: delegates to `react-native-safe-area-context`.
 *
 * Always call from a component (it uses hooks). Both internal hook paths are
 * called unconditionally — Platform.OS is constant for the bundle lifetime so
 * the unused branch's value is discarded with no Rules-of-Hooks violation.
 */
export function useSafeAreaInsetsCompat(): SafeAreaInsets {
  const native: EdgeInsets = useNativeSafeAreaInsets();
  const web = useWebSafeAreaInsets();

  if (Platform.OS === 'web') return web;
  return {
    top: native.top,
    right: native.right,
    bottom: native.bottom,
    left: native.left,
  };
}

/**
 * Pure CSS variable names for callers that want to write inline
 * `style={{ paddingTop: 'var(--sai-top)' }}` (web only).
 */
export const SAFE_AREA_CSS_VARS = CSS_VAR_NAMES;

/**
 * Force-install the web safe-area CSS vars without rendering anything.
 * Idempotent. Useful from app entrypoints to guarantee the vars exist
 * before the first paint, even if no component has called the hook yet.
 */
export function ensureSafeAreaCssVarsInstalled(): void {
  installWebSafeAreaCssVars();
}
