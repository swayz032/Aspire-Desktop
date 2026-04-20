/**
 * Asset prefetch hints critical media at app startup.
 *
 * Use `prefetch` instead of `preload` so idle downloads don't emit
 * unsupported `as` or unused preload warnings on auth/onboarding routes.
 *
 * Only runs on web platform. No-op on native.
 */
import { Platform } from 'react-native';

const CRITICAL_VIDEOS = [
  '/ava-orb.mp4',
  '/finn-orb.mp4',
  '/eli-orb.mp4',
  '/finn-3d-object.mp4',
];

const CRITICAL_IMAGES = [
  '/aspire-logo.png',
  '/aspire-logo-full.png',
  '/aspire-icon-glow.png',
];

let prefetched = false;

export function prefetchCriticalAssets(): void {
  if (prefetched || Platform.OS !== 'web' || typeof document === 'undefined') return;
  prefetched = true;

  // Prefetch videos during idle time without generating preload warnings.
  for (const src of CRITICAL_VIDEOS) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = src;
    document.head.appendChild(link);
  }

  // Images are also non-blocking hints; they can warm the cache opportunistically.
  for (const src of CRITICAL_IMAGES) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = src;
    document.head.appendChild(link);
  }
}
