/**
 * ConferenceSettingsPanel — Slide-in panel for device selection + virtual backgrounds.
 *
 * Sections:
 * - Camera selector (dropdown)
 * - Microphone selector (dropdown)
 * - Speaker selector (dropdown)
 * - Virtual Background (blur / none)
 * - Video Quality toggle (HD on/off)
 *
 * Used by both host (conference-live.tsx) and guest (join/[code].tsx).
 * Requires ZoomConferenceProvider context for stream access.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { useZoomContext } from '@/components/session/ZoomConferenceProvider';

interface MediaDevice {
  deviceId: string;
  label: string;
}

interface ConferenceSettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function ConferenceSettingsPanel({ visible, onClose }: ConferenceSettingsPanelProps) {
  const { stream } = useZoomContext();

  const [cameras, setCameras] = useState<MediaDevice[]>([]);
  const [mics, setMics] = useState<MediaDevice[]>([]);
  const [speakers, setSpeakers] = useState<MediaDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [virtualBg, setVirtualBg] = useState<'none' | 'blur'>('none');
  const [isHd, setIsHd] = useState(true);

  // Load device lists
  useEffect(() => {
    if (!visible || !stream) return;

    const loadDevices = async () => {
      try {
        const cameraList = stream.getCameraList() ?? [];
        const micList = stream.getMicList() ?? [];
        const speakerList = stream.getSpeakerList() ?? [];

        // Zoom SDK returns MediaDevice[] with deviceId + label
        setCameras(cameraList.map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` })));
        setMics(micList.map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` })));
        setSpeakers(speakerList.map((d) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 6)}` })));

        // Get current active devices (returns deviceId string)
        const activeMicId = stream.getActiveMicrophone?.();
        const activeSpeakerId = stream.getActiveSpeaker?.();
        if (activeMicId) setSelectedMic(activeMicId);
        if (activeSpeakerId) setSelectedSpeaker(activeSpeakerId);
        // Camera: select first if available
        if (cameraList.length > 0) setSelectedCamera(cameraList[0].deviceId);
      } catch (_e) {
        // Device enumeration may fail on some browsers
      }
    };

    loadDevices();
  }, [visible, stream]);

  const handleSwitchCamera = useCallback(async (deviceId: string) => {
    if (!stream) return;
    try {
      await stream.switchCamera(deviceId);
      setSelectedCamera(deviceId);
    } catch (_e) { /* best-effort */ }
  }, [stream]);

  const handleSwitchMic = useCallback(async (deviceId: string) => {
    if (!stream) return;
    try {
      await stream.switchMicrophone(deviceId);
      setSelectedMic(deviceId);
    } catch (_e) { /* best-effort */ }
  }, [stream]);

  const handleSwitchSpeaker = useCallback(async (deviceId: string) => {
    if (!stream) return;
    try {
      await stream.switchSpeaker(deviceId);
      setSelectedSpeaker(deviceId);
    } catch (_e) { /* best-effort */ }
  }, [stream]);

  const handleVirtualBg = useCallback(async (mode: 'none' | 'blur') => {
    if (!stream) return;
    try {
      if (mode === 'blur') {
        // updateVirtualBackgroundImage with 'blur' enables blur effect
        await stream.updateVirtualBackgroundImage?.('blur');
      } else {
        // undefined removes virtual background
        await stream.updateVirtualBackgroundImage?.(undefined);
      }
      setVirtualBg(mode);
    } catch (_e) { /* Virtual background may not be supported */ }
  }, [stream]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close settings" />
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Settings</Text>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close" accessibilityRole="button">
            <Ionicons name="close" size={20} color={Colors.text.muted} />
          </Pressable>
        </View>

        <ScrollView style={styles.panelBody} contentContainerStyle={styles.panelBodyContent} showsVerticalScrollIndicator={false}>
          {/* Camera */}
          <View style={styles.section}>
            <View style={styles.sectionLabel}>
              <Ionicons name="videocam-outline" size={16} color={Colors.text.tertiary} />
              <Text style={styles.sectionTitle}>Camera</Text>
            </View>
            {cameras.length > 0 ? (
              <View style={styles.deviceList}>
                {cameras.map(cam => (
                  <Pressable
                    key={cam.deviceId}
                    style={[styles.deviceOption, selectedCamera === cam.deviceId && styles.deviceOptionActive]}
                    onPress={() => handleSwitchCamera(cam.deviceId)}
                  >
                    <Text style={[styles.deviceText, selectedCamera === cam.deviceId && styles.deviceTextActive]} numberOfLines={1}>
                      {cam.label}
                    </Text>
                    {selectedCamera === cam.deviceId && (
                      <Ionicons name="checkmark" size={16} color={Colors.accent.cyan} />
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.noDevices}>No cameras detected</Text>
            )}
          </View>

          {/* Microphone */}
          <View style={styles.section}>
            <View style={styles.sectionLabel}>
              <Ionicons name="mic-outline" size={16} color={Colors.text.tertiary} />
              <Text style={styles.sectionTitle}>Microphone</Text>
            </View>
            {mics.length > 0 ? (
              <View style={styles.deviceList}>
                {mics.map(mic => (
                  <Pressable
                    key={mic.deviceId}
                    style={[styles.deviceOption, selectedMic === mic.deviceId && styles.deviceOptionActive]}
                    onPress={() => handleSwitchMic(mic.deviceId)}
                  >
                    <Text style={[styles.deviceText, selectedMic === mic.deviceId && styles.deviceTextActive]} numberOfLines={1}>
                      {mic.label}
                    </Text>
                    {selectedMic === mic.deviceId && (
                      <Ionicons name="checkmark" size={16} color={Colors.accent.cyan} />
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.noDevices}>No microphones detected</Text>
            )}
          </View>

          {/* Speaker */}
          <View style={styles.section}>
            <View style={styles.sectionLabel}>
              <Ionicons name="volume-high-outline" size={16} color={Colors.text.tertiary} />
              <Text style={styles.sectionTitle}>Speaker</Text>
            </View>
            {speakers.length > 0 ? (
              <View style={styles.deviceList}>
                {speakers.map(spk => (
                  <Pressable
                    key={spk.deviceId}
                    style={[styles.deviceOption, selectedSpeaker === spk.deviceId && styles.deviceOptionActive]}
                    onPress={() => handleSwitchSpeaker(spk.deviceId)}
                  >
                    <Text style={[styles.deviceText, selectedSpeaker === spk.deviceId && styles.deviceTextActive]} numberOfLines={1}>
                      {spk.label}
                    </Text>
                    {selectedSpeaker === spk.deviceId && (
                      <Ionicons name="checkmark" size={16} color={Colors.accent.cyan} />
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.noDevices}>No speakers detected</Text>
            )}
          </View>

          {/* Virtual Background */}
          <View style={styles.section}>
            <View style={styles.sectionLabel}>
              <Ionicons name="image-outline" size={16} color={Colors.text.tertiary} />
              <Text style={styles.sectionTitle}>Virtual Background</Text>
            </View>
            <View style={styles.bgOptions}>
              <Pressable
                style={[styles.bgOption, virtualBg === 'none' && styles.bgOptionActive]}
                onPress={() => handleVirtualBg('none')}
              >
                <Ionicons name="close-circle-outline" size={24} color={virtualBg === 'none' ? Colors.accent.cyan : Colors.text.muted} />
                <Text style={[styles.bgOptionText, virtualBg === 'none' && styles.bgOptionTextActive]}>None</Text>
              </Pressable>
              <Pressable
                style={[styles.bgOption, virtualBg === 'blur' && styles.bgOptionActive]}
                onPress={() => handleVirtualBg('blur')}
              >
                <Ionicons name="water-outline" size={24} color={virtualBg === 'blur' ? Colors.accent.cyan : Colors.text.muted} />
                <Text style={[styles.bgOptionText, virtualBg === 'blur' && styles.bgOptionTextActive]}>Blur</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...(Platform.OS === 'web' ? {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    } : {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panel: {
    width: 340,
    backgroundColor: '#111113',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.06)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
    } as unknown as ViewStyle : {}),
  },
  panelHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  panelTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelBody: {
    flex: 1,
  },
  panelBodyContent: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.small,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deviceList: {
    gap: 2,
  },
  deviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    minHeight: 40,
  },
  deviceOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  deviceText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  deviceTextActive: {
    color: Colors.text.primary,
  },
  noDevices: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },
  bgOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bgOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(28, 28, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  bgOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  bgOptionText: {
    ...Typography.small,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  bgOptionTextActive: {
    color: Colors.text.primary,
  },
});
