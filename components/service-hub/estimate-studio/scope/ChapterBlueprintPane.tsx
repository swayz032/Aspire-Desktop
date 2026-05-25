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
  const sheets = chapter.source_sheets;
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBarScroll}
      contentContainerStyle={styles.tabBar}
      dataSet={Platform.OS === 'web' ? ({ chapterBlueprintTabbar: '1' } as Record<string, unknown>) : undefined}
    >
      {sheets.map((s) => {
        const isActive = s.sheet_code === activeSheetCode;
        return (
          <Pressable
            key={s.sheet_code}
            testID={`sheet-tab-${s.sheet_code}`}
            accessibilityRole="tab"
            accessibilityLabel={`Sheet ${s.sheet_code}, ${s.sheet_title}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(s.sheet_code)}
            style={[styles.tab, isActive ? styles.tabActive : styles.tabIdle]}
          >
            <Text style={[styles.tabCode, isActive ? styles.tabCodeActive : null]}>
              {s.sheet_code}
            </Text>
            <Text style={[styles.tabTitle, isActive ? styles.tabTitleActive : null]} numberOfLines={1}>
              {s.sheet_title}
            </Text>
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
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 96,
    flexShrink: 0,
  },
  tabIdle: {
    backgroundColor: 'rgba(20,22,28,0.85)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: '#fbbf24',
  },
  tabCode: {
    color: '#f5f5f5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tabCodeActive: {
    color: '#fbbf24',
  },
  tabTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 2,
  },
  tabTitleActive: {
    color: 'rgba(255,255,255,0.85)',
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
