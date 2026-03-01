/**
 * Persona — Animated Agent Orb for Aspire Canvas Chat Mode
 *
 * Voice-first AI agent persona with premium animations and state-driven visuals.
 * Responds to voice interaction states: idle → listening → thinking → speaking → idle
 *
 * Pattern: Extends AvaOrbVideo component pattern with multi-state support
 * Design: $10K aesthetic matching CanvasTokens premium visual language
 *
 * State Machine:
 * - idle: Breathing animation (2s cycle), soft glow
 * - listening: Pulsing blue glow (1s cycle), voice waveform indicator
 * - thinking: Rotating shimmer gradient, pulsing brightness
 * - speaking: Active glow with voice amplitude sync
 *
 * Agent-Specific Styling:
 * - ava: Purple glow (#A855F7)
 * - finn: Green glow (#10B981)
 * - eli: Blue glow (#3B82F6)
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors } from '@/constants/tokens';
import type { AgentName } from '@/lib/elevenlabs';

export type PersonaState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface PersonaProps {
  state: PersonaState;
  variant: AgentName;
  onVoiceInput?: (text: string) => void;
  onVoiceEnd?: () => void;
}

/**
 * Agent-specific glow colors from CanvasTokens
 */
function getGlowColor(variant: AgentName): string {
  switch (variant) {
    case 'ava': return CanvasTokens.glow.ava;
    case 'finn': return CanvasTokens.glow.finn;
    case 'eli': return CanvasTokens.glow.eli;
    default: return CanvasTokens.glow.eli; // Default to blue
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
  }
}

/**
 * Voice waveform visualization component
 * Displays 6 animated vertical bars that pulse with voice activity
 */
function VoiceWaveform({ color }: { color: string }) {
  const barAnimations = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    // Staggered bar animations for natural waveform feel
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

/**
 * Persona component with premium animations and agent-specific styling
 */
export function Persona({ state, variant, onVoiceInput, onVoiceEnd }: PersonaProps) {
  const breathScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.6)).current;
  const rotationDegree = useRef(new Animated.Value(0)).current;
  const shimmerOpacity = useRef(new Animated.Value(0)).current;

  const glowColor = getGlowColor(variant);

  // Breathing animation (idle)
  useEffect(() => {
    if (state === 'idle') {
      const breathAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScale, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(breathScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      breathAnim.start();
      return () => breathAnim.stop();
    }
  }, [state, breathScale]);

  // Pulsing glow (listening/speaking)
  useEffect(() => {
    if (state === 'listening') {
      // Faster pulse for listening state
      const pulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

      pulseAnim.start();
      return () => pulseAnim.stop();
    } else if (state === 'speaking') {
      // Slower, more active pulse for speaking
      const speakAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.9,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.5,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );

      speakAnim.start();
      return () => speakAnim.stop();
    } else {
      // Reset to default for idle/thinking
      Animated.timing(glowOpacity, {
        toValue: 0.6,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [state, glowOpacity]);

  // Rotating shimmer gradient (thinking)
  useEffect(() => {
    if (state === 'thinking') {
      const rotateAnim = Animated.loop(
        Animated.timing(rotationDegree, {
          toValue: 360,
          duration: 3000,
          useNativeDriver: true,
        })
      );

      const shimmerAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerOpacity, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerOpacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );

      rotateAnim.start();
      shimmerAnim.start();

      return () => {
        rotateAnim.stop();
        shimmerAnim.stop();
      };
    } else {
      // Reset rotation and shimmer
      Animated.timing(rotationDegree, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      Animated.timing(shimmerOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [state, rotationDegree, shimmerOpacity]);

  const rotation = rotationDegree.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  // Gradient colors based on agent variant
  const gradientColors: readonly [string, string, string] = (() => {
    switch (variant) {
      case 'ava':
        return ['#7C3AED', '#A855F7', '#C084FC'] as const; // Purple gradient
      case 'finn':
        return ['#059669', '#10B981', '#34D399'] as const; // Green gradient
      case 'eli':
        return ['#2563EB', '#3B82F6', '#60A5FA'] as const; // Blue gradient
      default:
        return ['#2563EB', '#3B82F6', '#60A5FA'] as const;
    }
  })();

  // Web-specific glow effect
  const webGlowStyle = Platform.OS === 'web' ? ({
    boxShadow: `0 0 ${40 * (glowOpacity as any)._value}px ${glowColor}`,
    filter: state === 'thinking' ? 'brightness(1.2)' : 'brightness(1)',
  } as unknown as Record<string, string>) : {};

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.orb,
          {
            transform: [{ scale: breathScale }, { rotate: rotation }],
            opacity: 1,
          },
          Platform.OS !== 'web' && {
            shadowColor: glowColor,
            shadowOpacity: glowOpacity as any,
            shadowRadius: 40,
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
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: shimmerOpacity,
              },
            ]}
          >
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
      <Text style={styles.statusText}>{getStatusText(state)}</Text>
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
});
