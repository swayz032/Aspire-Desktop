/**
 * useConferenceControls — mic/camera/share/record toggle actions via Zoom SDK.
 *
 * Camera/mic state comes from the provider (single source of truth via participant data).
 * This hook only manages screen share and recording state internally.
 */
import { useState, useCallback, useEffect } from 'react';
import { VIDEO_CAPTURE_DEFAULTS } from '@/lib/zoom-config';
import { reportProviderError } from '@/lib/providerErrorReporter';

interface ConferenceControlsOptions {
  stream: any | null;
  client: any | null;
  /** Current mute state from provider (derived from participant data) */
  isMuted: boolean;
  /** Current camera-off state from provider (derived from participant data) */
  isCameraOff: boolean;
}

export function useConferenceControls({ stream, client, isMuted, isCameraOff }: ConferenceControlsOptions) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const toggleMic = useCallback(async () => {
    if (!stream || typeof stream.muteAudio !== 'function') return;
    try {
      if (isMuted) {
        await stream.unmuteAudio();
      } else {
        await stream.muteAudio();
      }
      // No local state — provider re-syncs via participant data
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_mic', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!stream || typeof stream.startVideo !== 'function') return;
    try {
      if (isCameraOff) {
        try {
          await stream.startVideo({
            fullHd: VIDEO_CAPTURE_DEFAULTS.fullHd,
            hd: VIDEO_CAPTURE_DEFAULTS.hd,
            fps: VIDEO_CAPTURE_DEFAULTS.fps,
            facingMode: VIDEO_CAPTURE_DEFAULTS.facingMode,
          });
        } catch {
          await stream.startVideo({
            hd: VIDEO_CAPTURE_DEFAULTS.hd,
            fps: VIDEO_CAPTURE_DEFAULTS.fps,
            facingMode: VIDEO_CAPTURE_DEFAULTS.facingMode,
          });
        }
      } else {
        await stream.stopVideo();
      }
      // No local state — provider re-syncs via participant data
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_camera', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (!stream) return;
    try {
      if (isScreenSharing) {
        await stream.stopShareScreen();
        if (typeof document !== 'undefined') {
          document.getElementById('zoom-share-canvas')?.remove();
        }
        setIsScreenSharing(false);
      } else {
        if (typeof document !== 'undefined') {
          let shareEl = document.getElementById('zoom-share-canvas') as HTMLVideoElement;
          const isNew = !shareEl;
          if (isNew) {
            shareEl = document.createElement('video');
            shareEl.id = 'zoom-share-canvas';
            shareEl.style.display = 'none';
            document.body.appendChild(shareEl);
          }
          try {
            await stream.startShareScreen(shareEl as any);
            setIsScreenSharing(true);
          } catch (e: any) {
            // Clean up element on failure
            if (isNew) shareEl.remove();
            if (e?.type === 'USER_FORBIDDEN' || e?.message?.includes('Permission denied')) {
              return;
            }
            throw e;
          }
        }
      }
    } catch (e: any) {
      if (e?.type === 'USER_FORBIDDEN' || e?.message?.includes('Permission denied')) {
        return;
      }
      reportProviderError({ provider: 'zoom', action: 'toggle_screen_share', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isScreenSharing]);

  const toggleRecording = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!client) return { success: false, error: 'Conference client not available' };
    try {
      const rc = client.getRecordingClient();
      if (!rc) return { success: false, error: 'Recording is not available for this session' };
      if (isRecording) {
        await rc.stopCloudRecording();
        setIsRecording(false);
        return { success: true };
      } else {
        if (typeof rc.canStartRecording === 'function' && !rc.canStartRecording()) {
          return { success: false, error: 'Only the host can start recording' };
        }
        await rc.startCloudRecording();
        setIsRecording(true);
        return { success: true };
      }
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_recording', error: e, component: 'ConferenceControls' });
      return { success: false, error: 'Recording failed — please try again' };
    }
  }, [client, isRecording]);

  // Clean up orphaned screen share element on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.getElementById('zoom-share-canvas')?.remove();
      }
    };
  }, []);

  return {
    isScreenSharing, isRecording,
    toggleMic, toggleCamera, toggleScreenShare, toggleRecording,
    setIsRecording, setIsScreenSharing,
  };
}
