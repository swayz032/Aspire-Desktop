import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';

interface AvaVoiceStripProps {
  participantName: string;
  isActive?: boolean;
  isSpeaking?: boolean;
  taskCount?: number;
}

export function AvaVoiceStrip({ 
  participantName, 
  isActive = true, 
  isSpeaking = false,
  taskCount = 0 
}: AvaVoiceStripProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0.3)).current;
  const waveAnim2 = useRef(new Animated.Value(0.5)).current;
  const waveAnim3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isSpeaking) {
      const createWaveAnimation = (anim: Animated.Value, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration,
              useNativeDriver: false,
            }),
          ])
        );
      };

      const wave1 = createWaveAnimation(waveAnim1, 300);
      const wave2 = createWaveAnimation(waveAnim2, 400);
      const wave3 = createWaveAnimation(waveAnim3, 350);

      wave1.start();
      wave2.start();
      wave3.start();

      return () => {
        wave1.stop();
        wave2.stop();
        wave3.stop();
      };
    } else {
      waveAnim1.setValue(0.3);
      waveAnim2.setValue(0.5);
      waveAnim3.setValue(0.4);
    }
  }, [isSpeaking]);

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [isActive]);

  return (
    <View style={styles.container}>
      <View style={styles.avaIndicator}>
        <Animated.View 
          style={[
            styles.avaDot,
            isActive && { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <Ionicons name="sparkles" size={10} color={Colors.accent.cyan} />
        </Animated.View>
        <Text style={styles.avaLabel}>Ava for {participantName.split(' ')[0]}</Text>
      </View>

      {isSpeaking && (
        <View style={styles.waveContainer}>
          <Animated.View 
            style={[styles.waveBar, { transform: [{ scaleY: waveAnim1 }] }]} 
          />
          <Animated.View 
            style={[styles.waveBar, { transform: [{ scaleY: waveAnim2 }] }]} 
          />
          <Animated.View 
            style={[styles.waveBar, { transform: [{ scaleY: waveAnim3 }] }]} 
          />
          <Animated.View 
            style={[styles.waveBar, { transform: [{ scaleY: waveAnim1 }] }]} 
          />
        </View>
      )}

      {taskCount > 0 && (
        <View style={styles.taskBadge}>
          <Text style={styles.taskCount}>{taskCount}</Text>
        </View>
      )}

      <View style={[styles.statusDot, isActive ? styles.statusActive : styles.statusInactive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  avaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avaDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 206, 209, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.accent.cyan,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 12,
  },
  waveBar: {
    width: 2,
    height: 12,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 1,
  },
  taskBadge: {
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 14,
    alignItems: 'center',
  },
  taskCount: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusActive: {
    backgroundColor: Colors.semantic.success,
  },
  statusInactive: {
    backgroundColor: Colors.text.muted,
  },
});
