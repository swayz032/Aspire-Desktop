import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

interface AnimatedMicButtonProps {
  isAvaSpeaking?: boolean;
  isListening?: boolean;
}

export function AnimatedMicButton({ isAvaSpeaking = false, isListening = false }: AnimatedMicButtonProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAvaSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else if (isListening) {
      glowAnim.stopAnimation();
      pulseAnim.stopAnimation();
      Animated.timing(glowAnim, {
        toValue: 0.6,
        duration: 300,
        useNativeDriver: false,
      }).start();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      glowAnim.stopAnimation();
      pulseAnim.stopAnimation();
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isAvaSpeaking, isListening]);

  const showRing = isListening || isAvaSpeaking;

  return (
    <View style={styles.container}>
      {showRing && (
        <Animated.View 
          style={[
            styles.glowRing,
            {
              opacity: glowAnim,
              transform: [{ scale: pulseAnim }],
            }
          ]} 
        />
      )}
      <View style={styles.micContainer}>
        <Ionicons 
          name="mic-outline" 
          size={32} 
          color={isAvaSpeaking ? Colors.accent.cyan : Colors.text.primary} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    top: -10,
  },
  glowRing: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: Colors.accent.cyan,
  },
  micContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
});
