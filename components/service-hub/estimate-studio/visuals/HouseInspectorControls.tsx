/**
 * HouseInspectorControls — explicit, large nav controls designed for
 * non-technical users who shouldn't have to know mouse-drag conventions
 * for 3D navigation.
 *
 * Two clusters, both visible at once:
 *
 *   Bottom-LEFT:  ANGLE PRESETS  [Front] [Right] [Back] [Left] [Top]
 *   Bottom-RIGHT: D-PAD NAV      ▲ tilt up
 *                              ◄ ⌂ ►   rotate-left / reset / rotate-right
 *                                ▼ tilt down
 *                              [+] [−] zoom in/out
 *                              [Auto-Orbit] [Measure]
 *
 * Every camera move has a button — drag/scroll still work but never required.
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

// Step sizes for the D-pad nav. Tuned for non-technical users — small
// enough each click is predictable, big enough multiple clicks aren't tedious.
export const NAV_STEP = {
  rotateDeg: 30,
  tiltDeg: 15,
  zoomFactor: 1.4, // multiply (zoom out) or divide (zoom in)
} as const;

interface Props {
  onPreset: (preset: CameraPresetKey) => void;
  onRotate: (deltaDegrees: number) => void;
  onTilt: (deltaDegrees: number) => void;
  onZoom: (factor: number) => void;
  onReset: () => void;
  autoOrbit: boolean;
  onToggleOrbit: () => void;
  measureActive: boolean;
  onToggleMeasure: () => void;
}

export function HouseInspectorControls({
  onPreset,
  onRotate,
  onTilt,
  onZoom,
  onReset,
  autoOrbit,
  onToggleOrbit,
  measureActive,
  onToggleMeasure,
}: Props) {
  return (
    <>
      {/* ─── Bottom-left: angle preset cluster ─── */}
      <View style={styles.presetCluster} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.clusterLabel}>VIEW FROM</Text>
          <View style={styles.presetRow}>
            <NavButton label="Front" icon="home-outline" onPress={() => onPreset('front')} />
            <NavButton label="Right" icon="arrow-forward-outline" onPress={() => onPreset('right')} />
            <NavButton label="Back" icon="arrow-back-outline" onPress={() => onPreset('back')} />
            <NavButton label="Left" icon="arrow-back-outline" onPress={() => onPreset('left')} flipIcon />
            <NavButton label="Top" icon="layers-outline" onPress={() => onPreset('top')} />
          </View>
        </View>
      </View>

      {/* ─── Bottom-right: D-pad + zoom + actions ─── */}
      <View style={styles.dpadCluster} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.clusterLabel}>MOVE CAMERA</Text>
          <View style={styles.dpadGrid}>
            <View style={styles.dpadRow}>
              <View style={styles.dpadSpacer} />
              <DpadButton label="Tilt up" icon="chevron-up" onPress={() => onTilt(-NAV_STEP.tiltDeg)} />
              <View style={styles.dpadSpacer} />
            </View>
            <View style={styles.dpadRow}>
              <DpadButton label="Rotate left" icon="chevron-back" onPress={() => onRotate(-NAV_STEP.rotateDeg)} />
              <DpadButton label="Reset view" icon="refresh-outline" onPress={onReset} accent="reset" />
              <DpadButton label="Rotate right" icon="chevron-forward" onPress={() => onRotate(NAV_STEP.rotateDeg)} />
            </View>
            <View style={styles.dpadRow}>
              <View style={styles.dpadSpacer} />
              <DpadButton label="Tilt down" icon="chevron-down" onPress={() => onTilt(NAV_STEP.tiltDeg)} />
              <View style={styles.dpadSpacer} />
            </View>
          </View>
          <View style={styles.zoomRow}>
            <DpadButton label="Zoom in" icon="add-outline" onPress={() => onZoom(1 / NAV_STEP.zoomFactor)} wide />
            <DpadButton label="Zoom out" icon="remove-outline" onPress={() => onZoom(NAV_STEP.zoomFactor)} wide />
          </View>
          <View style={styles.actionRow}>
            <NavButton
              label={autoOrbit ? 'Stop' : 'Auto-Orbit'}
              icon={autoOrbit ? 'pause-outline' : 'play-outline'}
              onPress={onToggleOrbit}
              accent={autoOrbit}
              wide
            />
            <NavButton
              label={measureActive ? 'Clear' : 'Measure'}
              icon={measureActive ? 'close-outline' : 'resize-outline'}
              onPress={onToggleMeasure}
              accent={measureActive}
              wide
            />
          </View>
        </View>
      </View>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accent?: boolean | 'reset';
  flipIcon?: boolean;
  wide?: boolean;
}

/** Standard labeled pill button (preset row + bottom action row). */
function NavButton({ label, icon, onPress, accent, flipIcon, wide }: ButtonProps) {
  const isAccent = accent === true;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.navBtn,
        wide && styles.navBtnWide,
        isAccent && styles.navBtnAccent,
        hovered && (isAccent ? styles.navBtnAccentHover : styles.navBtnHover),
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={isAccent ? '#0A0A0F' : '#fbbf24'}
        style={flipIcon ? ({ transform: [{ scaleX: -1 }] } as unknown as Record<string, unknown>) : undefined}
      />
      <Text style={[styles.navBtnText, isAccent && styles.navBtnTextAccent]}>{label}</Text>
    </Pressable>
  );
}

/** Big chunky D-pad button — icon-only, large tap target. */
function DpadButton({ label, icon, onPress, accent, wide }: ButtonProps) {
  const isReset = accent === 'reset';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.dpadBtn,
        wide && styles.dpadBtnWide,
        isReset && styles.dpadBtnReset,
        hovered && (isReset ? styles.dpadBtnResetHover : styles.dpadBtnHover),
      ]}
    >
      <Ionicons name={icon} size={isReset ? 18 : 22} color={isReset ? '#0A0A0F' : '#fbbf24'} />
    </Pressable>
  );
}

// ───────────────────────────────────────────────────────────────────────────

const CARD_BG: ViewStyle = {
  backgroundColor: 'rgba(0,0,0,0.78)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.10)',
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 10,
  ...(Platform.OS === 'web'
    ? (({
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
      } as unknown) as ViewStyle)
    : {}),
};

const styles = StyleSheet.create({
  presetCluster: { position: 'absolute', left: 14, bottom: 14 },
  dpadCluster: { position: 'absolute', right: 14, bottom: 14 },
  card: { ...CARD_BG },
  clusterLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'center',
  },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // ─── D-pad ───
  dpadGrid: { alignItems: 'center' },
  dpadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dpadSpacer: { width: 44 },
  dpadBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.30)',
    backgroundColor: 'rgba(251,191,36,0.06)',
    ...(Platform.OS === 'web'
      ? (({ transition: 'border-color 120ms ease-out, background-color 120ms ease-out, transform 80ms ease-out' } as unknown) as ViewStyle)
      : {}),
  },
  dpadBtnHover: {
    borderColor: 'rgba(251,191,36,0.65)',
    backgroundColor: 'rgba(251,191,36,0.14)',
    ...(Platform.OS === 'web' ? (({ transform: 'scale(1.04)' } as unknown) as ViewStyle) : {}),
  },
  dpadBtnWide: { width: 90, height: 36 },
  dpadBtnReset: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  dpadBtnResetHover: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  zoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  // ─── NavButton ───
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.30)',
    backgroundColor: 'rgba(251,191,36,0.06)',
    minHeight: 38,
    ...(Platform.OS === 'web'
      ? (({ transition: 'border-color 120ms ease-out, background-color 120ms ease-out' } as unknown) as ViewStyle)
      : {}),
  },
  navBtnWide: { flex: 1, justifyContent: 'center' },
  navBtnHover: {
    borderColor: 'rgba(251,191,36,0.65)',
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  navBtnAccent: { borderColor: '#fbbf24', backgroundColor: '#fbbf24' },
  navBtnAccentHover: { borderColor: '#f59e0b', backgroundColor: '#f59e0b' },
  navBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.1,
  },
  navBtnTextAccent: { color: '#0A0A0F' },
});
