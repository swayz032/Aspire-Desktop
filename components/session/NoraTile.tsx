/**
 * NoraTile — full-size Nora AI participant tile for the video conference grid.
 * Immersive black design: inner box fills most of the tile, no visible borders,
 * new Aspire arrow logo centered, subtle cyan glow on active states.
 * "Nora - Room Assistant" label with status dot at bottom.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Spacing } from '@/constants/tokens';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';

const aspireLogo = require('../../assets/images/aspire-arrow-logo.png');

interface NoraTileProps {
  avaState: RoomAvaState;
  isNoraSpeaking: boolean;
  onPress: () => void;
}

export function NoraTile({ avaState, isNoraSpeaking, onPress }: NoraTileProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';

  useEffect(() => {
    if (isActive) {
      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1400, useNativeDriver: false }),
        ])
      );
      glowLoopRef.current.start();
    } else {
      glowLoopRef.current?.stop();
      glowAnim.setValue(0);
    }
    return () => { glowLoopRef.current?.stop(); };
  }, [isActive]);

  const glowColor = avaState === 'listening' ? 'rgba(59,130,246,0.4)'
    : avaState === 'thinking' ? 'rgba(167,139,250,0.4)'
    : avaState === 'speaking' ? 'rgba(74,222,128,0.4)'
    : 'rgba(59,130,246,0.15)';

  const statusText = avaState === 'listening' ? 'Listening...'
    : avaState === 'thinking' ? 'Thinking...'
    : avaState === 'speaking' ? 'Speaking...'
    : 'Ready';

  const statusDotColor = isNoraSpeaking ? '#4ade80'
    : avaState === 'listening' ? '#3B82F6'
    : avaState === 'thinking' ? '#A78BFA'
    : '#4ade80';

  // Subtle ambient glow only when active — no borders
  const activeGlow = isActive
    ? `0 0 60px ${glowColor}, 0 0 120px ${glowColor}`
    : 'none';

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Nora Room Assistant, ${statusText}. Tap to ${isNoraSpeaking ? 'stop' : 'start'}.`}
    >
      {/* Full-tile black background — immersive */}
      <View style={styles.background}>
        {/* Inner box — fills 80% of tile, no border, pure black */}
        <Animated.View style={[
          styles.innerBox,
          Platform.OS === 'web' && isActive && {
            boxShadow: activeGlow,
          } as any,
        ]}>
          <Image source={aspireLogo} style={styles.logo} contentFit="contain" />
        </Animated.View>
      </View>

      {/* Bottom label bar */}
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
  },
  background: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerBox: {
    width: '70%',
    aspectRatio: 1,
    maxWidth: 280,
    maxHeight: 280,
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '65%',
    height: '65%',
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
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  nameLabel: {
    fontSize: 14,
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
