/**
 * BlueprintZoomStage — the pan/zoom-aware blueprint sheet stage used
 * inside ChapterBlueprintPane (Story Mode v2).
 *
 * Web: hand-rolled CSS transform pan + wheel zoom + drag pan, scale
 *      clamped to [0.5, 6]. Image + AnnotationOverlay share the same
 *      transformed container so amber regions and red pins follow the
 *      sheet during pan/zoom.
 *
 * Native: plain Image with the overlay as a sibling (no transform, no
 *         zoom toolbar). Story Mode is web-first; native ship later.
 *
 * Zoom mechanics mirrored from
 * components/service-hub/estimate-studio/plans-photos/SheetCanvasView.tsx
 * to keep the contractor's pan/zoom muscle memory consistent across
 * Plans & Photos and Story Mode.
 *
 * Law #7: render layer only — transform state lives inside this
 * component, no autonomous decisions.
 */
import React, { useEffect, useRef, useState } from 'react';
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

export interface ZoomApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

// ---------------------------------------------------------------------------
// BlueprintZoomStage — pan/zoom container with overlay layered inside +
// floating top-right zoom toolbar (web only visually, mounted unconditionally).
// ---------------------------------------------------------------------------

interface Props {
  activeSheet: ChapterSource;
  regions: BlueprintRegion[];
  openQuestions: OpenQuestion[];
  hoverRegionKey: string | null;
  onHoverRegion: (key: string | null) => void;
}

export function BlueprintZoomStage({
  activeSheet,
  regions,
  openQuestions,
  hoverRegionKey,
  onHoverRegion,
}: Props): React.ReactElement {
  const [zoom, setZoom] = useState<ZoomState>(ZOOM_INITIAL);
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; otx: number; oty: number }>({
    active: false, sx: 0, sy: 0, otx: 0, oty: 0,
  });
  const zoomApiRef = useRef<Partial<ZoomApi>>({});

  // Imperative zoom API for the toolbar. Cleared on unmount so callers
  // don't hold stale closures pointing at this unmounted instance's setZoom.
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
  }, []);

  const uri = activeSheet.render_url ?? '';

  // Native: plain Image + overlay as siblings. No transform, but render the
  // toolbar anyway so testIDs resolve consistently across platforms.
  if (Platform.OS !== 'web') {
    return (
      <>
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
        <ZoomToolbar
          onZoomIn={() => zoomApiRef.current.zoomIn?.()}
          onZoomOut={() => zoomApiRef.current.zoomOut?.()}
          onFit={() => zoomApiRef.current.fit?.()}
        />
      </>
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
    <>
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
      <ZoomToolbar
        onZoomIn={() => zoomApiRef.current.zoomIn?.()}
        onZoomOut={() => zoomApiRef.current.zoomOut?.()}
        onFit={() => zoomApiRef.current.fit?.()}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ZoomToolbar — floating top-right (web only visually)
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
// Styles — only what the stage + toolbar need.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  stageInner: {
    flex: 1,
    position: 'relative',
  },
  stageImage: {
    width: '100%',
    height: '100%',
  },
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
});
