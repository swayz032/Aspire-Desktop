import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '@/constants/tokens';

export type OrbState = 'idle' | 'listening' | 'processing' | 'responding';

interface AvaOrbProps {
  state?: OrbState;
  size?: number;
}

const stateConfig = {
  idle: {
    colorA: Colors.orb.idle.dark,
    colorB: Colors.orb.idle.mid,
    colorC: Colors.orb.idle.light,
    scale: 1,
    pulseSpeed: 2500,
    glowMax: 0.4,
  },
  listening: {
    colorA: Colors.orb.listening.dark,
    colorB: Colors.orb.listening.mid,
    colorC: Colors.orb.listening.light,
    scale: 1.05,
    pulseSpeed: 1800,
    glowMax: 0.5,
  },
  processing: {
    colorA: Colors.orb.processing.dark,
    colorB: Colors.orb.processing.mid,
    colorC: Colors.orb.processing.light,
    scale: 1.1,
    pulseSpeed: 800,
    glowMax: 0.8,
  },
  responding: {
    colorA: Colors.orb.responding.dark,
    colorB: Colors.orb.responding.mid,
    colorC: Colors.orb.responding.light,
    scale: 1.08,
    pulseSpeed: 1200,
    glowMax: 0.6,
  },
};

export function AvaOrb({ state = 'idle', size = 300 }: AvaOrbProps) {
  const config = stateConfig[state];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const morphAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const { pulseSpeed, glowMax, scale } = config;
    
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: scale * 1.06,
          duration: pulseSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: scale * 0.96,
          duration: pulseSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: glowMax,
          duration: pulseSpeed * 1.2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.15,
          duration: pulseSpeed * 1.2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const morph = Animated.loop(
      Animated.sequence([
        Animated.timing(morphAnim, {
          toValue: 1,
          duration: pulseSpeed * 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(morphAnim, {
          toValue: 0,
          duration: pulseSpeed * 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    pulse.start();
    rotate.start();
    glow.start();
    morph.start();

    return () => {
      pulse.stop();
      rotate.stop();
      glow.stop();
      morph.stop();
    };
  }, [state, config]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const reverseRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const scaleX = morphAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.08, 1],
  });

  const scaleY = morphAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.94, 1],
  });

  const orbSize = size * 0.65;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.outerGlow,
          {
            width: orbSize * 1.8,
            height: orbSize * 1.8,
            borderRadius: orbSize * 0.9,
            backgroundColor: config.colorC,
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.midGlow,
          {
            width: orbSize * 1.5,
            height: orbSize * 1.5,
            borderRadius: orbSize * 0.75,
            backgroundColor: config.colorB,
            transform: [{ scale: pulseAnim }, { rotate: reverseRotation }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.innerGlow,
          {
            width: orbSize * 1.25,
            height: orbSize * 1.25,
            borderRadius: orbSize * 0.625,
            backgroundColor: config.colorA,
            transform: [{ scale: pulseAnim }, { rotate: rotation }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.orbCore,
          {
            width: orbSize,
            height: orbSize,
            borderRadius: orbSize / 2,
            transform: [
              { scale: pulseAnim },
              { scaleX },
              { scaleY },
            ],
          },
        ]}
      >
        <View style={[styles.orbBase, { backgroundColor: config.colorA }]} />
        <View style={[styles.orbMid, { backgroundColor: config.colorB }]} />
        <Animated.View
          style={[
            styles.orbHighlight,
            {
              backgroundColor: config.colorC,
              opacity: glowAnim,
            },
          ]}
        />
        <View style={[styles.orbShine, { backgroundColor: config.colorC }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.ringOuter,
          {
            width: orbSize * 1.4,
            height: orbSize * 1.4,
            borderRadius: orbSize * 0.7,
            borderColor: config.colorC,
            transform: [{ rotate: rotation }, { scale: pulseAnim }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.ringInner,
          {
            width: orbSize * 1.2,
            height: orbSize * 1.2,
            borderRadius: orbSize * 0.6,
            borderColor: config.colorB,
            transform: [{ rotate: reverseRotation }, { scale: pulseAnim }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.particle,
          {
            top: '20%',
            left: '15%',
            backgroundColor: config.colorC,
            transform: [
              { rotate: rotation },
              { translateX: orbSize * 0.5 },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.particle,
          {
            top: '70%',
            right: '20%',
            backgroundColor: config.colorB,
            transform: [
              { rotate: reverseRotation },
              { translateX: orbSize * 0.3 },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position: 'absolute',
    opacity: 0.2,
  },
  midGlow: {
    position: 'absolute',
    opacity: 0.3,
  },
  innerGlow: {
    position: 'absolute',
    opacity: 0.4,
  },
  orbCore: {
    position: 'relative',
    overflow: 'hidden',
  },
  orbBase: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 1000,
  },
  orbMid: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    width: '70%',
    height: '70%',
    borderRadius: 1000,
    opacity: 0.8,
  },
  orbHighlight: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '35%',
    height: '35%',
    borderRadius: 1000,
  },
  orbShine: {
    position: 'absolute',
    top: '8%',
    left: '25%',
    width: '15%',
    height: '8%',
    borderRadius: 1000,
    opacity: 0.6,
  },
  ringOuter: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.4,
  },
  ringInner: {
    position: 'absolute',
    borderWidth: 1,
    opacity: 0.3,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },
});

export default AvaOrb;
