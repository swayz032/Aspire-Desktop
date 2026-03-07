import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { MagicLoader } from '@/components/MagicLoader';
import { ShinyText } from '@/components/ShinyText';

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
const LOADER_SIZE = 280;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PremiumLoadingScreenProps {
  isComplete: boolean;
  onFadeComplete: () => void;
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
      textOpacity.value = withTiming(0, { duration: TEXT_FADE_MS / 2 }, (finished) => {
        if (finished) {
          runOnJS(cycleText)();
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
      <ShinyText
        style={styles.statusText}
        speed={2.5}
        baseColor="rgba(110,110,115,0.9)"
        shineColor="rgba(255,255,255,0.85)"
      >
        {STATUS_MESSAGES[index]}
      </ShinyText>
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
      -1,
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

  return (
    <Animated.View
      style={[styles.container, screenAnimatedStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Setting up your Aspire workspace"
      accessibilityState={{ busy: !isComplete }}
    >
      {/* Radial glow backdrop (web-only) */}
      {Platform.OS === 'web' && <View style={styles.radialGlowWeb} />}

      {/* Breathing logo */}
      <BreathingLogo />

      {/* MagicLoader particle animation */}
      <View style={styles.loaderContainer}>
        <MagicLoader size={LOADER_SIZE} particleCount={3} speed={1} />
      </View>

      {/* Cycling shiny status text */}
      <StatusText />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radialGlowWeb: {
    position: 'absolute',
    width: LOADER_SIZE * 2.5,
    height: LOADER_SIZE * 2.5,
    borderRadius: LOADER_SIZE * 1.25,
    top: '50%',
    marginTop: Spacing.lg,
    alignSelf: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
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

  loaderContainer: {
    marginTop: Spacing.xxxl + Spacing.sm,
    width: LOADER_SIZE,
    height: LOADER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusTextContainer: {
    marginTop: Spacing.xxxl,
    alignItems: 'center',
    minHeight: Spacing.xxl,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.text.muted,
    letterSpacing: 0.3,
  },
});

export default PremiumLoadingScreen;
