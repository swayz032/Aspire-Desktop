/**
 * TruthDistributionChart — Wave 12.
 *
 * The 7th Scope canvas card. Visualises HOW MUCH of the project's understanding
 * is built from solid facts versus best-guesses. Three layers:
 *
 *   1) Hero — large overall confidence % + headline classification.
 *   2) Stacked horizontal bar — the truth-class distribution across all facts
 *      (observed / derived / assumed / missing / *_confirmed). The single most
 *      important visual on this page.
 *   3) Per-class breakdown rows — each truth class with its count + share %
 *      + a thin track bar. Tabular numbers throughout.
 *
 * Data sources:
 *   - `BlueprintStory.truth_distribution` for the fact-level counts.
 *   - `BlueprintStory.mean_confidence` for the headline %.
 *   - `BlueprintAssembly[]` + `BlueprintMaterial[]` aggregated for the
 *     "assemblies / materials by truth" sub-stats (so contractors see that
 *     "82% of the materials list is observed" — not just the story facts).
 *
 * Law #7: pure render — no decisions, no fetch. The chart is a derived view
 * over the existing useBlueprintStory() hook.
 */
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintAssembly,
  BlueprintMaterial,
  BlueprintStory,
  TruthClass,
} from '@/lib/api/blueprintsApi';
import { getTruthStyle } from './TruthBadge';

interface Props {
  story: BlueprintStory | null;
  assemblies: ReadonlyArray<BlueprintAssembly>;
  materials: ReadonlyArray<BlueprintMaterial>;
  isPolling: boolean;
}

// Trust order — solid → soft. Drives both the bar layout and legend.
const TRUTH_ORDER: ReadonlyArray<TruthClass> = [
  'observed',
  'field_confirmed',
  'vendor_confirmed',
  'permit_confirmed',
  'derived',
  'assumed',
  'missing',
];

// Anything in this set counts toward "confirmed share" — the contractor's
// shortest mental tally of "how solid is this project?".
const CONFIRMED: ReadonlySet<TruthClass> = new Set<TruthClass>([
  'observed',
  'field_confirmed',
  'vendor_confirmed',
  'permit_confirmed',
]);

function _classify(pct: number): { label: string; tone: 'high' | 'mid' | 'low' } {
  if (pct >= 85) return { label: 'Bid-ready', tone: 'high' };
  if (pct >= 65) return { label: 'Mostly solid', tone: 'mid' };
  return { label: 'Field-confirm before bid', tone: 'low' };
}

interface AggBucket {
  count: number;
}

function _aggregateTruth(
  story: BlueprintStory | null,
  assemblies: ReadonlyArray<BlueprintAssembly>,
  materials: ReadonlyArray<BlueprintMaterial>,
): Record<TruthClass, AggBucket> {
  const init: Record<TruthClass, AggBucket> = {
    observed: { count: 0 },
    derived: { count: 0 },
    assumed: { count: 0 },
    missing: { count: 0 },
    field_confirmed: { count: 0 },
    vendor_confirmed: { count: 0 },
    permit_confirmed: { count: 0 },
  };
  if (story?.truth_distribution) {
    for (const tc of TRUTH_ORDER) {
      init[tc].count += story.truth_distribution[tc] ?? 0;
    }
  }
  for (const a of assemblies) init[a.truth].count += 1;
  for (const m of materials) init[m.truth].count += 1;
  return init;
}

export function TruthDistributionChart({
  story,
  assemblies,
  materials,
  isPolling,
}: Props): React.ReactElement {
  const agg = useMemo(
    () => _aggregateTruth(story, assemblies, materials),
    [story, assemblies, materials],
  );

  const total = useMemo(
    () => TRUTH_ORDER.reduce((sum, tc) => sum + agg[tc].count, 0),
    [agg],
  );

  const confirmedCount = useMemo(
    () =>
      TRUTH_ORDER.filter((tc) => CONFIRMED.has(tc)).reduce(
        (sum, tc) => sum + agg[tc].count,
        0,
      ),
    [agg],
  );
  const confirmedPct = total > 0 ? (confirmedCount / total) * 100 : 0;

  const overallPct = story?.mean_confidence != null
    ? Math.round(story.mean_confidence * 100)
    : Math.round(confirmedPct);
  const klass = _classify(overallPct);

  // Empty state — no facts have streamed yet.
  if (total === 0) {
    return (
      <View style={styles.empty} testID="truth-distribution-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="analytics-outline"
            size={28}
            color="rgba(255,255,255,0.55)"
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isPolling ? 'Counting facts…' : 'No facts yet'}
        </Text>
        <Text style={styles.emptyBody}>
          {isPolling
            ? "Drew is still classifying. The truth distribution will appear once REASON has produced facts."
            : 'Once the plan set is reasoned over, the truth distribution will appear here.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scrollContent}
      testID="truth-distribution-chart"
    >
      <View style={styles.column}>
        {/* Hero — the one number a contractor remembers. */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroEyebrow}>Project Confidence</Text>
            <View style={styles.heroValueRow}>
              <Text
                style={[
                  styles.heroValue,
                  klass.tone === 'high' && styles.heroValueHigh,
                  klass.tone === 'mid' && styles.heroValueMid,
                  klass.tone === 'low' && styles.heroValueLow,
                ]}
              >
                {overallPct}
              </Text>
              <Text style={styles.heroPct}>%</Text>
            </View>
            <View
              style={[
                styles.heroChip,
                klass.tone === 'high' && styles.heroChipHigh,
                klass.tone === 'mid' && styles.heroChipMid,
                klass.tone === 'low' && styles.heroChipLow,
              ]}
            >
              <Ionicons
                name={
                  klass.tone === 'high'
                    ? 'checkmark-circle-outline'
                    : klass.tone === 'mid'
                      ? 'flash-outline'
                      : 'alert-circle-outline'
                }
                size={12}
                color={
                  klass.tone === 'high'
                    ? '#4ade80'
                    : klass.tone === 'mid'
                      ? '#fbbf24'
                      : '#fb923c'
                }
              />
              <Text
                style={[
                  styles.heroChipText,
                  klass.tone === 'high' && styles.heroChipTextHigh,
                  klass.tone === 'mid' && styles.heroChipTextMid,
                  klass.tone === 'low' && styles.heroChipTextLow,
                ]}
              >
                {klass.label}
              </Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            <HeroStat
              value={`${Math.round(confirmedPct)}%`}
              label="confirmed share"
              testID="truth-chart-confirmed-share"
            />
            <HeroStat
              value={String(total)}
              label="facts counted"
              testID="truth-chart-total"
            />
            <HeroStat
              value={String(agg.assumed.count + agg.missing.count)}
              label="needs field-confirm"
              tone="warn"
              testID="truth-chart-needs-confirm"
            />
          </View>
        </View>

        {/* The big stacked bar — the single most important visual. */}
        <View style={styles.barCard} testID="truth-chart-bar-card">
          <Text style={styles.barCardTitle}>Distribution</Text>
          <View style={styles.bar}>
            {TRUTH_ORDER.map((tc) => {
              const pct = (agg[tc].count / total) * 100;
              if (pct <= 0) return null;
              const s = getTruthStyle(tc);
              return (
                <View
                  key={tc}
                  style={[
                    styles.barSeg,
                    {
                      // Use flex so the segments add to exactly 100%.
                      flexGrow: agg[tc].count,
                      backgroundColor: s.fg,
                    },
                  ]}
                  testID={`truth-chart-seg-${tc}`}
                />
              );
            })}
          </View>
          <View style={styles.barLegend}>
            {TRUTH_ORDER.filter((tc) => agg[tc].count > 0).map((tc) => {
              const s = getTruthStyle(tc);
              const pct = (agg[tc].count / total) * 100;
              return (
                <View key={tc} style={styles.barLegendItem}>
                  <View
                    style={[styles.barLegendDot, { backgroundColor: s.fg }]}
                  />
                  <Text style={styles.barLegendLabel}>{s.label}</Text>
                  <Text style={styles.barLegendValue}>
                    {pct.toFixed(0)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Per-class detail rows. */}
        <View style={styles.rows} testID="truth-chart-rows">
          {TRUTH_ORDER.map((tc) => {
            const bucket = agg[tc];
            if (bucket.count === 0) return null;
            const pct = (bucket.count / total) * 100;
            const s = getTruthStyle(tc);
            return (
              <View key={tc} style={styles.row} testID={`truth-chart-row-${tc}`}>
                <View
                  style={[
                    styles.rowDot,
                    { backgroundColor: s.fg + '22', borderColor: s.border },
                  ]}
                >
                  <View style={[styles.rowDotInner, { backgroundColor: s.fg }]} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowHeader}>
                    <Text style={[styles.rowLabel, { color: s.fg }]}>
                      {s.label}
                    </Text>
                    <Text style={styles.rowCount}>
                      {bucket.count} ({pct.toFixed(0)}%)
                    </Text>
                  </View>
                  <View style={styles.rowTrack}>
                    <View
                      style={[
                        styles.rowFill,
                        { width: `${pct}%`, backgroundColor: s.fg },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.footnote}>
          Confirmed share blends observed sheet facts with field, vendor, and
          permit confirmations. Derived facts are computed from those. Anything
          assumed or missing should be field-confirmed before final bid.
        </Text>
      </View>
    </ScrollView>
  );
}

function HeroStat({
  value,
  label,
  tone,
  testID,
}: {
  value: string;
  label: string;
  tone?: 'warn';
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.heroStat} testID={testID}>
      <Text style={[styles.heroStatValue, tone === 'warn' && styles.heroStatValueWarn]}>
        {value}
      </Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const READING_MAX_WIDTH = 880;

const styles = StyleSheet.create({
  host: { flex: 1 },
  scrollContent: {
    alignItems: 'center',
    padding: 24,
  },
  column: {
    width: '100%',
    maxWidth: READING_MAX_WIDTH,
    gap: 18,
  },

  // ─── Hero ─────────────────────────────────────────────────────────
  hero: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
    padding: 22,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroLeft: {
    flex: 1,
    minWidth: 220,
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  heroValue: {
    fontSize: 64,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    lineHeight: 70,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-serif, Georgia, serif' } as any)
      : {}),
  },
  heroValueHigh: { color: '#4ade80' },
  heroValueMid: { color: '#fbbf24' },
  heroValueLow: { color: '#fb923c' },
  heroPct: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  heroChipHigh: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor: 'rgba(74,222,128,0.45)',
  },
  heroChipMid: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  heroChipLow: {
    backgroundColor: 'rgba(251,146,60,0.08)',
    borderColor: 'rgba(251,146,60,0.45)',
  },
  heroChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroChipTextHigh: { color: '#4ade80' },
  heroChipTextMid: { color: '#fbbf24' },
  heroChipTextLow: { color: '#fb923c' },
  heroRight: {
    flexDirection: 'row',
    gap: 18,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  heroStat: {
    gap: 4,
    minWidth: 96,
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  heroStatValueWarn: {
    color: '#fb923c',
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },

  // ─── Big stacked bar ─────────────────────────────────────────────
  barCard: {
    gap: 12,
    padding: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  barCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  bar: {
    flexDirection: 'row',
    height: 26,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  barSeg: {
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({ transition: 'flex-grow 200ms ease' } as any)
      : {}),
  },
  barLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  barLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barLegendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: -0.05,
  },
  barLegendValue: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    fontVariant: ['tabular-nums'],
  },

  // ─── Per-class rows ──────────────────────────────────────────────
  rows: {
    gap: 12,
    padding: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  rowCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  rowTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  rowFill: {
    height: '100%',
    borderRadius: 3,
    ...(Platform.OS === 'web'
      ? ({ transition: 'width 200ms ease' } as any)
      : {}),
  },

  footnote: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.05,
    paddingHorizontal: 4,
  },

  // ─── Empty state ─────────────────────────────────────────────────
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
