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
        const options = {
          fullHd: VIDEO_CAPTURE_DEFAULTS.fullHd,
          hd: VIDEO_CAPTURE_DEFAULTS.hd,
          fps: VIDEO_CAPTURE_DEFAULTS.fps,
          facingMode: VIDEO_CAPTURE_DEFAULTS.facingMode,
        };
        try {
          await stream.startVideo(options);
        } catch {
          await stream.startVideo({
            hd: true,
            fps: 24,
            facingMode: 'user',
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
          // Zoom SDK startShareScreen requires a <canvas> element for sender-side
          // WebGL capture (NOT a <video> — that caused the videoShare.closeMedia
          // immediate-close bug). Production-grade requirements for that canvas:
          //
          //   - It MUST be in the layout tree (not display:none) so the SDK can
          //     acquire a sized WebGL context. We position it offscreen with
          //     visibility:hidden + pointer-events:none instead.
          //   - It MUST have explicit width/height HTML attributes (NOT just CSS)
          //     because those set the WebGL backing-store resolution. CSS-only
          //     sizing leaves the backing store at 300×150 (browser default) and
          //     remote viewers see a low-res share. We size to 1920×1080 — Zoom
          //     re-encodes downstream so the backing store is the upstream cap.
          //   - It MUST be painted before startShareScreen is called. We defer
          //     by one animation frame to guarantee at least one paint cycle.
          let shareEl = document.getElementById('zoom-share-canvas') as HTMLCanvasElement;
          const isNew = !shareEl;
          if (isNew) {
            shareEl = document.createElement('canvas');
            shareEl.id = 'zoom-share-canvas';
            // Backing store at HD — SDK encodes/scales for the wire.
            shareEl.width = 1920;
            shareEl.height = 1080;
            // In-tree but invisible: visibility:hidden keeps layout, fixed
            // position with negative offsets keeps it off the user's screen,
            // pointer-events:none avoids stealing clicks.
            shareEl.style.cssText = [
              'position: fixed',
              'top: -9999px',
              'left: -9999px',
              'width: 1px',
              'height: 1px',
              'visibility: hidden',
              'pointer-events: none',
              'opacity: 0',
            ].join('; ');
            document.body.appendChild(shareEl);
          }
          // Defer one frame so the canvas has been laid out and painted.
          await new Promise<void>((resolve) => {
            if (typeof window.requestAnimationFrame === 'function') {
              window.requestAnimationFrame(() => resolve());
            } else {
              setTimeout(resolve, 16);
            }
          });
          try {
            await stream.startShareScreen(shareEl as any);
            setIsScreenSharing(true);
          } catch (e: any) {
            // Clean up newly-created element on failure; leave existing one in place
            if (isNew) shareEl.remove();
            // User denied the browser picker — silent return (UI stays in
            // not-sharing state, no toast needed for a deliberate decline).
            const denied = e?.type === 'USER_FORBIDDEN'
              || e?.name === 'NotAllowedError'
              || /permission|denied|user.?cancel/i.test(String(e?.message || ''));
            if (denied) return;
            throw e;
          }
        }
      }
    } catch (e: any) {
      const denied = e?.type === 'USER_FORBIDDEN'
        || e?.name === 'NotAllowedError'
        || /permission|denied|user.?cancel/i.test(String(e?.message || ''));
      if (denied) return;
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
