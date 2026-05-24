/**
 * AnnotationOverlay — paints Drew's BlueprintRegion[] highlights and
 * open-question pins on top of the active sheet render. Coordinates
 * are normalized 0..1, so the overlay sits in the same absolutely
 * positioned space as the sheet image and survives pan/zoom when its
 * parent applies a CSS transform.
 *
 * Law #7: render-layer only. Hover is dispatched up via onHoverRegion.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { BlueprintRegion, OpenQuestion } from '@/lib/api/blueprintsApi';

interface Props {
  activeSheetCode: string;
  regions: BlueprintRegion[];
  openQuestions: OpenQuestion[];
  hoverRegionKey: string | null;
  onHoverRegion: (key: string | null) => void;
}

export function AnnotationOverlay({
  activeSheetCode,
  regions,
  openQuestions,
  hoverRegionKey,
  onHoverRegion,
}: Props): React.ReactElement {
  const matchingRegions = regions.filter((r) => r.sheet_code === activeSheetCode);
  const matchingPins = openQuestions.filter(
    (q) => q.blueprint_region?.sheet_code === activeSheetCode,
  );

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="annotation-overlay">
      {matchingRegions.map((r, idx) => {
        const key = `${r.sheet_code}-${idx}`;
        const isHover = hoverRegionKey === key;
        const isPrimary = r.kind === 'primary';
        const baseGlow: ViewStyle =
          Platform.OS === 'web'
            ? (({ boxShadow: '0 0 10px rgba(251,191,36,0.5)' } as unknown) as ViewStyle)
            : {};
        const hoverGlow: ViewStyle =
          Platform.OS === 'web'
            ? (({ boxShadow: '0 0 14px rgba(251,191,36,0.7)' } as unknown) as ViewStyle)
            : {};
        return (
          <Pressable
            key={key}
            testID={`annotation-region-${idx}`}
            accessibilityLabel={`${r.label}, source ${r.sheet_code}`}
            onHoverIn={() => onHoverRegion(key)}
            onHoverOut={() => onHoverRegion(null)}
            style={[
              styles.region,
              {
                top: `${r.y * 100}%`,
                left: `${r.x * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                borderWidth: isPrimary ? 2 : 1.5,
                borderColor: isPrimary ? '#fbbf24' : 'rgba(251,191,36,0.55)',
                backgroundColor: isPrimary
                  ? 'rgba(251,191,36,0.16)'
                  : 'rgba(251,191,36,0.08)',
              },
              isHover ? hoverGlow : isPrimary ? baseGlow : null,
            ]}
          >
            <View
              style={[
                styles.label,
                { backgroundColor: isPrimary ? '#fbbf24' : 'rgba(251,191,36,0.85)' },
              ]}
            >
              <Text style={styles.labelText}>{r.label}</Text>
            </View>
          </Pressable>
        );
      })}
      {matchingPins.map((q) => {
        const r = q.blueprint_region!;
        return (
          <View
            key={q.question_id}
            testID={`annotation-pin-${q.question_id}`}
            accessibilityLabel={`Open question: ${q.title}, source ${r.sheet_code}`}
            pointerEvents="none"
            style={[
              styles.pin,
              { top: `${r.y * 100}%`, left: `${r.x * 100}%` },
              Platform.OS === 'web'
                ? (({ boxShadow: '0 0 12px rgba(239,68,68,0.6)' } as unknown) as ViewStyle)
                : {},
            ]}
          >
            <Text style={styles.pinText}>?</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  region: { position: 'absolute', borderRadius: 3 },
  label: {
    position: 'absolute',
    top: -18,
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  labelText: {
    color: '#0b0d12',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pin: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
