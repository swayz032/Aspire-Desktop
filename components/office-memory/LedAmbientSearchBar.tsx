/**
 * LedAmbientSearchBar — the interactive heartbeat of the Memory Engine hero.
 *
 * Visual contract (plan §8.2 + §12.1):
 *   - Outer ring breathes Aspire-blue LED light (2400ms cubic-bezier loop).
 *   - Inner field is calm dark glass (#0d0d10) — does NOT pulse, never noisy.
 *   - On focus: ring intensifies (sharper inner stroke + heavier outer halo).
 *   - On submit (Enter): fires `onSubmit(value)` and blurs.
 *
 * Web: uses CSS `@keyframes memoryLedPulse` for true infinite loop without
 * pinning the JS thread. Native: `Animated.Value` interpolating borderColor.
 *
 * Detail obsessions per §12.1:
 *   - Breathing min/max chosen to feel "alive but never anxious" — 0.35→0.78.
 *   - Search icon optically centered (not just mathematically) via line-height.
 *   - ⌘K hint pill is web-only (native has no keyboard) and lives at 0.5 opacity
 *     so it reads as a hint, not a CTA.
 *   - Border-radius 16 matches `Colors.memory.cardBg` cards — visual continuity.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import { injectMemoryKeyframes } from './cardAnimations';

export interface LedAmbientSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Optional max width override; default 720 per hero spec */
  maxWidth?: number;
}

export function LedAmbientSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask a memory or describe what you're looking for…",
  autoFocus = false,
  maxWidth = 720,
}: LedAmbientSearchBarProps) {
  const [focused, setFocused] = useState(false);

  // Lazy keyframe injection on web
  useEffect(() => {
    injectMemoryKeyframes();
  }, []);

  // Native LED animation — interpolate borderColor between off/on tokens
  const ledAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ledAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(ledAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ledAnim]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed.length > 0) onSubmit(trimmed);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Web rendering — CSS keyframes drive the LED breathe.
  // ─────────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    const ledStyle: ViewStyle = {
      // Web-only CSS via project's established cast pattern
      ...({
        animation: focused
          ? 'memoryLedPulseFocus 1800ms cubic-bezier(0.4, 0, 0.6, 1) infinite'
          : 'memoryLedPulse 2400ms cubic-bezier(0.4, 0, 0.6, 1) infinite',
        position: 'absolute',
        inset: 0,
        borderRadius: BorderRadius.xl,
        pointerEvents: 'none',
      } as unknown as ViewStyle),
    };

    const fieldStyle: ViewStyle = {
      ...styles.field,
      // Premium focus lift: card rises 1px and casts a deeper shadow
      ...(focused
        ? ({
            transform: 'translateY(-1px)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.45)',
          } as unknown as ViewStyle)
        : {}),
    };

    return (
      <View
        style={[styles.outer, { maxWidth }]}
        accessibilityRole="search"
      >
        {/* LED breathing ring — purely decorative */}
        <View style={ledStyle} aria-hidden />

        {/* Inner calm dark-glass field */}
        <View style={fieldStyle}>
          <Ionicons
            name="search"
            size={20}
            color={focused ? Colors.text.bright : Colors.text.tertiary}
            style={styles.iconLeft}
          />

          <TextInput
            value={value}
            onChangeText={onChange}
            onSubmitEditing={handleSubmit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            placeholderTextColor={Colors.text.muted}
            autoFocus={autoFocus}
            returnKeyType="search"
            style={styles.input as unknown as TextStyle}
            accessibilityLabel="Memory engine search"
          />

          {/* ⌘K keyboard hint — desktop only, 0.5 opacity per §12.1 detail rules */}
          <View style={styles.kbdWrap} aria-hidden>
            <Text style={styles.kbdKey}>⌘</Text>
            <Text style={styles.kbdKey}>K</Text>
          </View>

          {/* Submit button — fires on Enter, intensifies when query is non-empty */}
          <Pressable
            onPress={handleSubmit}
            style={({ hovered, pressed }: any) => [
              styles.submit,
              value.trim().length > 0 && styles.submitReady,
              hovered && styles.submitHover,
              pressed && styles.submitPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Search memories"
            accessibilityState={{ disabled: value.trim().length === 0 }}
          >
            <Ionicons
              name="arrow-forward"
              size={16}
              color={value.trim().length > 0 ? Colors.text.primary : Colors.text.tertiary}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Native rendering — Animated borderColor breath.
  // ─────────────────────────────────────────────────────────────────────────
  const borderColor = ledAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.memory.ledOff, Colors.memory.ledOn],
  });

  return (
    <View style={[styles.outer, { maxWidth }]}>
      <Animated.View
        style={[
          styles.fieldNative,
          { borderColor, borderWidth: focused ? 2 : 1.5 },
        ]}
      >
        <Ionicons
          name="search"
          size={20}
          color={focused ? Colors.text.bright : Colors.text.tertiary}
          style={styles.iconLeft}
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          onSubmitEditing={handleSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.muted}
          autoFocus={autoFocus}
          returnKeyType="search"
          style={styles.input as unknown as TextStyle}
          accessibilityLabel="Memory engine search"
        />
        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Search memories"
          hitSlop={12}
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
        >
          <Ionicons name="arrow-forward" size={16} color={Colors.text.primary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const SEARCH_HEIGHT = 64;

const styles = StyleSheet.create({
  outer: {
    width: '100%' as unknown as number,
    height: SEARCH_HEIGHT,
    alignSelf: 'center',
    position: 'relative',
  },
  field: {
    height: SEARCH_HEIGHT,
    backgroundColor: '#0d0d10',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xxl, // 24
    flexDirection: 'row',
    alignItems: 'center',
    // Inner inset highlight for premium "carved" feel
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.04)' } as unknown as ViewStyle)
      : {}),
  },
  fieldNative: {
    height: SEARCH_HEIGHT,
    backgroundColor: '#0d0d10',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  iconLeft: {
    // Optical centering: nudge -1px because Ionicons "search" baseline sits high
    marginTop: Platform.OS === 'web' ? -1 : 0,
  },
  input: {
    flex: 1,
    marginLeft: Spacing.lg,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.text.primary,
    // Strip default web outline — LED ring is our focus indicator
    ...(Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as unknown as TextStyle) : {}),
  },
  kbdWrap: {
    flexDirection: 'row',
    gap: 4,
    marginRight: Spacing.md,
    opacity: 0.5,
  },
  kbdKey: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    color: Colors.text.tertiary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  submit: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
  },
  submitReady: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 16px rgba(59,130,246,0.55)' } as unknown as ViewStyle)
      : {}),
  },
  submitHover: {
    backgroundColor: Colors.accent.cyanDark,
    borderColor: Colors.accent.cyanDark,
  },
  submitPressed: {
    transform: [{ scale: 0.94 }],
  },
});

export default LedAmbientSearchBar;
