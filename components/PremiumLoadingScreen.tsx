import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing } from '@/constants/tokens';
import { MagicLoader } from '@/components/MagicLoader';
import { ShinyText } from '@/components/ShinyText';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_MESSAGES = [
  'Creating your suite...',
  'Setting up your office...',
  'Preparing your workspace...',
  'Almost there...',
];

const STATUS_CYCLE_MS = 1500;
const FADE_OUT_MS = 400;
const TEXT_FADE_MS = 280;
const LOADER_SIZE = 380;

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
        speed={3}
        baseColor="rgba(200,210,230,0.75)"
        shineColor="rgba(255,255,255,1)"
      >
        {STATUS_MESSAGES[index]}
      </ShinyText>
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
      {/* MagicLoader — center stage hero */}
      <View style={styles.loaderContainer}>
        <MagicLoader size={LOADER_SIZE} particleCount={10} speed={1.2} />
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
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loaderContainer: {
    width: LOADER_SIZE,
    height: LOADER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusTextContainer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    minHeight: 32,
  },
  statusText: {
    ...Typography.body,
    fontSize: 16,
    fontWeight: '300',
    color: Colors.text.muted,
    letterSpacing: 3,
  } as any,
});

export default PremiumLoadingScreen;
