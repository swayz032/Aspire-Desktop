/**
 * Zoom Video SDK — Aspire Guest Dark Theme Supplement
 *
 * Supplements lib/zoom-styles.ts with guest-specific overrides.
 * Now that we use the same custom Aspire components as the host,
 * this file only needs minimal SDK-level CSS tweaks.
 *
 * Pattern: idempotent DOM injection (same as lib/zoom-styles.ts).
 */
import { Platform } from 'react-native';

const GUEST_THEME_ID = 'aspire-guest-theme';

const ASPIRE_GUEST_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
 * Zoom Video SDK — Aspire Guest Supplement
 * ═══════════════════════════════════════════════════════════════════════════
 * Minimal overrides for SDK elements in the guest context.
 * The main theme is handled by lib/zoom-styles.ts.
 */

/* ── SDK Video Elements ──────────────────────────────────────────────────── */
/* Ensure any SDK-rendered video elements use Aspire dark surfaces.          */

video-player-container,
video-player {
  background-color: #0a0a0c !important;
}

/* ── Reduced Motion ──────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

let injected = false;

/**
 * Inject guest theme supplement CSS into the DOM.
 * Safe to call multiple times — idempotent.
 */
export function injectGuestTheme(): void {
  if (Platform.OS !== 'web' || injected) return;
  if (typeof document === 'undefined') return;

  if (document.getElementById(GUEST_THEME_ID)) {
    injected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = GUEST_THEME_ID;
  style.textContent = ASPIRE_GUEST_CSS;
  document.head.appendChild(style);
  injected = true;
}
