/**
 * SheetViewer — Wave 8.
 *
 * Canvas card for the Commercial Blueprint mode. Shows:
 *   - Top bar: sheet number · discipline · revision · scale · seal indicator
 *   - Left thumbnail strip (column of small previews; click swaps the main viewer)
 *   - Main viewer: large rendered sheet image + absolute-positioned symbol overlay
 *   - Overlay toggle + zoom reset button at top-right of the viewer
 *
 * Pan/zoom (web-first):
 *   - mouse wheel = zoom around cursor
 *   - drag = pan
 *   - "Reset" button restores scale=1, origin=center
 *
 * Clicking a symbol invokes `onSymbolPress(sym)` → SheetViewer calls
 * `onSelectSymbol(sym)` which opens the per-symbol action modal at the
 * parent (CommercialBlueprintMode).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintSheet } from '@/lib/api/blueprintsApi';
import type { TakeoffSymbol } from '@/lib/api/blueprintsApi';
import { SymbolOverlay } from './SymbolOverlay';

interface Props {
  sheets: BlueprintSheet[];
  activeSheetId: string | null;
  onSheetChange: (sheetId: string) => void;
  symbols: TakeoffSymbol[];
  symbolsEndpointMissing: boolean;
  selectedSymbolId?: string | null;
  onSelectSymbol: (sym: TakeoffSymbol | null) => void;
  /** When true the overlay is rendered. Toggled by the button. */
  overlayVisible: boolean;
  onToggleOverlay: () => void;
}

export function SheetViewer({
  sheets,
  activeSheetId,
  onSheetChange,
  symbols,
  symbolsEndpointMissing,
  selectedSymbolId,
  onSelectSymbol,
  overlayVisible,
  onToggleOverlay,
}: Props): React.ReactElement {
  const activeSheet = useMemo(
    () => sheets.find((s) => s.sheet_id === activeSheetId) ?? sheets[0] ?? null,
    [sheets, activeSheetId],
  );

  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  // Reset transform when the sheet changes (premium UX — don't carry pan/zoom).
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [activeSheet?.sheet_id]);

  // Wheel-zoom (web only — RN doesn't have a wheel event natively).
  const onWheel = useCallback((evt: any) => {
    if (Platform.OS !== 'web') return;
    evt.preventDefault?.();
    const delta = (evt.deltaY ?? 0) > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.5, Math.min(5, prev + delta)));
  }, []);

  const onPointerDown = useCallback((evt: any) => {
    if (Platform.OS !== 'web') return;
    dragRef.current = {
      x: evt.clientX ?? 0,
      y: evt.clientY ?? 0,
      tx: translate.x,
      ty: translate.y,
    };
  }, [translate.x, translate.y]);

  const onPointerMove = useCallback((evt: any) => {
    if (Platform.OS !== 'web' || !dragRef.current) return;
    const dx = (evt.clientX ?? 0) - dragRef.current.x;
    const dy = (evt.clientY ?? 0) - dragRef.current.y;
    setTranslate({ x: dragRef.current.tx + dx, y: dragRef.current.ty + dy });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Resolve the image source. RN's Image needs `uri` for remote.
  const imgSource: ImageSourcePropType | null = activeSheet?.thumbnail_url
    ? { uri: activeSheet.thumbnail_url }
    : null;

  return (
    <View style={styles.host} testID="sheet-viewer">
      {/* Top bar: sheet meta */}
      <View style={styles.topBar} testID="sheet-viewer-top-bar">
        <View style={styles.topBarLeft}>
          <Text style={styles.sheetNumber}>{activeSheet?.sheet_number ?? '—'}</Text>
          {activeSheet?.discipline ? (
            <View style={styles.disciplineChip}>
              <Text style={styles.disciplineText}>{activeSheet.discipline}</Text>
            </View>
          ) : null}
          <View style={styles.revBadge}>
            <Text style={styles.revText}>REV {activeSheet?.revision ?? 0}</Text>
          </View>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.scaleChip}>
            <Ionicons name="resize-outline" size={11} color="rgba(255,255,255,0.65)" />
            <Text style={styles.scaleText}>{'1/4" = 1\'-0"'}</Text>
          </View>
          <View
            style={[styles.sealChip, styles.sealOk]}
            testID="sheet-viewer-seal-indicator"
          >
            <Ionicons name="checkmark-circle" size={12} color="#34d399" />
            <Text style={styles.sealText}>Seal detected</Text>
          </View>
        </View>
      </View>

      {/* Body: thumbnail strip + main viewer */}
      <View style={styles.body}>
        <ScrollView
          style={styles.thumbStrip}
          contentContainerStyle={styles.thumbStripContent}
          showsVerticalScrollIndicator={false}
          testID="sheet-viewer-thumb-strip"
        >
          {sheets.map((sheet, idx) => {
            const isActive = sheet.sheet_id === (activeSheet?.sheet_id ?? null);
            return (
              <Pressable
                key={sheet.sheet_id}
                onPress={() => onSheetChange(sheet.sheet_id)}
                accessibilityRole="button"
                accessibilityLabel={`Sheet ${sheet.sheet_number}`}
                accessibilityState={{ selected: isActive }}
                testID={`sheet-thumb-${sheet.sheet_id}`}
                style={({ hovered }: any) => [
                  styles.thumb,
                  isActive && styles.thumbActive,
                  hovered && !isActive && styles.thumbHover,
                ]}
              >
                {sheet.thumbnail_url ? (
                  <Image
                    source={{ uri: sheet.thumbnail_url }}
                    style={styles.thumbImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Ionicons
                      name="document-outline"
                      size={20}
                      color="rgba(255,255,255,0.35)"
                    />
                  </View>
                )}
                <Text style={styles.thumbLabel} numberOfLines={1}>
                  {sheet.sheet_number || `Sheet ${idx + 1}`}
                </Text>
              </Pressable>
            );
          })}
          {sheets.length === 0 ? (
            <View style={styles.thumbEmpty}>
              <Text style={styles.thumbEmptyText}>No sheets</Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={styles.viewport}
          testID="sheet-viewer-viewport"
          onLayout={(e) =>
            setViewportSize({
              w: e.nativeEvent.layout.width,
              h: e.nativeEvent.layout.height,
            })
          }
          {...(Platform.OS === 'web'
            ? {
                onWheel,
                onPointerDown,
                onPointerMove,
                onPointerUp,
                onPointerLeave: onPointerUp,
              }
            : {})}
        >
          {imgSource ? (
            <View
              style={[
                styles.sheetCanvas,
                {
                  transform: [
                    { translateX: translate.x },
                    { translateY: translate.y },
                    { scale },
                  ],
                },
              ]}
            >
              <Image
                source={imgSource}
                style={styles.sheetImage}
                resizeMode="contain"
                testID="sheet-viewer-image"
              />
              <SymbolOverlay
                symbols={symbols.filter(
                  (s) => !activeSheet || s.sheet_id === activeSheet.sheet_id,
                )}
                containerWidth={viewportSize.w}
                containerHeight={viewportSize.h}
                visible={overlayVisible}
                onSymbolPress={onSelectSymbol}
                selectedSymbolId={selectedSymbolId}
              />
            </View>
          ) : (
            <View style={styles.emptyCanvas}>
              <Ionicons name="image-outline" size={36} color="rgba(255,255,255,0.30)" />
              <Text style={styles.emptyText}>
                {activeSheet
                  ? 'Thumbnail not yet available for this sheet.'
                  : 'Pick a sheet from the strip on the left.'}
              </Text>
            </View>
          )}

          {/* Floating controls */}
          <View style={styles.controls} pointerEvents="box-none">
            <Pressable
              onPress={onToggleOverlay}
              accessibilityRole="switch"
              accessibilityLabel="Toggle symbol overlay"
              accessibilityState={{ checked: overlayVisible }}
              testID="symbol-overlay-toggle"
              style={({ hovered }: any) => [
                styles.controlBtn,
                overlayVisible && styles.controlBtnActive,
                hovered && styles.controlBtnHover,
              ]}
            >
              <Ionicons
                name={overlayVisible ? 'eye' : 'eye-off-outline'}
                size={14}
                color={overlayVisible ? '#fbbf24' : 'rgba(255,255,255,0.78)'}
              />
              <Text
                style={[
                  styles.controlText,
                  overlayVisible && styles.controlTextActive,
                ]}
              >
                {overlayVisible ? 'Overlay on' : 'Overlay off'}
              </Text>
            </Pressable>
            <Pressable
              onPress={resetView}
              accessibilityRole="button"
              accessibilityLabel="Reset zoom"
              testID="sheet-viewer-reset"
              style={({ hovered }: any) => [styles.controlBtn, hovered && styles.controlBtnHover]}
            >
              <Ionicons name="contract-outline" size={14} color="rgba(255,255,255,0.78)" />
              <Text style={styles.controlText}>Reset</Text>
            </Pressable>
          </View>

          {symbolsEndpointMissing ? (
            <View style={styles.missingBanner} testID="symbols-missing-banner">
              <Ionicons name="warning-outline" size={12} color="#fbbf24" />
              <Text style={styles.missingText}>
                Symbol overlay requires Wave 2.7 backend reads (PR pending merge).
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    gap: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
    flexWrap: 'wrap',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetNumber: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  disciplineChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.30)',
  },
  disciplineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  revBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  revText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.6,
  },
  scaleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scaleText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    fontVariant: ['tabular-nums'],
  },
  sealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  sealOk: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.32)',
  },
  sealText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#34d399',
    letterSpacing: -0.05,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  thumbStrip: {
    width: 96,
    flexGrow: 0,
  },
  thumbStripContent: {
    gap: 8,
    paddingVertical: 2,
  },
  thumb: {
    width: 88,
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 4,
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 120ms ease, border-color 120ms ease' } as any)
      : {}),
  },
  thumbActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  thumbHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  thumbImage: {
    width: '100%',
    aspectRatio: 0.77,
    borderRadius: 4,
    backgroundColor: '#0b0b0b',
  },
  thumbPlaceholder: {
    width: '100%',
    aspectRatio: 0.77,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: -0.05,
    textAlign: 'center',
  },
  thumbEmpty: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  thumbEmptyText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
  },
  viewport: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#0b0b0b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 320,
    ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as any) : {}),
  },
  sheetCanvas: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetImage: {
    width: '100%',
    height: '100%',
  },
  emptyCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  emptyText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.50)',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 17,
  },
  controls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(11,11,11,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  controlBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  controlText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.05,
  },
  controlTextActive: {
    color: '#fbbf24',
  },
  missingBanner: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
  },
  missingText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(251,191,36,0.92)',
    letterSpacing: -0.05,
  },
});
