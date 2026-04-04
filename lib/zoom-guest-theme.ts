/**
 * Zoom UI Toolkit — Aspire Premium Dark Theme
 *
 * The Zoom Video SDK UI Toolkit uses CSS custom properties scoped by
 * `zoom-data-theme` attribute on `:root`. We override these with Aspire
 * design tokens so the entire toolkit renders in our brand palette.
 *
 * Also includes scoped overrides under `.zoom-ui-toolkit-root` for
 * fine-grained control over toolkit elements (borders, buttons, tiles).
 *
 * Pattern: idempotent DOM injection (same as lib/zoom-styles.ts).
 */
import { Platform } from 'react-native';

const GUEST_THEME_ID = 'aspire-guest-theme';

const ASPIRE_GUEST_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
 * Zoom UI Toolkit — Aspire Premium Dark Theme Override
 * ═══════════════════════════════════════════════════════════════════════════
 * Overrides Zoom's --color-* CSS variables with Aspire design tokens.
 * The toolkit reads these variables natively — zero specificity wars.
 */

/* ── Theme Variable Overrides ────────────────────────────────────────────── */
/* Set on :root so they apply regardless of zoom-data-theme attribute.       */

:root,
:root[zoom-data-theme="dark"] {
  --color-primary: #3B82F6;
  --color-secondary: #A855F7;
  --color-background: #0a0a0c;
  --color-surface: #1C1C1E;
  --color-surface-elevated: #2C2C2E;
  --color-text: #ffffff;
  --color-text-secondary: #D4D4D8;
  --color-text-button: #ffffff;
  --color-accent: #3B82F6;
  --color-divider: #2C2C2E;
}

/* ── Full Container Reset ────────────────────────────────────────────────── */
/* Ensure toolkit fills its container properly.                              */

#zoom-uitoolkit-container {
  height: 100% !important;
  width: 100% !important;
  background: #0a0a0c !important;
}

.zoom-ui-toolkit-root {
  background: #0a0a0c !important;
}

/* ── Pre-Join Screen Overrides ───────────────────────────────────────────── */
/* Override the default "Join Session" screen styling.                       */

/* Main background with subtle vignette */
.zoom-ui-toolkit-root .bg-theme-background,
.zoom-ui-toolkit-root [class*="bg-theme-background"] {
  background: radial-gradient(ellipse at center, #0a0a0c 50%, #050506 100%) !important;
}

/* Surface cards (device selectors, preview container) */
.zoom-ui-toolkit-root .bg-theme-surface,
.zoom-ui-toolkit-root [class*="bg-theme-surface"] {
  background-color: #1C1C1E !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
}

/* Elevated surfaces */
.zoom-ui-toolkit-root .bg-theme-surface-elevated,
.zoom-ui-toolkit-root [class*="bg-theme-surface-elevated"] {
  background-color: #2C2C2E !important;
}

/* Primary buttons — Aspire blue gradient */
.zoom-ui-toolkit-root .bg-blue-500,
.zoom-ui-toolkit-root .bg-blue-600,
.zoom-ui-toolkit-root [class*="bg-blue-5"],
.zoom-ui-toolkit-root [class*="bg-blue-6"],
.zoom-ui-toolkit-root button[class*="bg-blue"] {
  background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%) !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.1) !important;
  transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease !important;
}

.zoom-ui-toolkit-root .bg-blue-500:hover,
.zoom-ui-toolkit-root .bg-blue-600:hover,
.zoom-ui-toolkit-root [class*="bg-blue-5"]:hover,
.zoom-ui-toolkit-root [class*="bg-blue-6"]:hover,
.zoom-ui-toolkit-root button[class*="bg-blue"]:hover {
  background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%) !important;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.2) !important;
  transform: translateY(-1px) !important;
}

.zoom-ui-toolkit-root .bg-blue-500:active,
.zoom-ui-toolkit-root .bg-blue-600:active,
.zoom-ui-toolkit-root button[class*="bg-blue"]:active {
  transform: translateY(0) !important;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.25) !important;
}

/* ── Video Tile Overrides ────────────────────────────────────────────────── */
/* Replace green participant borders with Aspire blue glow.                  */

.zoom-ui-toolkit-root [class*="border-green"],
.zoom-ui-toolkit-root [class*="ring-green"],
.zoom-ui-toolkit-root [style*="border-color: green"],
.zoom-ui-toolkit-root [style*="border-color: rgb(0, 128, 0)"] {
  border-color: #3B82F6 !important;
}

/* Video tiles — premium rounded corners + subtle border */
.zoom-ui-toolkit-root [class*="aspect-video"],
.zoom-ui-toolkit-root [class*="aspect-[16"],
.zoom-ui-toolkit-root [class*="aspect-[3/4]"] {
  border-radius: 12px !important;
  overflow: hidden !important;
}

/* Active speaker glow — Aspire blue instead of green */
.zoom-ui-toolkit-root [class*="ring-2"],
.zoom-ui-toolkit-root [class*="ring-green"] {
  --tw-ring-color: rgba(59, 130, 246, 0.6) !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.6), 0 0 12px rgba(59, 130, 246, 0.2) !important;
}

/* Gray placeholder tiles — use Aspire dark surface */
.zoom-ui-toolkit-root .bg-gray-400,
.zoom-ui-toolkit-root .bg-gray-500,
.zoom-ui-toolkit-root .bg-gray-600,
.zoom-ui-toolkit-root .bg-gray-700,
.zoom-ui-toolkit-root .bg-gray-800,
.zoom-ui-toolkit-root .bg-gray-900 {
  background-color: #1C1C1E !important;
}

/* ── Toolbar / Footer Overrides ──────────────────────────────────────────── */
/* Glassmorphism treatment for control bars.                                 */

.zoom-ui-toolkit-root [class*="bg-black\\/"],
.zoom-ui-toolkit-root [class*="bg-black/"] {
  background: rgba(10, 10, 12, 0.85) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
}

/* Control buttons — dark elevated surface */
.zoom-ui-toolkit-root button[class*="rounded-full"] {
  background-color: rgba(44, 44, 46, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  transition: background-color 0.15s ease, border-color 0.15s ease !important;
  min-width: 44px !important;
  min-height: 44px !important;
}

.zoom-ui-toolkit-root button[class*="rounded-full"]:hover {
  background-color: rgba(60, 60, 62, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.zoom-ui-toolkit-root button[class*="rounded-full"]:active {
  background-color: rgba(50, 50, 52, 0.95) !important;
}

/* Red/destructive buttons (leave, mute) keep their color */
.zoom-ui-toolkit-root button[class*="bg-red"],
.zoom-ui-toolkit-root [class*="bg-red-5"],
.zoom-ui-toolkit-root [class*="bg-red-6"] {
  background-color: #DC2626 !important;
  border: none !important;
}

/* ── Input / Select Overrides ────────────────────────────────────────────── */

.zoom-ui-toolkit-root input,
.zoom-ui-toolkit-root select,
.zoom-ui-toolkit-root textarea {
  background-color: #1C1C1E !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
  border-radius: 8px !important;
  font-size: 14px !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
}

.zoom-ui-toolkit-root input::placeholder,
.zoom-ui-toolkit-root textarea::placeholder {
  color: #6e6e73 !important;
  opacity: 1 !important;
}

.zoom-ui-toolkit-root input:focus,
.zoom-ui-toolkit-root select:focus,
.zoom-ui-toolkit-root textarea:focus {
  border-color: #3B82F6 !important;
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15) !important;
}

/* Dropdown option elements */
.zoom-ui-toolkit-root select option {
  background-color: #1C1C1E !important;
  color: #ffffff !important;
}

/* Labels in device selector forms */
.zoom-ui-toolkit-root label {
  color: #d1d1d6 !important;
  font-size: 12px !important;
}

/* ── Video Quality ───────────────────────────────────────────────────────── */
/* Force video/canvas to fill containers at full resolution.                 */

.zoom-ui-toolkit-root video,
.zoom-ui-toolkit-root canvas {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

/* ── Dividers / Borders ──────────────────────────────────────────────────── */

.zoom-ui-toolkit-root [class*="border-theme-divider"],
.zoom-ui-toolkit-root [class*="divide-theme-divider"] > * + * {
  border-color: #2C2C2E !important;
}

/* ── Chat / Side Panel Overrides ─────────────────────────────────────────── */
/* Theme the chat panel, participant list, and settings drawers.             */

.zoom-ui-toolkit-root [class*="bg-white"],
.zoom-ui-toolkit-root [class*="bg-neutral-50"],
.zoom-ui-toolkit-root [class*="bg-neutral-100"] {
  background-color: #1C1C1E !important;
  color: #ffffff !important;
}

.zoom-ui-toolkit-root [class*="text-gray-5"],
.zoom-ui-toolkit-root [class*="text-gray-6"],
.zoom-ui-toolkit-root [class*="text-gray-7"],
.zoom-ui-toolkit-root [class*="text-neutral"] {
  color: #D4D4D8 !important;
}

/* Chat message bubbles */
.zoom-ui-toolkit-root [class*="bg-blue-50"],
.zoom-ui-toolkit-root [class*="bg-blue-100"] {
  background-color: rgba(59, 130, 246, 0.12) !important;
}

/* ── Tooltip / Popover Overrides ─────────────────────────────────────────── */

.zoom-ui-toolkit-root [role="tooltip"],
.zoom-ui-toolkit-root [class*="tooltip"],
.zoom-ui-toolkit-root [class*="popover"] {
  background-color: #2C2C2E !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #ffffff !important;
  border-radius: 8px !important;
}

/* ── Focus States (Keyboard A11y) ────────────────────────────────────────── */
/* Visible focus ring for keyboard navigation.                               */

.zoom-ui-toolkit-root button:focus-visible,
.zoom-ui-toolkit-root input:focus-visible,
.zoom-ui-toolkit-root select:focus-visible,
.zoom-ui-toolkit-root [role="button"]:focus-visible {
  outline: 2px solid #3B82F6 !important;
  outline-offset: 2px !important;
}

/* ── Scrollbars (Webkit) ─────────────────────────────────────────────────── */

.zoom-ui-toolkit-root ::-webkit-scrollbar {
  width: 6px;
}

.zoom-ui-toolkit-root ::-webkit-scrollbar-track {
  background: transparent;
}

.zoom-ui-toolkit-root ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.zoom-ui-toolkit-root ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* ── Reduced Motion ──────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .zoom-ui-toolkit-root *,
  .aspire-guest-logo-container,
  .aspire-guest-footer {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ── Aspire Logo Injection Container ─────────────────────────────────────── */

.aspire-guest-logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0 8px 0;
  animation: aspireGuestFadeIn 0.4s ease;
}

.aspire-guest-logo-container img {
  height: 28px;
  width: auto;
  opacity: 0.9;
}

.aspire-guest-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0 16px 0;
  animation: aspireGuestFadeIn 0.6s ease;
}

.aspire-guest-footer-dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background-color: #3B82F6;
}

.aspire-guest-footer-text {
  color: #9CA3AF;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

@keyframes aspireGuestFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

let injected = false;

/**
 * Inject Aspire guest theme CSS into the DOM.
 * Also sets zoom-data-theme="dark" on :root for toolkit variable activation.
 * Safe to call multiple times — idempotent.
 */
export function injectGuestTheme(): void {
  if (Platform.OS !== 'web' || injected) return;
  if (typeof document === 'undefined') return;

  if (document.getElementById(GUEST_THEME_ID)) {
    injected = true;
    return;
  }

  // Set dark theme attribute so toolkit reads our overridden variables
  document.documentElement.setAttribute('zoom-data-theme', 'dark');

  const style = document.createElement('style');
  style.id = GUEST_THEME_ID;
  style.textContent = ASPIRE_GUEST_CSS;
  document.head.appendChild(style);
  injected = true;
}

/**
 * Inject Aspire branding elements into the Zoom UI Toolkit pre-join screen.
 * Uses MutationObserver to detect when the toolkit renders, then injects
 * logo + footer. Includes a timeout fallback.
 */
export function injectGuestBranding(container: HTMLElement): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const inject = () => {
    // Find the toolkit root
    const root = container.querySelector('.zoom-ui-toolkit-root');
    if (!root) return false;

    // Don't double-inject
    if (root.querySelector('.aspire-guest-logo-container')) return true;

    // Find the first child (usually the preview/session container)
    const firstChild = root.firstElementChild;
    if (!firstChild) return false;

    // Inject logo above the toolkit content
    const logoContainer = document.createElement('div');
    logoContainer.className = 'aspire-guest-logo-container';
    logoContainer.innerHTML = '<img src="/images/aspire-logo-premium.png" alt="Aspire" />';
    root.insertBefore(logoContainer, firstChild);

    // Inject footer at the bottom
    const footer = document.createElement('div');
    footer.className = 'aspire-guest-footer';
    footer.innerHTML = '<span class="aspire-guest-footer-dot"></span><span class="aspire-guest-footer-text">Powered by Aspire</span>';
    root.appendChild(footer);

    return true;
  };

  // Try immediately
  if (inject()) return;

  // Watch for toolkit DOM changes
  const observer = new MutationObserver(() => {
    if (inject()) {
      observer.disconnect();
    }
  });

  observer.observe(container, { childList: true, subtree: true });

  // Fallback: stop observing after 5 seconds
  setTimeout(() => observer.disconnect(), 5000);
}
