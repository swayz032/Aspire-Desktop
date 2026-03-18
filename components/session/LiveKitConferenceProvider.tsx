/**
 * LiveKitConferenceProvider
 *
 * Wraps children with the official @livekit/components-react <LiveKitRoom>
 * provider and <RoomAudioRenderer>. Enterprise-grade video/audio configuration.
 *
 * On non-web platforms, renders children directly (LiveKit web SDK is browser-only).
 *
 * Audio pipeline: WebRTC echo cancellation + noise suppression + AGC + voiceIsolation
 * (baseline), with optional Krisp enhanced noise filter (LiveKit Cloud only).
 *
 * Video: 1080p capture, 3-layer simulcast (1080p/720p/360p), VP8 codec,
 * adaptiveStream + dynacast. All settings from livekit-config.ts (single source of truth).
 */
import React, { createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import { ENTERPRISE_ROOM_OPTIONS } from '@/lib/livekit-config';
import { injectLiveKitStyles } from '@/lib/livekit-styles';
import { reportProviderError } from '@/lib/providerErrorReporter';


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
  } catch (err) {
    // Krisp not supported (e.g. not on LiveKit Cloud, or browser unsupported)
    // Degrade gracefully — baseline WebRTC noise suppression still active
    reportProviderError({ provider: 'livekit', action: 'krisp_init', error: err, component: 'LiveKitConferenceProvider' });
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
      options={ENTERPRISE_ROOM_OPTIONS}
      onError={(err) => {
        reportProviderError({ provider: 'livekit', action: 'room_error', error: err, component: 'LiveKitConferenceProvider' });
      }}
      onDisconnected={(reason) => {
        if (reason !== undefined) {
          reportProviderError({ provider: 'livekit', action: 'room_disconnected', error: new Error(`Disconnected: reason=${reason}`), component: 'LiveKitConferenceProvider' });
        }
      }}
    >
      <RoomAudioRenderer />
      <KrispBridge>
        {children}
      </KrispBridge>
    </LiveKitRoom>
  );
}

