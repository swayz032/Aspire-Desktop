/**
 * PlansPhotosContextPayload — Wave 6A.
 *
 * Tim Rail Context tab payload for the Plans & Photos route. Renders:
 *   - Pipeline status (vertical 5-stage indicator)
 *   - Discipline counts (compact chips)
 *   - Last upload (filename + relative time)
 *   - Revision activity (count)
 *
 * Property facts are NOT rendered here — TimRailContextTab still mounts
 * the shared <PropertySummaryCard /> below this component.
 *
 * Wave 6A reality: ingest + classify carry real data; the remaining 3
 * stages are dimmed placeholders. The PlansPhotosTab also surfaces a
 * banner explaining what's coming in Wave 6.5.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
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

export function PlansPhotosContextPayload(): React.ReactElement {
  const snap = useBlueprintUploadSnapshot();
  const disciplines = Object.entries(snap.response?.classify?.discipline_counts ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const sheetCount = snap.response?.ingest.sheet_count ?? 0;
  const revisions = snap.response?.classify?.revisions ?? 0;
  const isBusy =
    snap.phase === 'reading' ||
    snap.phase === 'uploading' ||
    snap.phase === 'ingesting' ||
    snap.phase === 'classifying';

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
                stageProgress={snap.stageProgress}
                uploadRatio={snap.uploadRatio}
                startedAtMs={snap.startedAtMs ?? Date.now()}
                testID="context-drew-stage-progress"
              />
            ),
          } as ContextSection,
        ]
      : []),
    {
      key: 'pipeline',
      title: 'Pipeline Status',
      subtitle: 'Wave 6A: Ingest + Classify real · See/Reason/Procure ship in Wave 3+',
      render: () => (
        <UploadProgressInline
          stages={snap.stageProgress}
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
                ? `${sheetCount} sheet${sheetCount === 1 ? '' : 's'} · ${_relativeTime(snap.uploadedAt)}`
                : 'Drop a plan set on the canvas.'}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: 'revisions',
      title: 'Revision Activity',
      render: () => (
        <View style={styles.revRow} testID="context-revisions">
          <View style={styles.revStat}>
            <Text style={styles.revValue}>{revisions}</Text>
            <Text style={styles.revLabel}>superseded</Text>
          </View>
          <Text style={styles.revHint}>
            {revisions === 0
              ? 'No revisions detected.'
              : 'Per-sheet revision chain ships in Wave 6.5.'}
          </Text>
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
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  discCode: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  discLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.05,
  },
  discCount: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  lastBody: {
    flex: 1,
    gap: 2,
  },
  lastFilename: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  lastMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: -0.05,
  },
  revRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  revStat: {
    alignItems: 'center',
    minWidth: 40,
  },
  revValue: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    fontVariant: ['tabular-nums'],
  },
  revLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  revHint: {
    flex: 1,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: -0.05,
    lineHeight: 14,
  },
});
