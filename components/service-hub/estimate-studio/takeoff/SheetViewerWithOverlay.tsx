/**
 * SheetViewerWithOverlay â€” Wave 13.
 *
 * Bluebeam-grade takeoff canvas. Mirrors the Wave 11o `SheetCanvasView`
 * layout that contractors already know from Plans & Photos:
 *
 *   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 *   â”‚                                                             â”‚
 *   â”‚   BIG SHEET ON STAGE (pan + zoom on web)                    â”‚
 *   â”‚   + Drew's YOLO bounding boxes layered on top               â”‚
 *   â”‚                                                             â”‚
 *   â”‚                                  â”Œâ”€â”€â” â”Œâ”€â”€â” â”Œâ”€â”€â” â”Œâ”€â”€â”        â”‚
 *   â”‚                                  â”‚ +â”‚ â”‚ âˆ’â”‚ â”‚â¤¢ â”‚ â”‚1:â”‚        â”‚
 *   â”‚                                  â””â”€â”€â”˜ â””â”€â”€â”˜ â””â”€â”€â”˜ â””â”€â”€â”˜        â”‚
 *   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 *   â”Œâ”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”  â†scroll
 *   â”‚ A 1  â”‚ â”‚ A 2  â”‚ â”‚ E 1  â”‚ â”‚ E 2  â”‚ â”‚ P 1  â”‚ â”‚ AD 1 â”‚  bottom
 *   â”‚      â”‚ â”‚      â”‚ â”‚ thumbâ”‚ â”‚      â”‚ â”‚      â”‚ â”‚      â”‚  chip
 *   â””â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”˜  strip
 *                              â–²
 *                              â”‚  Side panel slides in from right
 *                              â”‚  when a symbol bbox is clicked.
 *
 * Why we wrote this in parallel to `SheetCanvasView`:
 *   - SheetCanvasView is a pure read-only viewer. Adding an overlay layer
 *     that lives INSIDE the same transform component would have required
 *     re-architecting it with a render-prop. To preserve the locked Plans
 *     & Photos contract, this file copies the pan/zoom math and adds the
 *     overlay as a sibling sharing the same transform. Smaller diff.
 *
 * Bbox math:
 *   - `TakeoffSymbol.bbox` is normalized 0..1 to the rendered sheet image.
 *   - The image is `object-fit: contain` inside the viewport, so the actual
 *     pixel rect of the image inside the viewport depends on the sheet's
 *     intrinsic aspect ratio vs. the viewport's aspect ratio. We compute
 *     the contained image rect on each render and project bboxes into it.
 *   - The whole stack (image + overlay) shares ONE CSS transform, so the
 *     boxes stay locked to the image when the user pans/zooms.
 *
 * Aspire Laws:
 *   - Law #7 â€” pure render. Confirm/RFI/Edit are console.info stubs.
 *   - Law #9 â€” symbol payload contains no PII; safe to log selection events
 *     in dev (we don't, but it would be safe if we did).
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintSheetRead,
  TakeoffSymbol,
} from '@/lib/api/blueprintsApi';
import { getDisciplineStyle as getSheetDisciplineStyle } from '../plans-photos/disciplines';
import {
  styleForSymbolClass,
  prettyClassName,
  type SymbolDiscipline,
} from './symbolClasses';

// ---------------------------------------------------------------------------
// Zoom contract
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

// ---------------------------------------------------------------------------
// Sheet sort (matches SheetCanvasView)
// ---------------------------------------------------------------------------

function sortSheetsNatural(sheets: BlueprintSheetRead[]): BlueprintSheetRead[] {
  return sheets.slice().sort((a, b) => {
    const na = parseInt(a.sheet_number ?? '', 10);
    const nb = parseInt(b.sheet_number ?? '', 10);
    const aValid = !Number.isNaN(na);
    const bValid = !Number.isNaN(nb);
    if (aValid && bValid) return na - nb;
    if (aValid) return -1;
    if (bValid) return 1;
    return (a.sheet_number ?? '').localeCompare(b.sheet_number ?? '');
  });
}

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface SheetViewerWithOverlayProps {
  sheets: BlueprintSheetRead[];
  /** Filter applied to the parent's full symbol list. Already filtered to
   *  active sheet by the parent so the overlay just renders what it gets. */
  symbols: TakeoffSymbol[];
  /** Whole-project symbol count, used to render the per-sheet count chip. */
  totalSymbolCount: number;
  /** Disciplines toggled off in the legend; overlay filters by this set. */
  hiddenDisciplines: ReadonlySet<SymbolDiscipline>;
  activeSheetId: string | null;
  onActiveSheetChange: (id: string) => void;
  selectedSymbolId: string | null;
  onSelectSymbol: (sym: TakeoffSymbol | null) => void;
  overlayVisible: boolean;
  onToggleOverlay: () => void;
  /** When set, these chips render with the highlight accent (driven by
   *  AssemblyTable click â†’ "where does this assembly live?"). */
  highlightedSheetIds: ReadonlySet<string>;
  symbolsEndpointMissing?: boolean;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SheetViewerWithOverlay({
  sheets,
  symbols,
  totalSymbolCount,
  hiddenDisciplines,
  activeSheetId,
  onActiveSheetChange,
  selectedSymbolId,
  onSelectSymbol,
  overlayVisible,
  onToggleOverlay,
  highlightedSheetIds,
  symbolsEndpointMissing = false,
  testID = 'sheet-viewer-with-overlay',
}: SheetViewerWithOverlayProps): React.ReactElement {
  const sorted = useMemo(() => sortSheetsNatural(sheets), [sheets]);

  // If the active sheet vanishes from the list, fall back to the first sheet.
  useEffect(() => {
    if (sorted.length === 0) return;
    if (!activeSheetId || !sorted.some((s) => s.id === activeSheetId)) {
      onActiveSheetChange(sorted[0].id);
    }
  }, [sorted, activeSheetId, onActiveSheetChange]);

  const activeSheet = useMemo(
    () => sorted.find((s) => s.id === activeSheetId) ?? sorted[0] ?? null,
    [sorted, activeSheetId],
  );

  // Selected symbol object (for the side panel).
  const selectedSymbol = useMemo(
    () => symbols.find((s) => s.symbol_id === selectedSymbolId) ?? null,
    [symbols, selectedSymbolId],
  );

  // Filter symbols by hidden disciplines.
  const visibleSymbols = useMemo(() => {
    if (hiddenDisciplines.size === 0) return symbols;
    return symbols.filter((sym) => {
      const style = styleForSymbolClass(sym.override_class ?? sym.class);
      return !hiddenDisciplines.has(style.discipline);
    });
  }, [symbols, hiddenDisciplines]);

  // Auto-scroll the active chip into view when it changes.
  const scrollRef = useRef<ScrollView | null>(null);
  const chipPositions = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!activeSheet) return;
    const x = chipPositions.current[activeSheet.id];
    if (typeof x === 'number' && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, x - 120), animated: true });
    }
  }, [activeSheet?.id]);

  // Per-sheet symbol count map for the chip badges.
  const symbolCountBySheet = useMemo(() => {
    const m = new Map<string, number>();
    for (const sym of symbols) {
      m.set(sym.sheet_id, (m.get(sym.sheet_id) ?? 0) + 1);
    }
    return m;
  }, [symbols]);

  // Zoom api shared between stage + toolbar.
  const zoomApiRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    fit: () => void;
  } | null>(null);

  const handleZoomIn = useCallback(() => zoomApiRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => zoomApiRef.current?.zoomOut(), []);
  const handleZoomReset = useCallback(() => zoomApiRef.current?.reset(), []);
  const handleZoomFit = useCallback(() => zoomApiRef.current?.fit(), []);

  if (sorted.length === 0) {
    return (
      <View style={styles.emptyHost} testID={`${testID}-empty`}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="documents-outline" size={28} color="rgba(255,255,255,0.45)" />
        </View>
        <Text style={styles.emptyTitle}>No sheets yet</Text>
        <Text style={styles.emptyBody}>
          Drop a plan set in Plans & Photos. Sheets appear as Drew classifies them.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.host} testID={testID}>
      {/* Stage â”€ active sheet with pan/zoom + overlay */}
      <View style={styles.stage}>
        <SheetStage
          sheet={activeSheet}
          symbols={visibleSymbols}
          overlayVisible={overlayVisible}
          selectedSymbolId={selectedSymbolId}
          onSelectSymbol={onSelectSymbol}
          zoomApiRef={zoomApiRef}
        />

        {/* Top-right toolbar: overlay toggle + zoom controls */}
        <View style={styles.toolbar} pointerEvents="box-none">
          <ToolbarButton
            icon={overlayVisible ? 'eye' : 'eye-off-outline'}
            onPress={onToggleOverlay}
            label="Toggle symbol overlay"
            active={overlayVisible}
            testID="symbol-overlay-toggle"
          />
          <View style={styles.toolbarDivider} />
          <ToolbarButton icon="add" onPress={handleZoomIn} label="Zoom in" />
          <ToolbarButton icon="remove" onPress={handleZoomOut} label="Zoom out" />
          <ToolbarButton icon="scan-outline" onPress={handleZoomFit} label="Fit to screen" />
          <ToolbarButton icon="refresh" onPress={handleZoomReset} label="Reset zoom" />
        </View>

        {/* Bottom-left sheet badge */}
        {activeSheet ? (
          <View style={styles.activeLabel}>
            <Text style={styles.activeLabelMain}>
              {activeSheet.sheet_code ??
                `${getSheetDisciplineStyle(activeSheet.discipline).code} ${activeSheet.sheet_number ?? 'â€”'}`}
            </Text>
            <Text style={styles.activeLabelSub}>
              {activeSheet.sheet_title ??
                getSheetDisciplineStyle(activeSheet.discipline).label}
              {activeSheet.revision ? ` Â· Rev ${activeSheet.revision}` : ''}
              {' Â· '}
              {(symbolCountBySheet.get(activeSheet.id) ?? 0).toString()} symbols
            </Text>
          </View>
        ) : null}

        {/* Wave 2.7 missing-endpoint banner */}
        {symbolsEndpointMissing ? (
          <View style={styles.missingBanner} testID="symbols-missing-banner">
            <Ionicons name="warning-outline" size={12} color="#fbbf24" />
            <Text style={styles.missingText}>
              Symbol overlay requires Wave 2.7 backend reads. UI ready; awaiting data.
            </Text>
          </View>
        ) : null}

        {/* Side panel â€” slides in from right when a symbol is selected */}
        <SymbolSidePanel
          symbol={selectedSymbol}
          totalSymbolCount={totalSymbolCount}
          sameSheetCount={
            selectedSymbol
              ? symbols.filter(
                  (s) =>
                    s.sheet_id === selectedSymbol.sheet_id &&
                    s.class === selectedSymbol.class,
                ).length
              : 0
          }
          onClose={() => onSelectSymbol(null)}
        />
      </View>

      {/* Bottom chip strip â€” sheet selector */}
      <View style={styles.stripHost}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          testID={`${testID}-strip`}
        >
          {sorted.map((s, i) => (
            <View
              key={s.id}
              onLayout={(e) => {
                chipPositions.current[s.id] = e.nativeEvent.layout.x;
              }}
            >
              <SheetChip
                sheet={s}
                index={i}
                isActive={s.id === activeSheet?.id}
                isHighlighted={highlightedSheetIds.has(s.id)}
                symbolCount={symbolCountBySheet.get(s.id) ?? 0}
                onPress={() => onActiveSheetChange(s.id)}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SheetStage â€” pan + zoom around image, overlay shares the same transform
// ---------------------------------------------------------------------------

interface StageProps {
  sheet: BlueprintSheetRead | null;
  symbols: TakeoffSymbol[];
  overlayVisible: boolean;
  selectedSymbolId: string | null;
  onSelectSymbol: (sym: TakeoffSymbol | null) => void;
  zoomApiRef: React.MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    fit: () => void;
  } | null>;
}

function SheetStage({
  sheet,
  symbols,
  overlayVisible,
  selectedSymbolId,
  onSelectSymbol,
  zoomApiRef,
}: StageProps): React.ReactElement {
  const [zoom, setZoom] = useState<ZoomState>(ZOOM_INITIAL);
  const dragRef = useRef<{
    active: boolean;
    sx: number;
    sy: number;
    otx: number;
    oty: number;
    moved: boolean;
  }>({ active: false, sx: 0, sy: 0, otx: 0, oty: 0, moved: false });

  // Viewport size (for projecting normalized bbox coordinates).
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Intrinsic image aspect ratio (for the contain-fit math).
  const [imgAspect, setImgAspect] = useState<number | null>(null);

  // Reset zoom when sheet changes.
  useEffect(() => {
    setZoom(ZOOM_INITIAL);
  }, [sheet?.id]);

  // Wire the imperative zoom API.
  useEffect(() => {
    const clampScale = (s: number): number =>
      Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
    zoomApiRef.current = {
      zoomIn: () =>
        setZoom((z) => ({ ...z, scale: clampScale(z.scale * BUTTON_STEP) })),
      zoomOut: () =>
        setZoom((z) => ({ ...z, scale: clampScale(z.scale / BUTTON_STEP) })),
      reset: () => setZoom(ZOOM_INITIAL),
      fit: () => setZoom(ZOOM_INITIAL),
    };
  }, [zoomApiRef]);

  // Compute the contained image rect â€” where the image actually paints
  // inside the viewport with object-fit: contain semantics.
  const containedRect = useMemo(() => {
    if (!viewport.w || !viewport.h || !imgAspect || imgAspect <= 0) {
      return { left: 0, top: 0, width: viewport.w, height: viewport.h };
    }
    const viewportAspect = viewport.w / viewport.h;
    if (imgAspect > viewportAspect) {
      // Image is wider than viewport â€” width fills, height is letterboxed.
      const width = viewport.w;
      const height = width / imgAspect;
      return { left: 0, top: (viewport.h - height) / 2, width, height };
    }
    // Image is taller â€” height fills, width is pillar-boxed.
    const height = viewport.h;
    const width = height * imgAspect;
    return { left: (viewport.w - width) / 2, top: 0, width, height };
  }, [viewport.w, viewport.h, imgAspect]);

  if (!sheet || !sheet.thumbnail_url) {
    return (
      <View style={styles.stageEmpty}>
        <Ionicons name="image-outline" size={56} color="rgba(255,255,255,0.20)" />
        <Text style={styles.stageEmptyText}>
          {sheet ? 'Image not ready yet' : 'Select a sheet'}
        </Text>
      </View>
    );
  }

  const overlayLayer = (
    <View
      style={[
        styles.overlayLayer,
        {
          left: containedRect.left,
          top: containedRect.top,
          width: containedRect.width,
          height: containedRect.height,
        },
      ]}
      pointerEvents={overlayVisible ? 'box-none' : 'none'}
      testID="symbol-overlay-layer"
    >
      {overlayVisible &&
        symbols.map((sym) => {
          if (sym.status === 'dropped') return null;
          const style = styleForSymbolClass(sym.override_class ?? sym.class);
          const left = sym.bbox.x * containedRect.width;
          const top = sym.bbox.y * containedRect.height;
          const w = Math.max(10, sym.bbox.w * containedRect.width);
          const h = Math.max(10, sym.bbox.h * containedRect.height);
          const isLowConf = sym.confidence < 0.5;
          const isSelected = sym.symbol_id === selectedSymbolId;
          const isConfirmed =
            sym.status === 'confirmed' || sym.status === 'reclassified';
          const opacity = Math.max(0.45, Math.min(1, sym.confidence));

          return (
            <Pressable
              key={sym.symbol_id}
              onPress={() => {
                // Suppress click if user was panning.
                if (dragRef.current.moved) return;
                onSelectSymbol(sym);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Symbol ${prettyClassName(
                sym.override_class ?? sym.class,
              )} at ${Math.round(sym.confidence * 100)}% confidence`}
              testID={`symbol-bbox-${sym.symbol_id}`}
              style={({ hovered }: any) => [
                styles.bbox,
                {
                  left,
                  top,
                  width: w,
                  height: h,
                  backgroundColor: style.fill,
                  borderColor: style.fg,
                  opacity,
                  borderStyle:
                    isLowConf && !isConfirmed ? 'dashed' : 'solid',
                },
                hovered ? styles.bboxHover : null,
                isSelected ? styles.bboxSelected : null,
                isConfirmed ? styles.bboxConfirmed : null,
              ]}
            >
              <View style={[styles.bboxTag, { backgroundColor: style.fg }]}>
                <Text style={styles.bboxTagText}>{style.code}</Text>
              </View>
            </Pressable>
          );
        })}
    </View>
  );

  if (Platform.OS === 'web') {
    const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * WHEEL_STEP;
      setZoom((z) => {
        const next = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, z.scale * (1 + delta)),
        );
        return { ...z, scale: next };
      });
    };
    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
      dragRef.current = {
        active: true,
        sx: e.clientX,
        sy: e.clientY,
        otx: zoom.tx,
        oty: zoom.ty,
        moved: false,
      };
    };
    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      setZoom((z) => ({ ...z, tx: d.otx + dx, ty: d.oty + dy }));
    };
    const onMouseUp = (): void => {
      dragRef.current.active = false;
      // Don't reset `moved` here â€” the bbox onPress reads it next-microtask.
      // Reset it on the next mousedown instead.
    };

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: dragRef.current.active
            ? 'grabbing'
            : zoom.scale > 1
              ? 'grab'
              : 'default',
          userSelect: 'none',
          position: 'relative',
        }}
        onLoad={() => {
          /* noop */
        }}
        ref={(el) => {
          if (el) {
            const rect = el.getBoundingClientRect();
            if (
              viewport.w !== rect.width ||
              viewport.h !== rect.height
            ) {
              setViewport({ w: rect.width, h: rect.height });
            }
          }
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
            transformOrigin: 'center center',
            transition: dragRef.current.active
              ? 'none'
              : 'transform 100ms ease-out',
          }}
        >
          <img
            src={sheet.thumbnail_url}
            alt={`Sheet ${sheet.sheet_number ?? ''}`}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImgAspect(img.naturalWidth / img.naturalHeight);
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              display: 'block',
            }}
          />
          {overlayLayer}
        </div>
      </div>
    );
  }

  // Native fallback â€” touch tap to select; no pan/zoom in v1.
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) =>
        setViewport({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      <Image
        source={{ uri: sheet.thumbnail_url }}
        style={styles.stageImage}
        resizeMode="contain"
        onLoad={(e: any) => {
          const src = e?.nativeEvent?.source;
          if (src?.width && src?.height) {
            setImgAspect(src.width / src.height);
          }
        }}
      />
      {overlayLayer}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SymbolSidePanel â€” slides in from right when a symbol is selected
// ---------------------------------------------------------------------------

interface SidePanelProps {
  symbol: TakeoffSymbol | null;
  totalSymbolCount: number;
  sameSheetCount: number;
  onClose: () => void;
}

function SymbolSidePanel({
  symbol,
  totalSymbolCount: _totalSymbolCount,
  sameSheetCount,
  onClose,
}: SidePanelProps): React.ReactElement | null {
  // We always render the panel (for transition smoothness), but slide it
  // off-screen when no symbol is selected.
  const visible = symbol != null;

  if (!symbol && !visible) return null;

  const style = symbol
    ? styleForSymbolClass(symbol.override_class ?? symbol.class)
    : null;
  const bboxArea = symbol
    ? `${(symbol.bbox.w * 100).toFixed(1)}% Ã— ${(symbol.bbox.h * 100).toFixed(1)}%`
    : '';
  const confPct = symbol ? Math.round(symbol.confidence * 100) : 0;

  return (
    <View
      style={[styles.sidePanel, visible ? styles.sidePanelOpen : styles.sidePanelClosed]}
      pointerEvents={visible ? 'auto' : 'none'}
      testID="symbol-side-panel"
      accessibilityViewIsModal={visible}
    >
      {symbol && style ? (
        <>
          <View style={styles.sidePanelHeader}>
            <View
              style={[
                styles.sidePanelTypeChip,
                { backgroundColor: style.fg + '22', borderColor: style.fg + '55' },
              ]}
            >
              <Text style={[styles.sidePanelTypeText, { color: style.fg }]}>
                {style.code}
              </Text>
            </View>
            <View style={styles.sidePanelTitleBlock}>
              <Text style={styles.sidePanelTitle} numberOfLines={2}>
                {prettyClassName(symbol.override_class ?? symbol.class)}
              </Text>
              <Text style={styles.sidePanelSubtitle}>
                {style.label}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close symbol details"
              testID="symbol-side-panel-close"
              style={({ hovered }: any) => [
                styles.sidePanelClose,
                hovered ? styles.sidePanelCloseHover : null,
              ]}
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.78)" />
            </Pressable>
          </View>

          {/* Stats block */}
          <View style={styles.sidePanelStats}>
            <StatRow
              label="Confidence"
              value={`${confPct}%`}
              accent={
                confPct >= 75
                  ? '#34d399'
                  : confPct >= 50
                    ? '#fbbf24'
                    : '#f87171'
              }
            />
            <StatRow label="Status" value={symbol.status ?? 'detected'} />
            <StatRow
              label="On this sheet"
              value={`${sameSheetCount} of same type`}
            />
            <StatRow label="Bbox area" value={bboxArea} />
          </View>

          <View style={styles.sidePanelDivider} />

          {/* Actions â€” all stubs (Law #7) */}
          <View style={styles.sidePanelActions}>
            <ActionButton
              icon="checkmark-circle-outline"
              label="Confirm"
              tone="success"
              onPress={() => {
                // eslint-disable-next-line no-console
                console.info('[takeoff] confirm', symbol.symbol_id);
              }}
              testID="symbol-action-confirm"
            />
            <ActionButton
              icon="help-circle-outline"
              label="RFI"
              tone="warning"
              onPress={() => {
                // eslint-disable-next-line no-console
                console.info('[takeoff] rfi', symbol.symbol_id);
              }}
              testID="symbol-action-rfi"
            />
            <ActionButton
              icon="create-outline"
              label="Edit type"
              tone="neutral"
              onPress={() => {
                // eslint-disable-next-line no-console
                console.info('[takeoff] edit-type', symbol.symbol_id);
              }}
              testID="symbol-action-edit"
            />
          </View>

          <View style={styles.sidePanelFooter}>
            <Ionicons
              name="link-outline"
              size={11}
              color="rgba(255,255,255,0.45)"
            />
            <Text style={styles.sidePanelFooterText} numberOfLines={1}>
              Belongs to: assembly link populates after REASON pass.
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): React.ReactElement {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  tone,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: 'success' | 'warning' | 'neutral';
  onPress: () => void;
  testID?: string;
}): React.ReactElement {
  const toneStyles = {
    success: { fg: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.40)' },
    warning: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.40)' },
    neutral: {
      fg: 'rgba(255,255,255,0.85)',
      bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.14)',
    },
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.actionBtn,
        {
          backgroundColor: toneStyles.bg,
          borderColor: toneStyles.border,
        },
        hovered ? styles.actionBtnHover : null,
        pressed ? styles.actionBtnPressed : null,
      ]}
    >
      <Ionicons name={icon} size={13} color={toneStyles.fg} />
      <Text style={[styles.actionBtnText, { color: toneStyles.fg }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Toolbar button (mirrors SheetCanvasView)
// ---------------------------------------------------------------------------

function ToolbarButton({
  icon,
  onPress,
  label,
  active,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  active?: boolean;
  testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active != null ? { checked: !!active } : undefined}
      testID={testID}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.toolbarBtn,
        active ? styles.toolbarBtnActive : null,
        hovered ? styles.toolbarBtnHover : null,
        pressed ? styles.toolbarBtnPressed : null,
      ]}
    >
      <Ionicons name={icon} size={15} color={active ? '#fbbf24' : '#fbbf24'} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// SheetChip â€” bottom-strip card
// ---------------------------------------------------------------------------

interface ChipProps {
  sheet: BlueprintSheetRead;
  index: number;
  isActive: boolean;
  isHighlighted: boolean;
  symbolCount: number;
  onPress: () => void;
}

function SheetChip({
  sheet,
  index,
  isActive,
  isHighlighted,
  symbolCount,
  onPress,
}: ChipProps): React.ReactElement {
  const discStyle = getSheetDisciplineStyle(sheet.discipline);
  const codeLabel =
    sheet.sheet_code ?? `${discStyle.code} ${sheet.sheet_number ?? String(index + 1)}`;
  const subLabel = sheet.sheet_title ?? discStyle.label;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Sheet ${codeLabel}, ${subLabel}, ${symbolCount} symbols`}
      accessibilityState={{ selected: isActive }}
      testID={`takeoff-sheet-chip-${sheet.id}`}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.chip,
        hovered && !isActive ? styles.chipHover : null,
        pressed ? styles.chipPressed : null,
        isHighlighted && !isActive ? styles.chipHighlighted : null,
        isActive ? styles.chipActive : null,
      ]}
    >
      <View style={styles.chipThumb}>
        {sheet.thumbnail_url ? (
          <Image
            source={{ uri: sheet.thumbnail_url }}
            style={styles.chipThumbImg}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.chipThumbPlaceholder}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color="rgba(255,255,255,0.30)"
            />
          </View>
        )}
        <View
          style={[
            styles.chipDiscPill,
            { backgroundColor: discStyle.fg + '22', borderColor: discStyle.fg + '55' },
          ]}
        >
          <Text style={[styles.chipDiscPillText, { color: discStyle.fg }]}>
            {discStyle.code}
          </Text>
        </View>
        {symbolCount > 0 ? (
          <View style={styles.chipSymCount} testID={`takeoff-sheet-chip-count-${sheet.id}`}>
            <Text style={styles.chipSymCountText}>{symbolCount}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {codeLabel}
      </Text>
      <Text style={[styles.chipSubLabel, { color: discStyle.fg }]} numberOfLines={1}>
        {subLabel}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  stage: {
    flex: 1,
    minHeight: 360,
    borderRadius: 14,
    backgroundColor: 'rgba(8,10,14,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.10)',
    overflow: 'hidden',
    position: 'relative',
  },
  stageEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stageEmptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  stageImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlayLayer: {
    position: 'absolute',
  },
  bbox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 2,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'opacity 120ms ease, box-shadow 120ms ease, border-width 80ms ease',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  bboxHover: {
    borderColor: '#fbbf24',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 2px rgba(251,191,36,0.45)',
        } as any)
      : {}),
  },
  bboxSelected: {
    borderWidth: 2.5,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 3px rgba(251,191,36,0.55)' } as any)
      : {
          shadowColor: '#fbbf24',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 6,
          elevation: 6,
        }),
  },
  bboxConfirmed: {
    borderWidth: 2,
  },
  bboxTag: {
    position: 'absolute',
    top: -8,
    left: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    minWidth: 14,
    alignItems: 'center',
  },
  bboxTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0b0b0b',
    letterSpacing: 0.4,
  },
  // Toolbar (top-right) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  toolbar: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(251,191,36,0.18)',
    marginHorizontal: 2,
  },
  toolbarBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.65)',
  },
  toolbarBtnHover: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  toolbarBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  // Active sheet badge (bottom-left of stage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  activeLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  activeLabelMain: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  activeLabelSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    marginTop: 1,
  },
  // Missing-endpoint banner
  missingBanner: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
    maxWidth: 320,
  },
  missingText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(251,191,36,0.92)',
    letterSpacing: -0.05,
  },
  // Side panel (right) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sidePanel: {
    position: 'absolute',
    top: 12,
    right: 12,
    bottom: 12,
    width: 320,
    borderRadius: 12,
    backgroundColor: 'rgba(14,16,22,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
    padding: 16,
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({
          transition:
            'transform 200ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease',
          backdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  sidePanelOpen: {
    opacity: 1,
    transform: [{ translateX: 0 }],
  },
  sidePanelClosed: {
    opacity: 0,
    transform: [{ translateX: 360 }],
  },
  sidePanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  sidePanelTypeChip: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidePanelTypeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sidePanelTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sidePanelTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sidePanelSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10.5,
    letterSpacing: -0.05,
  },
  sidePanelClose: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sidePanelCloseHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  sidePanelStats: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  sidePanelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sidePanelActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 120ms ease, border-color 120ms ease',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  actionBtnHover: {
    ...(Platform.OS === 'web'
      ? ({ filter: 'brightness(1.18)' } as any)
      : { opacity: 0.85 }),
  },
  actionBtnPressed: {
    transform: [{ scale: 0.97 }],
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  sidePanelFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sidePanelFooterText: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.05,
  },
  // Bottom chip strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  stripHost: {
    marginTop: 12,
    paddingVertical: 4,
  },
  stripContent: {
    paddingHorizontal: 4,
    gap: 10,
  },
  chip: {
    width: 132,
    paddingBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(20,22,28,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          transition:
            'background-color 150ms ease, border-color 150ms ease, transform 100ms ease',
        } as any)
      : {}),
  },
  chipHover: {
    borderColor: 'rgba(251,191,36,0.30)',
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
  chipHighlighted: {
    borderColor: 'rgba(52,211,153,0.55)',
    backgroundColor: 'rgba(52,211,153,0.08)',
  },
  chipActive: {
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  chipThumb: {
    width: '100%',
    aspectRatio: 1.3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  chipThumbImg: {
    width: '100%',
    height: '100%',
  },
  chipThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDiscPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipDiscPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chipSymCount: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSymCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
  chipLabel: {
    color: '#f5f5f5',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  chipSubLabel: {
    fontSize: 10,
    marginTop: 1,
    paddingHorizontal: 8,
  },
  // Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  emptyHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 320,
  },
});

export default SheetViewerWithOverlay;
