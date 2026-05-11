/**
 * HouseInspectorControls — bottom floating bar for the House Inspector hero.
 *
 * 5 angle preset buttons (Front / Right / Back / Left / Top) + divider +
 * Auto-Orbit toggle + Measure toggle. Style matches LiveEarthHero's bar so
 * the two heroes feel like the same family.
 *
 * Aspire Law #7 (Tools are Hands): pure render. Parent owns all state.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Heading in degrees (0=N, 90=E, 180=S, 270=W). Tilt: 0=top-down, 90=horizon.
// `range` = camera distance from house center in meters.
export const PRESET_HPR = {
  front: { heading: 0, tilt: 35, range: 30 },
  right: { heading: 90, tilt: 35, range: 30 },
  back: { heading: 180, tilt: 35, range: 30 },
  left: { heading: 270, tilt: 35, range: 30 },
  top: { heading: 0, tilt: 88, range: 50 },
} as const;
export type CameraPresetKey = keyof typeof PRESET_HPR;

interface Props {
  onPreset: (preset: CameraPresetKey) => void;
  autoOrbit: boolean;
  onToggleOrbit: () => void;
  measureActive: boolean;
  onToggleMeasure: () => void;
}

export function HouseInspectorControls({
  onPreset,
  autoOrbit,
  onToggleOrbit,
  measureActive,
  onToggleMeasure,
}: Props) {
  return (
    <View style={styles.controlBar} pointerEvents="box-none">
      <View style={styles.presetRow}>
        <PresetButton label="Front" icon="home-outline" onPress={() => onPreset('front')} />
        <PresetButton label="Right" icon="arrow-forward-outline" onPress={() => onPreset('right')} />
        <PresetButton label="Back" icon="arrow-back-outline" onPress={() => onPreset('back')} />
        <PresetButton label="Left" icon="arrow-back-outline" onPress={() => onPreset('left')} flip />
        <PresetButton label="Top" icon="layers-outline" onPress={() => onPreset('top')} />
        <View style={styles.divider} />
        <PresetButton
          label={autoOrbit ? 'Stop Orbit' : 'Auto-Orbit'}
          icon={autoOrbit ? 'pause-outline' : 'play-outline'}
          onPress={onToggleOrbit}
          accent={autoOrbit}
        />
        <PresetButton
          label={measureActive ? 'Clear' : 'Measure'}
          icon={measureActive ? 'close-outline' : 'resize-outline'}
          onPress={onToggleMeasure}
          accent={measureActive}
        />
      </View>
    </View>
  );
}

interface PresetButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accent?: boolean;
  flip?: boolean;
}
function PresetButton({ label, icon, onPress, accent, flip }: PresetButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.presetBtn,
        accent && styles.presetBtnAccent,
        hovered && (accent ? styles.presetBtnAccentHover : styles.presetBtnHover),
      ]}
    >
      <Ionicons
        name={icon}
        size={12}
        color={accent ? '#0A0A0F' : '#fbbf24'}
        style={flip ? ({ transform: [{ scaleX: -1 }] } as unknown as Record<string, unknown>) : undefined}
      />
      <Text style={[styles.presetBtnText, accent && styles.presetBtnTextAccent]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controlBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
        } as unknown) as ViewStyle)
      : {}),
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    backgroundColor: 'rgba(251,191,36,0.04)',
    ...(Platform.OS === 'web'
      ? (({
          transition: 'border-color 120ms ease-out, background-color 120ms ease-out',
        } as unknown) as ViewStyle)
      : {}),
  },
  presetBtnHover: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  presetBtnAccent: {
    borderColor: 'rgba(251,191,36,0.85)',
    backgroundColor: '#fbbf24',
  },
  presetBtnAccentHover: {
    backgroundColor: '#f59e0b',
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.1,
  },
  presetBtnTextAccent: {
    color: '#0A0A0F',
  },
});
