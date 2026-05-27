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
import { STAGE_TERMINAL } from '@/lib/api/blueprintsApi';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import {
  plansPhotosUiActions,
  usePlansPhotosUi,
  type PlansPhotosCardKey,
} from '@/lib/plansPhotosUiStore';
import { UploadDropZone } from './UploadDropZone';
import { SheetCanvasView } from './SheetCanvasView';
import { BlueprintFailureCard } from './BlueprintFailureCard';
import { PremiumBlueprintLoader } from './PremiumBlueprintLoader';
import { getDisciplineStyle } from './disciplines';

export function PlansPhotosTab(): React.ReactElement {
  const upload = useBlueprintUpload();
  const ui = usePlansPhotosUi();
  const { setActiveCard } = plansPhotosUiActions();
  // Snapshot store carries `projectId` on the async-dispatch path where
  // upload.response stays null (the queued path) — fall back to snapshot
  // so the failure card mounts for in-progress projects too.
  const snap = useBlueprintUploadSnapshot();

  const projectId =
    upload.response?.ingest?.project_id ??
    upload.response?.project_id ??
    snap.projectId ??
    null;
  const poll = useBlueprintProjectPoll(projectId);

  const hasProject = projectId != null;
  const liveSheetCount = poll.status?.sheet_count ?? poll.sheets.length;

  // Auto-jump to Sheets when an upload finishes (premium UX: don't make
  // the user click). Effect catches up the store; the render below uses
  // an effective-card synchronously computed value so there's no
  // one-frame flicker to UploadDropZone after a project loads.
  React.useEffect(() => {
    if (hasProject && ui.activeCard === 'upload') {
      setActiveCard('sheets');
    }
    // setActiveCard is module-stable; safe to exclude.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProject, ui.activeCard]);

  // 2026-05-26 — A previous version of this file listened to global
  // `estimate-studio:remove-project` / `:new-project` events and called
  // `upload.reset()` + `setActiveCard('upload')` inside the listener. The
  // listener was suspected of triggering React error #300 (Maximum update
  // depth exceeded) under specific click sequences — `upload.reset()` and
  // `setActiveCard()` both notify external stores, which in turn fan out
  // setState calls across multiple subscribers; combined with the
  // auto-jump effect below, the cascade could re-enter under certain
  // timings. Removed in favor of letting the poll cache invalidation +
  // the `poll.sheets.length === 0` loader gate handle remove cleanup
  // (see below). If a future bug shows the dead-project-id sticking,
  // re-introduce as a snap.projectId watcher instead of a DOM event.

  // 2026-05-25 — Effective card override: if a project is active, never
  // render 'upload' even if the store hasn't been corrected yet by the
  // effect above. This kills the loader → UploadDropZone → loader flash
  // the user reported when navigating into Plans & Photos with a live
  // project. The store still updates asynchronously via the effect, but
  // the render path is now flicker-free.
  const activeCard: PlansPhotosCardKey =
    hasProject && ui.activeCard === 'upload' ? 'sheets' : ui.activeCard;

  // Failure short-circuit: when Drew has reported a stage failure, the
  // canvas swaps in the failure card REGARDLESS of which view chip is
  // selected. The user has been staring at frozen shimmer too long for
  // us to gate the error surface behind a click. Wired ABOVE the
  // memoized switch so we never compute the success-path render tree
  // for a dead project.
  const failureCard = useMemo<React.ReactNode>(() => {
    if (!poll.hasFailed || !poll.failedStage) return null;
    const isRetrying =
      upload.phase === 'reading' ||
      upload.phase === 'uploading' ||
      upload.phase === 'ingesting' ||
      upload.phase === 'classifying';
    return (
      <BlueprintFailureCard
        failedStage={poll.failedStage}
        failureSummary={poll.failureSummary}
        projectId={projectId}
        isRetrying={isRetrying}
        onRetry={upload.retry}
        onStartOver={upload.reset}
      />
    );
  }, [
    poll.hasFailed,
    poll.failedStage,
    poll.failureSummary,
    projectId,
    upload.phase,
    upload.retry,
    upload.reset,
  ]);

  // 2026-05-25 — Unconditional loader bridge.
  // Computed at the TOP of `card` (above the activeCard switch) so the
  // ripple loader owns the entire upload-click -> blueprints-rendered
  // window. The previous architecture had the loader living inside the
  // 'sheets' case, which created flicker windows when:
  //   (a) upload.phase entered a pipeline state but hasProject hadn't
  //       flipped true yet (response in-flight) -> 'upload' case rendered
  //       UploadDropZone, then transitioned to 'sheets' case
  //   (b) hasProject toggled false momentarily mid-upload due to
  //       response/snapshot timing -> 'upload' case re-rendered briefly
  // This loader gate fires whenever the user is in ANY post-idle upload
  // phase OR has a project but no sheets yet. UploadDropZone now only
  // renders in the truly-idle and error states, eliminating all
  // intermediate flashes.
  // 2026-05-26 — Bridging loader rule, simplified.
  //
  // Prior versions tried to gate on `upload.phase`, but the upload hook never
  // transitions OUT of 'ingesting' on its own — it stays there for the rest
  // of the session because nothing wires poll state back to phase. That made
  // the loader stick forever as soon as one upload was queued, even though
  // sheets had long since rendered.
  //
  // Correct rule: the loader is ONLY a bridge between (a) the user clicking
  // upload and (b) the project's sheets becoming visible. The moment sheets
  // arrive in the poll, drop the loader — the user has visible content,
  // there's nothing to bridge to. If sheets is still empty AND ingest hasn't
  // finished, keep the loader. If sheets is empty AND ingest IS terminal,
  // that's the empty-state card's job, not the loader's.
  const ingestStatus = poll.stageProgress?.ingest ?? 'pending';
  const ingestHardFailed = ingestStatus === 'error';
  const ingestTerminal = STAGE_TERMINAL.has(ingestStatus);
  // Pre-handoff window: the file is being read/uploaded/initialised, before
  // the backend has accepted it. There is no project yet, no sheets to show.
  const preHandoff =
    upload.phase === 'reading' ||
    upload.phase === 'init' ||
    upload.phase === 'uploading' ||
    upload.phase === 'completing';
  // Post-handoff: project exists, but no sheets yet and ingest still running.
  const awaitingFirstSheets =
    hasProject &&
    poll.sheets.length === 0 &&
    !ingestHardFailed &&
    !ingestTerminal;
  // Sheets in poll == content ready. Never bridge over visible content.
  const showBridgingLoader =
    poll.sheets.length === 0 && (preHandoff || awaitingFirstSheets);
  // Kept for the loader copy switch below (was the original boolean name).
  const uploadInFlight = preHandoff;

  const card = useMemo<React.ReactNode>(() => {
    // Unconditional loader bridge — wins over the activeCard switch.
    if (showBridgingLoader) {
      return (
        <View style={styles.loaderHost} testID="plans-photos-bridging-loader">
          <PremiumBlueprintLoader size={240} />
          <Text style={styles.loaderTitle}>
            {uploadInFlight ? 'Processing your blueprint…' : 'Loading blueprints…'}
          </Text>
          <Text style={styles.loaderBody}>
            Drew is preparing the canvas. This usually takes a few seconds.
          </Text>
        </View>
      );
    }

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
      case 'sheets': {
        return hasProject ? (
          <SheetCanvasView
            sheets={poll.sheets}
            testID="plans-photos-sheet-canvas"
          />
        ) : (
          <EmptyCardPlaceholder
            icon="documents-outline"
            title="No sheets yet"
            body="Drop a plan set in the Controls tab to begin."
          />
        );
      }
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
    showBridgingLoader,
    uploadInFlight,
  ]);

  // Canvas is intentionally bare: ONE focused element, edge-to-edge, no
  // surrounding chrome. The Tim Rail Context tab owns counters, stage
  // progress, view-switcher, and discipline-filter chrome.
  return (
    <View style={styles.canvas} testID="plans-photos-tab">
      {failureCard ?? card}
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
  // Wave 18m bridge loader — shown between upload completion and first poll
  // response so the canvas never flashes empty.
  loaderHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 28,
    minHeight: 320,
  },
  loaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  loaderBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 17,
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
