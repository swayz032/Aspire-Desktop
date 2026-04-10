/**
 * BaseCard -- Shared card shell for all Ava Presents research card types.
 *
 * Layout (top-to-bottom):
 *   1. SafetyBadge slot (absolute top-right)
 *   2. Hero area (top ~40% -- photos, data summaries, maps)
 *   3. Content area (middle -- metrics, ratings, details)
 *   4. Action row (bottom -- Call, Visit, Book, Details)
 *
 * Dark glass aesthetic matching the Aspire desktop app:
 *   - Background:  Colors.surface.card (#1C1C1E)
 *   - Border:      Colors.surface.cardBorder (#2C2C2E)
 *   - Border radius: 16 (BorderRadius.xl)
 *   - Max width:   500px, centered
 *
 * Card types (HotelCard, ProductCard, etc.) compose this shell and
 * fill in the slots. This file owns the outer chrome only.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle, Platform } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/tokens';
import { SafetyBadge, type SafetyBadgeProps } from './SafetyBadge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BaseCardProps {
  /** Safety score badge. Pass null to hide. */
  safety: SafetyBadgeProps | null;
  /** Top ~40% hero slot (image, map, chart) */
  heroSlot?: React.ReactNode;
  /** Override default hero container style (e.g. fixed height instead of aspect ratio) */
  heroStyle?: ViewStyle;
  /** Middle content slot (metrics, body text) */
  children: React.ReactNode;
  /** Bottom action buttons slot */
  actionSlot?: React.ReactNode;
  /** Highlight card when it is the active/focused card in the tray */
  isActive?: boolean;
  /** Optional outer style overrides */
  style?: ViewStyle;
  /** Accessibility label for the card */
  accessibilityLabel?: string;
  /** Test ID for testing */
  testID?: string;
  /** Staggered entrance delay in ms. Default 0. Pass index * 80 for sequential reveal. */
  enterDelay?: number;
}

// ─── Platform shadows ───────────────────────────────────────────────────────

const WEB_CARD_SHADOW: ViewStyle = Platform.OS === 'web'
  ? { boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset' }
  : Shadows.elevated;

const WEB_ACTIVE_SHADOW: ViewStyle = Platform.OS === 'web'
  ? { boxShadow: '0 0 0 1px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.25)' }
  : {};

// ─── Component ───────────────────────────────────────────────────────────────

export function BaseCard({
  safety,
  heroSlot,
  heroStyle,
  children,
  actionSlot,
  isActive,
  style,
  accessibilityLabel,
  testID,
  enterDelay = 0,
}: BaseCardProps) {
  return (
    <Animated.View
      entering={FadeInUp.delay(enterDelay).duration(300).springify()}
      style={[
        styles.card,
        WEB_CARD_SHADOW,
        isActive && styles.cardActive,
        isActive && WEB_ACTIVE_SHADOW,
        style,
      ]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
      // Web hover lift: className applied for CSS-based hover effect
      {...(Platform.OS === 'web' ? { className: 'ava-card' } : {})}
    >
      {/* SafetyBadge -- absolute positioned, z-above hero */}
      {safety && (
        <View style={styles.badgeSlot}>
          <SafetyBadge {...safety} />
        </View>
      )}

      {/* Hero area */}
      {heroSlot && <View style={[styles.hero, heroStyle]}>{heroSlot}</View>}

      {/* Content body */}
      <View style={styles.content}>{children}</View>

      {/* Action row */}
      {actionSlot && <View style={styles.actions}>{actionSlot}</View>}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_MAX_WIDTH = 500;
const CARD_MIN_HEIGHT = 580;

const styles = StyleSheet.create({
  card: {
    maxWidth: CARD_MAX_WIDTH,
    minHeight: CARD_MIN_HEIGHT,
    width: '100%' as unknown as number,
    alignSelf: 'center',
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: Colors.accent.cyan,
  },
  badgeSlot: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  hero: {
    width: '100%' as unknown as number,
    aspectRatio: 16 / 9,
    backgroundColor: Colors.background.elevated,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
  },
});
