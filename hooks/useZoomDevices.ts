/**
 * useZoomDevices — device selection for camera, microphone, speaker.
 * Uses Zoom SDK stream methods: getCameraList, getMicList, getSpeakerList,
 * switchCamera, switchMicrophone, switchSpeaker.
 */
import { useState, useCallback, useEffect } from 'react';
import { reportProviderError } from '@/lib/providerErrorReporter';

interface Device {
  deviceId: string;
  label: string;
}

interface UseZoomDevicesResult {
  cameras: Device[];
  microphones: Device[];
  speakers: Device[];
  activeCamera: string;
  activeMic: string;
  activeSpeaker: string;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;
  switchSpeaker: (deviceId: string) => Promise<void>;
  refresh: () => void;
}

export function useZoomDevices(stream: any | null): UseZoomDevicesResult {
  const [cameras, setCameras] = useState<Device[]>([]);
  const [microphones, setMicrophones] = useState<Device[]>([]);
  const [speakers, setSpeakers] = useState<Device[]>([]);
  const [activeCamera, setActiveCamera] = useState('');
  const [activeMic, setActiveMic] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState('');

  const refresh = useCallback(() => {
    if (!stream) return;
    try {
      setCameras(stream.getCameraList?.() || []);
      setMicrophones(stream.getMicList?.() || []);
      setSpeakers(stream.getSpeakerList?.() || []);
      setActiveCamera(stream.getActiveVideoId?.() || '');
      setActiveMic(stream.getActiveMicrophone?.() || '');
      setActiveSpeaker(stream.getActiveSpeaker?.() || '');
    } catch (_e) { /* non-critical */ }
  }, [stream]);

  useEffect(() => { refresh(); }, [refresh]);

  const doSwitchCamera = useCallback(async (deviceId: string) => {
    if (!stream) return;
    try {
      await stream.switchCamera(deviceId);
      setActiveCamera(deviceId);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'switch_camera', error: e, component: 'useZoomDevices' });
    }
  }, [stream]);

  const doSwitchMicrophone = useCallback(async (deviceId: string) => {
    if (!stream) return;
    try {
      await stream.switchMicrophone(deviceId);
      setActiveMic(deviceId);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'switch_mic', error: e, component: 'useZoomDevices' });
    }
  }, [stream]);

  const doSwitchSpeaker = useCallback(async (deviceId: string) => {
    if (!stream) return;
    try {
      await stream.switchSpeaker(deviceId);
      setActiveSpeaker(deviceId);
    } catch (e) {
      reportProviderError({ provider: 'zoom', action: 'switch_speaker', error: e, component: 'useZoomDevices' });
    }
  }, [stream]);

  return {
    cameras, microphones, speakers,
    activeCamera, activeMic, activeSpeaker,
    switchCamera: doSwitchCamera,
    switchMicrophone: doSwitchMicrophone,
    switchSpeaker: doSwitchSpeaker,
    refresh,
  };
}
