/**
 * UploadProgressInline — Wave 6A.
 *
 * 5-stage pipeline indicator that lives INSIDE the Plans & Photos canvas
 * (independent of Tim Rail — no Tim dependency). The same component renders
 * inline (horizontal) OR in the Tim Rail Context payload (vertical) via the
 * `layout` prop.
 *
 * Wave 6A reality: only `ingest` and `classify` carry real state. SEE /
 * REASON / PROCURE pills are STRUCTURAL PLACEHOLDERS so the UI is shaped
 * correctly for Wave 3/4/5. The wave-coming-soon banner above explains this
 * to localhost reviewers.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StageKey, StageStatus, StageProgress } from '@/lib/api/blueprintsApi';

interface Props {
  stages: StageProgress;
  layout?: 'horizontal' | 'vertical';
  testID?: string;
}

const STAGE_ORDER: ReadonlyArray<{ key: StageKey; label: string; shortLabel: string }> = [
  { key: 'ingest', label: 'Ingest', shortLabel: 'INGEST' },
  { key: 'classify', label: 'Classify', shortLabel: 'CLASSIFY' },
  { key: 'see', label: 'See', shortLabel: 'SEE' },
  { key: 'reason', label: 'Reason', shortLabel: 'REASON' },
  { key: 'procure', label: 'Procure', shortLabel: 'PROCURE' },
];

function _statusGlyph(status: StageStatus): {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
} {
  switch (status) {
    case 'ok':
      return { icon: 'checkmark-circle', color: '#22c55e' };
    case 'running':
      return { icon: 'sync', color: '#fbbf24' };
    case 'error':
      return { icon: 'alert-circle', color: '#ef4444' };
    case 'stub':
      return { icon: 'time-outline', color: 'rgba(255,255,255,0.35)' };
    case 'pending':
    default:
      return { icon: 'ellipse-outline', color: 'rgba(255,255,255,0.30)' };
  }
}

export function UploadProgressInline({
  stages,
  layout = 'horizontal',
  testID,
}: Props): React.ReactElement {
  const isVertical = layout === 'vertical';
  return (
    <View
      style={[styles.host, isVertical ? styles.hostVertical : styles.hostHorizontal]}
      testID={testID ?? 'upload-progress-inline'}
      accessibilityLabel="Blueprint pipeline progress"
    >
      {STAGE_ORDER.map((stage, idx) => {
        const status: StageStatus = stages[stage.key];
        const glyph = _statusGlyph(status);
        const isLast = idx === STAGE_ORDER.length - 1;
        // SEE/REASON/PROCURE are Wave 3/4/5 — dim them slightly so the eye
        // tracks the active stages.
        const isFuture = stage.key === 'see' || stage.key === 'reason' || stage.key === 'procure';

        return (
          <React.Fragment key={stage.key}>
            <View
              style={[
                styles.pill,
                isVertical ? styles.pillVertical : styles.pillHorizontal,
                isFuture && styles.pillFuture,
              ]}
              testID={`upload-progress-pill-${stage.key}`}
            >
              <Ionicons name={glyph.icon} size={isVertical ? 14 : 13} color={glyph.color} />
              <Text style={[styles.pillLabel, isFuture && styles.pillLabelFuture]}>
                {isVertical ? stage.label : stage.shortLabel}
              </Text>
            </View>
            {!isLast && !isVertical ? <View style={styles.connector} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    gap: 6,
  },
  hostHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  hostVertical: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pillHorizontal: {},
  pillVertical: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillFuture: {
    opacity: 0.65,
  },
  pillLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.6,
  },
  pillLabelFuture: {
    color: 'rgba(255,255,255,0.55)',
  },
  connector: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
