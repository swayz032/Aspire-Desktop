/**
 * NoraTile — Nora AI participant tile for the video conference grid.
 *
 * Design: Pure black (#000) tile. Large inner black box fills ~85% of tile.
 * Nora's real photo in a circle centered in the box — NO ring, NO border,
 * seamlessly blends into the black. Ambient glow breathes continuously
 * even when idle (color shifts by state). "Nora - Room Assistant" label.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/tokens';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';

const noraPhoto = require('../../assets/images/nora-avatar-photo.png');

interface NoraTileProps {
  avaState: RoomAvaState;
  isNoraSpeaking: boolean;
  onPress: () => void;
}

export function NoraTile({ avaState, isNoraSpeaking, onPress }: NoraTileProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Ambient glow breathes ALWAYS — even when idle
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2400, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2400, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Glow color changes by state
  const glowColor = avaState === 'listening' ? '59,130,246'    // blue
    : avaState === 'thinking' ? '167,139,250'                   // purple
    : avaState === 'speaking' ? '74,222,128'                     // green
    : '59,130,246';                                               // blue (idle)

  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';

  // Stronger glow when active, subtle when idle
  const idleGlow = `0 0 40px rgba(${glowColor},0.08), 0 0 80px rgba(${glowColor},0.04)`;
  const activeGlow = `0 0 50px rgba(${glowColor},0.2), 0 0 100px rgba(${glowColor},0.1), 0 0 150px rgba(${glowColor},0.05)`;

  const statusText = avaState === 'listening' ? 'Listening...'
    : avaState === 'thinking' ? 'Thinking...'
    : avaState === 'speaking' ? 'Speaking...'
    : 'Ready';

  const statusDotColor = isNoraSpeaking ? '#4ade80'
    : avaState === 'listening' ? '#3B82F6'
    : avaState === 'thinking' ? '#A78BFA'
    : '#4ade80';

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Nora Room Assistant, ${statusText}`}
    >
      {/* Pure black background */}
      <Animated.View style={[
        styles.innerBox,
        Platform.OS === 'web' && {
          boxShadow: isActive ? activeGlow : idleGlow,
          transition: 'box-shadow 1.2s ease',
        } as any,
      ]}>
        {/* Nora photo — circle, no border, no ring, seamless on black */}
        <Image
          source={noraPhoto}
          style={styles.photo}
          contentFit="cover"
        />
      </Animated.View>

      {/* Bottom label */}
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
  innerBox: {
    flex: 1,
    margin: '7%' as any,
    backgroundColor: '#000000',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    // No border, no ring — seamless circle on black
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
