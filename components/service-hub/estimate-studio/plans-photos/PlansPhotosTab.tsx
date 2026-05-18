/**
 * PlansPhotosTab — Wave 6.5.
 *
 * Owner of the Plans & Photos UX. Three states:
 *
 *   Empty (no project yet):
 *     - Big <UploadDropZone /> hero takes the canvas
 *     - Bottom chip strip shows only "Upload" enabled
 *
 *   Busy (upload in flight, no project_id yet):
 *     - UploadDropZone shows the calm loading ring (DrewStageProgress lives
 *       in the Tim Rail Context tab — Lock #15 LEFT INTACT)
 *
 *   Populated (project_id available, polling started):
 *     - CanvasCardSwitcher hosts the chip-selected card
 *     - Default view = "All Sheets" -> <SheetThumbnailGrid /> driven by
 *       `useBlueprintProjectPoll` so counts/thumbnails/revisions tick live
 *     - Bottom chip strip wired to real polled counts; selecting a chip
 *       swaps the canvas card with the 200ms cross-fade (CLS=0).
 *
 * Wave 6.5 plan §1, §3, §4, §6 — see docs/plans/serene-seeking-hollerith.
 *
 * Law #7: render layer only. All polling decisions in the hook.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlueprintUpload } from '@/hooks/useBlueprintUpload';
import { useBlueprintProjectPoll } from '@/hooks/useBlueprintProjectPoll';
import { CanvasCardSwitcher } from '../shell/CanvasCardSwitcher';
import { BottomChipStrip, type BottomChip } from '../shell/BottomChipStrip';
import { UploadDropZone } from './UploadDropZone';
import { SheetThumbnailGrid } from './SheetThumbnailGrid';
import { UploadProgressInline } from './UploadProgressInline';
import { getDisciplineStyle } from './disciplines';

type CardKey = 'upload' | 'sheets' | 'disciplines' | 'revisions';

export function PlansPhotosTab(): React.ReactElement {
  const upload = useBlueprintUpload();
  const [activeCard, setActiveCard] = useState<CardKey>('upload');

  // Wave 6.5: project_id is published into the upload store once INGEST
  // returns. The poll hook then runs the live read loop against the
  // backend's GET endpoints.
  const projectId = upload.response?.ingest?.project_id ?? upload.response?.project_id ?? null;
  const poll = useBlueprintProjectPoll(projectId);

  const hasProject = projectId != null;
  const liveSheetCount = poll.status?.sheet_count ?? poll.sheets.length;
  const liveDisciplineCount = useMemo(() => {
    const set = new Set<string>();
    for (const s of poll.sheets) {
      if (s.discipline) set.add(s.discipline.toLowerCase());
    }
    return set.size;
  }, [poll.sheets]);
  const liveRevisionCount = poll.revisions.length;

  // Auto-jump to Sheets when an upload finishes (premium UX: don't make
  // the user click).
  React.useEffect(() => {
    if (hasProject && activeCard === 'upload') {
      setActiveCard('sheets');
    }
  }, [hasProject, activeCard]);

  const chips: BottomChip<CardKey>[] = useMemo(
    () => [
      {
        key: 'upload',
        icon: 'cloud-upload-outline',
        label: 'Upload',
        stat: hasProject ? 'Add another' : 'Drop a plan set',
      },
      {
        key: 'sheets',
        icon: 'documents-outline',
        label: 'All Sheets',
        stat: hasProject ? `${liveSheetCount} sheets` : 'Upload to enable',
        badge: hasProject ? `${liveSheetCount}` : undefined,
        disabled: !hasProject,
      },
      {
        key: 'disciplines',
        icon: 'color-palette-outline',
        label: 'By Discipline',
        stat: hasProject
          ? `${liveDisciplineCount} tag${liveDisciplineCount === 1 ? '' : 's'}`
          : 'Upload to enable',
        disabled: !hasProject || liveDisciplineCount === 0,
      },
      {
        key: 'revisions',
        icon: 'time-outline',
        label: 'Revisions',
        stat: hasProject
          ? `${liveRevisionCount} chain${liveRevisionCount === 1 ? '' : 's'}`
          : 'Upload to enable',
        badge: hasProject && liveRevisionCount > 0 ? `${liveRevisionCount}` : undefined,
        disabled: !hasProject,
      },
    ],
    [hasProject, liveSheetCount, liveDisciplineCount, liveRevisionCount],
  );

  const cards: Record<CardKey, React.ReactNode> = {
    upload: (
      <UploadDropZone
        phase={upload.phase}
        progress={upload.progress}
        filename={upload.filename}
        stageProgress={upload.stageProgress}
        error={upload.error}
        onFile={upload.upload}
        onReset={upload.reset}
      />
    ),
    sheets: hasProject ? (
      <SheetThumbnailGrid
        sheets={poll.sheets}
        revisions={poll.revisions}
        isLoading={poll.isFirstLoad}
        stageProgress={poll.stageProgress}
        sheetCount={liveSheetCount}
        testID="plans-photos-thumbnail-grid"
      />
    ) : (
      <EmptyCardPlaceholder
        icon="documents-outline"
        title="No sheets yet"
        body="Upload a plan set to see the roster."
      />
    ),
    disciplines: hasProject ? (
      <DisciplineBreakdownCard sheets={poll.sheets} />
    ) : (
      <EmptyCardPlaceholder
        icon="color-palette-outline"
        title="No disciplines yet"
        body="Upload a plan set so Drew can classify the sheets."
      />
    ),
    revisions: hasProject ? (
      <RevisionsListCard
        chainCount={liveRevisionCount}
        sheets={poll.sheets}
        revisions={poll.revisions}
      />
    ) : (
      <EmptyCardPlaceholder
        icon="time-outline"
        title="No revisions yet"
        body="Upload a plan set first."
      />
    ),
  };

  return (
    <View style={styles.tab} testID="plans-photos-tab">
      {/* Inline pipeline indicator — always visible so users see ingest → classify happen. */}
      {upload.phase !== 'idle' ? (
        <View style={styles.progressStrip}>
          <UploadProgressInline stages={poll.project?.stage_progress ?? upload.stageProgress} layout="horizontal" />
        </View>
      ) : null}

      <View style={styles.canvas}>
        <CanvasCardSwitcher
          activeCardKey={activeCard}
          cards={cards}
          testID="plans-photos-canvas-switcher"
        />
      </View>

      <BottomChipStrip
        chips={chips}
        activeKey={activeCard}
        onChange={setActiveCard}
        testID="plans-photos-chip-strip"
      />
    </View>
  );
}

function EmptyCardPlaceholder({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}): React.ReactElement {
  return (
    <View style={styles.placeholderHost}>
      <View style={styles.placeholderIconCircle}>
        <Ionicons name={icon} size={28} color="rgba(255,255,255,0.55)" />
      </View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderBody}>{body}</Text>
    </View>
  );
}

function DisciplineBreakdownCard({
  sheets,
}: {
  sheets: ReadonlyArray<{ discipline: string | null; supersedes_id: string | null; id: string }>;
}): React.ReactElement {
  // Current-only counts derived from polled sheet list.
  const counts = useMemo(() => {
    const successorIds = new Set<string>();
    for (const s of sheets) if (s.supersedes_id) successorIds.add(s.supersedes_id);
    const map = new Map<string, number>();
    for (const s of sheets) {
      if (successorIds.has(s.id)) continue;
      const k = s.discipline ? s.discipline.toLowerCase() : 'unclassified';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [sheets]);

  if (counts.length === 0) {
    return (
      <EmptyCardPlaceholder
        icon="color-palette-outline"
        title="No discipline tags yet"
        body="Drew didn't find recognisable discipline markers on this plan set."
      />
    );
  }
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  return (
    <View style={styles.discHost} testID="discipline-breakdown-card">
      <Text style={styles.discTitle}>Discipline Breakdown</Text>
      <Text style={styles.discSubtitle}>
        {total} classified sheet{total === 1 ? '' : 's'} across {counts.length} discipline
        {counts.length === 1 ? '' : 's'}.
      </Text>
      <View style={styles.discList}>
        {counts.map(([disc, count]) => {
          const style = getDisciplineStyle(disc);
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <View key={disc} style={styles.discRow}>
              <View
                style={[styles.discRowCodeWrap, { backgroundColor: style.fg + '22' }]}
              >
                <Text style={[styles.discRowCode, { color: style.fg }]}>{style.code}</Text>
              </View>
              <View style={styles.discRowBody}>
                <View style={styles.discRowHeader}>
                  <Text style={styles.discRowLabel}>{style.label}</Text>
                  <Text style={styles.discRowCount}>
                    {count} ({pct.toFixed(0)}%)
                  </Text>
                </View>
                <View style={styles.discRowTrack}>
                  <View
                    style={[
                      styles.discRowFill,
                      { width: `${pct}%`, backgroundColor: style.fg },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RevisionsListCard({
  chainCount,
  sheets,
  revisions,
}: {
  chainCount: number;
  sheets: ReadonlyArray<{ discipline: string | null; supersedes_id: string | null; id: string; sheet_number: string | null }>;
  revisions: ReadonlyArray<{ currentSheetId: string; sheets: ReadonlyArray<{ id: string; sheet_number: string | null; revision: number | null }> }>;
}): React.ReactElement {
  if (chainCount === 0) {
    return (
      <EmptyCardPlaceholder
        icon="time-outline"
        title="No revisions detected"
        body="When Drew finds a sheet that supersedes another, the chain will appear here."
      />
    );
  }
  return (
    <View style={styles.discHost} testID="revisions-list-card">
      <Text style={styles.discTitle}>Revision Chains</Text>
      <Text style={styles.discSubtitle}>
        {chainCount} chain{chainCount === 1 ? '' : 's'} found.{' '}
        Tap a sheet in the All Sheets grid to expand its chain.
      </Text>
      <View style={styles.revList}>
        {revisions.map((chain) => {
          const current = chain.sheets[chain.sheets.length - 1];
          const root = chain.sheets[0];
          const currentSheetMeta = sheets.find((s) => s.id === chain.currentSheetId);
          return (
            <View key={chain.currentSheetId} style={styles.revListRow}>
              <Ionicons name="git-branch-outline" size={14} color="#fbbf24" />
              <View style={styles.revListBody}>
                <Text style={styles.revListSheetNum}>
                  {currentSheetMeta?.sheet_number ?? current.sheet_number ?? 'Sheet'}
                </Text>
                <Text style={styles.revListMeta}>
                  {root.sheet_number ?? 'original'} → {current.sheet_number ?? 'current'}{' · '}
                  {chain.sheets.length} versions
                </Text>
              </View>
              <View style={styles.revListPill}>
                <Text style={styles.revListPillText}>
                  REV {current.revision ?? chain.sheets.length - 1}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    padding: 18,
    gap: 12,
  },
  progressStrip: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  canvas: {
    flex: 1,
    minHeight: 320,
  },
  placeholderHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
  },
  placeholderIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.2,
  },
  placeholderBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 17,
  },

  discHost: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  discTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  discSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  discList: {
    gap: 10,
  },
  discRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discRowCodeWrap: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discRowCode: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  discRowBody: {
    flex: 1,
    gap: 4,
  },
  discRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  discRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  discRowCount: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  discRowTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  discRowFill: {
    height: '100%',
    borderRadius: 3,
  },

  revList: {
    gap: 8,
  },
  revListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.20)',
  },
  revListBody: {
    flex: 1,
    gap: 2,
  },
  revListSheetNum: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  revListMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
  },
  revListPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.55)',
  },
  revListPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.6,
  },
});
