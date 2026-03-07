/**
 * LiveKitConferenceProvider
 *
 * Wraps children with the official @livekit/components-react <LiveKitRoom>
 * provider and <RoomAudioRenderer>. Enterprise-grade video/audio configuration.
 *
 * On non-web platforms, renders children directly (LiveKit web SDK is browser-only).
 *
 * Audio pipeline: WebRTC echo cancellation + noise suppression + AGC (baseline),
 * with optional Krisp enhanced noise filter (LiveKit Cloud only).
 */
import React, { createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import { VideoPreset } from 'livekit-client';
import { injectLiveKitStyles } from '@/lib/livekit-styles';

// ── Krisp context — expose toggle to conference UI ──────────────────────────

interface KrispState {
  isEnabled: boolean;
  isPending: boolean;
  isSupported: boolean;
  toggle: () => Promise<void>;
}

const KrispContext = createContext<KrispState>({
  isEnabled: false,
  isPending: false,
  isSupported: false,
  toggle: async () => {},
});

export function useKrisp(): KrispState {
  return useContext(KrispContext);
}

/**
 * KrispBridge — must render inside <LiveKitRoom> to access room context.
 * Exposes Krisp state via React context to descendant conference components.
 */
function KrispBridge({ children }: { children: React.ReactNode }) {
  let krispState: KrispState = {
    isEnabled: false,
    isPending: false,
    isSupported: false,
    toggle: async () => {},
  };

  try {
    const krisp = useKrispNoiseFilter();
    krispState = {
      isEnabled: krisp.isNoiseFilterEnabled,
      isPending: krisp.isNoiseFilterPending,
      isSupported: true,
      toggle: async () => {
        await krisp.setNoiseFilterEnabled(!krisp.isNoiseFilterEnabled);
      },
    };
  } catch {
    // Krisp not supported (e.g. not on LiveKit Cloud, or browser unsupported)
    // Degrade gracefully — baseline WebRTC noise suppression still active
  }

  return (
    <KrispContext.Provider value={krispState}>
      {children}
    </KrispContext.Provider>
  );
}

// ── Provider ────────────────────────────────────────────────────────────────

interface LiveKitConferenceProviderProps {
  /** JWT token from POST /api/livekit/token */
  token: string | null;
  /** LiveKit server URL (wss://...) */
  serverUrl: string;
  /** Child components rendered inside the LiveKit room context */
  children: React.ReactNode;
}

export function LiveKitConferenceProvider({
  token,
  serverUrl,
  children,
}: LiveKitConferenceProviderProps) {
  // Inject Aspire dark theme CSS on first render
  if (Platform.OS === 'web') {
    injectLiveKitStyles();
  }

  // Non-web or no token yet — render children without LiveKit context
  if (Platform.OS !== 'web' || !token) {
    return <>{children}</>;
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={true}
      video={true}
      data-lk-theme="default"
      style={{ height: '100%', width: '100%', background: '#0a0a0c' }}
      options={{
        // adaptiveStream selects simulcast layer based on video element size.
        // With proper 3-layer simulcast (1080p / 720p / 360p), this prevents
        // wasting bandwidth while maintaining crisp video at every tile size.
        adaptiveStream: true,
        dynacast: true,         // Pause unused video layers to save bandwidth

        // --- VIDEO CAPTURE (1080p, explicit constraints for iOS Safari) ---
        videoCaptureDefaults: {
          resolution: { width: 1920, height: 1080, frameRate: 30 },
          facingMode: 'user',
        },

        // --- AUDIO CAPTURE (enterprise quality) ---
        audioCaptureDefaults: {
          echoCancellation: true,     // WebRTC echo cancellation
          noiseSuppression: true,     // WebRTC noise suppression
          autoGainControl: true,      // Normalize volume levels
        },

        // --- PUBLISH DEFAULTS ---
        publishDefaults: {
          // Video: 3.0Mbps main track — ensures 1080p source is sharp.
          // LiveKit bitrate guide: 1080p VP8 needs 2.0-3.5Mbps for clarity.
          videoEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
          simulcast: true,
          // 3-layer simulcast with NO quality gaps:
          //   Main:    1920x1080 @ 30fps, 3.0Mbps (above)
          //   Layer 1: 1280x720  @ 30fps, 1.5Mbps — mid-quality, covers most tile sizes
          //   Layer 2:  640x360  @ 24fps, 400kbps — small tiles, low bandwidth fallback
          // Previous config had 360p+180p with a HUGE gap from 1080p.
          // Adding 720p mid-layer prevents adaptiveStream from dropping to 360p
          // for any tile larger than ~640px. This is the #1 fix for blurry video.
          videoSimulcastLayers: [
            new VideoPreset(1280, 720, 1_500_000, 30),
            new VideoPreset(640, 360, 400_000, 24),
          ],

          // Screen share: 5Mbps at 15fps (optimized for text/slides clarity)
          screenShareEncoding: { maxBitrate: 5_000_000, maxFramerate: 15 },
          screenShareSimulcastLayers: [],  // No simulcast for screen share — full quality

          // Audio: enterprise settings per LiveKit docs
          dtx: true,              // Discontinuous transmission — save bandwidth during silence
          red: true,              // Redundant encoding — recover from packet loss
          audioPreset: { maxBitrate: 48_000 },  // 48kbps opus (good for speech)
        },
      }}
    >
      <RoomAudioRenderer />
      <KrispBridge>
        {children}
      </KrispBridge>
    </LiveKitRoom>
  );
}
