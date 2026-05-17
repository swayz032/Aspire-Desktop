/**
 * PlansPhotosTab — Wave 6A.
 *
 * Owner of the Plans & Photos UX. Two states:
 *
 *   Empty (no project yet):
 *     - Big <UploadDropZone /> hero takes the canvas
 *     - Bottom chip strip shows only "📤 Upload" enabled; the other chips
 *       are disabled placeholders for future views
 *
 *   Populated (a project landed):
 *     - <CanvasCardSwitcher /> hosts the chip-selected card
 *     - Default view = "📑 All Sheets" (the SheetRoster)
 *     - Bottom chip strip switches between Upload / All Sheets /
 *       By Discipline / Revisions
 *
 * Wave 6A reality: thumbnails, polling, and per-sheet discipline tags
 * land in Wave 6.5. A wave-coming-soon banner makes this visible to
 * localhost reviewers (per Tonio's directive).
 *
 * Law #7: render layer only. All decisions happen in the hook.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlueprintUpload } from '@/hooks/useBlueprintUpload';
import { CanvasCardSwitcher } from '../shell/CanvasCardSwitcher';
import { BottomChipStrip, type BottomChip } from '../shell/BottomChipStrip';
import { UploadDropZone } from './UploadDropZone';
import { SheetRoster } from './SheetRoster';
import { UploadProgressInline } from './UploadProgressInline';
import { getDisciplineStyle } from './disciplines';

type CardKey = 'upload' | 'sheets' | 'disciplines' | 'revisions';

const COMING_SOON_NOTE =
  'Thumbnails + 5-stage progress land in Wave 6.5 (waiting on Wave 2.5 backend reads + Wave 3 SEE).';

export function PlansPhotosTab(): React.ReactElement {
  const upload = useBlueprintUpload();
  const [activeCard, setActiveCard] = useState<CardKey>('upload');

  const hasProject = upload.phase === 'success' && upload.response != null;
  const sheetCount = upload.response?.ingest.sheet_count ?? 0;
  const disciplineCounts = upload.response?.classify?.discipline_counts ?? {};
  const revisions = upload.response?.classify?.revisions ?? 0;
  const needsReview = upload.response?.classify?.needs_review_count ?? 0;
  const sheetIds = upload.response?.ingest.sheet_ids ?? [];

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
        stat: hasProject ? `${sheetCount} sheets` : 'Upload to enable',
        badge: hasProject ? `${sheetCount}` : undefined,
        disabled: !hasProject,
      },
      {
        key: 'disciplines',
        icon: 'color-palette-outline',
        label: 'By Discipline',
        stat: hasProject
          ? `${Object.keys(disciplineCounts).length} tags`
          : 'Upload to enable',
        disabled: !hasProject || Object.keys(disciplineCounts).length === 0,
      },
      {
        key: 'revisions',
        icon: 'time-outline',
        label: 'Revisions',
        stat: hasProject ? `${revisions} found` : 'Upload to enable',
        disabled: !hasProject,
      },
    ],
    [hasProject, sheetCount, disciplineCounts, revisions],
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
      <SheetRoster
        sheetIds={sheetIds}
        disciplineCounts={disciplineCounts}
        revisions={revisions}
        needsReviewCount={needsReview}
      />
    ) : (
      <EmptyCardPlaceholder
        icon="documents-outline"
        title="No sheets yet"
        body="Upload a plan set to see the roster."
      />
    ),
    disciplines: hasProject ? (
      <DisciplineBreakdownCard counts={disciplineCounts} />
    ) : (
      <EmptyCardPlaceholder
        icon="color-palette-outline"
        title="No disciplines yet"
        body="Upload a plan set so Drew can classify the sheets."
      />
    ),
    revisions: hasProject ? (
      <EmptyCardPlaceholder
        icon="time-outline"
        title={`${revisions} revision${revisions === 1 ? '' : 's'} detected`}
        body="Full revision-chain UI (per-sheet supersedes + tooltips) ships in Wave 6.5."
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
      {/* Wave 6A coming-soon banner so localhost reviewers know what's deferred. */}
      <View style={styles.banner} accessibilityRole="alert" testID="plans-photos-wave-banner">
        <Ionicons name="information-circle-outline" size={13} color="#fbbf24" />
        <Text style={styles.bannerText}>{COMING_SOON_NOTE}</Text>
      </View>

      {/* Inline pipeline indicator — always visible so users see ingest → classify happen. */}
      {upload.phase !== 'idle' ? (
        <View style={styles.progressStrip}>
          <UploadProgressInline stages={upload.stageProgress} layout="horizontal" />
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

function DisciplineBreakdownCard({ counts }: { counts: Record<string, number> }): React.ReactElement {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <EmptyCardPlaceholder
        icon="color-palette-outline"
        title="No discipline tags yet"
        body="Drew didn't find recognisable discipline markers on this plan set."
      />
    );
  }
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return (
    <View style={styles.discHost} testID="discipline-breakdown-card">
      <Text style={styles.discTitle}>Discipline Breakdown</Text>
      <Text style={styles.discSubtitle}>
        {total} classified entr{total === 1 ? 'y' : 'ies'} across {entries.length} discipline
        {entries.length === 1 ? '' : 's'}.
      </Text>
      <View style={styles.discList}>
        {entries.map(([disc, count]) => {
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

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    padding: 18,
    gap: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  bannerText: {
    flex: 1,
    fontSize: 10.5,
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: -0.05,
    lineHeight: 14,
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
});
