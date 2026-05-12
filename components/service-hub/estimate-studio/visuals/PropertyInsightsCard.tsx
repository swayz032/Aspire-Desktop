/**
 * PropertyInsightsCard — surfaces the high-signal property facts pulled by
 * the aggregator (propertyType, yearBuilt, zoning).
 *
 * Aspire Law #7: pure render — props in, layout out.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InsightCardBase } from './InsightCardBase';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';

interface Props {
  facts?: PropertyData['facts'];
  address?: PropertyData['address'];
  loading: boolean;
  onCtaPress?: () => void;
}

export function PropertyInsightsCard({ facts, address, loading, onCtaPress }: Props) {
  const rows: { label: string; value: string }[] = [];

  if (facts?.propertyType) rows.push({ label: 'Type', value: facts.propertyType });
  if (facts?.yearBuilt) rows.push({ label: 'Built', value: String(facts.yearBuilt) });
  if (facts?.zoning) rows.push({ label: 'Zoning', value: facts.zoning });
  if (facts?.stories) rows.push({ label: 'Stories', value: String(facts.stories) });

  return (
    <InsightCardBase
      icon="business-outline"
      title="Property Details"
      ctaLabel="View details"
      onCtaPress={onCtaPress}
      loading={loading}
      testID="property-insights-card"
    >
      {rows.length === 0 ? (
        <Text style={styles.empty}>
          No property facts resolved yet — drop in evidence to populate.
        </Text>
      ) : (
        <View style={styles.rows}>
          {rows.map((row) => (
            <View style={styles.row} key={row.label}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </InsightCardBase>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  rowValue: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  empty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
  },
});
