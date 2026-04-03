/**
 * NoraTile — full-size Nora AI participant tile for the video conference grid.
 * Same dimensions as ZoomVideoTile. Shows animated avatar with state-based glow,
 * audio bars when speaking, and AI badge. Click toggles Nora voice session.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/tokens';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';

const noraAvatar = require('../../assets/images/ava-logo.png');

interface NoraTileProps {
  avaState: RoomAvaState;
  isNoraSpeaking: boolean;
  onPress: () => void;
}

export function NoraTile({ avaState, isNoraSpeaking, onPress }: NoraTileProps) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const ringAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const ringLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';

  useEffect(() => {
    if (isActive) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 1200, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 1200, useNativeDriver: false }),
        ])
      );
      pulseLoopRef.current.start();

      ringLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1.06, duration: 1600, useNativeDriver: false }),
          Animated.timing(ringAnim, { toValue: 1, duration: 1600, useNativeDriver: false }),
        ])
      );
      ringLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      ringLoopRef.current?.stop();
      pulseAnim.setValue(0.3);
      ringAnim.setValue(1);
    }
    return () => {
      pulseLoopRef.current?.stop();
      ringLoopRef.current?.stop();
    };
  }, [isActive]);

  const glowColor = avaState === 'listening' ? '#3B82F6'
    : avaState === 'thinking' ? '#A78BFA'
    : avaState === 'speaking' ? '#22C55E'
    : '#3B82F6';

  const statusText = avaState === 'listening' ? 'Listening...'
    : avaState === 'thinking' ? 'Thinking...'
    : avaState === 'speaking' ? 'Speaking...'
    : 'Ready';

  // Simple audio bar heights — animated via pulse
  const barHeights = [12, 18, 24, 18, 12];

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Nora AI assistant, ${statusText}. Tap to ${isNoraSpeaking ? 'stop' : 'start'}.`}
    >
      <LinearGradient colors={['#0B1020', '#0F172A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        {/* Glow ring */}
        <Animated.View style={[
          styles.glowRing,
          {
            transform: [{ scale: ringAnim }],
            borderColor: glowColor,
          },
          Platform.OS === 'web' && {
            boxShadow: isActive
              ? `0 0 24px ${glowColor}55, 0 0 48px ${glowColor}22`
              : `0 0 12px ${glowColor}33`,
          } as any,
        ]}>
          <Animated.View style={[styles.avatarContainer, { opacity: Animated.add(0.6, pulseAnim) }]}>
            <Image source={noraAvatar} style={styles.avatar} contentFit="contain" />
          </Animated.View>
        </Animated.View>

        {/* Audio bars when speaking */}
        {isNoraSpeaking && (
          <View style={styles.audioBars}>
            {barHeights.map((h, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.audioBar,
                  {
                    height: h,
                    backgroundColor: glowColor,
                    opacity: pulseAnim,
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Bottom label overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.bottomOverlay}
        >
          <View style={styles.labelRow}>
            <Text style={styles.name}>Nora</Text>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={8} color="#3B82F6" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: glowColor }]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0a0a0c',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  avatar: {
    width: 56,
    height: 56,
  },
  audioBars: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 12,
    alignItems: 'flex-end',
    height: 24,
  },
  audioBar: {
    width: 4,
    borderRadius: 2,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3B82F6',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
});
