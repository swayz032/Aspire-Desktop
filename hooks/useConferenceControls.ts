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
    if (!stream) return;
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
    if (!stream) return;
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
        await stream.startShareScreen();
      }
      setIsScreenSharing(prev => !prev);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'toggle_screen_share', error: e, component: 'ConferenceControls' });
    }
  }, [stream, isScreenSharing]);

  const toggleRecording = useCallback(async () => {
    if (!client) return;
    try {
      const rc = client.getRecordingClient();
      if (isRecording) {
        await rc.stopCloudRecording();
      } else {
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
