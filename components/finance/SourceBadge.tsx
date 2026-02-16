import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

interface SourceBadgeProps {
  source: 'plaid' | 'stripe' | 'qbo' | 'gusto' | 'computed';
  lastSyncAt: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  compact?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  plaid: 'Plaid',
  stripe: 'Stripe',
  qbo: 'QuickBooks',
  gusto: 'Gusto',
  computed: 'Computed',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: Colors.semantic.success,
  medium: Colors.semantic.warning,
  low: Colors.semantic.error,
  none: Colors.text.disabled,
};

const CONFIDENCE_BG: Record<string, string> = {
  high: Colors.semantic.successLight,
  medium: Colors.semantic.warningLight,
  low: Colors.semantic.errorLight,
  none: 'rgba(255,255,255,0.05)',
};

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function SourceBadge({ source, lastSyncAt, confidence, compact = false }: SourceBadgeProps) {
  const dotColor = CONFIDENCE_COLORS[confidence];
  const bgColor = CONFIDENCE_BG[confidence];
  const borderColor = dotColor + '33';
  const syncText = getRelativeTime(lastSyncAt);

  return (
    <View style={[
      styles.container,
      { backgroundColor: bgColor, borderColor },
      Platform.OS === 'web' && ({ cursor: 'default' } as any),
    ]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.sourceLabel}>{SOURCE_LABELS[source] || source}</Text>
      {!compact && syncText ? (
        <Text style={styles.syncTime}>{syncText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceLabel: {
    ...Typography.smallMedium,
    color: Colors.text.secondary,
  },
  syncTime: {
    ...Typography.micro,
    color: Colors.text.muted,
    marginLeft: 2,
  },
});
