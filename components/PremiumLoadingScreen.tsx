import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

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
const SPHERE_SIZE = 200;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PremiumLoadingScreenProps {
  isComplete: boolean;
  onFadeComplete: () => void;
}

// ---------------------------------------------------------------------------
// CSS Orb (web) — pure CSS animated gradient sphere, no 3D deps
// ---------------------------------------------------------------------------

function CSSOrb({ size }: { size: number }) {
  if (Platform.OS !== 'web') return null;

  const orbStyle: React.CSSProperties = {
    width: size * 0.65,
    height: size * 0.65,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #60A5FA 0%, #3B82F6 40%, #2563EB 70%, #1E40AF 100%)',
    boxShadow: '0 0 60px rgba(59, 130, 246, 0.4), 0 0 120px rgba(59, 130, 246, 0.2), inset 0 0 30px rgba(96, 165, 250, 0.3)',
    animation: 'aspire-orb-pulse 3s ease-in-out infinite, aspire-orb-rotate 8s linear infinite',
    position: 'relative' as const,
  };

  const highlightStyle: React.CSSProperties = {
    position: 'absolute' as const,
    top: '15%',
    left: '20%',
    width: '35%',
    height: '25%',
    borderRadius: '50%',
    background: 'radial-gradient(ellipse, rgba(255,255,255,0.25) 0%, transparent 70%)',
    filter: 'blur(4px)',
  };

  const shimmerStyle: React.CSSProperties = {
    position: 'absolute' as const,
    inset: '-4px',
    borderRadius: '50%',
    background: 'conic-gradient(from 0deg, transparent 0%, rgba(96, 165, 250, 0.15) 25%, transparent 50%, rgba(37, 99, 235, 0.1) 75%, transparent 100%)',
    animation: 'aspire-orb-shimmer 4s linear infinite',
  };

  return (
    <>
      {/* Inject CSS keyframes once */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes aspire-orb-pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.06); }
            }
            @keyframes aspire-orb-rotate {
              0% { filter: hue-rotate(0deg); }
              100% { filter: hue-rotate(15deg); }
            }
            @keyframes aspire-orb-shimmer {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `,
        }}
      />
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={orbStyle}>
          <div style={highlightStyle} />
          <div style={shimmerStyle} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Fallback Orb (native)
// ---------------------------------------------------------------------------

function FallbackOrb({ size }: { size: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  return (
    <View style={[styles.fallbackContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.fallbackOrb,
          {
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: size * 0.3,
            backgroundColor: '#3B82F6',
            transform: [{ scale: pulseAnim }],
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
              backgroundColor: '#60A5FA',
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Status Text with Fade Cycling (standard Animated API)
// ---------------------------------------------------------------------------

function StatusText() {
  const [index, setIndex] = useState(0);
  const textOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: TEXT_FADE_MS / 2,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
          // Fade back in
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: TEXT_FADE_MS / 2,
            useNativeDriver: true,
          }).start();
        }
      });
    }, STATUS_CYCLE_MS);

    return () => clearInterval(interval);
  }, [textOpacity]);

  return (
    <Animated.View style={[styles.statusTextContainer, { opacity: textOpacity }]}>
      <Text style={styles.statusText}>{STATUS_MESSAGES[index]}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Breathing Logo (standard Animated API)
// ---------------------------------------------------------------------------

function BreathingLogo() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.03,
          duration: LOGO_BREATH_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: LOGO_BREATH_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.logoContainer, { transform: [{ scale }] }]}>
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
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const fadeTriggeredRef = useRef(false);

  // Trigger fade-out when isComplete becomes true
  useEffect(() => {
    if (isComplete && !fadeTriggeredRef.current) {
      fadeTriggeredRef.current = true;
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onFadeComplete();
        }
      });
    }
  }, [isComplete, screenOpacity, onFadeComplete]);

  const isWeb = Platform.OS === 'web';

  return (
    <Animated.View
      style={[styles.container, { opacity: screenOpacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Setting up your Aspire workspace"
      accessibilityState={{ busy: !isComplete }}
      testID="onboarding-premium-loading-screen"
    >
      {/* Subtle radial glow behind sphere (web only) */}
      {isWeb && <View style={styles.radialGlowWeb} />}

      {/* Breathing Aspire logo */}
      <BreathingLogo />

      {/* Animated Sphere */}
      <View style={styles.sphereContainer}>
        {/* Soft radial glow pool underneath */}
        <View style={styles.sphereGlowOuter}>
          <View style={styles.sphereGlow} />
        </View>

        {isWeb ? (
          <CSSOrb size={SPHERE_SIZE} />
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

  radialGlowWeb: {
    position: 'absolute',
    width: SPHERE_SIZE * 2.5,
    height: SPHERE_SIZE * 2.5,
    borderRadius: SPHERE_SIZE * 1.25,
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

  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 56,
    height: 56,
  },

  sphereContainer: {
    marginTop: Spacing.xxxl + Spacing.sm,
    width: SPHERE_SIZE,
    height: SPHERE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sphereGlowOuter: {
    position: 'absolute',
    bottom: -Spacing.sm,
    width: SPHERE_SIZE * 0.7,
    height: Spacing.xxxl,
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

  statusTextContainer: {
    marginTop: Spacing.xxxl,
    alignItems: 'center',
    minHeight: Spacing.xxl,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.text.muted,
    letterSpacing: LETTER_SPACING_WIDE,
  },
});

export default PremiumLoadingScreen;
