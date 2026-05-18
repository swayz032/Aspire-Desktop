/**
 * PlansPhotosTab — Canvas Cleanup (locked 2026-05-18).
 *
 * THE CANVAS IS BLUEPRINTS ONLY.
 *
 * User lock 2026-05-18:
 *   "ONLY BLUEPRINTS ON CANVAS — anything else is in Context tab"
 *   "THE CANVAS SCREEN SUPPOSED TO BE BIGGER"
 *   "VISUALS, PLAN AND PHOTOS TAB ETC SHOULD BE IN CONTROLS TAB IN TIM RAIL"
 *
 * Composition (post-lock):
 *   - Canvas = ONE element. Either:
 *       a) UploadDropZone (when no project is active), OR
 *       b) SheetThumbnailGrid (when a project has been ingested), OR
 *       c) DisciplineBreakdownCard / RevisionsListCard if the Context-tab
 *          "View" switcher selects them.
 *   - NO stat row, NO discipline filter strip, NO bottom chip strip on canvas.
 *   - All chrome (counters · stage progress · view switcher · discipline
 *     filter · action chips) lives in the Tim Rail Context tab.
 *
 * Active card + discipline filter are owned by `plansPhotosUiStore` so the
 * Tim Rail Context tab can drive them without prop-drilling.
 *
 * Law #7: render layer only. All polling decisions in the hook.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlueprintUpload } from '@/hooks/useBlueprintUpload';
import { useBlueprintProjectPoll } from '@/hooks/useBlueprintProjectPoll';
import {
  plansPhotosUiActions,
  usePlansPhotosUi,
  type PlansPhotosCardKey,
} from '@/lib/plansPhotosUiStore';
import { UploadDropZone } from './UploadDropZone';
import { SheetThumbnailGrid } from './SheetThumbnailGrid';
import { getDisciplineStyle } from './disciplines';

export function PlansPhotosTab(): React.ReactElement {
  const upload = useBlueprintUpload();
  const ui = usePlansPhotosUi();
  const { setActiveCard } = plansPhotosUiActions();

  const projectId = upload.response?.ingest?.project_id ?? upload.response?.project_id ?? null;
  const poll = useBlueprintProjectPoll(projectId);

  const hasProject = projectId != null;
  const liveSheetCount = poll.status?.sheet_count ?? poll.sheets.length;

  // Auto-jump to Sheets when an upload finishes (premium UX: don't make
  // the user click).
  React.useEffect(() => {
    if (hasProject && ui.activeCard === 'upload') {
      setActiveCard('sheets');
    }
    // setActiveCard is module-stable; safe to exclude.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProject, ui.activeCard]);

  const activeCard: PlansPhotosCardKey = ui.activeCard;

  const card = useMemo<React.ReactNode>(() => {
    switch (activeCard) {
      case 'upload':
        return (
          <UploadDropZone
            phase={upload.phase}
            progress={upload.progress}
            filename={upload.filename}
            stageProgress={upload.stageProgress}
            error={upload.error}
            onFile={upload.upload}
            onReset={upload.reset}
          />
        );
      case 'sheets':
        return hasProject ? (
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
            body="Drop a plan set in the Controls tab to begin."
          />
        );
      case 'disciplines':
        return hasProject ? (
          <DisciplineBreakdownCard sheets={poll.sheets} />
        ) : (
          <EmptyCardPlaceholder
            icon="color-palette-outline"
            title="No disciplines yet"
            body="Upload a plan set so Drew can classify the sheets."
          />
        );
      case 'revisions':
        return hasProject ? (
          <RevisionsListCard
            chainCount={poll.revisions.length}
            sheets={poll.sheets}
            revisions={poll.revisions}
          />
        ) : (
          <EmptyCardPlaceholder
            icon="time-outline"
            title="No revisions yet"
            body="Upload a plan set first."
          />
        );
      default:
        return null;
    }
  }, [
    activeCard,
    hasProject,
    upload.phase,
    upload.progress,
    upload.filename,
    upload.stageProgress,
    upload.error,
    upload.upload,
    upload.reset,
    poll.sheets,
    poll.revisions,
    poll.isFirstLoad,
    poll.stageProgress,
    liveSheetCount,
  ]);

  // Canvas is intentionally bare: ONE focused element, edge-to-edge, no
  // surrounding chrome. The Tim Rail Context tab owns counters, stage
  // progress, view-switcher, and discipline-filter chrome.
  return (
    <View style={styles.canvas} testID="plans-photos-tab">
      {card}
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
  // Canvas-only: no padding-around-chrome, just a calm edge inset and the
  // single focused card. CLS=0 — minHeight floor keeps the canvas stable
  // across state transitions.
  canvas: {
    flex: 1,
    padding: 16,
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
