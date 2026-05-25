/**
 * ChapterBlueprintPane — Story Mode v2 right pane.
 *
 * Renders the actual blueprint sheet image for the currently selected
 * chapter, with a tab bar across the top (one tab per `chapter.source_sheets[]`)
 * and a bottom legend. The pan/zoom-aware stage + AnnotationOverlay +
 * floating zoom toolbar are owned by `BlueprintZoomStage` (sibling file).
 *
 * Law #7 compliance: this is a render layer only. All hover state is
 * dispatched up via `onHoverRegion`; no decisions, no orchestrator calls,
 * no autonomous behavior.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// 2026-05-24 — Desktop-visible, touch-invisible horizontal scrollbar.
//
// Touch devices (phones, tablets) hide the scrollbar so the canvas reads
// clean. Desktop browsers with a real pointer get a premium amber scrollbar
// so mouse users have a visible scroll affordance for the sheet tab bar.
// `(hover: hover) and (pointer: fine)` is the canonical mouse-capable
// media query — true for mouse, false for touch + stylus.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'chapter-blueprint-pane-tabbar-scrollbar';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      /* Touch / unknown — hide. */
      [data-chapter-blueprint-tabbar="1"] { scrollbar-width: none; -ms-overflow-style: none; }
      [data-chapter-blueprint-tabbar="1"]::-webkit-scrollbar { width: 0; height: 0; display: none; }

      /* Desktop with mouse — premium amber scrollbar. */
      @media (hover: hover) and (pointer: fine) {
        [data-chapter-blueprint-tabbar="1"] {
          scrollbar-width: thin;
          scrollbar-color: rgba(251,191,36,0.45) transparent;
        }
        [data-chapter-blueprint-tabbar="1"]::-webkit-scrollbar {
          height: 6px;
          width: 6px;
          display: block;
        }
        [data-chapter-blueprint-tabbar="1"]::-webkit-scrollbar-track { background: transparent; }
        [data-chapter-blueprint-tabbar="1"]::-webkit-scrollbar-thumb {
          background: rgba(251,191,36,0.35);
          border-radius: 3px;
        }
        [data-chapter-blueprint-tabbar="1"]::-webkit-scrollbar-thumb:hover {
          background: rgba(251,191,36,0.65);
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
}
import type {
  BlueprintChapter,
  BlueprintRegion,
  ChapterSource,
  OpenQuestion,
} from '@/lib/api/blueprintsApi';
import { BlueprintZoomStage } from './BlueprintZoomStage';
import { sheetDisplayName } from '@/lib/scope/sheet-naming';

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface ChapterBlueprintPaneProps {
  chapter: BlueprintChapter;
  regions: BlueprintRegion[];
  openQuestions?: OpenQuestion[];
  hoverRegionKey: string | null;
  onHoverRegion: (key: string | null) => void;
  /** Optional controlled mode — when both props are supplied, the parent
   *  drives sheet switching (e.g. so a SmartText chip in the left pane
   *  can jump to a referenced sheet). When omitted, the pane manages its
   *  own internal state. */
  activeSheetCode?: string | null;
  onActiveSheetCodeChange?: (code: string) => void;
}

export function ChapterBlueprintPane({
  chapter,
  regions,
  openQuestions = [],
  hoverRegionKey,
  onHoverRegion,
  activeSheetCode: controlledActive,
  onActiveSheetCodeChange,
}: ChapterBlueprintPaneProps): React.ReactElement {
  // 2026-05-25 — Dedupe source_sheets by sheet_code so the tab bar never
  // shows two cards with the same code (which made both look "active" at
  // once because both matched the active-code comparison). First page
  // wins. Drew's OCR sometimes emits the same sheet_code twice for
  // multi-page sheets — we collapse those into one tab here.
  const sheets = useMemo<ChapterSource[]>(() => {
    const seen = new Set<string>();
    const out: ChapterSource[] = [];
    for (const s of chapter.source_sheets) {
      const key = s.sheet_code.trim().toUpperCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    }
    return out;
  }, [chapter.source_sheets]);

  const [internalActive, setInternalActive] = useState<string | null>(
    sheets.length > 0 ? sheets[0].sheet_code : null,
  );

  // Controlled mode wins when the parent provides both props.
  const isControlled = controlledActive !== undefined && typeof onActiveSheetCodeChange === 'function';
  const activeSheetCode = isControlled ? controlledActive : internalActive;
  const setActiveSheetCode = (code: string): void => {
    if (isControlled) {
      onActiveSheetCodeChange!(code);
    } else {
      setInternalActive(code);
    }
  };

  // Reset internal active sheet whenever the chapter switches (uncontrolled
  // mode only — controlled mode is the parent's responsibility).
  useEffect(() => {
    if (!isControlled) {
      setInternalActive(sheets.length > 0 ? sheets[0].sheet_code : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.key]);

  const activeSheet: ChapterSource | null = useMemo(
    () => sheets.find((s) => s.sheet_code === activeSheetCode) ?? sheets[0] ?? null,
    [sheets, activeSheetCode],
  );

  const matchingRegions = useMemo(
    () => (activeSheet ? regions.filter((r) => r.sheet_code === activeSheet.sheet_code) : []),
    [regions, activeSheet],
  );

  // Empty-chapter state.
  if (sheets.length === 0) {
    return (
      <View style={styles.pane} testID="blueprint-pane">
        <View style={styles.emptyCenter} testID="blueprint-pane-no-sheets">
          <Text style={styles.emptyText}>No source sheets</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.pane} testID="blueprint-pane">
      <SheetTabBar
        sheets={sheets}
        activeSheetCode={activeSheet?.sheet_code ?? null}
        onSelect={setActiveSheetCode}
      />

      <View style={styles.stage}>
        {activeSheet && activeSheet.render_url ? (
          <BlueprintZoomStage
            key={activeSheet.sheet_code}
            activeSheet={activeSheet}
            regions={regions}
            openQuestions={openQuestions}
            hoverRegionKey={hoverRegionKey}
            onHoverRegion={onHoverRegion}
          />
        ) : (
          <View style={styles.emptyCenter} testID="blueprint-pane-render-pending">
            <Text style={styles.emptyText}>Sheet render pending</Text>
          </View>
        )}
      </View>

      <LegendBar hasRegions={matchingRegions.length > 0} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// SheetTabBar — top tab strip, one tab per source sheet
// ---------------------------------------------------------------------------

interface SheetTabBarProps {
  sheets: ChapterSource[];
  activeSheetCode: string | null;
  onSelect: (code: string) => void;
}

function SheetTabBar({ sheets, activeSheetCode, onSelect }: SheetTabBarProps): React.ReactElement {
  // Pre-compute display names once per render so the JSX stays tight.
  const items = useMemo(
    () =>
      sheets.map((s) => ({
        sheet: s,
        display: sheetDisplayName(s.sheet_code, s.sheet_title),
      })),
    [sheets],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBarScroll}
      contentContainerStyle={styles.tabBar}
      dataSet={Platform.OS === 'web' ? ({ chapterBlueprintTabbar: '1' } as Record<string, unknown>) : undefined}
    >
      {items.map(({ sheet, display }) => {
        const isActive = sheet.sheet_code === activeSheetCode;
        return (
          <Pressable
            key={sheet.sheet_code}
            testID={`sheet-tab-${sheet.sheet_code}`}
            accessibilityRole="tab"
            accessibilityLabel={`Sheet ${display.primary}, ${display.secondary}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(sheet.sheet_code)}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.tab,
              isActive ? styles.tabActive : styles.tabIdle,
              !isActive && hovered ? styles.tabHover : null,
            ]}
          >
            <Text style={[styles.tabCode, isActive ? styles.tabCodeActive : null]} numberOfLines={1}>
              {display.primary}
            </Text>
            <Text style={[styles.tabTitle, isActive ? styles.tabTitleActive : null]} numberOfLines={1}>
              {display.secondary}
            </Text>
            {isActive ? <View style={styles.tabActiveBar} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// LegendBar — bottom-pinned amber legend
// ---------------------------------------------------------------------------

interface LegendBarProps {
  hasRegions: boolean;
}

function LegendBar({ hasRegions }: LegendBarProps): React.ReactElement {
  return (
    <View style={styles.legendBar}>
      <View style={styles.legendItem}>
        <View style={styles.swatchAmber} />
        <Text style={styles.legendText}>Drew highlighted</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={styles.swatchRed} />
        <Text style={styles.legendText}>Open question</Text>
      </View>
      <View style={styles.legendSpacer} />
      {hasRegions ? (
        <Text style={styles.legendHint}>Hover bullet → region pulses</Text>
      ) : (
        <Text style={styles.legendHint} testID="blueprint-pane-no-regions">
          No regions on this sheet yet.
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    backgroundColor: 'rgba(8,10,14,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.10)',
    overflow: 'hidden',
  },
  // ─── Tab bar (single horizontal row, scrolls with invisible scrollbar) ───
  tabBarScroll: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251,191,36,0.10)',
  },
  // 2026-05-25 — Equal-width tab cards. flexBasis + minWidth + maxWidth
  // gives every card the same shape regardless of label length, and the
  // ScrollView still scrolls horizontally when total width exceeds the
  // available pane. alignItems: 'stretch' would inflate tab height to
  // match the tallest sibling — we want consistent intrinsic height from
  // the explicit `tab.height` instead.
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'flex-start',
  },
  tab: {
    width: 140,
    height: 52,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
    flexGrow: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIdle: {
    backgroundColor: 'rgba(20,22,28,0.85)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabHover: {
    backgroundColor: 'rgba(30,32,40,0.95)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tabActive: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: '#fbbf24',
  },
  tabCode: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tabCodeActive: {
    color: '#fbbf24',
  },
  tabTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10.5,
    marginTop: 3,
    fontWeight: '500',
  },
  tabTitleActive: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },
  // 4px amber underline at the bottom of the active tab — premium visual
  // anchor so the user can tell at a glance which sheet is selected even
  // if hover state and active state look similar.
  tabActiveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: '#fbbf24',
  },
  // ─── Stage ───
  stage: {
    flex: 1,
    minHeight: 320,
    position: 'relative',
    overflow: 'hidden',
  },
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  // ─── Legend ───
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.18)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatchAmber: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
  },
  swatchRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  legendText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
  legendSpacer: {
    flex: 1,
  },
  legendHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default ChapterBlueprintPane;
