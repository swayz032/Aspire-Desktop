import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';

const avaLogo = require('../../assets/images/ava-logo.png');

export type RoomAvaState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface RoomAvaTileProps {
  state: RoomAvaState;
  listeningTo?: string;
  onPress?: () => void;
  onStopListening?: () => void;
  width?: number;
  height?: number;
}

export function RoomAvaTile({
  state,
  listeningTo,
  onPress,
  onStopListening,
  width = 200,
  height = 150,
}: RoomAvaTileProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }
      pulseAnim.setValue(1);
    }

    return () => {
      if (pulseLoopRef.current) pulseLoopRef.current.stop();
    };
  }, [state]);

  const logoSize = Math.min(width, height) * 0.75;
  
  const getStatusColor = () => {
    switch (state) {
      case 'listening': return '#3B82F6';
      case 'speaking': return '#4ade80';
      case 'thinking': return '#A78BFA';
      default: return '#4ade80';
    }
  };

  const isActive = state !== 'idle';

  return (
    <Pressable 
      style={[styles.container, { width, height }]}
      onPress={onPress}
    >
      <View style={styles.background}>
        <Animated.View 
          style={[
            { 
              width: logoSize,
              height: logoSize,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pulseAnim }],
            },
            isActive && { 
              shadowColor: getStatusColor(),
              shadowOpacity: 0.6,
              shadowRadius: 20,
            }
          ]}
        >
          <Image 
            source={avaLogo}
            style={{ width: logoSize, height: logoSize }}
            contentFit="contain"
          />
        </Animated.View>

        <View style={styles.labelContainer}>
          <Text style={styles.assistantName}>Ava - Room Assistant</Text>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  background: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assistantName: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
