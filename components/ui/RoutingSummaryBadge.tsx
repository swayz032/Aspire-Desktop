import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RoutingSummaryBadgeProps {
  summary: { auto: number; review: number; open: number };
  compact?: boolean;
  testID?: string;
}

const COLOR_AUTO = '#22c55e';
const COLOR_AVA = '#fbbf24';
const COLOR_BLOCK = '#ef4444';

function fmt(n: number): string {
  return n > 99 ? '99+' : String(n);
}

export function RoutingSummaryBadge({
  summary,
  compact = true,
  testID,
}: RoutingSummaryBadgeProps): React.ReactElement | null {
  const { auto, review, open } = summary;
  const total = auto + review + open;
  if (total === 0) return null;

  void compact; // reserved for future expanded layout

  const segments: Array<{ key: string; label: string; color: string; n: number }> = [];
  if (auto > 0) segments.push({ key: 'auto', label: 'AUTO', color: COLOR_AUTO, n: auto });
  if (review > 0) segments.push({ key: 'review', label: 'AVA', color: COLOR_AVA, n: review });
  if (open > 0) segments.push({ key: 'open', label: 'BLOCK', color: COLOR_BLOCK, n: open });

  const a11yLabel = `Routing: ${auto} auto-populated, ${review} pending review, ${open} open questions`;

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={styles.pill}
    >
      {segments.map((seg, idx) => (
        <React.Fragment key={seg.key}>
          {idx > 0 && (
            <Text style={[styles.text, styles.sep]} accessible={false}>
              {' · '}
            </Text>
          )}
          <Text style={[styles.text, { color: seg.color }]} accessible={false}>
            {seg.label} {fmt(seg.n)}
          </Text>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,13,18,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sep: {
    color: 'rgba(255,255,255,0.4)',
  },
});
