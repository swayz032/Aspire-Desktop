/**
 * googleMapsLoader — singleton loader for the Google Maps JavaScript API.
 *
 * Service Hub Phase 3, Pass 3.2.
 *
 * The Visuals tab renders a live Street View Panorama (`LiveStreetViewHero`)
 * and a 3D aerial view (`LiveAerialHero`). Both consume the Maps JS API.
 * This module guarantees the script tag is injected ONCE — repeat callers
 * await the same in-flight promise.
 *
 * Design:
 *   - If `window.google?.maps` is already present → resolve immediately.
 *   - If a load is in flight → return the same promise.
 *   - Otherwise inject `<script>` tag with `loading=async` + `callback=` and
 *     resolve when the callback fires.
 *   - 30s timeout → reject with structured error so the UI can show a
 *     premium error banner and offer retry.
 *   - Missing API key → reject early; the UI surfaces a "Maps unavailable"
 *     banner. Browser-side key is referrer-restricted in Cloud Console.
 *
 * Aspire Law compliance:
 *   - Law #9 (no secrets logged): we never log the key value.
 *   - Law #7 (tools are hands): this is purely a script-loader; no decisions.
 */

export type GoogleMapsLibrary =
  | 'places'
  | 'streetView'
  | 'maps3d'
  | 'visualization'
  | 'geometry'
  | 'drawing';

export type GoogleMapsLoadOptions = {
  apiKey: string;
  libraries?: GoogleMapsLibrary[];
  /** Default 'weekly' — matches Cloud Console rolling channel. */
  version?: string;
};

export class GoogleMapsLoaderError extends Error {
  constructor(
    public readonly code:
      | 'MISSING_API_KEY'
      | 'TIMEOUT'
      | 'SCRIPT_ERROR'
      | 'NOT_BROWSER',
    message: string,
  ) {
    super(message);
    this.name = 'GoogleMapsLoaderError';
  }
}

const LOAD_TIMEOUT_MS = 30_000;
const SCRIPT_ID = 'aspire-google-maps-js';
const CALLBACK_NAME = '__aspireGoogleMapsLoaded';

// Module-level singletons — survive HMR module re-evals on the same page
// because the actual `<script>` and `window.google` already exist after
// the first successful load.
let _loadPromise: Promise<typeof google> | null = null;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace google {
    // forward-decl. Real type comes from @types/google.maps when installed.
  }
  interface Window {
    google?: typeof google;
    [CALLBACK_NAME]?: () => void;
  }
}

/**
 * Load the Google Maps JS API once; subsequent calls return the same promise.
 *
 * @example
 *   const g = await loadGoogleMaps({ apiKey, libraries: ['streetView'] });
 *   new g.maps.StreetViewPanorama(el, { position: coords });
 */
export function loadGoogleMaps(
  options: GoogleMapsLoadOptions,
): Promise<typeof google> {
  // SSR / non-browser guard.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new GoogleMapsLoaderError(
        'NOT_BROWSER',
        'Google Maps JS API can only be loaded in a browser environment',
      ),
    );
  }

  if (!options.apiKey || options.apiKey.length === 0) {
    return Promise.reject(
      new GoogleMapsLoaderError(
        'MISSING_API_KEY',
        'EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY not configured',
      ),
    );
  }

  // Already loaded in this page.
  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }

  // Load already in flight — return the same promise.
  if (_loadPromise) {
    return _loadPromise;
  }

  _loadPromise = new Promise<typeof google>((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      _loadPromise = null;
      reject(
        new GoogleMapsLoaderError(
          'TIMEOUT',
          `Google Maps JS API failed to load within ${LOAD_TIMEOUT_MS}ms`,
        ),
      );
    }, LOAD_TIMEOUT_MS);

    // Defensive — if a script with the same id exists from a previous attempt
    // that errored out, remove it so we get a clean retry.
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) existing.remove();

    (window as any)[CALLBACK_NAME] = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      try {
        delete (window as any)[CALLBACK_NAME];
      } catch {
        /* noop */
      }
      if (!(window as any).google?.maps) {
        _loadPromise = null;
        reject(
          new GoogleMapsLoaderError(
            'SCRIPT_ERROR',
            'Google Maps callback fired but window.google.maps is missing',
          ),
        );
        return;
      }
      resolve((window as any).google);
    };

    const libs = (options.libraries ?? []).join(',');
    const version = options.version ?? 'weekly';
    const params = new URLSearchParams({
      key: options.apiKey,
      v: version,
      loading: 'async',
      callback: CALLBACK_NAME,
    });
    if (libs.length > 0) params.set('libraries', libs);

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      _loadPromise = null;
      reject(
        new GoogleMapsLoaderError(
          'SCRIPT_ERROR',
          'Failed to load Google Maps JS API script',
        ),
      );
    };
    document.head.appendChild(script);
  });

  return _loadPromise;
}

/**
 * Test seam — clears the singleton state so unit tests can reset between
 * cases. NOT exported in production code paths.
 */
export function __resetGoogleMapsLoaderForTests(): void {
  _loadPromise = null;
  if (typeof window !== 'undefined') {
    try {
      delete (window as any).google;
      delete (window as any)[CALLBACK_NAME];
    } catch {
      /* noop */
    }
    if (typeof document !== 'undefined') {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) existing.remove();
    }
  }
}

/** Resolve the browser-side Maps key from Expo public env. */
export function resolveBrowserMapsKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '';
}
