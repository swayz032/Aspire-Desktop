/**
 * AssemblyRow — Wave 7.
 *
 * Shared row primitive used by IncludedWorkCard / NotInBaseCard /
 * AlternatesCard. Flat-premium card geometry that lines up assembly type,
 * quantity, unit, and a TruthBadge.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BlueprintAssembly } from '@/lib/api/blueprintsApi';
import { TruthBadge } from './TruthBadge';

interface Props {
  assembly: BlueprintAssembly;
  /** Optional right-side trailing element (e.g. action buttons). */
  trailing?: React.ReactNode;
  testIDPrefix?: string;
}

export function AssemblyRow({
  assembly,
  trailing,
  testIDPrefix = 'assembly-row',
}: Props): React.ReactElement {
  return (
    <View
      style={styles.row}
      testID={`${testIDPrefix}-${assembly.assembly_id}`}
    >
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={2}>
          {assembly.label}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.quantity}>
            {_formatQuantity(assembly.quantity)} {assembly.unit}
          </Text>
          <TruthBadge
            truth={assembly.truth}
            confidence={assembly.confidence}
          />
        </View>
        {assembly.alternate_note ? (
          <Text style={styles.alternateNote} numberOfLines={3}>
            {assembly.alternate_note}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

function _formatQuantity(q: number): string {
  if (Number.isInteger(q)) return q.toLocaleString();
  return q.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  body: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantity: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  alternateNote: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 16,
  },
  trailing: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
  },
});
