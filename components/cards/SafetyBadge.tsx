/**
 * SafetyBadge -- Research result quality/safety indicator.
 *
 * Positioned top-right on BaseCard. Color-coded shield icon with numeric score.
 *   - Green shield:  "Recommended"      (score >= 7.5)
 *   - Amber caution: "Use Caution"      (score 3.5 - 7.4)
 *   - Red warning:   "Not Recommended"  (score < 3.5)
 *
 * The badge also drives the ambient glow color of the ResearchModal.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SafetyTier = 'recommended' | 'caution' | 'not_recommended';

export interface SafetyBadgeProps {
  score: number;
  /** Override auto-derived tier if needed */
  tier?: SafetyTier;
}

// ─── Tier Resolution ─────────────────────────────────────────────────────────

export function deriveTier(score: number): SafetyTier {
  if (score >= 7.5) return 'recommended';
  if (score >= 3.5) return 'caution';
  return 'not_recommended';
}

const TIER_CONFIG: Record<SafetyTier, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  recommended:     { label: 'Recommended',     color: Colors.safety.recommended, icon: 'shield-checkmark' },
  caution:         { label: 'Use Caution',     color: Colors.safety.caution, icon: 'warning' },
  not_recommended: { label: 'Not Recommended', color: Colors.safety.notRecommended, icon: 'close-circle' },
};

/** Map safety tier to ambient glow hex for the ResearchModal backdrop. */
export function tierToGlowColor(tier: SafetyTier): string {
  return TIER_CONFIG[tier].color;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SafetyBadge({ score, tier }: SafetyBadgeProps) {
  const resolvedTier = tier ?? deriveTier(score);
  const config = TIER_CONFIG[resolvedTier];
  const displayScore = score.toFixed(1);

  return (
    <View
      style={[styles.container, { backgroundColor: `${config.color}18` }]}
      accessibilityRole="text"
      accessibilityLabel={`Safety score ${displayScore}, ${config.label}`}
    >
      <Ionicons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.score, { color: config.color }]}>{displayScore}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  score: {
    ...Typography.smallMedium,
    letterSpacing: 0.3,
  },
});
