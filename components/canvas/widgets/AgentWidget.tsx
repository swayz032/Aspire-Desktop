import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { VoiceStatus } from '@/hooks/useAgentVoice';

interface AgentWidgetProps {
  agentId: string;
  suiteId: string;
  officeId: string;
  voiceStatus?: VoiceStatus;
  onPrimaryAction?: () => void;
}

const AGENT_META: Record<string, { name: string; subtitle: string; orbA: [string, string, string]; orbB: [string, string, string] }> = {
  ava: {
    name: 'Ava',
    subtitle: 'Executive AI Assistant',
    orbA: ['#60A5FA', '#8B5CF6', '#1D4ED8'],
    orbB: ['#A78BFA', '#38BDF8', '#1D4ED8'],
  },
  eli: {
    name: 'Eli',
    subtitle: 'Communications and Inbox',
    orbA: ['#FDE68A', '#22C55E', '#84CC16'],
    orbB: ['#22C55E', '#FACC15', '#0F766E'],
  },
  finn: {
    name: 'Finn',
    subtitle: 'Finance and Accounting',
    orbA: ['#38BDF8', '#6366F1', '#0EA5E9'],
    orbB: ['#818CF8', '#06B6D4', '#1D4ED8'],
  },
};

function statusLabel(status?: VoiceStatus): string {
  if (status === 'listening') return 'Listening';
  if (status === 'thinking') return 'Thinking';
  if (status === 'speaking') return 'Speaking';
  if (status === 'error') return 'Reconnect needed';
  return 'Ready';
}

export function AgentWidget({ agentId, voiceStatus = 'idle', onPrimaryAction }: AgentWidgetProps) {
  const meta = AGENT_META[agentId] || AGENT_META.ava;
  const orbFloat = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat, { toValue: -4, duration: 1800, useNativeDriver: true }),
        Animated.timing(orbFloat, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [orbFloat]);

  useEffect(() => {
    const active = voiceStatus === 'listening' || voiceStatus === 'speaking' || voiceStatus === 'thinking';
    if (active) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(orbPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
      const progressLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, { toValue: 0.94, duration: 1300, useNativeDriver: false }),
          Animated.timing(progress, { toValue: 0.28, duration: 1300, useNativeDriver: false }),
        ]),
      );
      pulseLoop.start();
      progressLoop.start();
      return () => {
        pulseLoop.stop();
        progressLoop.stop();
      };
    }

    Animated.timing(orbPulse, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.timing(progress, { toValue: 0.2, duration: 300, useNativeDriver: false }).start();
  }, [voiceStatus, orbPulse, progress]);

  const isActive = voiceStatus !== 'idle' && voiceStatus !== 'error';

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.orbStage, { transform: [{ translateY: orbFloat }] }]}>
        <Animated.View style={[styles.orbGlow, { transform: [{ scale: orbPulse }] }]} />
        <Animated.View style={[styles.orbShell, { transform: [{ scale: orbPulse }] }]}>
          <LinearGradient
            colors={meta.orbA}
            start={{ x: 0.15, y: 0.15 }}
            end={{ x: 0.85, y: 0.85 }}
            style={styles.orbMain}
          >
            <LinearGradient
              colors={meta.orbB}
              start={{ x: 0.7, y: 0.2 }}
              end={{ x: 0.2, y: 0.9 }}
              style={styles.orbInnerSwirl}
            />
            <View style={styles.orbHighlight} />
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      <Text style={styles.agentName}>{meta.name}</Text>
      <Text style={styles.agentSubtitle}>{meta.subtitle}</Text>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>

      <Text style={styles.voiceState}>{statusLabel(voiceStatus)}</Text>

      <View style={styles.controlsRow}>
        <Pressable
          style={({ pressed }) => [styles.primaryControl, pressed && styles.primaryControlPressed]}
          onPress={onPrimaryAction}
          accessibilityRole="button"
          accessibilityLabel={isActive ? `Stop ${meta.name} voice session` : `Start ${meta.name} voice session`}
        >
          <Ionicons name={isActive ? 'stop' : 'mic'} size={16} color="#F8FAFC" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)' } as unknown as ViewStyle)
      : {}),
  },
  orbStage: {
    marginTop: 2,
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGlow: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(56,189,248,0.24)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(20px)' } as unknown as ViewStyle) : {}),
  },
  orbShell: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    overflow: 'hidden',
  },
  orbMain: {
    flex: 1,
    borderRadius: 52,
  },
  orbInnerSwirl: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    bottom: 12,
    borderRadius: 42,
    opacity: 0.7,
  },
  orbHighlight: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 54,
    height: 22,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '-18deg' }],
  },
  agentName: {
    marginTop: 6,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  agentSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: 10,
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  voiceState: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.74)',
    fontSize: 10,
    fontWeight: '600',
  },
  controlsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryControl: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  primaryControlPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
