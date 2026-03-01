/**
 * AgentAvatar — Premium draggable agent avatar for Canvas Mode.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - REAL depth: Multi-layer glow + shadow (NOT flat circle)
 * - Premium breathing animation: Smooth 2s sine cycle (NO cheap bounce)
 * - 60fps draggable: Spring physics snap to 32px grid
 * - Voice active state: Pulsing glow indicator
 * - Glass surface with rim lighting (top edge catch light)
 * - Image depth system: Gradient overlay + edge vignette + inner glow
 * - Micro-interactions: Hover state + click pulse + focus ring
 *
 * Reference Quality: Premium orb UI, Bloomberg Terminal avatars, Apple TV personas.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  Easing,
  type ViewStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CanvasTokens } from '@/constants/canvas.tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentAvatarProps {
  agent: 'ava' | 'finn' | 'eli';
  position?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  onClick?: () => void;
  /** Wave 17: Toggle voice session on click (called before onClick) */
  onVoiceToggle?: () => void;
  isVoiceActive?: boolean;
}

// ---------------------------------------------------------------------------
// Agent Config
// ---------------------------------------------------------------------------

const AGENT_CONFIG = {
  ava: {
    initial: 'A',
    image: require('@/assets/avatars/ava.png'),
    glowColor: CanvasTokens.glow.ava, // #A855F7 purple
    name: 'Ava',
  },
  finn: {
    initial: 'F',
    image: require('@/assets/avatars/finn.png'),
    glowColor: CanvasTokens.glow.finn, // #10B981 green
    name: 'Finn',
  },
  eli: {
    initial: 'E',
    image: require('@/assets/avatars/eli.png'),
    glowColor: CanvasTokens.glow.eli, // #3B82F6 blue
    name: 'Eli',
  },
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_SIZE = CanvasTokens.avatar.size; // 80
const GRID_SIZE = 32; // Snap to 32px grid
const GLOW_OPACITY = CanvasTokens.avatar.glowOpacity; // 0.6

// Spring physics config (snappy, premium feel)
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.9,
};

// Breathing animation config (2s smooth sine cycle)
const BREATHING_DURATION = 2000;
const BREATHING_SCALE_MIN = 1.0;
const BREATHING_SCALE_MAX = 1.05;
const BREATHING_GLOW_MIN = 0.6;
const BREATHING_GLOW_MAX = 0.8;

// Voice active animation config (1s faster pulse)
const VOICE_PULSE_DURATION = 1000;
const VOICE_GLOW_MIN = 0.5;
const VOICE_GLOW_MAX = 0.9;

// Hover state config
const HOVER_SCALE = 1.02;
const HOVER_GLOW_BOOST = 0.1;

// Click pulse config
const CLICK_PULSE_SCALE = 1.08;
const CLICK_PULSE_DURATION = 150;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  agent,
  position = { x: 100, y: 100 },
  onPositionChange,
  onClick,
  onVoiceToggle,
  isVoiceActive = false,
}) => {
  const config = AGENT_CONFIG[agent];

  // ---------------------------------------------------------------------------
  // Interaction State
  // ---------------------------------------------------------------------------

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // ---------------------------------------------------------------------------
  // Drag State (Reanimated)
  // ---------------------------------------------------------------------------

  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const isDragging = useSharedValue(false);

  // ---------------------------------------------------------------------------
  // Breathing Animation (RN Animated for smooth sine easing)
  // ---------------------------------------------------------------------------

  const breathScale = useRef(new Animated.Value(1)).current;
  const breathGlow = useRef(new Animated.Value(BREATHING_GLOW_MIN)).current;

  useEffect(() => {
    // Only breathe when NOT voice active (voice active uses different pulse)
    if (isVoiceActive) {
      breathScale.stopAnimation();
      breathGlow.stopAnimation();
      breathScale.setValue(1.05); // Slightly larger when active
      breathGlow.setValue(VOICE_GLOW_MAX);
      return;
    }

    // Smooth breathing loop (2s sine cycle)
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: BREATHING_SCALE_MAX,
            duration: BREATHING_DURATION / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathGlow, {
            toValue: BREATHING_GLOW_MAX,
            duration: BREATHING_DURATION / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false, // opacity requires non-native
          }),
        ]),
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: BREATHING_SCALE_MIN,
            duration: BREATHING_DURATION / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breathGlow, {
            toValue: BREATHING_GLOW_MIN,
            duration: BREATHING_DURATION / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ]),
      ])
    ).start();
  }, [isVoiceActive]);

  // ---------------------------------------------------------------------------
  // Voice Active Pulse Animation
  // ---------------------------------------------------------------------------

  const voicePulse = useRef(new Animated.Value(VOICE_GLOW_MIN)).current;

  useEffect(() => {
    if (!isVoiceActive) {
      voicePulse.stopAnimation();
      voicePulse.setValue(VOICE_GLOW_MIN);
      return;
    }

    // Faster pulse for active voice (1s cycle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(voicePulse, {
          toValue: VOICE_GLOW_MAX,
          duration: VOICE_PULSE_DURATION / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(voicePulse, {
          toValue: VOICE_GLOW_MIN,
          duration: VOICE_PULSE_DURATION / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [isVoiceActive]);

  // ---------------------------------------------------------------------------
  // Click Pulse Animation (Reanimated for 60fps)
  // ---------------------------------------------------------------------------

  const clickPulseScale = useSharedValue(1);

  const triggerClickPulse = () => {
    clickPulseScale.value = withTiming(
      CLICK_PULSE_SCALE,
      { duration: CLICK_PULSE_DURATION / 2 },
      () => {
        clickPulseScale.value = withSpring(1.05, SPRING_CONFIG);
      }
    );
  };

  const handleClick = () => {
    triggerClickPulse();
    // Wave 17: Toggle voice session before general onClick
    onVoiceToggle?.();
    onClick?.();
  };

  // ---------------------------------------------------------------------------
  // Drag Gesture
  // ---------------------------------------------------------------------------

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onChange((event) => {
      translateX.value = position.x + event.translationX;
      translateY.value = position.y + event.translationY;
    })
    .onEnd(() => {
      // Snap to grid with spring physics (premium feel)
      const snappedX = Math.round(translateX.value / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round(translateY.value / GRID_SIZE) * GRID_SIZE;

      translateX.value = withSpring(snappedX, SPRING_CONFIG);
      translateY.value = withSpring(snappedY, SPRING_CONFIG);

      isDragging.value = false;

      // Notify parent of new position
      if (onPositionChange) {
        onPositionChange({ x: snappedX, y: snappedY });
      }
    });

  // ---------------------------------------------------------------------------
  // Drag Animated Styles (Reanimated)
  // ---------------------------------------------------------------------------

  const animatedContainerStyle = useAnimatedStyle(() => {
    // Combine breathing scale + hover scale + click pulse + drag scale
    const baseScale = isHovered ? HOVER_SCALE : 1.0;
    const dragScale = isDragging.value ? 1.1 : 1.0;
    const finalScale = baseScale * dragScale * clickPulseScale.value;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withTiming(finalScale, { duration: 100 }) },
      ],
    };
  });

  const animatedShadowStyle = useAnimatedStyle(() => {
    // Shadow blur intensifies while dragging or hovering
    const baseBlur = isHovered ? 50 : 40;
    const shadowBlur = isDragging.value ? 60 : baseBlur;
    const baseOpacity = isHovered ? GLOW_OPACITY + HOVER_GLOW_BOOST : GLOW_OPACITY;
    const shadowOpacity = isDragging.value ? 1.0 : baseOpacity;

    // Web-only box-shadow (layered glow)
    if (Platform.OS === 'web') {
      return {
        boxShadow: `
          0 0 ${shadowBlur}px ${config.glowColor}${Math.round(shadowOpacity * 0.4 * 255).toString(16).padStart(2, '0')},
          0 0 ${shadowBlur * 2}px ${config.glowColor}${Math.round(shadowOpacity * 0.2 * 255).toString(16).padStart(2, '0')}
        `,
      } as unknown as ViewStyle;
    }

    // Native shadow fallback
    return {
      shadowColor: config.glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: shadowOpacity * 0.5,
      shadowRadius: shadowBlur / 2,
      elevation: 8,
    };
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View style={[styles.container, animatedContainerStyle]}>
        <Pressable
          onPress={handleClick}
          onHoverIn={Platform.OS === 'web' ? () => setIsHovered(true) : undefined}
          onHoverOut={Platform.OS === 'web' ? () => setIsHovered(false) : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.pressableWrapper,
            Platform.OS === 'web' && (isHovered || isDragging.value) && { cursor: 'pointer' },
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Start voice session with ${config.name}`}
        >
          {/* Focus Ring (Keyboard Navigation) */}
          {isFocused && (
            <View
              style={[
                styles.focusRing,
                {
                  borderColor: config.glowColor,
                },
              ]}
              accessibilityElementsHidden={true}
              importantForAccessibility="no-hide-descendants"
            />
          )}

          {/* Outer Glow Layer */}
          <Reanimated.View style={[styles.outerGlow, animatedShadowStyle]} />

          {/* Avatar Circle (Glass Surface) */}
          <Animated.View
            style={[
              styles.avatarCircle,
              {
                borderColor: config.glowColor,
                borderWidth: isVoiceActive ? 3 : 2, // Thicker border when active
                transform: [{ scale: breathScale }],
              },
            ]}
          >
            {/* Agent Avatar Image */}
            <Image
              source={config.image}
              style={styles.avatarImage}
              resizeMode="cover"
            />

            {/* Phase 1 Enhancement 1: Gradient Overlay (Depth - Lighter Top, Darker Bottom) */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.06)', 'rgba(0, 0, 0, 0.15)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradientOverlay}
              pointerEvents="none"
            />

            {/* Phase 1 Enhancement 2: Edge Vignette (Circular Fade) */}
            <View style={styles.vignetteContainer} pointerEvents="none">
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.3)']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 1, y: 1 }}
                style={[styles.vignette, { opacity: 0.8 }]}
              />
            </View>

            {/* Phase 1 Enhancement 3: Inner Glow Ring (Glass Surface Illusion) */}
            <View
              style={[
                styles.innerGlowRing,
                Platform.OS === 'web'
                  ? ({
                      boxShadow: 'inset 0 0 2px rgba(255, 255, 255, 0.08)',
                    } as unknown as ViewStyle)
                  : {},
              ]}
              pointerEvents="none"
            />

            {/* Phase 1 Enhancement 4: Premium Rim Light (Radial Gradient) */}
            <Animated.View
              style={[
                styles.rimLightContainer,
                {
                  opacity: isVoiceActive ? voicePulse : breathGlow,
                },
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[
                  `${config.glowColor}66`, // 40% opacity at top
                  `${config.glowColor}33`, // 20% opacity
                  'transparent',
                ]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.rimLight}
              />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Reanimated.View>
    </GestureDetector>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },

  pressableWrapper: {
    width: '100%',
    height: '100%',
  },

  // Phase 2 Enhancement 3: Focus Ring (Keyboard Navigation)
  focusRing: {
    position: 'absolute',
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
    borderWidth: 2,
    top: -4,
    left: -4,
    // High contrast for accessibility
  },

  outerGlow: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    // Glow applied via animated style (web boxShadow or native shadow)
  },

  avatarCircle: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(30, 30, 30, 0.95)', // Dark glass
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    // Inner shadow for depth (web only via className would be ideal, but using transparent for now)
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
        } as unknown as ViewStyle)
      : {}),
  },

  avatarImage: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    // Image fills entire circle, clipped by overflow: hidden on parent
  },

  // Phase 1 Enhancement 1: Gradient Overlay
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: AVATAR_SIZE / 2,
  },

  // Phase 1 Enhancement 2: Edge Vignette Container
  vignetteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
  },

  vignette: {
    position: 'absolute',
    top: -AVATAR_SIZE / 4,
    left: -AVATAR_SIZE / 4,
    right: -AVATAR_SIZE / 4,
    bottom: -AVATAR_SIZE / 4,
    borderRadius: AVATAR_SIZE,
  },

  // Phase 1 Enhancement 3: Inner Glow Ring
  innerGlowRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Phase 1 Enhancement 4: Premium Rim Light Container
  rimLightContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: AVATAR_SIZE / 2.5, // Slightly taller for better coverage
    borderTopLeftRadius: AVATAR_SIZE / 2,
    borderTopRightRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
  },

  rimLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  initial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    zIndex: 1,
  },
});
