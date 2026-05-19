/**
 * MissingInputsList — Wave 7.
 *
 * Lists blueprint_missing_inputs rows. Splits visually into Open and
 * Resolved sub-sections so contractors can see progress. Each row is
 * a MissingInputCard with the YELLOW-tier confirm flow.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintMissingInput } from '@/lib/api/blueprintsApi';
import { MissingInputCard } from './MissingInputCard';
import type { UseBlueprintActionsResult } from '@/hooks/useBlueprintActions';

interface Props {
  projectId: string | null;
  inputs: BlueprintMissingInput[];
  actions: UseBlueprintActionsResult;
  onConfirmed: () => void;
}

export function MissingInputsList({
  projectId,
  inputs,
  actions,
  onConfirmed,
}: Props): React.ReactElement {
  const { open, resolved } = useMemo(() => {
    const o: BlueprintMissingInput[] = [];
    const r: BlueprintMissingInput[] = [];
    for (const input of inputs) {
      if (input.status === 'resolved') r.push(input);
      else o.push(input);
    }
    return { open: o, resolved: r };
  }, [inputs]);

  if (inputs.length === 0) {
    return (
      <View style={styles.empty} testID="missing-inputs-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="checkmark-done-circle-outline"
            size={28}
            color="rgba(74,222,128,0.85)"
          />
        </View>
        <Text style={styles.emptyTitle}>No missing inputs</Text>
        <Text style={styles.emptyBody}>
          Either the plan set is complete, or REASON hasn't surfaced any
          known-unknowns yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scrollContent}
      testID="missing-inputs-list"
    >
      {open.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Open · {open.length}
          </Text>
          <View style={styles.list}>
            {open.map((input) => (
              <MissingInputCard
                key={input.input_id}
                input={input}
                phase={actions.phaseFor(input.input_id)}
                error={actions.errorFor(input.input_id)}
                onConfirm={async (value) => {
                  if (!projectId) return;
                  const result = await actions.confirmMissingInput(
                    projectId,
                    input.input_id,
                    value,
                  );
                  if (result) {
                    onConfirmed();
                  }
                }}
                onRequestRFI={() => {
                  void actions.requestRFI(input.input_id);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {resolved.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitleResolved}>
            Resolved · {resolved.length}
          </Text>
          <View style={styles.list}>
            {resolved.map((input) => (
              <MissingInputCard
                key={input.input_id}
                input={input}
                phase="success"
                error={null}
                onConfirm={() => {
                  /* already resolved — no-op */
                }}
                onRequestRFI={() => {
                  /* already resolved — no-op */
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fb923c',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionTitleResolved: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  list: {
    gap: 10,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(74,222,128,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 17,
  },
});
