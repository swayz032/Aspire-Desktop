/**
 * cesiumLoader — lazy-loads CesiumJS on the web only.
 *
 * Cesium ships ~3MB gzipped ESM. We dynamic-import it so it never lands in the
 * main Metro bundle; the House Inspector hero is the only consumer today.
 *
 * We do NOT use Cesium Ion (paid imagery + terrain). Photorealistic 3D Tiles
 * come straight from Google's free public endpoint:
 *   https://tile.googleapis.com/v1/3dtiles/root.json?key=...
 * so we set `Ion.defaultAccessToken = ''` to suppress the default warning and
 * stop any accidental Ion network calls.
 *
 * `CESIUM_BASE_URL` must be set BEFORE Cesium is imported so its workers,
 * shaders, and asset URLs resolve. We point it at the public CDN that mirrors
 * the same version as our installed package — this avoids Metro/webpack
 * gymnastics around copying Cesium's `Build/Cesium/` static assets.
 *
 * Aspire Law #7 (Tools are Hands): pure infrastructure helper, no decisions.
 */

import { Platform } from 'react-native';

// Match the version installed in package.json. If you bump the cesium dep,
// bump this constant too — keeps the worker/shader assets in lockstep with
// the JS bundle we import.
const CESIUM_VERSION = '1.141';
const CESIUM_BASE_URL = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;

// Single-flight: we only want one dynamic import in flight no matter how many
// hero mounts happen during a session.
let cesiumPromise: Promise<typeof import('cesium')> | null = null;

export async function loadCesium(): Promise<typeof import('cesium')> {
  if (Platform.OS !== 'web') {
    throw new Error('Cesium is web-only');
  }
  if (cesiumPromise) return cesiumPromise;

  cesiumPromise = (async () => {
    if (typeof window !== 'undefined') {
      // Cesium reads window.CESIUM_BASE_URL synchronously when it boots its
      // workers. Set it once, before any import side-effect runs.
      (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
        CESIUM_BASE_URL;
    }

    // Dynamic import keeps Cesium out of the initial bundle.
    const Cesium = await import('cesium');

    // Suppress Ion default-token warning. We never call Ion endpoints — Google
    // 3D Tiles is the only data source for the House Inspector.
    try {
      (Cesium as unknown as { Ion: { defaultAccessToken: string } }).Ion.defaultAccessToken = '';
    } catch {
      /* swallow — older builds may freeze the Ion namespace */
    }

    // Ensure stylesheet is present (for the credits container Google requires).
    if (typeof document !== 'undefined') {
      const STYLE_ID = 'cesium-widgets-css';
      if (!document.getElementById(STYLE_ID)) {
        const link = document.createElement('link');
        link.id = STYLE_ID;
        link.rel = 'stylesheet';
        link.href = `${CESIUM_BASE_URL}Widgets/widgets.css`;
        document.head.appendChild(link);
      }
    }

    return Cesium;
  })();

  return cesiumPromise;
}
