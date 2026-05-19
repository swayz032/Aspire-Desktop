/**
 * ScopeContextPayload — Wave 7.
 *
 * Tim Rail Context tab payload for the Scope route. Sections:
 *
 *   - 🚦 Pipeline status (5-stage indicator — Wave 6A UploadProgressInline)
 *   - 📊 Story confidence % (project-level mean_confidence)
 *   - 📈 Truth distribution bar
 *   - ⚠️ Missing inputs (count + clickable hint)
 *   - 🔁 Linked destinations (Materials / Takeoff / Estimate launchers)
 *   - 🏷️ Tariff exposure summary
 *
 * Property facts stay rendered separately by TimRailContextTab below this
 * component (per the Wave 6A pattern with PlansPhotosContextPayload).
 *
 * Law #7: pure render. Hooks fetch their own state.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useBlueprintStory } from '@/hooks/useBlueprintStory';
import { ContextTabPayload, type ContextSection } from '../shell/ContextTabPayload';
import { UploadProgressInline } from '../plans-photos/UploadProgressInline';
import type { TruthClass } from '@/lib/api/blueprintsApi';
import { getTruthStyle } from '../scope/TruthBadge';

interface Props {
  projectId?: string | null;
}

// Order matters for the visual bar — most-trusted on the left.
const TRUTH_ORDER: TruthClass[] = [
  'observed',
  'field_confirmed',
  'vendor_confirmed',
  'permit_confirmed',
  'derived',
  'assumed',
  'missing',
];

export function ScopeContextPayload({ projectId }: Props): React.ReactElement {
  const router = useRouter();
  const snap = useBlueprintUploadSnapshot();
  const effectiveProjectId = projectId ?? snap.response?.project_id ?? null;
  const story = useBlueprintStory(effectiveProjectId);

  const confidencePct = story.story
    ? Math.round(story.story.mean_confidence * 100)
    : null;

  const truthEntries = TRUTH_ORDER.map((tc) => ({
    truth: tc,
    count: story.story?.truth_distribution?.[tc] ?? 0,
  })).filter((e) => e.count > 0);
  const truthTotal = truthEntries.reduce((sum, e) => sum + e.count, 0);

  const openMissing = story.missingInputs.filter((m) => m.status === 'open').length;
  const tariffFlagged = story.materials.filter((m) => m.tariff_flagged).length;
  const tariffUsd = story.materials.reduce<number | null>((sum, m) => {
    if (typeof m.tariff_impact_usd === 'number') return (sum ?? 0) + m.tariff_impact_usd;
    return sum;
  }, null);

  const sections: ContextSection[] = [
    {
      key: 'pipeline',
      title: 'Pipeline Status',
      render: () => (
        <UploadProgressInline
          stages={snap.stageProgress}
          layout="vertical"
          testID="scope-context-pipeline-status"
        />
      ),
    },
    {
      key: 'confidence',
      title: 'Story Confidence',
      render: () => (
        <View style={styles.confidenceRow} testID="scope-context-confidence">
          <Text style={styles.confidenceValue}>
            {confidencePct != null ? `${confidencePct}%` : '—'}
          </Text>
          <Text style={styles.confidenceLabel}>mean</Text>
        </View>
      ),
    },
    {
      key: 'truth-distribution',
      title: 'Truth Distribution',
      render: () => {
        if (truthTotal === 0) {
          return (
            <Text style={styles.empty}>
              {story.isPolling ? 'Reading plan set…' : 'No facts yet.'}
            </Text>
          );
        }
        return (
          <View style={styles.truthBar} testID="scope-context-truth-bar">
            <View style={styles.truthBarTrack}>
              {truthEntries.map((entry) => {
                const pct = (entry.count / truthTotal) * 100;
                const s = getTruthStyle(entry.truth);
                return (
                  <View
                    key={entry.truth}
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: s.fg,
                    }}
                    testID={`scope-context-truth-seg-${entry.truth}`}
                  />
                );
              })}
            </View>
            <View style={styles.truthLegend}>
              {truthEntries.map((entry) => {
                const s = getTruthStyle(entry.truth);
                return (
                  <View key={entry.truth} style={styles.truthLegendItem}>
                    <View
                      style={[styles.truthLegendDot, { backgroundColor: s.fg }]}
                    />
                    <Text style={styles.truthLegendText}>
                      {s.label} · {entry.count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      },
    },
    {
      key: 'missing-inputs',
      title: 'Missing Inputs',
      render: () => (
        <View style={styles.missingRow} testID="scope-context-missing">
          <View style={styles.missingStat}>
            <Text style={styles.missingValue}>{openMissing}</Text>
            <Text style={styles.missingLabel}>open</Text>
          </View>
          <Text style={styles.missingHint}>
            {openMissing === 0
              ? 'All known-unknowns resolved.'
              : 'Open the Missing Inputs chip to confirm in field.'}
          </Text>
        </View>
      ),
    },
    {
      key: 'linked-destinations',
      title: 'Linked Destinations',
      render: () => (
        <View style={styles.destWrap}>
          {(
            [
              { label: 'Materials', icon: 'cube-outline', path: '/service-hub/estimate-studio/materials' },
              { label: 'Takeoff', icon: 'cut-outline', path: '/service-hub/estimate-studio/takeoff' },
              { label: 'Estimate', icon: 'calculator-outline', path: '/service-hub/estimate-studio/estimate' },
            ] as const
          ).map((dest) => (
            <Pressable
              key={dest.label}
              onPress={() => router.push(dest.path)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${dest.label}`}
              style={({ hovered, pressed }: any) => [
                styles.destBtn,
                hovered && styles.destBtnHover,
                pressed && styles.destBtnPressed,
              ]}
              testID={`scope-context-link-${dest.label.toLowerCase()}`}
            >
              <Ionicons
                name={dest.icon}
                size={13}
                color="rgba(255,255,255,0.78)"
              />
              <Text style={styles.destBtnText}>{dest.label}</Text>
            </Pressable>
          ))}
        </View>
      ),
    },
    {
      key: 'tariff-exposure',
      title: 'Tariff Exposure',
      render: () => (
        <View style={styles.tariffRow} testID="scope-context-tariff">
          <View style={styles.tariffStat}>
            <Text style={styles.tariffValue}>{tariffFlagged}</Text>
            <Text style={styles.tariffLabel}>flagged</Text>
          </View>
          <Text style={styles.tariffUsd}>
            {tariffUsd != null
              ? `$${tariffUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '— pending PROCURE'}
          </Text>
        </View>
      ),
    },
  ];

  return <ContextTabPayload sections={sections} testID="scope-context-payload" />;
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.05,
    paddingHorizontal: 4,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 4,
  },
  confidenceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  confidenceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  truthBar: {
    gap: 8,
    paddingHorizontal: 2,
  },
  truthBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  truthLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  truthLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  truthLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  truthLegendText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  missingStat: {
    alignItems: 'center',
    minWidth: 40,
  },
  missingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
  },
  missingLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  missingHint: {
    flex: 1,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
    lineHeight: 14,
  },
  destWrap: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    paddingHorizontal: 2,
  },
  destBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  destBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  destBtnPressed: {
    opacity: 0.82,
  },
  destBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tariffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  tariffStat: {
    alignItems: 'center',
    minWidth: 40,
  },
  tariffValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
  },
  tariffLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  tariffUsd: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
  },
});
