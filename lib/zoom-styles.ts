/**
 * Zoom Video SDK CSS for Aspire Dark Theme
 *
 * Since Expo web uses Metro bundler (no CSS import pipeline),
 * we inject styles at runtime via DOM injection.
 *
 * Zoom Video SDK has minimal built-in UI (canvas-based rendering),
 * so this file is much smaller than the previous LiveKit styles.
 * We style our custom components (ZoomVideoTile, ZoomControlBar,
 * ZoomPreJoin) directly in React Native StyleSheet.
 *
 * This file handles:
 * 1. Canvas container styling for video tiles
 * 2. Custom keyframes for animations
 * 3. Aspire dark theme tokens
 */
import { Platform } from 'react-native';

const ZOOM_STYLE_ID = 'zoom-aspire-theme';

/**
 * Aspire dark theme CSS for Zoom Video SDK canvas elements
 * and custom conference UI components.
 */
const ZOOM_ASPIRE_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
 * Zoom Video SDK — Aspire Premium Dark Theme
 * ═══════════════════════════════════════════════════════════════════════════
 * Design tokens from Aspire Canvas Mode design system.
 */

:root {
  --aspire-bg-primary: #0a0a0c;
  --aspire-bg-surface: #141414;
  --aspire-bg-elevated: #1C1C1E;
  --aspire-text-primary: #ffffff;
  --aspire-text-secondary: #D4D4D8;
  --aspire-text-tertiary: #9CA3AF;
  --aspire-accent-blue: #3B82F6;
  --aspire-accent-green: #22C55E;
  --aspire-accent-red: #FF3B30;
  --aspire-accent-yellow: #FCD34D;
  --aspire-border-radius: 10px;
  --aspire-transition-fast: 0.2s ease;
  --aspire-transition-normal: 0.3s ease;
}

/* ── Zoom SDK VideoPlayer Elements ────────────────────────────────────────── */
/* The SDK's attachVideo() returns <video-player> custom elements.            */
/* These rules ensure video covers the tile (like native Zoom) at all levels. */

video-player-container {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

video-player {
  display: block;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

/* Pierce into VideoPlayer internals — the SDK may render a <video> or        */
/* <canvas> inside the custom element or its shadow DOM.                       */
video-player video,
video-player canvas {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

/* ── Video Canvas Container (legacy) ─────────────────────────────────────── */

.zoom-video-canvas {
  width: 100%;
  height: 100%;
  border-radius: var(--aspire-border-radius);
  background-color: #000;
  object-fit: cover;
}

.zoom-video-tile {
  position: relative;
  overflow: hidden;
  border-radius: var(--aspire-border-radius);
  background-color: var(--aspire-bg-elevated);
  transition: border-color var(--aspire-transition-fast);
}

.zoom-video-tile[data-speaking="true"] {
  border: 2px solid var(--aspire-accent-blue);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
}

/* ── Participant Metadata ─────────────────────────────────────────────────── */

.zoom-participant-name {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 4px 8px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  color: var(--aspire-text-primary);
  font-size: 13px;
  font-weight: 500;
  backdrop-filter: blur(4px);
}

.zoom-muted-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 4px;
  background-color: rgba(255, 59, 48, 0.8);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Control Bar ──────────────────────────────────────────────────────────── */

.zoom-control-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: var(--aspire-bg-surface);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.zoom-control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background-color: var(--aspire-bg-elevated);
  color: var(--aspire-text-primary);
  cursor: pointer;
  transition: background-color var(--aspire-transition-fast);
}

.zoom-control-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.zoom-control-btn[data-active="false"] {
  background-color: rgba(255, 59, 48, 0.2);
  color: var(--aspire-accent-red);
}

.zoom-control-btn.zoom-disconnect {
  background-color: var(--aspire-accent-red);
  color: white;
}

.zoom-control-btn.zoom-disconnect:hover {
  background-color: #E5342B;
}

/* ── PreJoin ──────────────────────────────────────────────────────────────── */

.zoom-prejoin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
  max-width: 480px;
  margin: 0 auto;
}

.zoom-prejoin-video {
  width: 100%;
  aspect-ratio: 16 / 10;
  background-color: #000;
  border-radius: var(--aspire-border-radius);
  overflow: hidden;
}

.zoom-prejoin-video video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.zoom-prejoin-input {
  width: 100%;
  padding: 12px 16px;
  background-color: var(--aspire-bg-elevated);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--aspire-text-primary);
  font-size: 16px;
  outline: none;
  transition: border-color var(--aspire-transition-fast);
}

.zoom-prejoin-input:focus {
  border-color: var(--aspire-accent-blue);
}

.zoom-prejoin-join-btn {
  width: 100%;
  padding: 14px;
  background-color: var(--aspire-accent-blue);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--aspire-transition-fast);
}

.zoom-prejoin-join-btn:hover {
  background-color: #2563EB;
}

.zoom-prejoin-join-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Keyframes ────────────────────────────────────────────────────────────── */

@keyframes aspire-zoom-fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes aspire-zoom-speakingPulse {
  0%, 100% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.2); }
  50% { box-shadow: 0 0 16px rgba(59, 130, 246, 0.4); }
}

@keyframes aspire-zoom-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes aspire-zoom-spinnerRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Grid Layout ──────────────────────────────────────────────────────────── */

.zoom-grid {
  display: grid;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 4px;
  background-color: var(--aspire-bg-primary);
}

/* Auto-fit grid columns based on participant count */
.zoom-grid[data-count="1"] { grid-template-columns: 1fr; }
.zoom-grid[data-count="2"] { grid-template-columns: 1fr 1fr; }
.zoom-grid[data-count="3"],
.zoom-grid[data-count="4"] { grid-template-columns: 1fr 1fr; }
.zoom-grid[data-count="5"],
.zoom-grid[data-count="6"] { grid-template-columns: 1fr 1fr 1fr; }

/* ── Connection Quality ───────────────────────────────────────────────────── */

.zoom-quality-excellent { color: var(--aspire-accent-green); }
.zoom-quality-good { color: var(--aspire-accent-green); }
.zoom-quality-poor { color: var(--aspire-accent-yellow); }
.zoom-quality-bad { color: var(--aspire-accent-red); }
`;

let injected = false;

/**
 * Inject Zoom + Aspire theme CSS into the DOM.
 * Safe to call multiple times — idempotent.
 */
export function injectZoomStyles(): void {
  if (Platform.OS !== 'web' || injected) return;

  if (typeof document === 'undefined') return;

  // Check if already injected
  if (document.getElementById(ZOOM_STYLE_ID)) {
    injected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = ZOOM_STYLE_ID;
  style.textContent = ZOOM_ASPIRE_CSS;
  document.head.appendChild(style);
  injected = true;
}
