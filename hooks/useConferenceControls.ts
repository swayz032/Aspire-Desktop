/**
 * useConferenceControls — mic/camera/share/record toggle state via Zoom SDK stream.
 * All actions go through Zoom SDK directly. Error handling is graceful degradation.
 */
import { useState, useCallback, useEffect } from 'react';
import { VIDEO_CAPTURE_DEFAULTS } from '@/lib/zoom-config';
import { reportProviderError } from '@/lib/providerErrorReporter';

interface ConferenceControlsOptions {
  stream: any | null;
  client: any | null;
}

export function useConferenceControls({ stream, client }: ConferenceControlsOptions) {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
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
      setIsMuted(prev => !prev);
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
          // Fallback path for devices/browsers that reject fullHd.
          await stream.startVideo({
            hd: VIDEO_CAPTURE_DEFAULTS.hd,
            fps: VIDEO_CAPTURE_DEFAULTS.fps,
            facingMode: VIDEO_CAPTURE_DEFAULTS.facingMode,
          });
        }
      } else {
        await stream.stopVideo();
      }
      setIsCameraOff(prev => !prev);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_camera', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (!stream) return;
    try {
      if (isScreenSharing) {
        await stream.stopShareScreen();
        // Clean up the hidden video element created for screen share
        if (typeof document !== 'undefined') {
          document.getElementById('zoom-share-canvas')?.remove();
        }
      } else {
        // Zoom SDK startShareScreen requires a canvas/video element.
        // Create a temporary video element — SDK renders share into it.
        if (typeof document !== 'undefined') {
          let shareEl = document.getElementById('zoom-share-canvas') as HTMLVideoElement;
          if (!shareEl) {
            shareEl = document.createElement('video');
            shareEl.id = 'zoom-share-canvas';
            shareEl.style.display = 'none';
            document.body.appendChild(shareEl);
          }
          await stream.startShareScreen(shareEl as any);
        }
      }
      setIsScreenSharing(prev => !prev);
    } catch (e: any) {
      // USER_FORBIDDEN = user cancelled the share picker — not an error
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
    isMuted, isCameraOff, isScreenSharing, isRecording,
    toggleMic, toggleCamera, toggleScreenShare, toggleRecording,
    setIsRecording, setIsScreenSharing, setIsCameraOff, setIsMuted,
  };
}
