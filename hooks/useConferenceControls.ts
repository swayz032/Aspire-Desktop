/**
 * useConferenceControls — mic/camera/share/record toggle state via Zoom SDK stream.
 * All actions go through Zoom SDK directly. Error handling is graceful degradation.
 */
import { useState, useCallback } from 'react';
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
        await stream.startVideo({
          fullHd: VIDEO_CAPTURE_DEFAULTS.fullHd,
          hd: VIDEO_CAPTURE_DEFAULTS.hd,
          facingMode: VIDEO_CAPTURE_DEFAULTS.facingMode,
        });
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

  const toggleRecording = useCallback(async () => {
    if (!client) return;
    try {
      const rc = client.getRecordingClient();
      if (!rc) return;
      if (isRecording) {
        await rc.stopCloudRecording();
      } else {
        // Check if recording is available (host/co-host only)
        if (typeof rc.canStartRecording === 'function' && !rc.canStartRecording()) {
          console.warn('[ConferenceControls] Recording not available — may require host role');
          return;
        }
        await rc.startCloudRecording();
      }
      setIsRecording(prev => !prev);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_recording', error: e, component: 'ConferenceControls' });
    }
  }, [client, isRecording]);

  return {
    isMuted, isCameraOff, isScreenSharing, isRecording,
    toggleMic, toggleCamera, toggleScreenShare, toggleRecording,
    setIsRecording, setIsScreenSharing,
  };
}
