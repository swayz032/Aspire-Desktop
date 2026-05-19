/**
 * SymbolOverlay — Wave 8.
 *
 * Renders absolute-positioned bounding boxes over a sheet image. Each
 * symbol is keyed by its normalized 0..1 bbox; we scale to the parent
 * container's measured size on layout.
 *
 * Color contract:
 *   - electrical = blue
 *   - plumbing = green
 *   - structural = orange
 *   - mechanical = cyan
 *   - architectural = violet
 *   - fire = red
 *   - other = gray
 *
 * Confidence drives box opacity: 0.7 = 70% (per the plan). Below 0.5 the
 * box uses a dashed border to flag "needs review".
 *
 * Law #7: pure render; click handlers are passed in by SheetViewer.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TakeoffSymbol } from '@/lib/api/blueprintsApi';
import { styleForSymbolClass } from './symbolClasses';

interface Props {
  symbols: TakeoffSymbol[];
  /** Width of the rendered sheet image, in px (or layout units). */
  containerWidth: number;
  /** Height of the rendered sheet image, in px. */
  containerHeight: number;
  /** When false the overlay renders nothing. */
  visible: boolean;
  onSymbolPress?: (symbol: TakeoffSymbol) => void;
  /** Selected symbol id (highlight ring). */
  selectedSymbolId?: string | null;
  testID?: string;
}

export function SymbolOverlay({
  symbols,
  containerWidth,
  containerHeight,
  visible,
  onSymbolPress,
  selectedSymbolId,
  testID,
}: Props): React.ReactElement | null {
  if (!visible || symbols.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return null;
  }
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID={testID ?? 'symbol-overlay'}
    >
      {symbols.map((sym) => {
        if (sym.status === 'dropped') return null;
        const style = styleForSymbolClass(sym.override_class ?? sym.class);
        const left = sym.bbox.x * containerWidth;
        const top = sym.bbox.y * containerHeight;
        const w = Math.max(8, sym.bbox.w * containerWidth);
        const h = Math.max(8, sym.bbox.h * containerHeight);
        const opacity = Math.max(0.35, Math.min(1, sym.confidence));
        const isLowConf = sym.confidence < 0.5;
        const isSelected = sym.symbol_id === selectedSymbolId;
        const isConfirmed = sym.status === 'confirmed' || sym.status === 'reclassified';

        return (
          <Pressable
            key={sym.symbol_id}
            onPress={() => onSymbolPress?.(sym)}
            accessibilityRole="button"
            accessibilityLabel={`Symbol ${sym.override_class ?? sym.class} (${Math.round(sym.confidence * 100)}%)`}
            testID={`symbol-bbox-${sym.symbol_id}`}
            style={[
              styles.box,
              {
                left,
                top,
                width: w,
                height: h,
                backgroundColor: style.fill,
                borderColor: style.fg,
                opacity,
                borderStyle: isLowConf && !isConfirmed ? 'dashed' : 'solid',
              },
              isSelected && [styles.selected, { shadowColor: style.fg }],
            ]}
          >
            <View style={[styles.codeTag, { backgroundColor: style.fg }]}>
              <Text style={styles.codeText}>{style.code}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 2,
    ...(Platform.OS === 'web'
      ? ({ transition: 'opacity 120ms ease, box-shadow 120ms ease' } as any)
      : {}),
  },
  selected: {
    borderWidth: 2,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 3px rgba(251,191,36,0.45)' } as any)
      : {
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 6,
          elevation: 6,
        }),
  },
  codeTag: {
    position: 'absolute',
    top: -8,
    left: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    minWidth: 14,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0b0b0b',
    letterSpacing: 0.4,
  },
});
