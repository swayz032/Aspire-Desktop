/**
 * Typed Navigation Helpers
 *
 * Wraps expo-router's navigation with proper typing to eliminate
 * `router.push('/path' as any)` casts throughout the app.
 *
 * Expo Router's Href type is strict about route strings.
 * This helper accepts any string path and handles the type
 * conversion in one place.
 */

import { router, type Href } from 'expo-router';

/** Navigate to a route path (push onto stack) */
export function navigateTo(path: string, params?: Record<string, string | number>) {
  if (params) {
    router.push({ pathname: path, params } as Href);
  } else {
    router.push(path as Href);
  }
}

/** Replace current route */
export function replaceTo(path: string, params?: Record<string, string | number>) {
  if (params) {
    router.replace({ pathname: path, params } as Href);
  } else {
    router.replace(path as Href);
  }
}

/** Go back */
export const goBack = router.back;
