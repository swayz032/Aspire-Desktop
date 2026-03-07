/**
 * LiveKit CSS Injection for Aspire Dark Theme
 *
 * Since Expo web uses Metro bundler (no CSS import pipeline),
 * we inject LiveKit component styles at runtime via DOM injection.
 * This pattern is already used in AvaOrbVideo.tsx and AvaDeskPanel.tsx.
 */
import { Platform } from 'react-native';

const LIVEKIT_STYLE_ID = 'livekit-aspire-theme';

const LIVEKIT_ASPIRE_CSS = `
/* LiveKit Components — Aspire Dark Theme Overrides */
[data-lk-theme="default"] {
  --lk-bg: #0a0a0c;
  --lk-bg2: #141414;
  --lk-control-bg: rgba(20, 20, 20, 0.85);
  --lk-control-hover-bg: #1C1C1E;
  --lk-fg: #ffffff;
  --lk-border-color: #2C2C2E;
  --lk-accent-bg: #3B82F6;
  --lk-accent-fg: #ffffff;
  --lk-danger-bg: #FF3B30;
  --lk-danger-fg: #ffffff;
  --lk-success-bg: #34C759;
}

/* Ensure LiveKit room fills container — display:flex fixes broken flex chain */
.lk-room-container {
  background: #0a0a0c !important;
  height: 100% !important;
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}

/* Participant tiles — match Aspire rounded dark style */
.lk-participant-tile {
  border-radius: 10px !important;
  overflow: hidden !important;
  background: #141414 !important;
}

.lk-participant-tile video {
  border-radius: 10px !important;
  /* contain preserves native resolution — cover caused multi-pass resampling blur.
     Background covers letterbox areas with dark theme color. */
  object-fit: contain !important;
  background: #0a0a0c !important;
}

/* Focus ring — use Aspire cyan accent */
.lk-participant-tile .lk-focus-ring {
  border-color: #4FACFE !important;
}

/* Speaking indicator — green glow */
.lk-participant-tile[data-lk-speaking="true"] {
  box-shadow: 0 0 0 2px #34C759, 0 0 12px rgba(52, 199, 89, 0.3) !important;
}

/* Control bar styling */
.lk-control-bar {
  background: rgba(20, 20, 20, 0.85) !important;
  border-top: 1px solid #1C1C1E !important;
  padding: 8px 24px !important;
}

.lk-control-bar .lk-button {
  border-radius: 8px !important;
  background: transparent !important;
  color: #ffffff !important;
}

.lk-control-bar .lk-button:hover {
  background: #1C1C1E !important;
}

.lk-control-bar .lk-button.lk-button-active {
  background: rgba(255, 59, 48, 0.12) !important;
}

/* Grid layout */
.lk-grid-layout {
  gap: 4px !important;
  padding: 6px !important;
}

/* Connection quality indicator */
.lk-connection-quality {
  color: #34C759 !important;
}

.lk-connection-quality[data-lk-quality="poor"] {
  color: #FF3B30 !important;
}

/* Participant name overlay */
.lk-participant-name {
  font-size: 13px !important;
  font-weight: 500 !important;
  color: #D4D4D8 !important;
}

/* ── PreJoin — Aspire dark theme ─────────────────────────────────────────── */
.lk-prejoin {
  background: #0a0a0c !important;
  max-width: 480px !important;
  margin: 0 auto !important;
  padding: 24px !important;
}
.lk-prejoin .lk-form-control {
  background: #141414 !important;
  border-color: #2C2C2E !important;
  color: #ffffff !important;
  border-radius: 10px !important;
  padding: 12px 16px !important;
  font-size: 15px !important;
}
.lk-prejoin .lk-form-control::placeholder {
  color: #6B7280 !important;
}
.lk-prejoin .lk-join-button {
  background: #22C55E !important;
  color: #ffffff !important;
  border-radius: 10px !important;
  font-weight: 600 !important;
  padding: 12px 24px !important;
  border: none !important;
  cursor: pointer !important;
}
.lk-prejoin .lk-join-button:hover {
  background: #16A34A !important;
}
.lk-prejoin .lk-join-button:disabled {
  background: #1C1C1E !important;
  color: #6B7280 !important;
  cursor: not-allowed !important;
}
.lk-prejoin .lk-video-container {
  border-radius: 12px !important;
  overflow: hidden !important;
  background: #141414 !important;
}
.lk-prejoin .lk-button-group {
  background: transparent !important;
}
.lk-prejoin .lk-button-group .lk-button {
  background: #1C1C1E !important;
  border-color: #2C2C2E !important;
  color: #ffffff !important;
  border-radius: 8px !important;
}
.lk-prejoin .lk-button-group .lk-button:hover {
  background: #2C2C2E !important;
}
.lk-prejoin label, .lk-prejoin .lk-form-control-label {
  color: #9CA3AF !important;
  font-size: 12px !important;
}
.lk-prejoin select {
  background: #141414 !important;
  border-color: #2C2C2E !important;
  color: #ffffff !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
}

/* ── VideoConference inner layout ────────────────────────────────────────── */
.lk-video-conference {
  background: #0a0a0c !important;
  height: 100% !important;
}
.lk-video-conference-inner {
  flex: 1 !important;
}
.lk-focus-layout {
  background: #0a0a0c !important;
}

/* ── Chat sidebar — dark theme ───────────────────────────────────────────── */
.lk-chat {
  background: #0a0a0c !important;
  border-left: 1px solid #1C1C1E !important;
  max-width: 320px !important;
}
.lk-chat .lk-chat-entry {
  background: #141414 !important;
  border-top: 1px solid #1C1C1E !important;
  padding: 8px 12px !important;
}
.lk-chat .lk-chat-entry input {
  background: #1C1C1E !important;
  color: #ffffff !important;
  border-color: #2C2C2E !important;
  border-radius: 8px !important;
}
.lk-chat .lk-chat-entry button {
  background: #3B82F6 !important;
  border-radius: 8px !important;
}
.lk-chat .lk-message-body {
  color: #D4D4D8 !important;
}
.lk-chat .lk-message-sender {
  color: #9CA3AF !important;
}
.lk-chat .lk-message-timestamp {
  color: #6B7280 !important;
}

/* ── Guest badge + branding overlays ─────────────────────────────────────── */
.guest-badge-overlay {
  transition: opacity 0.3s ease;
}
.guest-badge-overlay:hover {
  opacity: 0.7;
}

/* ── Responsive — tablet ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .lk-grid-layout { gap: 2px !important; padding: 2px !important; }
  .lk-control-bar { padding: 6px 12px !important; }
  .lk-participant-name { font-size: 11px !important; }
  .lk-chat { max-width: 260px !important; }
  .lk-prejoin { max-width: 100% !important; padding: 16px !important; }
}

/* ── Responsive — phone ──────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .lk-grid-layout { gap: 1px !important; padding: 1px !important; }
  .lk-control-bar { padding: 4px 8px !important; }
  .lk-chat {
    max-width: 100% !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: 20 !important;
  }
  .lk-prejoin { padding: 12px !important; }
  .lk-prejoin .lk-video-container {
    max-height: 200px !important;
  }
}
`;

let injected = false;

/**
 * Inject LiveKit CSS into the document head.
 * Safe to call multiple times — only injects once.
 */
export function injectLiveKitStyles(): void {
  if (Platform.OS !== 'web' || injected) return;
  if (typeof document === 'undefined') return;

  // Check if already injected (e.g., hot reload)
  if (document.getElementById(LIVEKIT_STYLE_ID)) {
    injected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = LIVEKIT_STYLE_ID;
  style.textContent = LIVEKIT_ASPIRE_CSS;
  document.head.appendChild(style);
  injected = true;
}
