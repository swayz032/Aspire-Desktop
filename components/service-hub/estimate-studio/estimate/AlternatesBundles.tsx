/**
 * AlternatesBundles — Wave 15.
 *
 * Three side-by-side bundle cards (Premium / Standard / Economy) that swap
 * the markup recipe + tariff handling and show the delta against the current
 * bid. One-click "Apply this bundle" mutates estimateUiStore so the Bid
 * Summary canvas reflects the new pricing immediately.
 *
 * v1 ships with hardcoded bundle definitions. A follow-up Wave will lift
 * these into office_memory so each contractor's bundles are theirs.
 *
 * Mobile (<900px): cards stack vertically.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
import {
  estimateUiActions,
  useEstimateUi,
  type EstimateMarkupRules,
} from '@/lib/estimateUiStore';

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

interface BundleDef {
  key: 'premium' | 'standard' | 'economy';
  label: string;
  tagline: string;
  swaps: string[];
  markup: EstimateMarkupRules;
  accent: string;
}

const BUNDLES: BundleDef[] = [
  {
    key: 'premium',
    label: 'Premium',
    tagline: 'USA-mill stock · 28-day warranty · concierge install',
    swaps: [
      'USA-mill rebar (+$2,100 over import)',
      'Premium fixture line · all-brass plumbing',
      'Master electrician supervision · 25% labor lift',
    ],
    markup: { laborPct: 28, materialsPct: 30, contingencyPct: 8, tariffAbsorb: false },
    accent: '#fbbf24',
  },
  {
    key: 'standard',
    label: 'Standard',
    tagline: 'Code-compliant baseline · mixed sourcing',
    swaps: [
      'Domestic where competitive, import elsewhere',
      'Mid-tier fixture line',
      'Standard subcontractor crew',
    ],
    markup: { laborPct: 18, materialsPct: 22, contingencyPct: 5, tariffAbsorb: false },
    accent: '#60a5fa',
  },
  {
    key: 'economy',
    label: 'Economy',
    tagline: 'Aggressive import sourcing · longer lead times',
    swaps: [
      'Import rebar · softwood substituted where possible',
      'Builder-grade fixtures',
      'Pass-through tariff line included',
    ],
    markup: { laborPct: 12, materialsPct: 15, contingencyPct: 4, tariffAbsorb: false },
    accent: '#4ade80',
  },
];

export function AlternatesBundles({
  materials,
  assemblies,
}: Props): React.ReactElement {
  const ui = useEstimateUi();
  const {
    setLaborPct,
    setMaterialsPct,
    setContingencyPct,
    setTariffAbsorb,
  } = estimateUiActions();
  const { width } = useWindowDimensions();
  const isStacked = width < 900;
  const [appliedKey, setAppliedKey] = useState<string | null>(null);

  // Clear "Applied" badge after 1.4s so it doesn't linger.
  useEffect(() => {
    if (!appliedKey) return;
    const t = setTimeout(() => setAppliedKey(null), 1400);
    return () => clearTimeout(t);
  }, [appliedKey]);

  const built = useMemo(
    () =>
      buildLineItems({
        materials,
        assemblies,
        baseScopeOnly: true,
        qtyOverrides: ui.qtyOverrides,
        priceOverrides: ui.priceOverrides,
        hiddenLineItemIds: ui.hiddenLineItemIds,
      }),
    [materials, assemblies, ui.qtyOverrides, ui.priceOverrides, ui.hiddenLineItemIds],
  );

  const currentMoney = useMemo(
    () =>
      computeMoneyStack({
        lines: built.all,
        markup: ui.markup,
        perMaterialAbsorb: ui.perMaterialAbsorb,
      }),
    [built.all, ui.markup, ui.perMaterialAbsorb],
  );

  const bundleCards = useMemo(
    () =>
      BUNDLES.map((b) => {
        const m = computeMoneyStack({
          lines: built.all,
          markup: b.markup,
          perMaterialAbsorb: ui.perMaterialAbsorb,
        });
        return {
          ...b,
          total: m.total,
          delta: m.total - currentMoney.total,
        };
      }),
    [built.all, currentMoney.total, ui.perMaterialAbsorb],
  );

  const applyBundle = (bundle: BundleDef): void => {
    setLaborPct(bundle.markup.laborPct);
    setMaterialsPct(bundle.markup.materialsPct);
    setContingencyPct(bundle.markup.contingencyPct);
    setTariffAbsorb(bundle.markup.tariffAbsorb);
    setAppliedKey(bundle.key);
    console.info('[estimate] apply bundle (stub)', bundle.key, bundle.markup);
  };

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      testID="alternates-bundles"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Three ways to bid this job</Text>
        <Text style={styles.headerSubtitle}>
          Currently bidding {formatUsd(currentMoney.total)}. Each bundle swaps a
          different mix of materials, labor markup, and contingency — the delta
          shows how the client-facing total moves.
        </Text>
      </View>

      <View style={[styles.grid, isStacked && styles.gridStacked]}>
        {bundleCards.map((b) => {
          const isApplied = appliedKey === b.key;
          return (
            <View key={b.key} style={styles.card}>
              <View style={[styles.cardAccent, { backgroundColor: b.accent }]} />
              <View style={styles.cardHeader}>
                <Text style={[styles.cardLabel, { color: b.accent }]}>
                  {b.label.toUpperCase()}
                </Text>
                <Text style={styles.cardTagline}>{b.tagline}</Text>
              </View>

              <View style={styles.cardTotal}>
                <Text style={styles.cardTotalValue}>{formatUsd(b.total)}</Text>
                <Text
                  style={[
                    styles.cardDelta,
                    b.delta > 0 && styles.cardDeltaUp,
                    b.delta < 0 && styles.cardDeltaDown,
                  ]}
                >
                  {b.delta === 0
                    ? 'no change vs current'
                    : `${formatUsd(b.delta, { sign: true })} vs current`}
                </Text>
              </View>

              <View style={styles.markupGrid}>
                <View style={styles.markupCell}>
                  <Text style={styles.markupValue}>{b.markup.laborPct}%</Text>
                  <Text style={styles.markupLabel}>Labor</Text>
                </View>
                <View style={styles.markupCell}>
                  <Text style={styles.markupValue}>{b.markup.materialsPct}%</Text>
                  <Text style={styles.markupLabel}>Mats</Text>
                </View>
                <View style={styles.markupCell}>
                  <Text style={styles.markupValue}>{b.markup.contingencyPct}%</Text>
                  <Text style={styles.markupLabel}>Cont.</Text>
                </View>
              </View>

              <View style={styles.swapsList}>
                {b.swaps.map((swap) => (
                  <View key={swap} style={styles.swapRow}>
                    <Ionicons
                      name="arrow-forward"
                      size={10}
                      color={b.accent}
                    />
                    <Text style={styles.swapText}>{swap}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => applyBundle(b)}
                accessibilityRole="button"
                accessibilityLabel={`Apply ${b.label} bundle`}
                style={({ hovered, pressed }: any) => [
                  styles.applyBtn,
                  { borderColor: b.accent },
                  isApplied && { backgroundColor: b.accent },
                  hovered && !isApplied && { backgroundColor: `${b.accent}18` },
                  pressed && styles.applyBtnPressed,
                ]}
                testID={`bundle-apply-${b.key}`}
              >
                {isApplied ? (
                  <>
                    <Ionicons name="checkmark" size={13} color="#0b1220" />
                    <Text style={[styles.applyBtnText, { color: '#0b1220' }]}>
                      Applied
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.applyBtnText, { color: b.accent }]}>
                    Apply this bundle
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  scroll: { padding: 20, gap: 18 },
  header: { gap: 6 },
  headerTitle: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontFamily: BODY_SANS,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
    maxWidth: 720,
  },
  grid: { flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  gridStacked: { flexDirection: 'column' },
  card: {
    flex: 1,
    minWidth: 240,
    padding: 18,
    paddingTop: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cardHeader: { gap: 4 },
  cardLabel: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  cardTagline: {
    fontFamily: BODY_SANS,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 16,
  },
  cardTotal: { gap: 4 },
  cardTotalValue: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  cardDelta: {
    fontFamily: MONO,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  cardDeltaUp: { color: '#fb923c' },
  cardDeltaDown: { color: '#4ade80' },
  markupGrid: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  markupCell: { flex: 1, alignItems: 'center', gap: 2 },
  markupValue: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
  },
  markupLabel: {
    fontFamily: MONO,
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  swapsList: { gap: 6 },
  swapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  swapText: {
    flex: 1,
    fontFamily: BODY_SANS,
    fontSize: 11,
    color: 'rgba(255,255,255,0.70)',
    lineHeight: 15,
    letterSpacing: -0.05,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'transparent',
    marginTop: 'auto',
  },
  applyBtnPressed: { opacity: 0.82 },
  applyBtnText: {
    fontFamily: BODY_SANS,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
