import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';

export type BlobState = 'idle' | 'listening' | 'processing' | 'responding';

interface AvaBlobPureProps {
  state?: BlobState;
  size?: number;
}

const stateConfig = {
  idle: {
    morphSpeed: 4000,
    rotateSpeed: 25000,
    pulseSpeed: 3000,
    colors: {
      core: '#1e5799',
      mid: '#2989d8',
      outer: '#4facfe',
      glow: 'rgba(79, 172, 254, 0.4)',
    },
    intensity: 1,
  },
  listening: {
    morphSpeed: 2500,
    rotateSpeed: 18000,
    pulseSpeed: 2000,
    colors: {
      core: '#2575fc',
      mid: '#4facfe',
      outer: '#3B82F6',
      glow: 'rgba(0, 212, 255, 0.5)',
    },
    intensity: 1.3,
  },
  processing: {
    morphSpeed: 1200,
    rotateSpeed: 8000,
    pulseSpeed: 800,
    colors: {
      core: '#0052d4',
      mid: '#4364f7',
      outer: '#6fb1fc',
      glow: 'rgba(67, 100, 247, 0.7)',
    },
    intensity: 1.6,
  },
  responding: {
    morphSpeed: 1800,
    rotateSpeed: 12000,
    pulseSpeed: 1500,
    colors: {
      core: '#00c6ff',
      mid: '#0072ff',
      outer: '#81d4fa',
      glow: 'rgba(0, 114, 255, 0.6)',
    },
    intensity: 1.4,
  },
};

function MorphingLayer({
  size,
  scale,
  color,
  morphSpeed,
  rotateSpeed,
  offset,
  opacity,
}: {
  size: number;
  scale: number;
  color: string;
  morphSpeed: number;
  rotateSpeed: number;
  offset: number;
  opacity: number;
}) {
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const borderRadius1 = useRef(new Animated.Value(50)).current;
  const borderRadius2 = useRef(new Animated.Value(50)).current;
  const borderRadius3 = useRef(new Animated.Value(50)).current;
  const borderRadius4 = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    const morphDuration = morphSpeed + offset * 300;

    const morphXAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleX, {
          toValue: 1.15,
          duration: morphDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(scaleX, {
          toValue: 0.9,
          duration: morphDuration * 0.8,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(scaleX, {
          toValue: 1.05,
          duration: morphDuration * 0.6,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(scaleX, {
          toValue: 1,
          duration: morphDuration * 0.4,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const morphYAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleY, {
          toValue: 0.88,
          duration: morphDuration * 1.1,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(scaleY, {
          toValue: 1.12,
          duration: morphDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(scaleY, {
          toValue: 0.95,
          duration: morphDuration * 0.7,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(scaleY, {
          toValue: 1,
          duration: morphDuration * 0.5,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const rotateAnim = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: rotateSpeed,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    const br1Anim = Animated.loop(
      Animated.sequence([
        Animated.timing(borderRadius1, {
          toValue: 60,
          duration: morphDuration * 1.2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius1, {
          toValue: 40,
          duration: morphDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius1, {
          toValue: 50,
          duration: morphDuration * 0.8,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const br2Anim = Animated.loop(
      Animated.sequence([
        Animated.timing(borderRadius2, {
          toValue: 35,
          duration: morphDuration * 0.9,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius2, {
          toValue: 65,
          duration: morphDuration * 1.1,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius2, {
          toValue: 50,
          duration: morphDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const br3Anim = Animated.loop(
      Animated.sequence([
        Animated.timing(borderRadius3, {
          toValue: 55,
          duration: morphDuration * 1.3,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius3, {
          toValue: 42,
          duration: morphDuration * 0.7,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius3, {
          toValue: 50,
          duration: morphDuration * 0.9,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const br4Anim = Animated.loop(
      Animated.sequence([
        Animated.timing(borderRadius4, {
          toValue: 45,
          duration: morphDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius4, {
          toValue: 58,
          duration: morphDuration * 1.2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(borderRadius4, {
          toValue: 50,
          duration: morphDuration * 0.6,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    morphXAnim.start();
    morphYAnim.start();
    rotateAnim.start();
    br1Anim.start();
    br2Anim.start();
    br3Anim.start();
    br4Anim.start();

    return () => {
      morphXAnim.stop();
      morphYAnim.stop();
      rotateAnim.stop();
      br1Anim.stop();
      br2Anim.stop();
      br3Anim.stop();
      br4Anim.stop();
    };
  }, [morphSpeed, rotateSpeed, offset]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const layerSize = size * scale;

  return (
    <Animated.View
      style={[
        styles.morphLayer,
        {
          width: layerSize,
          height: layerSize,
          backgroundColor: color,
          opacity,
          transform: [
            { scaleX },
            { scaleY },
            { rotate: rotateInterpolate },
          ],
          borderTopLeftRadius: borderRadius1.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
          borderTopRightRadius: borderRadius2.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
          borderBottomRightRadius: borderRadius3.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
          borderBottomLeftRadius: borderRadius4.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        },
      ]}
    />
  );
}

function GlowPulse({
  size,
  color,
  pulseSpeed,
}: {
  size: number;
  color: string;
  pulseSpeed: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.3,
          duration: pulseSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: pulseSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    const opacityAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: pulseSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: pulseSpeed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    scaleAnim.start();
    opacityAnim.start();

    return () => {
      scaleAnim.stop();
      opacityAnim.stop();
    };
  }, [pulseSpeed]);

  return (
    <Animated.View
      style={[
        styles.glowLayer,
        {
          width: size * 1.4,
          height: size * 1.4,
          borderRadius: size * 0.7,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

function Highlight({ size }: { size: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    shimmerAnim.start();

    return () => shimmerAnim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.highlight,
        {
          width: size * 0.3,
          height: size * 0.15,
          top: size * 0.2,
          left: size * 0.25,
          borderRadius: size * 0.1,
          opacity: shimmer.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 0.8],
          }),
          transform: [
            {
              translateX: shimmer.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 15],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export function AvaBlobPure({ state = 'idle', size = 280 }: AvaBlobPureProps) {
  const config = stateConfig[state];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GlowPulse
        size={size * 0.7}
        color={config.colors.glow}
        pulseSpeed={config.pulseSpeed}
      />

      <MorphingLayer
        size={size}
        scale={0.75}
        color={config.colors.outer}
        morphSpeed={config.morphSpeed}
        rotateSpeed={config.rotateSpeed}
        offset={3}
        opacity={0.25}
      />

      <MorphingLayer
        size={size}
        scale={0.65}
        color={config.colors.mid}
        morphSpeed={config.morphSpeed}
        rotateSpeed={config.rotateSpeed * 1.2}
        offset={2}
        opacity={0.4}
      />

      <MorphingLayer
        size={size}
        scale={0.55}
        color={config.colors.core}
        morphSpeed={config.morphSpeed}
        rotateSpeed={config.rotateSpeed * 0.8}
        offset={1}
        opacity={0.6}
      />

      <MorphingLayer
        size={size}
        scale={0.45}
        color={config.colors.mid}
        morphSpeed={config.morphSpeed}
        rotateSpeed={config.rotateSpeed * 1.5}
        offset={0}
        opacity={0.8}
      />

      <Highlight size={size * 0.6} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  morphLayer: {
    position: 'absolute',
  },
  glowLayer: {
    position: 'absolute',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export default AvaBlobPure;
