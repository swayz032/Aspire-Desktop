/**
 * LiveKit Enterprise Video Quality Configuration
 *
 * Single source of truth for all LiveKit room options across
 * the Aspire platform (internal conference + guest join page).
 *
 * ── Configuration Rationale (cited from LiveKit docs) ──────────────────────
 *
 * VIDEO PRESETS (from livekit-client SDK source):
 *   VideoPresets.h1080 = new VideoPreset(1920, 1080, 3_000_000, 30)
 *   VideoPresets.h720  = new VideoPreset(1280, 720,  1_700_000, 30)
 *   VideoPresets.h360  = new VideoPreset(640,  360,  450_000,   20)
 *   VideoPresets.h180  = new VideoPreset(320,  180,  160_000,   20)
 *
 * SIMULCAST (docs: /transport/media/advanced/):
 *   "Simulcast enables publishing multiple versions of the same video track
 *    with different bitrate profiles. This allows LiveKit to dynamically
 *    forward the most suitable stream based on each recipient's bandwidth
 *    and preferred resolution."
 *   Default simulcast layers when left blank: h180, h360.
 *   Docs example uses VideoPresets.h540 and VideoPresets.h216.
 *
 * ADAPTIVE STREAM (docs: /transport/media/subscribe/):
 *   "Adaptive stream allows a developer to build dynamic video applications
 *    without consternation for how interface design or user interaction might
 *    impact video quality. It allows us to fetch the minimum bits necessary
 *    for high-quality rendering."
 *
 * DYNACAST (docs: /transport/media/advanced/):
 *   "With Dynacast dynamically pauses video layers that are not being consumed
 *    by any subscribers, significantly reducing publishing CPU and bandwidth."
 *
 * CODEC (docs: /transport/media/advanced/):
 *   Default codec is VP8. VP9/AV1 support SVC (Scalable Video Coding) with
 *   automatic L3T3_KEY scalability mode. VP8 is the most compatible default.
 *   backupCodec defaults to true — LiveKit auto-publishes VP8 backup for
 *   advanced codec subscribers that can't decode.
 *
 * AUDIO PRESETS (from livekit-client SDK source):
 *   AudioPresets.telephone       = { maxBitrate: 12_000 }
 *   AudioPresets.speech           = { maxBitrate: 24_000 }
 *   AudioPresets.music            = { maxBitrate: 48_000 }
 *   AudioPresets.musicStereo      = { maxBitrate: 64_000 }
 *   AudioPresets.musicHighQuality = { maxBitrate: 96_000 }
 *   Default publishDefaults.audioPreset = AudioPresets.music (48kbps)
 *
 * SCREEN SHARE PRESETS (from livekit-client SDK source):
 *   ScreenSharePresets.h1080fps15 = new VideoPreset(1920, 1080, 2_500_000, 15)
 *   ScreenSharePresets.h1080fps30 = new VideoPreset(1920, 1080, 5_000_000, 30)
 *   Default publishDefaults.screenShareEncoding = ScreenSharePresets.h1080fps15
 *
 * AUDIO CAPTURE (docs: /transport/media/noise-cancellation/):
 *   "You can adjust these settings with the AudioCaptureOptions type in the
 *    LiveKit SDKs during connection. Leaving these WebRTC settings on is
 *    strongly recommended when you are not using enhanced noise cancellation."
 *   SDK defaults: autoGainControl: true, echoCancellation: true,
 *                 noiseSuppression: true, voiceIsolation: true
 *
 * ROOM OPTIONS (docs: /intro/basics/connect/, SDK source):
 *   disconnectOnPageLeave: true (default) — auto-disconnect on page hide
 *   reconnectPolicy: DefaultReconnectPolicy — automatic ICE restart + full reconnect
 *
 * DTX (Discontinuous Transmission): enabled by default for mono tracks,
 *   saves bandwidth during silence.
 * RED (Redundant Audio Data): enabled by default for mono tracks,
 *   recovers from packet loss.
 */

import type { RoomOptions } from 'livekit-client';
import {
  VideoPreset,
  VideoPresets,
  AudioPresets,
  ScreenSharePresets,
} from 'livekit-client';

// ── Simulcast Layers ────────────────────────────────────────────────────────
//
// For 1080p main track, we define two additional simulcast layers.
// Docs (/transport/media/advanced/): "Up to two additional simulcast layers
// to publish in addition to the original Track."
//
// Layer strategy:
//   Main:    1920x1080 @ 30fps, 3.0Mbps  (VideoPresets.h1080)
//   Layer 1: 1280x720  @ 30fps, 1.7Mbps  (VideoPresets.h720)
//   Layer 2:  640x360  @ 20fps, 450kbps  (VideoPresets.h360)
//
// Using the SDK's built-in presets ensures bitrate values match LiveKit's
// "sane presets for video resolution/encoding" (SDK source: options.ts).
// Previous custom VideoPreset values (1.5Mbps@720p, 400kbps@360p) were
// slightly below the SDK recommendations. Using exact preset values ensures
// optimal quality at each layer.

const SIMULCAST_LAYERS_1080P: VideoPreset[] = [
  VideoPresets.h720,  // 1280x720, 1.7Mbps, 30fps — mid-quality
  VideoPresets.h360,  // 640x360, 450kbps, 20fps — low bandwidth fallback
];

// ── Screen Share Encoding ───────────────────────────────────────────────────
//
// Screen share needs higher bitrate than camera for text/slide clarity.
// SDK default is ScreenSharePresets.h1080fps15 (2.5Mbps, 15fps).
// We use h1080fps30 (5Mbps, 30fps) for smooth scrolling + presentation quality.
// Docs (/transport/media/screenshare/): screen share is published as a video
// track with optimized settings for content.

const SCREEN_SHARE_ENCODING = ScreenSharePresets.h1080fps30.encoding;

// ── Enterprise Room Options ─────────────────────────────────────────────────

/**
 * Enterprise-grade LiveKit room options used by both the internal conference
 * (LiveKitConferenceProvider) and guest join page (join/[code].tsx).
 *
 * All values are derived from LiveKit documentation and SDK presets.
 * No custom/invented values — everything maps to documented SDK constants.
 */
export const ENTERPRISE_ROOM_OPTIONS: RoomOptions = {
  // ── Subscriber Quality Management ──────────────────────────────────────
  //
  // adaptiveStream (docs: /transport/media/subscribe/):
  //   Selects simulcast layer based on video element size. Prevents wasting
  //   bandwidth while maintaining crisp video at every tile size. With 3-layer
  //   simulcast (1080p/720p/360p), adaptiveStream picks the optimal layer.
  adaptiveStream: true,

  // dynacast (docs: /transport/media/advanced/):
  //   Pauses unused video layers when no subscribers need them. Reduces
  //   publishing CPU and bandwidth significantly in multi-participant rooms.
  dynacast: true,

  // disconnectOnPageLeave (SDK default: true):
  //   Auto-disconnect on page hide/beforeunload. Ensures clean room cleanup.
  disconnectOnPageLeave: true,

  // ── Video Capture (1080p) ──────────────────────────────────────────────
  //
  // VideoPresets.h1080.resolution = { width: 1920, height: 1080 }
  // We add frameRate: 30 and facingMode: 'user' for explicit control.
  // Docs (/transport/media/advanced/): "Capture settings: Device selection
  // and capabilities (resolution, framerate, facing mode)."
  videoCaptureDefaults: {
    resolution: {
      width: 1920,
      height: 1080,
      frameRate: 30,
    },
    facingMode: 'user',
  },

  // ── Audio Capture (Enterprise Quality) ─────────────────────────────────
  //
  // Docs (/transport/media/noise-cancellation/): "Leaving these WebRTC
  // settings on is strongly recommended."
  // SDK defaults also enable voiceIsolation, which we include here.
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    voiceIsolation: true,
  },

  // ── Publish Defaults ───────────────────────────────────────────────────
  publishDefaults: {
    // Video encoding: VideoPresets.h1080 = 3.0Mbps @ 30fps (SDK preset).
    // Docs (/transport/media/advanced/): "Publish settings: Encoding
    // parameters (bitrate, framerate, simulcast layers)."
    videoEncoding: VideoPresets.h1080.encoding,

    // Simulcast: 3 layers (1080p main + 720p + 360p).
    // Docs: "When left blank, it defaults to h180, h360."
    // We override with h720 + h360 for better mid-range quality.
    simulcast: true,
    videoSimulcastLayers: SIMULCAST_LAYERS_1080P,

    // Video codec: VP8 (default, most compatible).
    // Docs (/transport/media/advanced/): "codec, defaults to vp8"
    // backupCodec: true (default) — auto VP8 fallback for advanced codecs.
    videoCodec: 'vp8',
    backupCodec: true,

    // Screen share: 1080p @ 30fps, 5.0Mbps (ScreenSharePresets.h1080fps30).
    // Higher than camera bitrate for text/slide clarity.
    // No simulcast for screen share — full quality to all subscribers.
    screenShareEncoding: SCREEN_SHARE_ENCODING,
    screenShareSimulcastLayers: [],

    // Audio: AudioPresets.music = 48kbps opus (SDK default for publishDefaults).
    // Docs: "which audio preset should be used for publishing (audio) tracks,
    // defaults to AudioPresets.music"
    // 48kbps is the sweet spot for speech clarity without wasting bandwidth.
    audioPreset: AudioPresets.music,

    // DTX (Discontinuous Transmission): save bandwidth during silence.
    // Docs: "dtx (Discontinuous Transmission of audio), enabled by default"
    dtx: true,

    // RED (Redundant Audio Data): recover from packet loss.
    // Docs: "red (Redundant Audio Data), enabled by default"
    red: true,
  },
};

/**
 * Build enterprise room options with device-specific overrides.
 *
 * Used by the guest join page where PreJoin provides device selection.
 * Merges guest's chosen audio/video device IDs into the base config.
 */
export function buildRoomOptionsWithDevices(overrides?: {
  audioDeviceId?: string;
  videoDeviceId?: string;
}): RoomOptions {
  const options = { ...ENTERPRISE_ROOM_OPTIONS };

  if (overrides?.videoDeviceId || overrides?.audioDeviceId) {
    if (overrides.videoDeviceId) {
      options.videoCaptureDefaults = {
        ...options.videoCaptureDefaults,
        deviceId: overrides.videoDeviceId,
      };
    }
    if (overrides.audioDeviceId) {
      options.audioCaptureDefaults = {
        ...options.audioCaptureDefaults,
        deviceId: overrides.audioDeviceId,
      };
    }
  }

  return options;
}
