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
//
// fullHd: true  → 1080p capture (Zoom SDK official param)
// hd: true      → 720p capture (fallback if fullHd not supported)
// Zoom SDK docs: https://developers.zoom.us/docs/video-sdk/web/video-hd/

export const VIDEO_CAPTURE_DEFAULTS = {
  /** Request 1080p capture from camera */
  fullHd: true,
  /** Fallback: 720p if fullHd unavailable */
  hd: true,
  /** Target frame rate */
  fps: 30,
  /** Front-facing camera */
  facingMode: 'user' as const,
} as const;

/**
 * Video receive quality — used when rendering remote participant video.
 * Zoom SDK VideoQuality enum values:
 *   Video_90P  = 0
 *   Video_180P = 1
 *   Video_360P = 2
 *   Video_720P = 3
 *   Video_1080P = 4
 */
export const VIDEO_RECEIVE_QUALITY = {
  /** Spotlight / active speaker: render at 1080p */
  spotlight: 4,
  /** Gallery tile (large): render at 720p */
  galleryLarge: 3,
  /** Gallery tile (small, >6 participants): render at 360p */
  gallerySmall: 2,
  /** Filmstrip thumbnail: render at 180p */
  filmstrip: 1,
} as const;

// ── Audio Capture Defaults ──────────────────────────────────────────────────
//
// Zoom SDK has built-in noise suppression — no external Krisp integration needed.
// Crystal clear audio: echo cancellation + noise suppression + auto gain control.

export const AUDIO_CAPTURE_DEFAULTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  /** Suppress background noise via Zoom SDK (separate from WebRTC) */
  backgroundNoiseSuppression: true,
} as const;

// ── Screen Share Defaults ───────────────────────────────────────────────────

export const SCREEN_SHARE_DEFAULTS = {
  /** Share at 1080p */
  fullHd: true,
  /** Optimize for motion (presentations) vs video content */
  optimizedForSharedVideo: false,
  frameRate: 30,
} as const;

// ── Zoom SDK Init Options ───────────────────────────────────────────────────
//
// Passed to ZoomVideo.createClient().init()
// Language: en-US, Region: Global (auto-select closest data center)
// patchJsMedia: true — required for browser compatibility
// enforceMultipleVideos: true — enables multi-participant canvas rendering

export const ZOOM_INIT_OPTIONS = {
  language: 'en-US' as const,
  region: 'Global' as const,
  patchJsMedia: true,
  leaveOnPageUnload: true,
  enforceMultipleVideos: true,
  /** Pre-load video/audio decoders for faster join */
  stayAwake: true,
} as const;

// ── Session Config ──────────────────────────────────────────────────────────

export const SESSION_CONFIG = {
  /** Max participants per session (Zoom Video SDK limit) */
  maxParticipants: 50,

  /** Auto-start audio on join */
  autoStartAudio: true,

  /** Auto-start video on join (1080p) */
  autoStartVideo: true,

  /** Enable Zoom SDK background noise suppression on join */
  autoEnableNoiseSuppression: true,
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
