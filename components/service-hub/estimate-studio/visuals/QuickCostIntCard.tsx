/**
 * QuickCostIntCard — preliminary cost band reveal.
 *
 * Empty state surfaces the dominant evidence gap so the user knows what to
 * supply next (Aspire Law #3: missing data is explicit).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InsightCardBase } from './InsightCardBase';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';

interface Props {
  costBand?: PropertyData['costBand'];
  evidenceGaps?: string[];
  loading: boolean;
  onCtaPress?: () => void;
  onRefresh?: () => void;
}

function formatBand(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1000).toLocaleString('en-US')}K`;
  return `$${value.toLocaleString('en-US')}`;
}

export function QuickCostIntCard({
  costBand,
  evidenceGaps,
  loading,
  onCtaPress,
}: Props) {
  const hasBand =
    costBand &&
    Number.isFinite(costBand.low) &&
    Number.isFinite(costBand.high) &&
    costBand.high >= costBand.low &&
    costBand.high > 0;

  const dominantGap = evidenceGaps && evidenceGaps.length > 0 ? evidenceGaps[0] : null;

  return (
    <InsightCardBase
      icon="trending-up-outline"
      title="Quick Cost Estimate"
      ctaLabel="See estimate"
      onCtaPress={onCtaPress}
      loading={loading}
      testID="quick-cost-int-card"
    >
      <View style={styles.body}>
        {hasBand ? (
          <Text style={styles.range} numberOfLines={1} adjustsFontSizeToFit>
            {formatBand(costBand!.low)} – {formatBand(costBand!.high)}
          </Text>
        ) : (
          <Text style={styles.dash}>—</Text>
        )}
        <Text style={styles.subtitle}>
          {hasBand
            ? 'Estimated Range'
            : dominantGap
              ? `Add ${humanizeGap(dominantGap)} to estimate`
              : 'Add sqft to estimate'}
        </Text>
      </View>
    </InsightCardBase>
  );
}

function humanizeGap(gap: string): string {
  switch (gap) {
    case 'sqft':
      return 'square footage';
    case 'yearBuilt':
      return 'year built';
    case 'zoning':
      return 'zoning';
    case 'propertyType':
      return 'property type';
    default:
      return gap;
  }
}

const styles = StyleSheet.create({
  body: {
    gap: 4,
  },
  range: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  dash: {
    fontSize: 32,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
