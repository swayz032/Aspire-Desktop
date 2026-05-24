/**
 * ScopeStoryContextCard — three instrument cards for the Tim Context
 * tab on the Scope route. Confidence gauge, truth distribution donut
 * (visual stub for v1 — single horizontal ring), chapter coverage list.
 *
 * Lives in the right rail so the canvas stays focused on the chapter
 * narrative. Replaces the canvas-side Story confidence label + Truth
 * Distribution chip that were removed in Story Mode v2.
 *
 * Law #7: render layer only — selection dispatched up via onJumpToChapter.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BlueprintStoryV2 } from '@/lib/api/blueprintsApi';

interface Props {
  story: BlueprintStoryV2;
  onJumpToChapter: (key: string) => void;
}

export function ScopeStoryContextCard({ story, onJumpToChapter }: Props): React.ReactElement {
  // Defensive clamp — backend contract is [0..1] but NaN / out-of-range slips
  // would otherwise render literal "NaN%" or "170%" in the gauge.
  const mc = Number.isFinite(story.mean_confidence) ? story.mean_confidence : 0;
  const pct = Math.max(0, Math.min(100, Math.round(mc * 100)));
  const td = story.truth_distribution;
  const confirmed = (td.observed ?? 0) + (td.field_confirmed ?? 0) + (td.vendor_confirmed ?? 0) + (td.permit_confirmed ?? 0);
  const unverified = (td.assumed ?? 0) + (td.missing ?? 0);
  const total = confirmed + unverified;
  const confirmedRatio = total > 0 ? confirmed / total : 0;
  const confirmedPct = Math.round(confirmedRatio * 100);

  return (
    <View style={styles.host} testID="story-context-card">
      {/* Card 1 — Confidence gauge */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>STORY CONFIDENCE</Text>
        <Text style={styles.gaugeNumber} testID="story-confidence-pct">{`${pct}%`}</Text>
        <Text style={styles.cardSub} testID="story-coverage">
          {`${story.coverage.sheets_read} / ${story.coverage.sheets_total} sheets read`}
        </Text>
      </View>

      {/* Card 2 — Truth donut (visual stub) */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>TRUTH DISTRIBUTION</Text>
        <View
          style={styles.donut}
          testID="truth-donut"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${confirmedPct} percent confirmed`}
          accessibilityValue={{ min: 0, max: 100, now: confirmedPct }}
        >
          <View style={[styles.donutFill, { width: `${confirmedPct}%` }]} />
        </View>
        <View style={styles.donutLegend}>
          <Text style={styles.donutLegendText}>{`${confirmed} confirmed`}</Text>
          <Text style={styles.donutLegendText}>{`${unverified} unverified`}</Text>
        </View>
      </View>

      {/* Card 3 — Chapter coverage list */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>CHAPTERS</Text>
        {story.chapters.map((c) => {
          const hasOpen = c.zones.open_questions.length > 0;
          return (
            <Pressable
              key={c.key}
              testID={`chapter-coverage-row-${c.key}`}
              accessibilityRole="button"
              accessibilityLabel={`Jump to chapter ${c.ordinal}, ${c.title}`}
              onPress={() => onJumpToChapter(c.key)}
              style={styles.row}
            >
              <Text style={styles.rowOrdinal}>{String(c.ordinal).padStart(2, '0')}</Text>
              <Text style={styles.rowTitle} numberOfLines={1}>{c.title}</Text>
              {hasOpen ? <Text style={styles.openChip}>OPEN</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { padding: 10, gap: 8 },
  card: {
    padding: 10, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.18)',
  },
  cardLabel: { fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', fontWeight: '700' },
  gaugeNumber: { marginTop: 4, fontSize: 30, fontWeight: '800', color: '#fbbf24', fontVariant: ['tabular-nums'] },
  cardSub: { marginTop: 2, fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  donut: {
    marginTop: 6, height: 6, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3, overflow: 'hidden',
  },
  donutFill: { height: '100%', backgroundColor: '#fbbf24' },
  donutLegend: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  donutLegendText: { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  rowOrdinal: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700', minWidth: 18 },
  rowTitle: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  openChip: {
    fontSize: 8.5, fontWeight: '800', color: '#fbbf24',
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 5, borderRadius: 3,
  },
});
