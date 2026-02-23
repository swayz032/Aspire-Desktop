/**
 * ContractTimeline -- Horizontal 6-state lifecycle timeline.
 * Shows dots connected by lines, with glow on the current active state.
 * States: Draft -> Reviewed -> Sent -> Signed -> Archived -> Expired
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Shadows } from '@/constants/tokens';
import { CONTRACT_LIFECYCLE, CONTRACT_STATUS, type ContractStatus } from './contractConstants';

interface ContractTimelineProps {
  currentStatus: ContractStatus;
}

function ContractTimelineInner({ currentStatus }: ContractTimelineProps) {
  const currentIdx = CONTRACT_LIFECYCLE.indexOf(currentStatus);

  return (
    <View style={styles.container}>
      {CONTRACT_LIFECYCLE.map((status, idx) => {
        const meta = CONTRACT_STATUS[status];
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const isLast = idx === CONTRACT_LIFECYCLE.length - 1;

        return (
          <View key={status} style={styles.stepWrapper}>
            <View style={styles.stepRow}>
              {/* Dot */}
              <View
                style={[
                  styles.dot,
                  isPast && { backgroundColor: meta.color, opacity: 0.6 },
                  isCurrent && { backgroundColor: meta.color },
                  isFuture && styles.dotFuture,
                  isCurrent && Platform.OS === 'web' ? {
                    boxShadow: `0 0 12px ${meta.color}, 0 0 4px ${meta.color}`,
                  } as any : {},
                  isCurrent && Platform.OS !== 'web' ? Shadows.glow(meta.color) : {},
                ]}
              />
              {/* Connecting line */}
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    isPast && { backgroundColor: meta.color, opacity: 0.4 },
                    isCurrent && { backgroundColor: meta.color, opacity: 0.3 },
                    isFuture && styles.lineFuture,
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.label,
                isCurrent && { color: meta.color, fontWeight: '600' },
                isPast && { color: Colors.text.muted },
                isFuture && { color: Colors.text.disabled },
              ]}
              numberOfLines={1}
            >
              {meta.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export const ContractTimeline = React.memo(ContractTimelineInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.text.disabled,
    zIndex: 1,
  },
  dotFuture: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lineFuture: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.text.disabled,
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
