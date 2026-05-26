/**
 * StoryPanelV2 — chapter-based Story Mode canvas (Wave 19+).
 *
 * Composes the three Story Mode v2 pieces:
 *   - Left  (440px): ChapterLeftPane — 5 plain-English zones over the active chapter
 *   - Right (flex):  ChapterBlueprintPane — real blueprint sheet render with pan/zoom + annotations
 *   - Bottom:        ChapterStrip — horizontal blueprint-thumbnail chapter cards
 *
 * Drop-in replacement for the legacy StoryPanel; consumed by ScopeTab when
 * activeCard === 'story' and storyV2.chapters has content. State (hover wiring,
 * active chapter selection) lives in useChapterAnnotations + scopeUiStore so
 * the canvas is a pure render layer (Law #7).
 *
 * Empty state: shown when Drew hasn't produced any chapters yet. The chapter
 * strip is also hidden — there's nothing to scroll.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintStoryV2 } from '@/lib/api/blueprintsApi';
import { ChapterLeftPane } from './ChapterLeftPane';
import { ChapterBlueprintPane } from './ChapterBlueprintPane';
import { ChapterStrip } from './ChapterStrip';
import { SheetReceiptDrawer } from './SheetReceiptDrawer';
import { useChapterAnnotations } from './useChapterAnnotations';

interface Props {
  story: BlueprintStoryV2;
  activeChapterKey: string | null;
  onSelectChapter: (key: string) => void;
  /** 2026-05-25 — DV Pass 3: passed through to SheetReceiptDrawer so the
   *  provenance lookup can scope its receipt fetch by project. Optional —
   *  legacy callers (and the empty-state path) work without it. */
  projectId?: string | null;
}

export function StoryPanelV2({ story, activeChapterKey, onSelectChapter, projectId = null }: Props): React.ReactElement {
  // All hooks must be called unconditionally before any early return —
  // hence we compute `active` (with a fallback shim when empty) up front,
  // even though the empty branch below doesn't use it.
  const annotations = useChapterAnnotations();

  const active =
    story.chapters.find((c) => c.key === activeChapterKey) ?? story.chapters[0] ?? null;
  const activeKey = active?.key ?? null;

  // Reset hover wiring when the active chapter changes so a stale bullet/region
  // key from the previous chapter doesn't accidentally match (or stick).
  // Setters are stable (useCallback in useChapterAnnotations) so depending on
  // them is safe and doesn't refire the effect.
  const { setHoverBulletKey, setHoverRegionKey } = annotations;
  useEffect(() => {
    setHoverBulletKey(null);
    setHoverRegionKey(null);
  }, [activeKey, setHoverBulletKey, setHoverRegionKey]);

  // Stable identity so ChapterBlueprintPane (and any downstream React.memo)
  // doesn't re-render on every parent render.
  const regions = useMemo(
    () =>
      (active?.zones.open_questions ?? [])
        .map((q) => q.blueprint_region)
        .filter((r): r is NonNullable<typeof r> => r != null),
    [active],
  );

  // 2026-05-24 — Active-sheet selection per chapter, lifted up so an inline
  // SmartText sheet-code chip in the left pane can jump the right pane to
  // the referenced sheet. Stored as a per-chapter map so switching chapters
  // remembers each chapter's last-viewed sheet.
  const [sheetByChapter, setSheetByChapter] = useState<Record<string, string>>({});
  const setSheetForChapter = useCallback((chapterKey: string, sheetCode: string) => {
    setSheetByChapter((prev) =>
      prev[chapterKey] === sheetCode ? prev : { ...prev, [chapterKey]: sheetCode },
    );
  }, []);

  // 2026-05-24 — View mode toggle (chapter overview vs per-sheet story).
  // Default 'chapter' on every chapter switch; auto-flips to 'sheet' when
  // the user clicks a sheet tab in the right pane or a SmartText jump chip.
  const [viewMode, setViewMode] = useState<'chapter' | 'sheet'>('chapter');
  useEffect(() => {
    setViewMode('chapter');
  }, [activeKey]);

  // Resolve the active sheet object for the active chapter — either the
  // user-selected sheet from sheetByChapter, or the first source sheet as
  // the default.
  const activeSheetCode = active ? sheetByChapter[active.key] : null;
  const activeSheetObj = useMemo(() => {
    if (!active || active.source_sheets.length === 0) return null;
    const found = active.source_sheets.find((s) => s.sheet_code === activeSheetCode);
    return found ?? active.source_sheets[0];
  }, [active, activeSheetCode]);

  // When the user picks a sheet (either via tab click in the right pane or
  // via a SmartText jump chip in the left), flip the view mode to 'sheet'
  // so the left pane shows that sheet's story right away.
  const handleSheetJump = useCallback((chapterKey: string, sheetCode: string) => {
    setSheetForChapter(chapterKey, sheetCode);
    setViewMode('sheet');
  }, [setSheetForChapter]);

  if (story.chapters.length === 0 || !active) {
    return (
      <View style={styles.empty} testID="story-panel-v2-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons name="book-outline" size={28} color="rgba(255,255,255,0.55)" />
        </View>
        <Text style={styles.emptyTitle}>Drew is reading your blueprint</Text>
        <Text style={styles.emptyBody}>
          Chapters appear as they complete. Typically 30–90 seconds for a 30-sheet plan set.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.host} testID="story-panel-v2">
      <View style={styles.card}>
        <View style={styles.split}>
          <View style={styles.leftSlot}>
            <ChapterLeftPane
              chapter={active}
              hoverBulletKey={annotations.hoverBulletKey}
              onHoverBullet={annotations.setHoverBulletKey}
              onSheetJump={(code) => handleSheetJump(active.key, code)}
              totalChapters={story.chapters.length}
              viewMode={viewMode}
              activeSheet={activeSheetObj ? { sheet_code: activeSheetObj.sheet_code, sheet_title: activeSheetObj.sheet_title } : null}
              onViewModeChange={setViewMode}
            />
          </View>
          <View style={styles.rightSlot}>
            <ChapterBlueprintPane
              chapter={active}
              regions={regions}
              hoverRegionKey={annotations.hoverRegionKey}
              onHoverRegion={annotations.setHoverRegionKey}
              activeSheetCode={activeSheetObj?.sheet_code ?? null}
              onActiveSheetCodeChange={(code) => handleSheetJump(active.key, code)}
            />
          </View>
        </View>
        {activeSheetObj ? (
          <View style={styles.drawerSlot}>
            <SheetReceiptDrawer projectId={projectId} sheet={activeSheetObj} />
          </View>
        ) : null}
        <ChapterStrip
          chapters={story.chapters}
          activeKey={active.key}
          onSelect={onSelectChapter}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 320 },
  card: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 10,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.10)',
  },
  split: { flexDirection: 'row', flex: 1, minHeight: 0 },
  leftSlot: { width: 440, minHeight: 0 },
  rightSlot: { flex: 1, minHeight: 0 },
  drawerSlot: { paddingHorizontal: 12, paddingVertical: 8 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28,
  },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.88)', letterSpacing: -0.2 },
  emptyBody: {
    fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 380, lineHeight: 17,
  },
});
