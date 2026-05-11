/**
 * ReceptionistStage — the live persona stage (spec §9).
 *
 * Mirrors `components/desktop/AvaDeskPanel.tsx` Voice/Video TabButton
 * pattern (lines 1057-1063 of AvaDeskPanel) and the voice-surface
 * black-bg styles (lines 1131-1185). Persona-aware: labels read
 * "Voice with {personaName}" / "Video with {personaName}".
 *
 * Pass 1 deliverables:
 *   - Voice mode: renders `<TiffanySarahOrbVideo />` on a pitch-black `#000`
 *     parent (transparent video over solid black, matches Voice with Ava).
 *   - Video mode: PLACEHOLDER ("coming in Pass 4"). Pass 4 will wire Anam.
 *   - Bottom controls: mic / video / end (red) / expand. No keypad,
 *     no activity list, no message composer (forbidden by spec §9).
 *
 * The Dial Pad is NEVER inside this component (spec §11 + §20).
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { TiffanySarahOrbVideo } from './TiffanySarahOrbVideo';

type StageMode = 'voice' | 'video';

interface ReceptionistStageProps {
  personaName: string;
}

export function ReceptionistStage({ personaName }: ReceptionistStageProps) {
  const [mode, setMode] = useState<StageMode>('voice');
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.headerTitle}>Receptionist</Text>
          <Text style={styles.headerPersona}>· {personaName}</Text>
        </View>
        <View style={styles.tabs}>
          <TabButton
            label={`Voice with ${personaName}`}
            icon="mic-outline"
            active={mode === 'voice'}
            onPress={() => setMode('voice')}
          />
          <TabButton
            label={`Video with ${personaName}`}
            icon="videocam-outline"
            active={mode === 'video'}
            onPress={() => setMode('video')}
          />
        </View>
      </View>

      <View style={[styles.surface, expanded && styles.surfaceExpanded]}>
        {mode === 'voice' ? (
          <View style={styles.voiceSurface}>
            <View style={styles.orbWrap}>
              <TiffanySarahOrbVideo state="idle" size={260} personaName={personaName} />
              <Text style={styles.idleHint}>Tap mic to talk with {personaName}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.videoPlaceholder}>
            <View style={styles.videoPlaceholderInner}>
              <Ionicons name="videocam-outline" size={32} color="rgba(255,255,255,0.4)" />
              <Text style={styles.videoPlaceholderTitle}>Video with {personaName}</Text>
              <Text style={styles.videoPlaceholderHint}>Coming in Pass 4 — Anam wiring</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <ControlBtn
          icon={micOn ? 'mic' : 'mic-off'}
          active={micOn}
          onPress={() => setMicOn((v) => !v)}
          accessibilityLabel={micOn ? 'Mute microphone' : 'Unmute microphone'}
        />
        <ControlBtn
          icon={videoOn ? 'videocam' : 'videocam-off'}
          active={videoOn}
          onPress={() => setVideoOn((v) => !v)}
          accessibilityLabel={videoOn ? 'Turn off camera' : 'Turn on camera'}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`End call with ${personaName}`}
          onPress={() => {
            setMicOn(false);
            setVideoOn(false);
          }}
          style={({ pressed }: any) => [styles.endBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="call" size={20} color="#fff" />
        </Pressable>
        <ControlBtn
          icon={expanded ? 'contract-outline' : 'expand-outline'}
          active={false}
          onPress={() => setExpanded((v) => !v)}
          accessibilityLabel={expanded ? 'Collapse stage' : 'Expand stage'}
        />
      </View>
    </View>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered }: any) => [
        styles.tabBtn,
        active && styles.tabBtnActive,
        hovered && !active && styles.tabBtnHover,
      ]}
    >
      <Ionicons name={icon} size={14} color={active ? Colors.accent.cyan : Colors.text.tertiary} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ControlBtn({
  icon,
  active,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, hovered }: any) => [
        styles.circleBtn,
        active && styles.circleBtnActive,
        hovered && styles.circleBtnHover,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? '#fff' : Colors.text.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34c759',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 6px rgba(52,199,89,0.7)' } as any)
      : {}),
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerPersona: {
    color: Colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background 0.15s ease' } as any)
      : {}),
  },
  tabBtnActive: {
    backgroundColor: '#242426',
  },
  tabBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text.primary,
  },
  surface: {
    backgroundColor: '#000',
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  surfaceExpanded: {
    minHeight: 520,
  },
  voiceSurface: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  idleHint: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  videoPlaceholder: {
    flex: 1,
    width: '100%',
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderInner: {
    alignItems: 'center',
    gap: 10,
  },
  videoPlaceholderTitle: {
    color: Colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  videoPlaceholderHint: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background 0.15s ease' } as any)
      : {}),
  },
  circleBtnActive: {
    backgroundColor: '#3B82F6',
  },
  circleBtnHover: {
    backgroundColor: '#3a3a3c',
  },
  endBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(255,59,48,0.4)',
          transition: 'transform 0.15s ease',
        } as any)
      : {}),
  },
});
