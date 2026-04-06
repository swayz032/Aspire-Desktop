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
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/tokens';
import { SafetyBadge, type SafetyBadgeProps } from './SafetyBadge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BaseCardProps {
  /** Safety score badge. Pass null to hide. */
  safety: SafetyBadgeProps | null;
  /** Top ~40% hero slot (image, map, chart) */
  heroSlot?: React.ReactNode;
  /** Middle content slot (metrics, body text) */
  children: React.ReactNode;
  /** Bottom action buttons slot */
  actionSlot?: React.ReactNode;
  /** Optional outer style overrides */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// ─── Web shadow (CSS box-shadow with blur — better than RN shadow on web) ────

const WEB_CARD_SHADOW: ViewStyle = Platform.OS === 'web'
  ? {
      // @ts-expect-error -- RN web supports boxShadow string
      boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset',
    }
  : Shadows.elevated;

// ─── Component ───────────────────────────────────────────────────────────────

export function BaseCard({ safety, heroSlot, children, actionSlot, style, testID }: BaseCardProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[styles.card, WEB_CARD_SHADOW, style]}
      testID={testID}
      accessibilityRole="none"
    >
      {/* SafetyBadge -- absolute positioned, z-above hero */}
      {safety && (
        <View style={styles.badgeSlot}>
          <SafetyBadge {...safety} />
        </View>
      )}

      {/* Hero area */}
      {heroSlot && <View style={styles.hero}>{heroSlot}</View>}

      {/* Content body */}
      <View style={styles.content}>{children}</View>

      {/* Action row */}
      {actionSlot && <View style={styles.actions}>{actionSlot}</View>}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_MAX_WIDTH = 500;

const styles = StyleSheet.create({
  card: {
    maxWidth: CARD_MAX_WIDTH,
    width: '100%' as unknown as number, // RN web accepts string
    alignSelf: 'center',
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
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
