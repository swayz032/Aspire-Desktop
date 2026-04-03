/**
 * NoraTile — full-size Nora AI participant tile for the video conference grid.
 * Matches the original Nora design: black box with cyan glow border,
 * inner black square with Ava logo, "Nora - Room Assistant" label.
 * Click toggles Nora voice session.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
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
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';

  useEffect(() => {
    if (isActive) {
      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 1400, useNativeDriver: false }),
        ])
      );
      glowLoopRef.current.start();
    } else {
      glowLoopRef.current?.stop();
      glowAnim.setValue(0.4);
    }
    return () => { glowLoopRef.current?.stop(); };
  }, [isActive]);

  const glowColor = avaState === 'listening' ? '#3B82F6'
    : avaState === 'thinking' ? '#A78BFA'
    : avaState === 'speaking' ? '#4ade80'
    : '#3B82F6';

  const statusText = avaState === 'listening' ? 'Listening...'
    : avaState === 'thinking' ? 'Thinking...'
    : avaState === 'speaking' ? 'Speaking...'
    : 'Ready';

  const statusDotColor = isNoraSpeaking ? '#4ade80' : glowColor;

  // Outer border glow: cyan with animated intensity
  const outerGlow = isActive
    ? `0 0 12px 4px ${glowColor}80, 0 0 25px 8px ${glowColor}40, inset 0 0 6px ${glowColor}30`
    : `0 0 8px 2px rgba(59,130,246,0.3), 0 0 15px 3px rgba(0,242,254,0.15)`;

  // Inner box glow
  const innerGlow = isActive
    ? `0 0 10px 3px ${glowColor}60, 0 0 20px 6px ${glowColor}25`
    : `0 0 6px 2px rgba(59,130,246,0.25), 0 0 12px 3px rgba(0,242,254,0.1)`;

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Nora Room Assistant, ${statusText}. Tap to ${isNoraSpeaking ? 'stop' : 'start'}.`}
    >
      {/* Outer tile — solid black with glow border */}
      <Animated.View style={[
        styles.outerBox,
        {
          borderColor: glowColor,
          opacity: Animated.add(new Animated.Value(0.6), Animated.multiply(glowAnim, new Animated.Value(0.4))),
        },
        Platform.OS === 'web' && { boxShadow: outerGlow } as any,
      ]}>
        {/* Inner box — smaller black square with glow border + logo */}
        <View style={[
          styles.innerBox,
          { borderColor: glowColor },
          Platform.OS === 'web' && { boxShadow: innerGlow } as any,
        ]}>
          <Image source={noraAvatar} style={styles.logo} contentFit="contain" />
        </View>
      </Animated.View>

      {/* Bottom label — outside the glow box, at bottom of tile */}
      <View style={styles.labelBar}>
        <Text style={styles.nameLabel}>Nora - Room Assistant</Text>
        <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerBox: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
    backgroundColor: '#000000',
  },
  innerBox: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 64,
    height: 64,
  },
  labelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  nameLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
