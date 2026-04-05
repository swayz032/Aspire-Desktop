/**
 * Asset Prefetch — preloads critical videos and images at app startup.
 *
 * Videos are prefetched via hidden <link rel="prefetch"> tags so the browser
 * downloads them in idle time. Images use fetch() for cache priming.
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

  // Prefetch videos via <link rel="preload"> — browser downloads with high priority
  for (const src of CRITICAL_VIDEOS) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = src;
    link.setAttribute('crossorigin', '');
    document.head.appendChild(link);
  }

  // Prefetch images via <link rel="preload">
  for (const src of CRITICAL_IMAGES) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  }
}
