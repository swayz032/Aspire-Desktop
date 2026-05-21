/**
 * TariffDrilldown — Wave 15.
 *
 * Per-item tariff exposure dashboard. Surfaces:
 *   - Total tariff $ exposure (top of the card)
 *   - Breakdown by tariff category (Section 232 steel/aluminum, softwood
 *     lumber, etc.)
 *   - Top 5 most-impacted line items with per-item absorb/pass-through
 *     toggles. Each toggle immediately recalcs the bid impact below.
 *
 * Aspire Laws:
 *   - Law #7: pure render. Toggles write to estimateUiStore;
 *     the bidMath computeMoneyStack reads from there.
 */
import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintAssembly,
  BlueprintMaterial,
} from '@/lib/api/blueprintsApi';
import {
  buildLineItems,
  computeMoneyStack,
  formatUsd,
} from '@/lib/estimate/bidMath';
import { estimateUiActions, useEstimateUi } from '@/lib/estimateUiStore';

interface Props {
  materials: BlueprintMaterial[];
  assemblies: BlueprintAssembly[];
}

const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
  default: 'Menlo',
});
const SERIF = Platform.select({
  web: '"Cormorant Garamond", "Source Serif Pro", Georgia, serif',
  default: 'Georgia',
});
const BODY_SANS = Platform.select({
  web: '"Söhne", "Inter Tight", "Helvetica Neue", system-ui, sans-serif',
  default: 'System',
});

function categorize(note: string | null): string {
  if (!note) return 'Other';
  const n = note.toLowerCase();
  if (n.includes('232') || n.includes('steel')) return 'Section 232 — Steel';
  if (n.includes('aluminum')) return 'Section 232 — Aluminum';
  if (n.includes('softwood') || n.includes('lumber')) return 'Softwood lumber';
  if (n.includes('copper')) return 'Copper';
  return note;
}

export function TariffDrilldown({
  materials,
  assemblies,
}: Props): React.ReactElement {
  const ui = useEstimateUi();
  const { toggleMaterialAbsorb } = estimateUiActions();

  const built = useMemo(
    () =>
      buildLineItems({
        materials,
        assemblies,
        baseScopeOnly: false,
        qtyOverrides: ui.qtyOverrides,
        priceOverrides: ui.priceOverrides,
        hiddenLineItemIds: ui.hiddenLineItemIds,
      }),
    [materials, assemblies, ui.qtyOverrides, ui.priceOverrides, ui.hiddenLineItemIds],
  );

  const money = useMemo(
    () =>
      computeMoneyStack({
        lines: built.all,
        markup: ui.markup,
        perMaterialAbsorb: ui.perMaterialAbsorb,
      }),
    [built.all, ui.markup, ui.perMaterialAbsorb],
  );

  const tariffLines = useMemo(
    () =>
      built.all
        .filter((l) => l.tariffFlagged && !l.hidden)
        .sort((a, b) => (b.tariffImpactUsd ?? 0) - (a.tariffImpactUsd ?? 0)),
    [built.all],
  );

  const totalExposure = useMemo(
    () =>
      tariffLines.reduce<number>(
        (sum, l) => sum + (l.tariffImpactUsd ?? 0),
        0,
      ),
    [tariffLines],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of tariffLines) {
      const cat = categorize(l.tariffNote);
      map.set(cat, (map.get(cat) ?? 0) + (l.tariffImpactUsd ?? 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [tariffLines]);

  const top5 = tariffLines.slice(0, 5);

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      testID="tariff-drilldown"
    >
      {/* ============== Hero ============== */}
      <View style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroLabel}>Total tariff exposure</Text>
          <Text style={styles.heroValue}>{formatUsd(totalExposure)}</Text>
          <Text style={styles.heroNote}>
            {tariffLines.length} flagged line{tariffLines.length === 1 ? '' : 's'} · current
            bid impact {formatUsd(money.tariffPassThrough)}
          </Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="pricetag" size={28} color="#fb923c" />
        </View>
      </View>

      {/* ============== Category breakdown ============== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By category</Text>
        {byCategory.length === 0 ? (
          <View style={styles.emptyHost}>
            <Text style={styles.emptyText}>
              No tariff-flagged materials yet. Drew's PROCURE stage stamps these.
            </Text>
          </View>
        ) : (
          byCategory.map(([cat, amount]) => {
            const pct = totalExposure > 0 ? (amount / totalExposure) * 100 : 0;
            return (
              <View key={cat} style={styles.catRow}>
                <View style={styles.catLabelCol}>
                  <Text style={styles.catLabel}>{cat}</Text>
                  <Text style={styles.catAmount}>{formatUsd(amount)}</Text>
                </View>
                <View style={styles.catBarTrack}>
                  <View style={[styles.catBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.catPct}>{pct.toFixed(0)}%</Text>
              </View>
            );
          })
        )}
      </View>

      {/* ============== Top 5 line items ============== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top 5 impacted line items</Text>
        {top5.length === 0 ? (
          <View style={styles.emptyHost}>
            <Text style={styles.emptyText}>Nothing to drill into.</Text>
          </View>
        ) : (
          top5.map((line) => {
            const override = ui.perMaterialAbsorb[line.id];
            const absorb =
              override === undefined ? ui.markup.tariffAbsorb : override;
            return (
              <View key={line.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemDesc} numberOfLines={2}>
                    {line.description}
                  </Text>
                  <View style={styles.itemMeta}>
                    <Text style={styles.itemMetaText}>
                      {line.tariffNote ?? 'Tariff'}
                    </Text>
                    <Text style={styles.itemMetaDim}>·</Text>
                    <Text style={styles.itemMetaText}>
                      {formatUsd(line.tariffImpactUsd)} impact
                    </Text>
                  </View>
                </View>
                <View style={styles.itemSwitch}>
                  <Pressable
                    onPress={() => toggleMaterialAbsorb(line.id)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !absorb }}
                    accessibilityLabel={`Toggle tariff for ${line.description}`}
                    style={({ hovered, pressed }: any) => [
                      styles.switchTrack,
                      !absorb && styles.switchTrackOn,
                      hovered && styles.switchTrackHover,
                      pressed && styles.switchTrackPressed,
                    ]}
                    testID={`tariff-toggle-${line.id}`}
                  >
                    <View
                      style={[styles.switchThumb, !absorb && styles.switchThumbOn]}
                    />
                  </Pressable>
                  <Text style={styles.switchLabel}>
                    {absorb ? 'Absorbed' : 'Pass-through'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  scroll: { padding: 20, gap: 18 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(251,146,60,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.35)',
    gap: 18,
  },
  heroLeft: { flex: 1, gap: 6 },
  heroLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(251,146,60,0.85)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontFamily: SERIF,
    fontSize: 36,
    fontWeight: '700',
    color: '#fb923c',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroNote: {
    fontFamily: BODY_SANS,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.60)',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251,146,60,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  sectionTitle: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catLabelCol: { minWidth: 180, gap: 2 },
  catLabel: {
    fontFamily: BODY_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
  },
  catAmount: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
  },
  catBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    backgroundColor: '#fb923c',
  },
  catPct: {
    fontFamily: MONO,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemLeft: { flex: 1, gap: 3 },
  itemDesc: {
    fontFamily: BODY_SANS,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: -0.05,
    lineHeight: 17,
  },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemMetaText: {
    fontFamily: MONO,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
  },
  itemMetaDim: { color: 'rgba(255,255,255,0.30)', fontFamily: MONO, fontSize: 10 },
  itemSwitch: { alignItems: 'center', gap: 5 },
  switchTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 2,
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 160ms ease' } as any)
      : {}),
  },
  switchTrackOn: { backgroundColor: 'rgba(251,146,60,0.55)' },
  switchTrackHover: { opacity: 0.95 },
  switchTrackPressed: { opacity: 0.78 },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    ...(Platform.OS === 'web'
      ? ({ transition: 'transform 160ms ease' } as any)
      : {}),
  },
  switchThumbOn: {
    backgroundColor: '#fff',
    transform: [{ translateX: 18 }],
  },
  switchLabel: {
    fontFamily: MONO,
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emptyHost: { paddingVertical: 14 },
  emptyText: {
    fontFamily: BODY_SANS,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.45)',
  },
});
