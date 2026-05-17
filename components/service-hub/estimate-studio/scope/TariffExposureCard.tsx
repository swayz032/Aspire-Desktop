/**
 * TariffExposureCard — Wave 7.
 *
 * Premium summary card that highlights tariff-flagged materials and their
 * estimated $ impact. Drives the contractor's attention to the line items
 * that are most exposed to Section 232 (steel / aluminum) and softwood
 * lumber tariffs.
 *
 * Wave 5 PROCURE is what populates `tariff_impact_usd`. When PROCURE
 * hasn't run yet, the per-flag count + per-material list still render,
 * but the $ impact shows "—" with a tiny "Tariff data ready when PROCURE
 * completes" note.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintMaterial } from '@/lib/api/blueprintsApi';
import { TruthBadge } from './TruthBadge';

interface Props {
  materials: BlueprintMaterial[];
}

interface Bucket {
  flag: string;
  items: BlueprintMaterial[];
  totalUsd: number | null;
}

export function TariffExposureCard({ materials }: Props): React.ReactElement {
  const buckets = useMemo<Bucket[]>(() => {
    const map = new Map<string, BlueprintMaterial[]>();
    for (const mat of materials) {
      if (!mat.tariff_flagged) continue;
      const flag = mat.tariff_note ?? 'Unclassified tariff';
      const existing = map.get(flag) ?? [];
      existing.push(mat);
      map.set(flag, existing);
    }
    return Array.from(map.entries())
      .map(([flag, items]) => {
        let total: number | null = null;
        for (const m of items) {
          if (typeof m.tariff_impact_usd === 'number') {
            total = (total ?? 0) + m.tariff_impact_usd;
          }
        }
        return { flag, items, totalUsd: total };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [materials]);

  const totalFlaggedCount = buckets.reduce((sum, b) => sum + b.items.length, 0);
  const overallUsd = buckets.reduce<number | null>((sum, b) => {
    if (b.totalUsd == null) return sum;
    return (sum ?? 0) + b.totalUsd;
  }, null);

  if (buckets.length === 0) {
    return (
      <View style={styles.empty} testID="tariff-exposure-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="pricetag-outline"
            size={28}
            color="rgba(74,222,128,0.85)"
          />
        </View>
        <Text style={styles.emptyTitle}>No tariff exposure</Text>
        <Text style={styles.emptyBody}>
          PROCURE didn't flag any materials in this plan set against current
          Section 232 or softwood lumber tariff schedules.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scrollContent}
      testID="tariff-exposure-card"
    >
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Flagged Materials</Text>
          <Text style={styles.summaryValue}>{totalFlaggedCount}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Est. Tariff Impact</Text>
          <Text style={styles.summaryValue}>
            {overallUsd != null
              ? `$${overallUsd.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : '—'}
          </Text>
        </View>
        {overallUsd == null ? (
          <Text style={styles.summaryHint}>
            Tariff data ready when PROCURE completes.
          </Text>
        ) : null}
      </View>

      <View style={styles.buckets}>
        {buckets.map((bucket) => (
          <View
            key={bucket.flag}
            style={styles.bucket}
            testID={`tariff-bucket-${_slugify(bucket.flag)}`}
          >
            <View style={styles.bucketHeader}>
              <Ionicons
                name="alert-outline"
                size={14}
                color="#fb923c"
              />
              <Text style={styles.bucketFlag}>{bucket.flag}</Text>
              <Text style={styles.bucketCount}>
                {bucket.items.length} item{bucket.items.length === 1 ? '' : 's'}
              </Text>
              {bucket.totalUsd != null ? (
                <Text style={styles.bucketUsd}>
                  $
                  {bucket.totalUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </Text>
              ) : null}
            </View>
            <View style={styles.bucketList}>
              {bucket.items.map((mat) => (
                <View
                  key={mat.material_id}
                  style={styles.materialRow}
                  testID={`tariff-material-${mat.material_id}`}
                >
                  <View style={styles.materialBody}>
                    <Text style={styles.materialLabel} numberOfLines={2}>
                      {mat.label}
                    </Text>
                    <View style={styles.materialMeta}>
                      <Text style={styles.materialQty}>
                        {mat.quantity.toLocaleString()} {mat.unit}
                      </Text>
                      <TruthBadge truth={mat.truth} />
                      {mat.supplier_hint ? (
                        <Text style={styles.materialSupplier} numberOfLines={1}>
                          · {mat.supplier_hint}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {typeof mat.tariff_impact_usd === 'number' ? (
                    <Text style={styles.materialUsd}>
                      $
                      {mat.tariff_impact_usd.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  ) : (
                    <Text style={styles.materialUsdPending}>—</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function _slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  summary: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(251,146,60,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.25)',
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  summaryHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    fontStyle: 'italic',
    letterSpacing: -0.05,
  },
  buckets: {
    gap: 14,
  },
  bucket: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  bucketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  bucketFlag: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  bucketCount: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  bucketUsd: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
  },
  bucketList: {
    gap: 1,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  materialBody: {
    flex: 1,
    gap: 4,
  },
  materialLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.05,
  },
  materialMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  materialQty: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  materialSupplier: {
    flexShrink: 1,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.45)',
  },
  materialUsd: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
  },
  materialUsdPending: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(74,222,128,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 17,
  },
});
