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
 *   - Dimensions:    500x580 (vertical) / 880x440 (horizontal), centered
 *
 * Card types (HotelCard, ProductCard, etc.) compose this shell and
 * fill in the slots. This file owns the outer chrome only.
 */

import React from 'react';
import { View, ScrollView, StyleSheet, type ViewStyle, Platform } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, Shadows } from '@/constants/tokens';
import { SafetyBadge, type SafetyBadgeProps } from './SafetyBadge';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Card orientation. Vertical = 500x580 (portrait, hero-on-top, content-below).
 * Horizontal = 880x440 (landscape, image-left ~580px, info-right ~300px).
 */
export type CardOrientation = 'vertical' | 'horizontal';

/** Outer container dimensions per orientation. The carousel queries this to
 *  pick the right translateX offset for side peeks. */
export const CARD_DIMS = {
  vertical: { width: 500, height: 580 },
  horizontal: { width: 880, height: 440 },
} as const;

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
  /** Card orientation. Default 'vertical' (500x580). Horizontal = 880x440 for hotel/product cards. */
  orientation?: CardOrientation;
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
  orientation = 'vertical',
}: BaseCardProps) {
  const dims = CARD_DIMS[orientation];
  const dimStyle: ViewStyle = {
    maxWidth: dims.width,
    width: dims.width,
    height: dims.height,
    maxHeight: dims.height,
  };
  const isHorizontal = orientation === 'horizontal';
  return (
    <Animated.View
      entering={FadeInUp.delay(enterDelay).duration(300).springify()}
      style={[
        styles.card,
        isHorizontal && styles.cardHorizontal,
        dimStyle,
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

      {isHorizontal ? (
        <>
          {/* LEFT pane: hero (580x440) -- image fills entire region */}
          {heroSlot && (
            <View style={[styles.heroHorizontal, heroStyle]}>{heroSlot}</View>
          )}

          {/* RIGHT pane: fixed-height info stack (300x440) -- NO scrolling */}
          <View style={styles.contentHorizontal}>
            <View style={styles.contentHorizontalBody}>{children}</View>
            {actionSlot && (
              <View style={styles.actionsHorizontal}>{actionSlot}</View>
            )}
          </View>
        </>
      ) : (
        <>
          {/* Hero area (fixed) */}
          {heroSlot && <View style={[styles.hero, heroStyle]}>{heroSlot}</View>}

          {/* Content body (scrollable) -- flex:1 so overflow scrolls inside the card,
              never pushes the card taller. */}
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            // Web: native scroll; touch: vertical only
            accessibilityLabel="Card details"
          >
            {children}
          </ScrollView>

          {/* Action row (fixed) */}
          {actionSlot && <View style={styles.actions}>{actionSlot}</View>}
        </>
      )}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

/** Legacy export — vertical card height. Prefer CARD_DIMS[orientation].height. */
export const CARD_HEIGHT = CARD_DIMS.vertical.height;

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    // flex column so hero (fixed) + content (flex:1) + actions (fixed) layout works
    flexDirection: 'column',
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
    flexShrink: 0,
  },
  contentScroll: {
    flex: 1,
    // Web: enable native overflow auto so trackpad/scrollwheel works
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', overflowX: 'hidden' } as unknown as ViewStyle)
      : {}),
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    // No flexGrow -- content sizes to its natural height; ScrollView handles overflow
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
    flexShrink: 0,
    backgroundColor: Colors.surface.card,
  },

  // ── Horizontal layout (880x440 -- LEFT 580 image / RIGHT 300 info) ──
  cardHorizontal: {
    flexDirection: 'row',
  },
  heroHorizontal: {
    width: 580,
    height: '100%' as unknown as number,
    backgroundColor: Colors.background.elevated,
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  contentHorizontal: {
    width: 300,
    height: '100%' as unknown as number,
    flexShrink: 0,
    flexDirection: 'column',
    backgroundColor: Colors.surface.card,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.surface.cardBorder,
  },
  contentHorizontalBody: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    overflow: 'hidden',
  },
  actionsHorizontal: {
    flexDirection: 'column',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.surface.cardBorder,
    flexShrink: 0,
  },
});
