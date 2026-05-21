/**
 * SheetCanvasView — Wave 11o canvas-on-stage layout.
 *
 * Replaces the 5-column SheetThumbnailGrid for the default `sheets` view.
 * Mirrors the Visuals tab pattern (HeroSwitcher + bottom chip strip):
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                                                             │
 *   │                                                             │
 *   │          BIG SHEET ON STAGE (pan + zoom on web)             │
 *   │                                                             │
 *   │                                  ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
 *   │                                  │ +│ │ −│ │⤢ │ │1:│        │
 *   │                                  └──┘ └──┘ └──┘ └──┘        │
 *   └─────────────────────────────────────────────────────────────┘
 *   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  ←scroll
 *   │ A 1  │ │ A 2  │ │ E 1  │ │ E 2  │ │ P 1  │ │ AD 1 │
 *   │      │ │      │ │ thumb│ │      │ │      │ │      │
 *   └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
 *
 * Sort order is numeric on sheet_number — fixes the "1, 10, 11, 12, 2"
 * alphabetic sort that disoriented contractors.
 *
 * Pan/zoom on web via react-zoom-pan-pinch (industry standard for canvas
 * blueprint tools — Bluebeam, PlanGrid, Procore all use the same library
 * family). Native falls back to a plain Image — Railway-served web is the
 * primary contractor surface, native ship is later.
 *
 * Sheet code (E-1, P-1) display: backend doesn't store sheet_code yet
 * (next migration). Until then, label = `{disciplineCode} {sheet_number}`
 * which is dramatically clearer than the raw page index alone.
 *
 * Law #7: render layer only. No polling, no decisions.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { BlueprintSheetRead } from '@/lib/api/blueprintsApi';
import { getDisciplineStyle } from './disciplines';

// Hand-rolled web pan + zoom (no external dep). CSS transform with
// wheel zoom + drag pan. Tracks scale + translate in state and exposes
// a small imperative API for the zoom buttons.

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
  reset: () => void;
  fit: () => void;
}

// ---------------------------------------------------------------------------
// Numeric sort — fixes 1,10,11,12,2 disorder
// ---------------------------------------------------------------------------

function _sortSheetsNatural(sheets: BlueprintSheetRead[]): BlueprintSheetRead[] {
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
// Chip — bottom-strip card representing one sheet
// ---------------------------------------------------------------------------

interface ChipProps {
  sheet: BlueprintSheetRead;
  index: number;
  isActive: boolean;
  onPress: () => void;
}

function SheetChip({ sheet, index, isActive, onPress }: ChipProps): React.ReactElement {
  const discStyle = getDisciplineStyle(sheet.discipline);
  // Wave 11p — prefer architectural sheet_code (e.g. "E-1", "C2.2") over
  // raw page index. Fall back to "{disciplineCode} {sheet_number}" when
  // Drew couldn't extract a code from the title block (older projects /
  // poor OCR / non-standard layouts).
  const codeLabel =
    sheet.sheet_code ?? `${discStyle.code} ${sheet.sheet_number ?? String(index + 1)}`;
  const subLabel = sheet.sheet_title ?? discStyle.label;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Sheet ${discStyle.code} ${num}, ${discStyle.label}`}
      accessibilityState={{ selected: isActive }}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.chip,
        hovered && !isActive ? styles.chipHover : null,
        pressed ? styles.chipPressed : null,
        isActive ? styles.chipActive : null,
      ]}
      testID={`sheet-chip-${sheet.id}`}
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
            <Ionicons name="document-text-outline" size={20} color="rgba(255,255,255,0.30)" />
          </View>
        )}
        {/* discipline pill bottom-left */}
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
// Public component
// ---------------------------------------------------------------------------

export interface SheetCanvasViewProps {
  sheets: BlueprintSheetRead[];
  testID?: string;
}

export function SheetCanvasView({
  sheets,
  testID = 'sheet-canvas-view',
}: SheetCanvasViewProps): React.ReactElement {
  const sorted = useMemo(() => _sortSheetsNatural(sheets), [sheets]);
  const [activeId, setActiveId] = useState<string | null>(
    sorted.length > 0 ? sorted[0].id : null,
  );

  // If the sheet list changes (new upload, sheets arriving), make sure the
  // active id still exists in the list.
  useEffect(() => {
    if (sorted.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    const stillExists = sorted.some((s) => s.id === activeId);
    if (!stillExists) setActiveId(sorted[0].id);
  }, [sorted, activeId]);

  const activeSheet = useMemo(
    () => sorted.find((s) => s.id === activeId) ?? sorted[0] ?? null,
    [sorted, activeId],
  );

  // Auto-scroll the active chip into view when it changes (premium UX —
  // no contractor should ever lose their place).
  const scrollRef = useRef<ScrollView | null>(null);
  const chipPositions = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!activeId) return;
    const x = chipPositions.current[activeId];
    if (typeof x === 'number' && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, x - 120), animated: true });
    }
  }, [activeId]);

  // Zoom controls. The stage owns the actual zoom state — we just pass a
  // ref it populates with imperative methods so the toolbar can trigger
  // them.
  const zoomApiRef = useRef<Partial<ZoomApi>>({});

  const handleZoomIn = useCallback(() => zoomApiRef.current.zoomIn?.(), []);
  const handleZoomOut = useCallback(() => zoomApiRef.current.zoomOut?.(), []);
  const handleZoomReset = useCallback(() => zoomApiRef.current.reset?.(), []);
  const handleZoomFit = useCallback(() => zoomApiRef.current.fit?.(), []);

  if (sorted.length === 0) {
    return (
      <View style={styles.emptyHost} testID={`${testID}-empty`}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="documents-outline" size={28} color="rgba(255,255,255,0.45)" />
        </View>
        <Text style={styles.emptyTitle}>No sheets yet</Text>
        <Text style={styles.emptyBody}>
          Drop a plan set in the Controls tab. Sheets appear as Drew classifies them.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.host} testID={testID}>
      {/* ────────── Canvas (active sheet, pan + zoom on web) ────────── */}
      <View style={styles.stage}>
        <SheetStage
          sheet={activeSheet}
          zoomApiRef={zoomApiRef}
        />

        {/* Zoom controls — float top-right, web only (no-op stubs on native) */}
        <View style={styles.zoomBar} pointerEvents="box-none">
          <ZoomButton icon="add" onPress={handleZoomIn} label="Zoom in" />
          <ZoomButton icon="remove" onPress={handleZoomOut} label="Zoom out" />
          <ZoomButton icon="scan-outline" onPress={handleZoomFit} label="Fit to screen" />
          <ZoomButton icon="refresh" onPress={handleZoomReset} label="Reset zoom" />
        </View>

        {/* Sheet label badge — bottom-left of canvas */}
        {activeSheet ? (
          <View style={styles.activeLabel}>
            <Text style={styles.activeLabelMain}>
              {activeSheet.sheet_code ??
                `${getDisciplineStyle(activeSheet.discipline).code} ${activeSheet.sheet_number ?? '—'}`}
            </Text>
            <Text style={styles.activeLabelSub}>
              {activeSheet.sheet_title ?? getDisciplineStyle(activeSheet.discipline).label}
              {activeSheet.revision ? ` · Rev ${activeSheet.revision}` : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ────────── Bottom chip strip ────────── */}
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
                isActive={s.id === activeId}
                onPress={() => setActiveId(s.id)}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SheetStage — handles web zoom wiring or native plain image
// ---------------------------------------------------------------------------

interface StageProps {
  sheet: BlueprintSheetRead | null;
  zoomApiRef: React.MutableRefObject<Partial<ZoomApi>>;
}

function SheetStage({ sheet, zoomApiRef }: StageProps): React.ReactElement {
  const [zoom, setZoom] = useState<ZoomState>(ZOOM_INITIAL);
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; otx: number; oty: number }>({
    active: false, sx: 0, sy: 0, otx: 0, oty: 0,
  });

  // Reset zoom when the active sheet changes — contractors expect each
  // new sheet to start fit-to-screen.
  useEffect(() => {
    setZoom(ZOOM_INITIAL);
  }, [sheet?.id]);

  // Wire the imperative zoom API the toolbar uses.
  useEffect(() => {
    const clampScale = (s: number): number =>
      Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
    zoomApiRef.current = {
      zoomIn: () => setZoom((z) => ({ ...z, scale: clampScale(z.scale * BUTTON_STEP) })),
      zoomOut: () => setZoom((z) => ({ ...z, scale: clampScale(z.scale / BUTTON_STEP) })),
      reset: () => setZoom(ZOOM_INITIAL),
      fit: () => setZoom(ZOOM_INITIAL),
    };
  }, [zoomApiRef]);

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

  // Web: hand-rolled pan + zoom via CSS transform.
  if (Platform.OS === 'web') {
    // Wheel zoom — invert sign so scroll-up = zoom-in (matches Photoshop /
    // Bluebeam / PlanGrid convention).
    const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * WHEEL_STEP;
      setZoom((z) => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, z.scale * (1 + delta)));
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
      };
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
    const onDoubleClick = (): void => {
      setZoom((z) => (z.scale > 1.1 ? ZOOM_INITIAL : { ...ZOOM_INITIAL, scale: 2 }));
    };

    return (
      <div
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: dragRef.current.active ? 'grabbing' : zoom.scale > 1 ? 'grab' : 'default',
          userSelect: 'none',
        }}
      >
        <img
          src={sheet.thumbnail_url}
          alt={`Sheet ${sheet.sheet_number ?? ''}`}
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
            transformOrigin: 'center center',
            transition: dragRef.current.active ? 'none' : 'transform 100ms ease-out',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  // Native fallback: plain Image (no pan/zoom for v1 — web is primary surface).
  return (
    <Image
      source={{ uri: sheet.thumbnail_url }}
      style={styles.stageImage}
      resizeMode="contain"
    />
  );
}

// ---------------------------------------------------------------------------
// Zoom button
// ---------------------------------------------------------------------------

interface ZoomButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
}

function ZoomButton({ icon, onPress, label }: ZoomButtonProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.zoomBtn,
        hovered ? styles.zoomBtnHover : null,
        pressed ? styles.zoomBtnPressed : null,
      ]}
    >
      <Ionicons name={icon} size={16} color="#fbbf24" />
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
  // ────────── Stage (canvas) ──────────
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
  // ────────── Floating active label (bottom-left of canvas) ──────────
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
  // ────────── Zoom controls (top-right of canvas) ──────────
  zoomBar: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnHover: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  zoomBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  // ────────── Bottom chip strip ──────────
  stripHost: {
    marginTop: 12,
    paddingVertical: 4,
  },
  stripContent: {
    paddingHorizontal: 4,
    gap: 10,
  },
  // ────────── Chip ──────────
  chip: {
    width: 132,
    paddingBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(20,22,28,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  chipHover: {
    borderColor: 'rgba(251,191,36,0.30)',
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
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
  // ────────── Empty state ──────────
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

export default SheetCanvasView;
