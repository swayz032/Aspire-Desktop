/**
 * ChapterBlueprintPane — Story Mode v2 right pane.
 *
 * Renders the actual blueprint sheet image for the currently selected
 * chapter, with a tab bar across the top (one tab per `chapter.source_sheets[]`)
 * and a top-right floating zoom toolbar. AnnotationOverlay (amber regions +
 * red pins) is layered INSIDE the same transformed container so coordinates
 * stay locked to the sheet geometry during pan/zoom.
 *
 * Pan/zoom mechanics are mirrored from `SheetCanvasView` — same constants,
 * same hand-rolled CSS-transform approach, web only. Native renders a plain
 * `<Image>` (no transform, no zoom toolbar) since web is the contractor's
 * primary surface for the canvas.
 *
 * Law #7 compliance: this is a render layer only. All hover state is
 * dispatched up via `onHoverRegion`; no decisions, no orchestrator calls,
 * no autonomous behavior.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type {
  BlueprintChapter,
  BlueprintRegion,
  ChapterSource,
  OpenQuestion,
} from '@/lib/api/blueprintsApi';
import { AnnotationOverlay } from './AnnotationOverlay';

// ---------------------------------------------------------------------------
// Zoom constants — mirror SheetCanvasView exactly.
// ---------------------------------------------------------------------------

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const WHEEL_STEP = 0.15;
const BUTTON_STEP = 1.25;

interface ZoomState {
  scale: number;
  tx: number;
  ty: number;
}
const ZOOM_INITIAL: ZoomState = { scale: 1, tx: 0, ty: 0 };

interface ZoomApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface ChapterBlueprintPaneProps {
  chapter: BlueprintChapter;
  regions: BlueprintRegion[];
  openQuestions?: OpenQuestion[];
  hoverRegionKey: string | null;
  onHoverRegion: (key: string | null) => void;
}

export function ChapterBlueprintPane({
  chapter,
  regions,
  openQuestions = [],
  hoverRegionKey,
  onHoverRegion,
}: ChapterBlueprintPaneProps): React.ReactElement {
  const sheets = chapter.source_sheets;
  const [activeSheetCode, setActiveSheetCode] = useState<string | null>(
    sheets.length > 0 ? sheets[0].sheet_code : null,
  );

  // Reset active sheet whenever the chapter switches.
  useEffect(() => {
    setActiveSheetCode(sheets.length > 0 ? sheets[0].sheet_code : null);
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

  const zoomApiRef = useRef<Partial<ZoomApi>>({});

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
          <>
            <BlueprintZoomStage
              key={activeSheet.sheet_code}
              activeSheet={activeSheet}
              regions={regions}
              openQuestions={openQuestions}
              hoverRegionKey={hoverRegionKey}
              onHoverRegion={onHoverRegion}
              zoomApiRef={zoomApiRef}
            />
            {/* Zoom toolbar — visually web-only (native has no transform),
                but rendered unconditionally so the imperative API stays
                consistent across platforms and tests. The buttons no-op on
                native where pan/zoom isn't wired. */}
            <ZoomToolbar
              onZoomIn={() => zoomApiRef.current.zoomIn?.()}
              onZoomOut={() => zoomApiRef.current.zoomOut?.()}
              onFit={() => zoomApiRef.current.fit?.()}
            />
          </>
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
    <View style={styles.tabBar}>
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// BlueprintZoomStage — pan/zoom container with overlay layered inside
// ---------------------------------------------------------------------------

interface BlueprintZoomStageProps {
  activeSheet: ChapterSource;
  regions: BlueprintRegion[];
  openQuestions: OpenQuestion[];
  hoverRegionKey: string | null;
  onHoverRegion: (key: string | null) => void;
  zoomApiRef: React.MutableRefObject<Partial<ZoomApi>>;
}

function BlueprintZoomStage({
  activeSheet,
  regions,
  openQuestions,
  hoverRegionKey,
  onHoverRegion,
  zoomApiRef,
}: BlueprintZoomStageProps): React.ReactElement {
  const [zoom, setZoom] = useState<ZoomState>(ZOOM_INITIAL);
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; otx: number; oty: number }>({
    active: false, sx: 0, sy: 0, otx: 0, oty: 0,
  });

  // NOTE: zoom reset on active-sheet change is handled by the `key={activeSheet.sheet_code}`
  // remount at the parent (see <BlueprintZoomStage key=...>). No useEffect reset needed —
  // remount gives us a fresh ZOOM_INITIAL state for free.

  // Imperative zoom API for the parent toolbar. Cleared on unmount so the parent
  // doesn't hold stale closures pointing at this unmounted instance's setZoom.
  useEffect(() => {
    const clampScale = (s: number): number => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
    zoomApiRef.current = {
      zoomIn: () => setZoom((z) => ({ ...z, scale: clampScale(z.scale * BUTTON_STEP) })),
      zoomOut: () => setZoom((z) => ({ ...z, scale: clampScale(z.scale / BUTTON_STEP) })),
      fit: () => setZoom(ZOOM_INITIAL),
    };
    return () => {
      zoomApiRef.current = {};
    };
  }, [zoomApiRef]);

  const uri = activeSheet.render_url ?? '';

  // Native: plain Image + overlay as siblings. No transform.
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.stageInner}>
        <Image source={{ uri }} style={styles.stageImage} resizeMode="contain" />
        <AnnotationOverlay
          activeSheetCode={activeSheet.sheet_code}
          regions={regions}
          openQuestions={openQuestions}
          hoverRegionKey={hoverRegionKey}
          onHoverRegion={onHoverRegion}
        />
      </View>
    );
  }

  // Web: hand-rolled pan + zoom via CSS transform on a same-size container
  // that holds BOTH the image and the AnnotationOverlay — so amber regions
  // and red pins follow the zoom in lockstep.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * WHEEL_STEP;
    setZoom((z) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, z.scale * (1 + delta)));
      return { ...z, scale: next };
    });
  };
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, otx: zoom.tx, oty: zoom.ty };
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    setZoom((z) => ({ ...z, tx: d.otx + dx, ty: d.oty + dy }));
  };
  const onMouseUp = (): void => {
    dragRef.current.active = false;
  };

  const transformedStyle: ViewStyle = ({
    transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
    transformOrigin: 'center center',
    transition: dragRef.current.active ? 'none' : 'transform 100ms ease-out',
  } as unknown) as ViewStyle;

  // Match SheetCanvasView's pattern: use a raw <div> on web so DOM mouse/
  // wheel handlers attach cleanly without RN-Web prop-name mismatch.
  return (
    <div
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: dragRef.current.active ? 'grabbing' : zoom.scale > 1 ? 'grab' : 'default',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      <View style={[StyleSheet.absoluteFill, transformedStyle]} pointerEvents="box-none">
        <Image
          source={{ uri }}
          style={styles.stageImage}
          resizeMode="contain"
        />
        <AnnotationOverlay
          activeSheetCode={activeSheet.sheet_code}
          regions={regions}
          openQuestions={openQuestions}
          hoverRegionKey={hoverRegionKey}
          onHoverRegion={onHoverRegion}
        />
      </View>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZoomToolbar — floating top-right (web only)
// ---------------------------------------------------------------------------

interface ZoomToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

function ZoomToolbar({ onZoomIn, onZoomOut, onFit }: ZoomToolbarProps): React.ReactElement {
  return (
    <View style={styles.zoomBar} pointerEvents="box-none">
      <ZoomBtn testID="zoom-button-in" label="Zoom in" glyph="+" onPress={onZoomIn} />
      <ZoomBtn testID="zoom-button-out" label="Zoom out" glyph="−" onPress={onZoomOut} />
      <ZoomBtn testID="zoom-button-fit" label="Fit to screen" glyph="⇱" onPress={onFit} />
    </View>
  );
}

interface ZoomBtnProps {
  testID: string;
  label: string;
  glyph: string;
  onPress: () => void;
}

function ZoomBtn({ testID, label, glyph, onPress }: ZoomBtnProps): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.zoomBtn}
    >
      <Text style={styles.zoomBtnGlyph}>{glyph}</Text>
    </Pressable>
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
  // ─── Tab bar ───
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251,191,36,0.10)',
    flexWrap: 'wrap',
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 96,
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
  stageInner: {
    flex: 1,
    position: 'relative',
  },
  stageImage: {
    width: '100%',
    height: '100%',
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
  // ─── Zoom toolbar ───
  zoomBar: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnGlyph: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
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
