/**
 * Zoom Video SDK Configuration
 *
 * Single source of truth for video/audio quality settings used by
 * ZoomConferenceProvider and guest join page.
 *
 * Zoom Video SDK handles adaptive quality internally (no simulcast
 * layers to configure). We specify capture defaults and init options.
 *
 * SDK: @zoom/videosdk v2.3.15+
 * Docs: https://developers.zoom.us/docs/video-sdk/web/
 */

// ── Video Capture Defaults ──────────────────────────────────────────────────

export const VIDEO_CAPTURE_DEFAULTS = {
  width: 1920,
  height: 1080,
  frameRate: 30,
  facingMode: 'user' as const,
} as const;

// ── Audio Capture Defaults ──────────────────────────────────────────────────
//
// Zoom SDK has built-in noise suppression — no external Krisp integration needed.
// These WebRTC constraints are applied at getUserMedia level.

export const AUDIO_CAPTURE_DEFAULTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

// ── Screen Share Defaults ───────────────────────────────────────────────────

export const SCREEN_SHARE_DEFAULTS = {
  width: 1920,
  height: 1080,
  frameRate: 30,
} as const;

// ── Zoom SDK Init Options ───────────────────────────────────────────────────
//
// Passed to ZoomVideo.createClient().init()
// Language: en-US, Region: Global (auto-select closest data center)
// patchJsMedia: true — required for browser compatibility

export const ZOOM_INIT_OPTIONS = {
  language: 'en-US' as const,
  region: 'Global' as const,
  patchJsMedia: true,
  leaveOnPageUnload: true,
  enforceMultipleVideos: true,
} as const;

// ── Session Config ──────────────────────────────────────────────────────────

export const SESSION_CONFIG = {
  /** Max participants per session (Zoom Video SDK limit) */
  maxParticipants: 50,

  /** Auto-start audio on join */
  autoStartAudio: true,

  /** Auto-start video on join */
  autoStartVideo: true,
} as const;

// ── Zoom JWT Role Types ─────────────────────────────────────────────────────

export const ZOOM_ROLE = {
  HOST: 1,
  ATTENDEE: 0,
} as const;

/**
 * Build Zoom SDK init options with optional overrides.
 */
export function buildZoomInitOptions(overrides?: Partial<typeof ZOOM_INIT_OPTIONS>) {
  return { ...ZOOM_INIT_OPTIONS, ...overrides };
}
