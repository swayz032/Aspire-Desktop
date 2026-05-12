/**
 * useHeroMode — Visuals tab hero state machine (Service Hub Phase 3, Pass 3.2).
 *
 * The Visuals tab's hero region cycles through 5 modes driven by the bottom
 * `PropertyImagesGrid` row. This hook owns:
 *   - Active mode (default 'streetview').
 *   - URL query-param sync (`?hero=interior`) for deep-linkable state on web.
 *   - ESC key handler that resets to the default mode.
 *
 * Component-level cross-fade animation lives in `HeroSwitcher.tsx`; this hook
 * only exposes mode transitions. Consumers can read the mode and render
 * accordingly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * True iff we're running in a real browser context with a working History API.
 * Web (Platform.OS === 'web') OR jsdom test env both qualify; native Platforms
 * have no `window.history`.
 */
function isBrowser(): boolean {
  if (Platform.OS === 'web') return true;
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).history !== 'undefined'
  );
}

export type HeroMode = 'streetview' | 'aerial' | 'earth' | 'interior' | 'exterior' | 'roof';

const HERO_MODES: HeroMode[] = [
  'streetview',
  'aerial',
  'earth',
  'interior',
  'exterior',
  'roof',
];

const DEFAULT_MODE: HeroMode = 'streetview';
const URL_PARAM = 'hero';

export type UseHeroModeResult = {
  mode: HeroMode;
  setMode: (mode: HeroMode) => void;
  /** Reset to the default ('streetview'). */
  reset: () => void;
};

function isHeroMode(value: unknown): value is HeroMode {
  return typeof value === 'string' && HERO_MODES.includes(value as HeroMode);
}

function readModeFromUrl(): HeroMode | null {
  if (!isBrowser()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(URL_PARAM);
    return isHeroMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeModeToUrl(mode: HeroMode): void {
  if (!isBrowser()) return;
  try {
    const url = new URL(window.location.href);
    if (mode === DEFAULT_MODE) {
      url.searchParams.delete(URL_PARAM);
    } else {
      url.searchParams.set(URL_PARAM, mode);
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* swallow — URL sync is best-effort */
  }
}

export function useHeroMode(initialMode?: HeroMode): UseHeroModeResult {
  const [mode, setModeState] = useState<HeroMode>(() => {
    const fromUrl = readModeFromUrl();
    if (fromUrl) return fromUrl;
    if (initialMode && isHeroMode(initialMode)) return initialMode;
    return DEFAULT_MODE;
  });

  // Avoid double-write to URL on first render.
  const didMountRef = useRef(false);

  // Sync to URL on changes (web only).
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    writeModeToUrl(mode);
  }, [mode]);

  // ESC → reset to default.
  useEffect(() => {
    if (!isBrowser()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode !== DEFAULT_MODE) {
        setModeState(DEFAULT_MODE);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode]);

  const setMode = useCallback((next: HeroMode) => {
    if (!isHeroMode(next)) return;
    setModeState(next);
  }, []);

  const reset = useCallback(() => {
    setModeState(DEFAULT_MODE);
  }, []);

  return { mode, setMode, reset };
}
