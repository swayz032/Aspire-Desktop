/**
 * NoraTile — Nora AI participant tile for the video conference grid.
 *
 * Design: Pure black tile. Nora's real photo (small circle, ~90px, no border/ring)
 * centered. Bright ambient glow cycles through Aspire brand colors continuously
 * (blue → amber → cyan → green → purple) even when idle. Intensifies on active.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/tokens';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';

const noraPhoto = require('../../assets/images/nora-avatar-photo.png');

// Aspire brand color cycle — blue, amber, cyan, green, purple
const GLOW_COLORS = [
  '59,130,246',   // Aspire blue
  '245,158,11',   // Amber yellow
  '6,182,212',    // Cyan
  '74,222,128',   // Green
  '167,139,250',  // Purple
];

interface NoraTileProps {
  avaState: RoomAvaState;
  isNoraSpeaking: boolean;
  onPress: () => void;
}

export function NoraTile({ avaState, isNoraSpeaking, onPress }: NoraTileProps) {
  const colorIndexRef = useRef(0);
  const containerRef = useRef<any>(null);

  const isActive = avaState === 'listening' || avaState === 'thinking' || avaState === 'speaking';

  // Cycle glow colors continuously via CSS animation on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    // Inject keyframes for color-cycling glow
    if (!document.getElementById('nora-glow-keyframes')) {
      const style = document.createElement('style');
      style.id = 'nora-glow-keyframes';
      style.textContent = `
        @keyframes noraGlowCycle {
          0%, 100% { box-shadow: 0 0 30px rgba(59,130,246,0.35), 0 0 60px rgba(59,130,246,0.15), 0 0 90px rgba(59,130,246,0.05); }
          20% { box-shadow: 0 0 30px rgba(245,158,11,0.35), 0 0 60px rgba(245,158,11,0.15), 0 0 90px rgba(245,158,11,0.05); }
          40% { box-shadow: 0 0 30px rgba(6,182,212,0.35), 0 0 60px rgba(6,182,212,0.15), 0 0 90px rgba(6,182,212,0.05); }
          60% { box-shadow: 0 0 30px rgba(74,222,128,0.35), 0 0 60px rgba(74,222,128,0.15), 0 0 90px rgba(74,222,128,0.05); }
          80% { box-shadow: 0 0 30px rgba(167,139,250,0.35), 0 0 60px rgba(167,139,250,0.15), 0 0 90px rgba(167,139,250,0.05); }
        }
        @keyframes noraGlowCycleActive {
          0%, 100% { box-shadow: 0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.25), 0 0 120px rgba(59,130,246,0.1); }
          20% { box-shadow: 0 0 40px rgba(245,158,11,0.5), 0 0 80px rgba(245,158,11,0.25), 0 0 120px rgba(245,158,11,0.1); }
          40% { box-shadow: 0 0 40px rgba(6,182,212,0.5), 0 0 80px rgba(6,182,212,0.25), 0 0 120px rgba(6,182,212,0.1); }
          60% { box-shadow: 0 0 40px rgba(74,222,128,0.5), 0 0 80px rgba(74,222,128,0.25), 0 0 120px rgba(74,222,128,0.1); }
          80% { box-shadow: 0 0 40px rgba(167,139,250,0.5), 0 0 80px rgba(167,139,250,0.25), 0 0 120px rgba(167,139,250,0.1); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
      {/* Inner box — ambient glow cycles through brand colors */}
      <View
        ref={containerRef}
        style={[
          styles.innerBox,
          Platform.OS === 'web' && {
            animationName: isActive ? 'noraGlowCycleActive' : 'noraGlowCycle',
            animationDuration: '8s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          } as any,
        ]}
      >
        {/* Nora photo — small circle, no ring, no border */}
        <Image
          source={noraPhoto}
          style={styles.photo}
          contentFit="cover"
        />
      </View>

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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: 140,
    height: 140,
    borderRadius: 70,
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
