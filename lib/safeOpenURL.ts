/**
 * safeOpenURL — Validated URL opener that prevents XSS via javascript:/data: schemes.
 *
 * Law #9 (Security & Privacy): All external URL opens MUST go through this function.
 * Direct Linking.openURL() is prohibited in card components.
 *
 * Allowed schemes: https, http, tel
 * Blocked: javascript, data, file, blob, vbscript, and everything else
 */

import { Linking } from 'react-native';

const ALLOWED_SCHEMES = new Set(['https:', 'http:', 'tel:']);

/**
 * Safely open a URL after validating the scheme.
 * Returns true if the URL was opened, false if blocked.
 */
export function safeOpenURL(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    // tel: URLs don't parse well with URL constructor — handle separately
    if (trimmed.startsWith('tel:')) {
      // Strip non-phone characters to prevent injection
      const phoneNumber = trimmed.slice(4).replace(/[^0-9+\-() ]/g, '');
      if (phoneNumber.length < 3) return false;
      Linking.openURL(`tel:${phoneNumber}`).catch(() => {});
      return true;
    }

    const parsed = new URL(trimmed);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      console.warn(`[safeOpenURL] Blocked URL with disallowed scheme: ${parsed.protocol}`);
      return false;
    }

    Linking.openURL(trimmed).catch(() => {});
    return true;
  } catch {
    // Invalid URL format — block it
    console.warn(`[safeOpenURL] Blocked malformed URL: ${trimmed.slice(0, 50)}`);
    return false;
  }
}

/**
 * Safely open a phone number via tel: link.
 * Strips non-phone characters before opening.
 */
export function safeCallPhone(phone: string | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const sanitized = phone.replace(/[^0-9+\-() ]/g, '').trim();
  if (sanitized.length < 3) return false;
  Linking.openURL(`tel:${sanitized}`).catch(() => {});
  return true;
}
