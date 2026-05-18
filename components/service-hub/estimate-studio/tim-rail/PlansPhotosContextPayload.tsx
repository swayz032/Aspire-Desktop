/**
 * PlansPhotosContextPayload — Wave 6.5.
 *
 * Tim Rail Context tab payload for the Plans & Photos route. Renders:
 *   - Drew Live Pipeline (only while busy — Lock #15)
 *   - Pipeline Status (vertical 5-stage indicator, live polled stage_progress)
 *   - Live counters: sheets · disciplines · revisions (200ms cross-fade)
 *   - Discipline counts (compact chips, derived from polled sheet list)
 *   - Last upload (filename + relative time)
 *
 * Wave 6.5 (plan §5): the zeros tick UP in real time as Drew classifies.
 * Uses `useBlueprintProjectPoll(projectId)` for live data once project_id
 * is available; falls back to the upload snapshot's optimistic counts
 * during the brief INGEST-in-flight window.
 */
import React, { useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useBlueprintProjectPoll } from '@/hooks/useBlueprintProjectPoll';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import { ContextTabPayload, type ContextSection } from '../shell/ContextTabPayload';
import { UploadProgressInline } from '../plans-photos/UploadProgressInline';
import { DrewStageProgress } from '../plans-photos/DrewStageProgress';
import { getDisciplineStyle } from '../plans-photos/disciplines';

function _relativeTime(ts: number | null): string {
  if (ts == null) return '—';
  const delta = Date.now() - ts;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

// 200ms cross-fade animated count — matches the locked premium-seamless spec.
function AnimatedCount({
  value,
  style,
  testID,
}: {
  value: number;
  style?: any;
  testID?: string;
}): React.ReactElement {
  const [displayed, setDisplayed] = useState(value);
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (value === displayed) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setDisplayed(value);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [value, displayed, opacity]);

  return (
    <Animated.Text style={[style, { opacity }]} testID={testID}>
      {displayed}
    </Animated.Text>
  );
}

export function PlansPhotosContextPayload(): React.ReactElement {
  const snap = useBlueprintUploadSnapshot();

  // Wave 6.5 — drive live counts from polled data once project_id is available.
  const projectId = snap.projectId;
  const poll = useBlueprintProjectPoll(projectId);

  const isBusy =
    snap.phase === 'reading' ||
    snap.phase === 'uploading' ||
    snap.phase === 'ingesting' ||
    snap.phase === 'classifying';

  // Live counts (prefer polled status; fall back to optimistic upload state
  // for the brief window between upload-success and first-poll-response).
  const liveSheetCount =
    poll.status?.sheet_count ??
    poll.sheets.length ??
    snap.response?.ingest?.sheet_count ??
    0;

  const liveDisciplineCount = useMemo(() => {
    if (poll.sheets.length > 0) {
      const set = new Set<string>();
      for (const s of poll.sheets) {
        if (s.discipline) set.add(s.discipline.toLowerCase());
      }
      return set.size;
    }
    return Object.keys(snap.response?.classify?.discipline_counts ?? {}).length;
  }, [poll.sheets, snap.response]);

  const liveRevisionCount =
    poll.revisions.length > 0
      ? poll.revisions.length
      : snap.response?.classify?.revisions ?? 0;

  // Wave 5.1a-5 — materials counter rolls up Drew's PROCURE picks. Polls the
  // same backend route used by the Materials tab "From Blueprint" card so
  // both surfaces stay in sync. Returns 0 until PROCURE finishes.
  const materialsState = useTakeoffMaterials(projectId);
  const liveMaterialCount = materialsState.materials.length;

  // Discipline chips: derive from polled sheets when available, otherwise the
  // CLASSIFY snapshot (so reviewers see chips appear the moment CLASSIFY
  // returns, even before the first /sheets fetch).
  const disciplines = useMemo(() => {
    if (poll.sheets.length > 0) {
      const m = new Map<string, number>();
      // Count only "current" sheets (those not superseded).
      const successorIds = new Set<string>();
      for (const s of poll.sheets) if (s.supersedes_id) successorIds.add(s.supersedes_id);
      for (const s of poll.sheets) {
        if (successorIds.has(s.id)) continue;
        const k = s.discipline ? s.discipline.toLowerCase() : 'unclassified';
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    }
    return Object.entries(snap.response?.classify?.discipline_counts ?? {}).sort(
      (a, b) => b[1] - a[1],
    );
  }, [poll.sheets, snap.response]);

  // Effective stage progress: polled when available, optimistic during the
  // upload-only window.
  const effectiveStageProgress = poll.project?.stage_progress ?? snap.stageProgress;

  // Aspire design rule: cinematic 5-stage timeline + narration + insight
  // cards + sheet thumbnail rail render HERE in the Tim Rail Context tab,
  // NEVER on the canvas. Canvas stays calm (loading ring + filename + timer
  // only). See: UploadDropZone busy block.
  const sections: ContextSection[] = [
    ...(isBusy
      ? [
          {
            key: 'drew-live',
            title: 'Drew · Live Pipeline',
            subtitle: 'Cinematic 5-stage timeline · narration · insights',
            render: () => (
              <DrewStageProgress
                filename={snap.filename}
                stageProgress={effectiveStageProgress}
                uploadRatio={snap.uploadRatio}
                startedAtMs={snap.startedAtMs ?? Date.now()}
                testID="context-drew-stage-progress"
              />
            ),
          } as ContextSection,
        ]
      : []),
    // Live counter strip — the visible heartbeat: the zeros tick up as Drew
    // works. Wave 6.5 acceptance criterion: 0 sheets · 0 disciplines · 0
    // revisions transitions to live values without layout shift.
    {
      key: 'counters',
      title: 'Live Counters',
      subtitle: poll.isPolling
        ? `Polling every ${poll.stageProgress.procure === 'ok' ? '10' : '2'}s`
        : projectId
          ? 'All stages complete'
          : 'Awaiting upload',
      render: () => (
        <View style={styles.counterRow} testID="context-live-counters">
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveSheetCount}
              style={styles.counterValue}
              testID="context-counter-sheets"
            />
            <Text style={styles.counterLabel}>sheets</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveDisciplineCount}
              style={styles.counterValue}
              testID="context-counter-disciplines"
            />
            <Text style={styles.counterLabel}>disciplines</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveRevisionCount}
              style={styles.counterValue}
              testID="context-counter-revisions"
            />
            <Text style={styles.counterLabel}>revisions</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveMaterialCount}
              style={styles.counterValue}
              testID="context-counter-materials"
            />
            <Text style={styles.counterLabel}>materials</Text>
          </View>
        </View>
      ),
    },
    {
      key: 'pipeline',
      title: 'Pipeline Status',
      subtitle: poll.isPolling ? 'Live · auto-refreshing' : 'Idle',
      render: () => (
        <UploadProgressInline
          stages={effectiveStageProgress}
          layout="vertical"
          testID="context-pipeline-status"
        />
      ),
    },
    {
      key: 'disciplines',
      title: 'Discipline Counts',
      render: () => {
        if (disciplines.length === 0) {
          return <Text style={styles.empty}>No classification yet.</Text>;
        }
        return (
          <View style={styles.discWrap}>
            {disciplines.map(([disc, count]) => {
              const s = getDisciplineStyle(disc);
              return (
                <View
                  key={disc}
                  style={[styles.discChip, { backgroundColor: s.bg, borderColor: s.fg + '55' }]}
                  testID={`context-disc-${disc}`}
                >
                  <Text style={[styles.discCode, { color: s.fg }]}>{s.code}</Text>
                  <Text style={styles.discLabel}>{s.label}</Text>
                  <Text style={[styles.discCount, { color: s.fg }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        );
      },
    },
    {
      key: 'last-upload',
      title: 'Last Upload',
      render: () => (
        <View style={styles.lastRow} testID="context-last-upload">
          <Ionicons
            name="document-attach-outline"
            size={14}
            color="rgba(255,255,255,0.55)"
          />
          <View style={styles.lastBody}>
            <Text style={styles.lastFilename} numberOfLines={1}>
              {snap.filename ?? 'No upload yet'}
            </Text>
            <Text style={styles.lastMeta}>
              {snap.filename
                ? `${liveSheetCount} sheet${liveSheetCount === 1 ? '' : 's'} · ${_relativeTime(snap.uploadedAt)}`
                : 'Drop a plan set on the canvas.'}
            </Text>
          </View>
        </View>
      ),
    },
  ];

  return <ContextTabPayload sections={sections} testID="plans-photos-context-payload" />;
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.05,
    paddingHorizontal: 4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  // Premium counter strip — hairline-outlined geometry, 32px ui-serif number,
  // 11px ui-monospace uppercase label. Tighter rhythm and no solid fill so
  // the amber-gold counter cross-fade reads as the focal point.
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  counterCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  counterValue: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fbbf24',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    // ui-serif gives the marquee number its premium editorial weight.
    fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
    lineHeight: 36,
    // Subtle glow only on the active marquee numbers (web-only via shadow).
    textShadowColor: 'rgba(251,191,36,0.25)',
    textShadowRadius: 8,
  },
  counterLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  counterDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  discWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 2,
  },
  discChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  discCode: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  discLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.05,
  },
  discCount: {
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // Hairline-outlined geometry — no solid fill. Matches the counter strip
  // aesthetic so the Context tab reads as a single continuous surface.
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lastBody: {
    flex: 1,
    gap: 4,
  },
  lastFilename: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  lastMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
});
