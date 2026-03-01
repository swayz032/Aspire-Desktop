/**
 * Persona — Animated Agent Orb for Aspire Canvas Chat Mode
 *
 * Voice-first AI agent persona with premium animations and state-driven visuals.
 * Responds to voice interaction states: idle → listening → thinking → speaking → asleep
 *
 * State Machine:
 * - idle: Breathing animation (2s cycle), soft glow
 * - listening: Pulsing blue glow (1s cycle), voice waveform indicator
 * - thinking: Rotating shimmer gradient, pulsing brightness
 * - speaking: Active glow with voice amplitude sync
 * - asleep: Dimmed orb (0.4 opacity), very slow breathing (4s cycle)
 *
 * Agent-Specific Styling:
 * - ava: Purple glow (#A855F7)
 * - finn: Green glow (#10B981)
 * - eli: Blue glow (#3B82F6)
 *
 * Control Bar (opt-in):
 * - 5 state buttons: Idle, Listening, Thinking, Speaking, Asleep
 * - Active button highlighted with agent accent color
 * - Controlled component: fires onStateChange, parent decides
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Pressable, StyleSheet, Text, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors } from '@/constants/tokens';
import type { AgentName } from '@/lib/elevenlabs';

export type PersonaState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'asleep';

interface PersonaProps {
  state: PersonaState;
  variant: AgentName;
  onVoiceInput?: (text: string) => void;
  onVoiceEnd?: () => void;
  /** Show control bar with state buttons (default: false) */
  showControls?: boolean;
  /** Callback when control bar button is pressed (controlled component) */
  onStateChange?: (state: PersonaState) => void;
}

/**
 * Agent-specific glow colors from CanvasTokens
 */
function getGlowColor(variant: AgentName): string {
  switch (variant) {
    case 'ava': return CanvasTokens.glow.ava;
    case 'finn': return CanvasTokens.glow.finn;
    case 'eli': return CanvasTokens.glow.eli;
    default: return CanvasTokens.glow.eli;
  }
}

/**
 * State-specific status text
 */
function getStatusText(state: PersonaState): string {
  switch (state) {
    case 'idle': return 'Ready';
    case 'listening': return 'Listening...';
    case 'thinking': return 'Thinking...';
    case 'speaking': return 'Speaking...';
    case 'asleep': return 'Asleep';
  }
}

/**
 * Voice waveform visualization component
 */
function VoiceWaveform({ color }: { color: string }) {
  const barAnimations = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = barAnimations.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 80),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [barAnimations]);

  return (
    <View style={styles.waveformContainer}>
      {barAnimations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveformBar,
            {
              backgroundColor: color,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Control bar button config
// ---------------------------------------------------------------------------

interface ControlButton {
  state: PersonaState;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const CONTROL_BUTTONS: ControlButton[] = [
  { state: 'idle', icon: 'radio-button-on', label: 'Idle' },
  { state: 'listening', icon: 'mic', label: 'Listen' },
  { state: 'thinking', icon: 'bulb', label: 'Think' },
  { state: 'speaking', icon: 'megaphone', label: 'Speak' },
  { state: 'asleep', icon: 'eye-off', label: 'Sleep' },
];

/**
 * Control bar — horizontal row of state buttons below the orb
 */
function ControlBar({
  currentState,
  glowColor,
  onStateChange,
}: {
  currentState: PersonaState;
  glowColor: string;
  onStateChange: (state: PersonaState) => void;
}) {
  return (
    <View style={styles.controlBar}>
      {CONTROL_BUTTONS.map((btn) => {
        const isActive = btn.state === currentState;
        return (
          <Pressable
            key={btn.state}
            onPress={() => onStateChange(btn.state)}
            style={[
              styles.controlBtn,
              isActive && { backgroundColor: glowColor + '30' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Set state: ${btn.label}`}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={btn.icon}
              size={14}
              color={isActive ? glowColor : 'rgba(255,255,255,0.4)'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Persona component with premium animations and agent-specific styling
 */
export function Persona({
  state,
  variant,
  onVoiceInput,
  onVoiceEnd,
  showControls = false,
  onStateChange,
}: PersonaProps) {
  const breathScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.6)).current;
  const rotationDegree = useRef(new Animated.Value(0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0)).current;
  const orbOpacity = useRef(new Animated.Value(1)).current;

  const glowColor = getGlowColor(variant);

  // Breathing animation (idle + asleep — asleep is slower)
  useEffect(() => {
    if (state === 'idle' || state === 'asleep') {
      const duration = state === 'asleep' ? 2000 : 1000;
      const scale = state === 'asleep' ? 1.02 : 1.05;

      const breathAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScale, {
            toValue: scale,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(breathScale, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
        ])
      );
      breathAnim.start();
      return () => breathAnim.stop();
    }
  }, [state, breathScale]);

  // Orb opacity (asleep = dimmed)
  useEffect(() => {
    Animated.timing(orbOpacity, {
      toValue: state === 'asleep' ? 0.4 : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [state, orbOpacity]);

  // Pulsing glow (listening/speaking)
  useEffect(() => {
    if (state === 'listening') {
      const pulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseAnim.start();
      return () => pulseAnim.stop();
    } else if (state === 'speaking') {
      const speakAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.9, duration: 600, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
        ])
      );
      speakAnim.start();
      return () => speakAnim.stop();
    } else if (state === 'asleep') {
      Animated.timing(glowOpacity, { toValue: 0.2, duration: 400, useNativeDriver: true }).start();
    } else {
      Animated.timing(glowOpacity, { toValue: 0.6, duration: 300, useNativeDriver: true }).start();
    }
  }, [state, glowOpacity]);

  // Rotating shimmer (thinking)
  useEffect(() => {
    if (state === 'thinking') {
      const rotateAnim = Animated.loop(
        Animated.timing(rotationDegree, { toValue: 360, duration: 3000, useNativeDriver: true })
      );
      const shimmerAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
          Animated.timing(shimmerOpacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        ])
      );
      rotateAnim.start();
      shimmerAnim.start();
      return () => { rotateAnim.stop(); shimmerAnim.stop(); };
    } else {
      Animated.timing(rotationDegree, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      Animated.timing(shimmerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [state, rotationDegree, shimmerOpacity]);

  const rotation = rotationDegree.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  // Gradient colors based on agent variant
  const gradientColors: readonly [string, string, string] = (() => {
    switch (variant) {
      case 'ava': return ['#7C3AED', '#A855F7', '#C084FC'] as const;
      case 'finn': return ['#059669', '#10B981', '#34D399'] as const;
      case 'eli': return ['#2563EB', '#3B82F6', '#60A5FA'] as const;
      default: return ['#2563EB', '#3B82F6', '#60A5FA'] as const;
    }
  })();

  // Web-specific glow
  const webGlowStyle = Platform.OS === 'web' ? ({
    boxShadow: `0 0 ${state === 'asleep' ? 10 : 40}px ${glowColor}`,
    filter: state === 'thinking' ? 'brightness(1.2)' : state === 'asleep' ? 'brightness(0.6)' : 'brightness(1)',
  } as unknown as Record<string, string>) : {};

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.orb,
          {
            transform: [{ scale: breathScale }, { rotate: rotation }],
            opacity: orbOpacity,
          },
          Platform.OS !== 'web' && {
            shadowColor: glowColor,
            shadowOpacity: glowOpacity as any,
            shadowRadius: state === 'asleep' ? 10 : 40,
            shadowOffset: { width: 0, height: 0 },
          },
          webGlowStyle,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Shimmer overlay for thinking state */}
        {state === 'thinking' && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity }]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        )}
      </Animated.View>

      {/* Voice waveform indicator (listening only) */}
      {state === 'listening' && <VoiceWaveform color={glowColor} />}

      {/* Status text */}
      <Text style={[styles.statusText, state === 'asleep' && styles.statusTextDimmed]}>
        {getStatusText(state)}
      </Text>

      {/* Control bar (opt-in) */}
      {showControls && onStateChange && (
        <ControlBar
          currentState={state}
          glowColor={glowColor}
          onStateChange={onStateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  orb: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    height: 40,
  },
  waveformBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  statusText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  statusTextDimmed: {
    color: Colors.text.muted,
  },

  // --- Control Bar ---
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 20,
    backgroundColor: '#1A1A1C',
    borderRadius: 8,
    padding: 4,
    ...(Platform.OS === 'web'
      ? ({ userSelect: 'none' } as unknown as ViewStyle)
      : {}),
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background-color 0.15s ease' } as unknown as ViewStyle)
      : {}),
  },
});
