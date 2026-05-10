/**
 * MaterialSignalsCard — list of detected materials with confidence badges.
 *
 * Confidence colors:
 *   HIGH    → amber  (#fbbf24) — primary surface signal
 *   MEDIUM  → blue   (#3b82f6) — secondary support
 *   LOW     → grey   — soft weight, easy to scan past
 *
 * Aspire Law #7: pure render.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { InsightCardBase } from './InsightCardBase';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';

type Material = PropertyData['signals']['materials'][number];

interface Props {
  signals?: Material[];
  roofType?: string;
  loading: boolean;
  onCtaPress?: () => void;
}

const CONFIDENCE_LABEL: Record<Material['confidence'], string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

const CONFIDENCE_COLOR: Record<
  Material['confidence'],
  { bg: string; border: string; fg: string }
> = {
  high: {
    bg: 'rgba(251, 191, 36, 0.14)',
    border: 'rgba(251, 191, 36, 0.30)',
    fg: '#fbbf24',
  },
  medium: {
    bg: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.30)',
    fg: '#60a5fa',
  },
  low: {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.10)',
    fg: 'rgba(255,255,255,0.55)',
  },
};

export function MaterialSignalsCard({ signals, roofType, loading, onCtaPress }: Props) {
  // Synthesize a roof signal if the aggregator surfaced one explicitly.
  const merged: Material[] = (() => {
    const out = [...(signals ?? [])];
    if (roofType && !out.some((m) => m.name.toLowerCase().includes('roof'))) {
      out.unshift({ name: `${roofType} Roofing`, confidence: 'high' });
    }
    return out.slice(0, 5); // cap to 5 lines so the card doesn't overflow
  })();

  return (
    <InsightCardBase
      icon="layers-outline"
      title="Material Signals"
      ctaLabel="View signals"
      onCtaPress={onCtaPress}
      loading={loading}
      testID="material-signals-card"
    >
      {merged.length === 0 ? (
        <Text style={styles.empty}>No signals detected yet.</Text>
      ) : (
        <View style={styles.list}>
          {merged.map((mat) => {
            const tone = CONFIDENCE_COLOR[mat.confidence];
            return (
              <View style={styles.row} key={mat.name}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {mat.name}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: tone.bg, borderColor: tone.border },
                  ]}
                >
                  <Text style={[styles.badgeLabel, { color: tone.fg }]}>
                    {CONFIDENCE_LABEL[mat.confidence]}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </InsightCardBase>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  empty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
  },
});
