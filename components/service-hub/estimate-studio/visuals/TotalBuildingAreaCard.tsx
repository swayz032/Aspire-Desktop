/**
 * TotalBuildingAreaCard — large numeric reveal for total floor area.
 *
 * Aspire Law #7: pure render. Empty state is explicit (Law #3 fail-closed).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InsightCardBase } from './InsightCardBase';

interface Props {
  sqft?: number;
  stories?: number;
  loading: boolean;
  onCtaPress?: () => void;
}

export function TotalBuildingAreaCard({ sqft, stories, loading, onCtaPress }: Props) {
  const formatted =
    typeof sqft === 'number' && Number.isFinite(sqft) && sqft > 0
      ? sqft.toLocaleString('en-US')
      : null;

  return (
    <InsightCardBase
      icon="resize-outline"
      title="Total Building Area"
      ctaLabel="View measurement"
      onCtaPress={onCtaPress}
      loading={loading}
      testID="total-building-area-card"
    >
      <View style={styles.body}>
        <Text style={styles.bigNumber} numberOfLines={1} adjustsFontSizeToFit>
          {formatted ?? '—'}
        </Text>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{formatted ? 'sq ft' : 'Tap to add manually'}</Text>
          {stories ? (
            <Text style={styles.subMeta}>· {stories} {stories === 1 ? 'story' : 'stories'}</Text>
          ) : null}
        </View>
      </View>
    </InsightCardBase>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 4,
  },
  bigNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  subMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
  },
});
