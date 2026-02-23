/**
 * LiveKitConferenceProvider
 *
 * Wraps children with the official @livekit/components-react <LiveKitRoom>
 * provider and <RoomAudioRenderer>. Replaces the manual useLiveKitRoom hook
 * for conference-live.tsx.
 *
 * On non-web platforms, renders children directly (LiveKit web SDK is browser-only).
 */
import React from 'react';
import { Platform } from 'react-native';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { injectLiveKitStyles } from '@/lib/livekit-styles';

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
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
      }}
    >
      <RoomAudioRenderer />
      {children}
    </LiveKitRoom>
  );
}
