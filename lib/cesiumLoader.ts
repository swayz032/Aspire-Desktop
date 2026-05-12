/**
 * cesiumLoader — loads CesiumJS via the official UMD CDN build on web.
 *
 * Why CDN and not `import('cesium')` from node_modules:
 *   Cesium's ESM build uses `import.meta.url` to resolve worker/asset URLs
 *   at runtime. Metro/Hermes can't parse `import.meta` (it's module-only
 *   syntax, Hermes targets non-module environments) so dynamic-importing
 *   Cesium blows up at parse time with:
 *     SyntaxError: Cannot use 'import.meta' outside a module
 *
 *   The UMD build (`Build/Cesium/Cesium.js`) doesn't use import.meta —
 *   it's a single IIFE bundle that exposes everything on `window.Cesium`.
 *   We pin the version to match what's in package.json so dev/prod stay
 *   in lockstep.
 *
 * No Cesium Ion. We render only Google Photorealistic 3D Tiles, which is
 * a free Map Tiles API endpoint that doesn't require Ion tokens.
 *
 * Aspire Law #7 (Tools are Hands): pure infrastructure helper.
 */

import { Platform } from 'react-native';

const CESIUM_VERSION = '1.141';
const CESIUM_BASE_URL = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;
const CESIUM_SCRIPT_URL = `${CESIUM_BASE_URL}Cesium.js`;
const CESIUM_CSS_URL = `${CESIUM_BASE_URL}Widgets/widgets.css`;

// Single-flight cache.
let cesiumPromise: Promise<typeof globalThis & { Cesium: any }> | null = null;

declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

/** Inject a <link rel="stylesheet"> once. */
function injectStylesheet(href: string, id: string): void {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Inject a <script> once and resolve when it loads. */
function injectScript(src: string, id: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      // Already loaded or in flight — wait for load event if not done.
      if ((existing as any).readyState === 'complete' || window.Cesium) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`Cesium script failed to load: ${src}`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error(`Cesium script failed to load: ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export async function loadCesium(): Promise<any> {
  if (Platform.OS !== 'web') {
    throw new Error('Cesium is web-only');
  }
  if (typeof window === 'undefined') {
    throw new Error('Cesium requires a window context');
  }
  if (window.Cesium) {
    return window.Cesium;
  }
  if (cesiumPromise) {
    await cesiumPromise;
    return window.Cesium;
  }

  // CESIUM_BASE_URL must be set BEFORE the UMD script runs so workers,
  // shaders, and asset URLs resolve correctly.
  window.CESIUM_BASE_URL = CESIUM_BASE_URL;

  injectStylesheet(CESIUM_CSS_URL, 'cesium-widgets-css');

  cesiumPromise = injectScript(CESIUM_SCRIPT_URL, 'cesium-umd-bundle').then(() => {
    if (!window.Cesium) {
      throw new Error('Cesium UMD bundle loaded but window.Cesium is missing');
    }
    // Suppress Ion default-token warning — we never call Ion endpoints.
    try {
      window.Cesium.Ion.defaultAccessToken = '';
    } catch {
      /* older builds may freeze the Ion namespace */
    }
    return window as any;
  });

  await cesiumPromise;
  return window.Cesium;
}
