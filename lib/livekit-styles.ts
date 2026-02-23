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

/* Ensure LiveKit room fills container */
.lk-room-container {
  background: #0a0a0c !important;
  height: 100% !important;
  width: 100% !important;
}

/* Participant tiles — match Aspire rounded dark style */
.lk-participant-tile {
  border-radius: 10px !important;
  overflow: hidden !important;
  background: #141414 !important;
}

.lk-participant-tile video {
  border-radius: 10px !important;
  object-fit: cover !important;
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

/* Hide default LiveKit branding if any */
.lk-room-container .lk-chat-toggle,
.lk-room-container .lk-settings-toggle {
  display: none !important;
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
