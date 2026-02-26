import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Shadows, Spacing, Animation } from '@/constants/tokens';

const ASPIRE_LOGO = require('@/assets/aspire-a-logo.png');

// Icon sizes — consistent with codebase pattern (inline: 14-16, navigation: 18-20)
const ICON_SIZE_INLINE = 14;
const ICON_SIZE_NAV = 18;

// Card inner padding — uses token scale (xxxl + sm = 40)
const CARD_PADDING = Spacing.xxxl + Spacing.sm;

interface CelebrationModalProps {
  businessName: string;
  suiteDisplayId: string;
  officeDisplayId: string;
  onEnter: () => void;
}

export function CelebrationModal({
  businessName,
  suiteDisplayId,
  officeDisplayId,
  onEnter,
}: CelebrationModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: Animation.spring.damping,
        stiffness: Animation.spring.stiffness,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: Animation.slow,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <View
      style={styles.overlay}
      accessibilityRole="none"
      accessibilityLabel="Workspace setup complete"
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
        accessibilityRole="alert"
        accessibilityLabel={`Congratulations, ${businessName}. Your workspace is ready.`}
      >
        {/* Top accent glow line — subtle gradient on web, solid fallback on native */}
        <View style={styles.accentLine} />

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={ASPIRE_LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Aspire logo"
          />
        </View>

        {/* Congratulations */}
        <Text
          style={styles.congratsText}
          accessibilityRole="header"
        >
          Congratulations!
        </Text>

        {/* Business name */}
        <Text style={styles.businessName}>{businessName}</Text>

        {/* Divider */}
        <View style={styles.divider} accessibilityElementsHidden />

        {/* Suite + Office badges */}
        <View style={styles.badgeRow} accessibilityRole="none">
          {suiteDisplayId ? (
            <View
              style={styles.badge}
              accessibilityRole="text"
              accessibilityLabel={`Suite ${suiteDisplayId}`}
            >
              <Ionicons
                name="business-outline"
                size={ICON_SIZE_INLINE}
                color={Colors.accent.cyan}
                accessibilityElementsHidden
              />
              <Text style={styles.badgeText}>Suite {suiteDisplayId}</Text>
            </View>
          ) : null}
          {officeDisplayId ? (
            <View
              style={styles.badge}
              accessibilityRole="text"
              accessibilityLabel={`Office ${officeDisplayId}`}
            >
              <Ionicons
                name="location-outline"
                size={ICON_SIZE_INLINE}
                color={Colors.accent.cyan}
                accessibilityElementsHidden
              />
              <Text style={styles.badgeText}>Office {officeDisplayId}</Text>
            </View>
          ) : null}
        </View>

        {/* Welcome text */}
        <Text style={styles.welcomeText}>
          Your AI-powered business suite is ready.{'\n'}
          Ava and your team of agents are standing by.
        </Text>

        {/* Spacer + Enter button (bottom-right) */}
        <View style={styles.buttonContainer}>
          <View style={styles.buttonSpacer} />
          <TouchableOpacity
            style={styles.enterButton}
            onPress={onEnter}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Enter Aspire workspace"
            accessibilityHint="Opens your new business suite"
          >
            <Text style={styles.enterButtonText}>Enter Aspire</Text>
            <Ionicons
              name="arrow-forward"
              size={ICON_SIZE_NAV}
              color={Colors.text.primary}
              accessibilityElementsHidden
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.background.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)' } as unknown as Record<string, string>)
      : {}),
  },
  card: {
    maxWidth: 520,
    width: '100%',
    backgroundColor: Colors.surface.premium,
    borderWidth: 1,
    borderColor: Colors.border.premium,
    borderRadius: BorderRadius.xl,
    padding: CARD_PADDING,
    overflow: 'hidden',
  },

  // Top accent line — softer with web gradient, solid fallback on native
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.accent.cyan,
    opacity: 0.4,
    ...(Platform.OS === 'web'
      ? ({
          height: 1,
          opacity: 1,
          background: `linear-gradient(90deg, transparent 0%, ${Colors.accent.cyan}66 30%, ${Colors.accent.cyan}99 50%, ${Colors.accent.cyan}66 70%, transparent 100%)`,
          backgroundColor: 'transparent',
        } as unknown as Record<string, string>)
      : {}),
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 48,
    height: 48,
  },

  congratsText: {
    ...Typography.display,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    ...(Platform.OS === 'web'
      ? ({
          // Soft blue halo — deliberate restraint, not neon
          textShadow: '0 0 40px rgba(59,130,246,0.25)',
        } as unknown as Record<string, string>)
      : {}),
  },

  businessName: {
    ...Typography.title,
    color: Colors.accent.cyan,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: Spacing.xl,
  },

  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md, // 12
    marginBottom: Spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm, // 8 (was 6 — aligned to token grid)
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.lg, // 16 (was 14 — aligned to token grid)
    paddingVertical: Spacing.sm, // 8
    borderRadius: BorderRadius.full,
    minHeight: 44, // A11y minimum tap target
    ...Shadows.glow(Colors.accent.cyan),
  },
  badgeText: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
  },

  welcomeText: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    // Use Typography.body.lineHeight (22) — no override needed.
    // The extra 2px line-height was causing inconsistency with the type scale.
    marginBottom: Spacing.xxxl,
  },

  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonSpacer: {
    flex: 1,
  },
  enterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm, // 8
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.xxl, // 24
    paddingVertical: Spacing.lg, // 16 (was 14 — raised to token grid, ensures 44pt min height)
    minHeight: 44, // A11y minimum tap target
    borderRadius: BorderRadius.lg,
    ...Shadows.glow(Colors.accent.cyan),
  },
  enterButtonText: {
    ...Typography.bodyMedium,
    color: Colors.text.primary, // Token reference (was hardcoded '#ffffff')
  },
});
