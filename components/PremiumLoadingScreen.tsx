import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere, Environment, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Colors, Typography, Shadows, Spacing, BorderRadius } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASPIRE_LOGO = require('@/assets/aspire-a-logo.png');

const STATUS_MESSAGES = [
  'Creating your suite...',
  'Setting up your office...',
  'Preparing your workspace...',
  'Almost there...',
];

const STATUS_CYCLE_MS = 1500;
const FADE_OUT_MS = 400;
const TEXT_FADE_MS = 280;
const LOGO_BREATH_MS = 2000;

/** 3D sphere config — "creating" state for the observatory aesthetic */
const CREATING_CONFIG = {
  distort: 0.35,
  speed: 2,
  color1: '#3B82F6',
  color2: '#2563EB',
  color3: '#60A5FA',
  emissiveIntensity: 0.25,
} as const;

const SPHERE_SIZE = 200;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PremiumLoadingScreenProps {
  isComplete: boolean;
  onFadeComplete: () => void;
}

// ---------------------------------------------------------------------------
// 3D Scene Components (web only)
// ---------------------------------------------------------------------------

function CreatingBlob() {
  const meshRef = useRef<THREE.Mesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Three.js material ref requires any (MeshDistortMaterial has custom internals)
  const materialRef = useRef<any>(null);

  const colorLerp = useRef(0);
  const targetColor = useRef(new THREE.Color(CREATING_CONFIG.color1));
  const currentColor = useRef(new THREE.Color(CREATING_CONFIG.color1));

  useFrame((frameState, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.08;
      meshRef.current.rotation.y += delta * 0.12;

      const time = frameState.clock.elapsedTime;
      const scale = 1 + Math.sin(time * 1.8) * 0.04;
      meshRef.current.scale.setScalar(scale);
    }

    if (materialRef.current) {
      colorLerp.current += delta * 0.4;
      if (colorLerp.current > 1) {
        colorLerp.current = 0;
        const colors = [
          CREATING_CONFIG.color1,
          CREATING_CONFIG.color2,
          CREATING_CONFIG.color3,
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        targetColor.current.set(randomColor);
      }
      currentColor.current.lerp(targetColor.current, delta * 1.5);
      materialRef.current.color = currentColor.current;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} scale={1.5}>
      <MeshDistortMaterial
        ref={materialRef}
        color={CREATING_CONFIG.color1}
        attach="material"
        distort={CREATING_CONFIG.distort}
        speed={CREATING_CONFIG.speed}
        roughness={0.08}
        metalness={0.92}
        envMapIntensity={1.8}
        emissive={CREATING_CONFIG.color2}
        emissiveIntensity={CREATING_CONFIG.emissiveIntensity}
      />
    </Sphere>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.4} color="#4facfe" />
      <pointLight position={[0, 0, 3]} intensity={0.6} color="#3B82F6" />
      <pointLight position={[0, -2, 1]} intensity={0.3} color="#60A5FA" />
      <Environment preset="night" />
      <CreatingBlob />
      <Sparkles
        count={20}
        size={1.5}
        color="#3B82F6"
        opacity={0.3}
        scale={3}
        speed={0.4}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Fallback Orb (native / Suspense fallback)
// ---------------------------------------------------------------------------

function FallbackOrb({ size }: { size: number }) {
  return (
    <View style={[styles.fallbackContainer, { width: size, height: size }]}>
      <View
        style={[
          styles.fallbackOrb,
          {
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: size * 0.3,
            backgroundColor: CREATING_CONFIG.color1,
          },
        ]}
      >
        <View
          style={[
            styles.fallbackGlow,
            {
              width: size * 0.4,
              height: size * 0.4,
              borderRadius: size * 0.2,
              backgroundColor: CREATING_CONFIG.color3,
            },
          ]}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Status Text with Fade Cycling
// ---------------------------------------------------------------------------

function StatusText() {
  const [index, setIndex] = useState(0);
  const textOpacity = useSharedValue(1);

  const cycleText = useCallback(() => {
    setIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      textOpacity.value = withTiming(0, { duration: TEXT_FADE_MS / 2 }, (finished) => {
        if (finished) {
          runOnJS(cycleText)();
          // Fade back in
          textOpacity.value = withTiming(1, { duration: TEXT_FADE_MS / 2 });
        }
      });
    }, STATUS_CYCLE_MS);

    return () => clearInterval(interval);
  }, [textOpacity, cycleText]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Animated.View style={[styles.statusTextContainer, animatedStyle]}>
      <Text style={styles.statusText}>{STATUS_MESSAGES[index]}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Breathing Logo
// ---------------------------------------------------------------------------

function BreathingLogo() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, {
          duration: LOGO_BREATH_MS / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1.0, {
          duration: LOGO_BREATH_MS / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1, // infinite repeat
      false,
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.logoContainer, animatedStyle]}>
      <Image
        source={ASPIRE_LOGO}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Aspire logo"
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PremiumLoadingScreen({
  isComplete,
  onFadeComplete,
}: PremiumLoadingScreenProps) {
  const screenOpacity = useSharedValue(1);
  const fadeTriggeredRef = useRef(false);

  // Trigger fade-out when isComplete becomes true
  useEffect(() => {
    if (isComplete && !fadeTriggeredRef.current) {
      fadeTriggeredRef.current = true;
      screenOpacity.value = withTiming(
        0,
        { duration: FADE_OUT_MS, easing: Easing.out(Easing.ease) },
        (finished) => {
          if (finished) {
            runOnJS(onFadeComplete)();
          }
        },
      );
    }
  }, [isComplete, screenOpacity, onFadeComplete]);

  const screenAnimatedStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View
      style={[styles.container, screenAnimatedStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Setting up your Aspire workspace"
      accessibilityState={{ busy: !isComplete }}
    >
      {/* Subtle radial glow behind sphere (web only, centered on sphere) */}
      {isWeb && <View style={styles.radialGlowWeb} />}

      {/* Breathing Aspire logo */}
      <BreathingLogo />

      {/* 3D Sphere or Fallback */}
      <View style={styles.sphereContainer}>
        {/* Soft radial glow pool underneath the sphere */}
        <View style={styles.sphereGlowOuter}>
          <View
            style={[
              styles.sphereGlow,
              Shadows.glow(Colors.accent.cyan),
            ]}
          />
        </View>

        {isWeb ? (
          <Suspense fallback={<FallbackOrb size={SPHERE_SIZE} />}>
            <Canvas
              camera={{ position: [0, 0, 4], fov: 45 }}
              style={{ width: SPHERE_SIZE, height: SPHERE_SIZE }}
              gl={{ antialias: true, alpha: true }}
            >
              <Scene />
            </Canvas>
          </Suspense>
        ) : (
          <FallbackOrb size={SPHERE_SIZE} />
        )}
      </View>

      {/* Cycling status text */}
      <StatusText />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const LETTER_SPACING_WIDE = 0.3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Radial glow backdrop (web-only, purely atmospheric)
  // Centered on the sphere area via absolute positioning + vertical offset
  radialGlowWeb: {
    position: 'absolute',
    width: SPHERE_SIZE * 2.5,
    height: SPHERE_SIZE * 2.5,
    borderRadius: SPHERE_SIZE * 1.25,
    // Offset down slightly to center on the sphere (accounting for logo above)
    top: '50%',
    marginTop: Spacing.lg,
    alignSelf: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    ...(Platform.OS === 'web'
      ? ({
          filter: 'blur(100px)',
          transform: 'translateY(-45%)',
        } as unknown as Record<string, string>)
      : {}),
  },

  // Logo
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 56,
    height: 56,
  },

  // 3D sphere area — generous spacing from logo for deliberate vertical rhythm
  sphereContainer: {
    marginTop: Spacing.xxxl + Spacing.sm, // 40 = 32 + 8
    width: SPHERE_SIZE,
    height: SPHERE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Soft elliptical glow pool that sits beneath the sphere
  sphereGlowOuter: {
    position: 'absolute',
    bottom: -Spacing.sm, // -8, slight overflow below sphere
    width: SPHERE_SIZE * 0.7,
    height: Spacing.xxxl, // 32 — taller for a softer pool
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: BorderRadius.full,
  },
  sphereGlow: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    ...(Platform.OS === 'web'
      ? ({
          background:
            'radial-gradient(ellipse at center, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.04) 60%, transparent 100%)',
        } as unknown as Record<string, string>)
      : {}),
  },

  // Fallback orb (native)
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  fallbackGlow: {
    opacity: 0.6,
  },

  // Status text — generous top margin for breathing room below sphere
  statusTextContainer: {
    marginTop: Spacing.xxxl, // 32
    alignItems: 'center',
    minHeight: Spacing.xxl, // 24, prevents layout jump during text cycling
  },
  statusText: {
    ...Typography.caption,
    color: Colors.text.muted,
    letterSpacing: LETTER_SPACING_WIDE,
  },
});

export default PremiumLoadingScreen;
