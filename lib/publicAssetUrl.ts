import { Platform } from 'react-native';

/**
 * Resolves a public asset URL against document.baseURI so it works when the app
 * is served from a sub-path (for example behind a reverse proxy).
 */
export function resolvePublicAssetUrl(assetPath: string): string {
  const normalized = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;

  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return `/${normalized}`;
  }

  try {
    return new URL(normalized, document.baseURI).toString();
  } catch {
    return `/${normalized}`;
  }
}

