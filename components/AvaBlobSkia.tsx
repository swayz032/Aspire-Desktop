import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import {
  Canvas,
  Circle,
  RadialGradient,
  vec,
  Blur,
  Group,
  Paint,
  BlendMode,
  Shadow,
  Oval,
} from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  useDerivedValue,
  interpolate,
} from 'react-native-reanimated';

export type BlobState = 'idle' | 'listening' | 'processing' | 'responding';

interface AvaBlobSkiaProps {
  state?: BlobState;
  size?: number;
}

const stateConfig = {
  idle: {
    morphSpeed: 4000,
    morphIntensity: 0.08,
    pulseSpeed: 3000,
    colors: ['#1e5799', '#2989d8', '#4facfe', '#7db9e8'],
    glowOpacity: 0.3,
  },
  listening: {
    morphSpeed: 2500,
    morphIntensity: 0.12,
    pulseSpeed: 2000,
    colors: ['#2575fc', '#4facfe', '#3B82F6', '#81d4fa'],
    glowOpacity: 0.5,
  },
  processing: {
    morphSpeed: 1200,
    morphIntensity: 0.18,
    pulseSpeed: 800,
    colors: ['#0052d4', '#4364f7', '#6fb1fc', '#3B82F6'],
    glowOpacity: 0.7,
  },
  responding: {
    morphSpeed: 1800,
    morphIntensity: 0.15,
    pulseSpeed: 1500,
    colors: ['#00c6ff', '#0072ff', '#5d26c1', '#81d4fa'],
    glowOpacity: 0.6,
  },
};

function AnimatedBlobLayer({ 
  size, 
  config, 
  offset = 0,
  scale = 1,
  opacity = 1,
}: { 
  size: number; 
  config: typeof stateConfig.idle;
  offset?: number;
  scale?: number;
  opacity?: number;
}) {
  const center = size / 2;
  const baseRadius = (size / 2) * 0.6 * scale;
  
  const morphX = useSharedValue(1);
  const morphY = useSharedValue(1);
  const rotation = useSharedValue(0);
  
  useEffect(() => {
    const duration = config.morphSpeed + offset * 200;
    const intensity = config.morphIntensity;
    
    morphX.value = withRepeat(
      withSequence(
        withTiming(1 + intensity, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(1 - intensity * 0.5, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(1 + intensity * 0.3, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: duration * 0.6, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    
    morphY.value = withRepeat(
      withSequence(
        withTiming(1 - intensity * 0.7, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
        withTiming(1 + intensity, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(1 - intensity * 0.4, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: duration * 0.7, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
    
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000 + offset * 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, [config.morphSpeed, config.morphIntensity, offset]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: morphX.value },
      { scaleY: morphY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity,
  }));

  return (
    <Animated.View style={[styles.layer, { width: size, height: size }, animatedStyle]}>
      <Canvas style={{ width: size, height: size }}>
        <Group>
          <Circle cx={center} cy={center} r={baseRadius}>
            <RadialGradient
              c={vec(center * 0.7, center * 0.6)}
              r={baseRadius * 1.5}
              colors={config.colors}
            />
          </Circle>
        </Group>
      </Canvas>
    </Animated.View>
  );
}

function GlowLayer({ size, config }: { size: number; config: typeof stateConfig.idle }) {
  const center = size / 2;
  const glowRadius = (size / 2) * 0.85;
  
  const pulse = useSharedValue(1);
  
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: config.pulseSpeed, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.95, { duration: config.pulseSpeed, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
  }, [config.pulseSpeed]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: config.glowOpacity,
  }));

  return (
    <Animated.View style={[styles.glowLayer, { width: size, height: size }, animatedStyle]}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={center} cy={center} r={glowRadius}>
          <RadialGradient
            c={vec(center, center)}
            r={glowRadius}
            colors={[config.colors[2], config.colors[1], 'transparent']}
          />
          <Blur blur={20} />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}

function HighlightLayer({ size, config }: { size: number; config: typeof stateConfig.idle }) {
  const shimmer = useSharedValue(0);
  
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4,
    transform: [
      { translateX: shimmer.value * 10 - 5 },
      { translateY: -shimmer.value * 5 },
    ],
  }));

  const highlightSize = size * 0.25;
  const center = size / 2;

  return (
    <Animated.View 
      style={[
        styles.highlightLayer, 
        { 
          width: size, 
          height: size,
          top: 0,
          left: 0,
        }, 
        animatedStyle
      ]}
    >
      <Canvas style={{ width: size, height: size }}>
        <Oval 
          x={center - highlightSize * 0.8} 
          y={center - size * 0.25} 
          width={highlightSize * 1.2} 
          height={highlightSize * 0.5}
        >
          <RadialGradient
            c={vec(center, center - size * 0.15)}
            r={highlightSize}
            colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.2)', 'transparent']}
          />
          <Blur blur={8} />
        </Oval>
      </Canvas>
    </Animated.View>
  );
}

export function AvaBlobSkia({ state = 'idle', size = 300 }: AvaBlobSkiaProps) {
  const config = stateConfig[state];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GlowLayer size={size} config={config} />
      
      <AnimatedBlobLayer size={size} config={config} offset={2} scale={1.1} opacity={0.3} />
      <AnimatedBlobLayer size={size} config={config} offset={1} scale={1.0} opacity={0.5} />
      <AnimatedBlobLayer size={size} config={config} offset={0} scale={0.9} opacity={0.8} />
      <AnimatedBlobLayer size={size} config={config} offset={-1} scale={0.75} opacity={1} />
      
      <HighlightLayer size={size} config={config} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
  glowLayer: {
    position: 'absolute',
  },
  highlightLayer: {
    position: 'absolute',
  },
});

export default AvaBlobSkia;
