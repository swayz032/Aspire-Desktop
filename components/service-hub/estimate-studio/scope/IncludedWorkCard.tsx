/**
 * IncludedWorkCard — Wave 7.
 *
 * Renders the assemblies that ARE in the base scope. Default Scope tab
 * card after Story. Each row shows the assembly label, quantity + unit,
 * and a TruthBadge (mostly observed / derived).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintAssembly } from '@/lib/api/blueprintsApi';
import { AssemblyRow } from './AssemblyRow';

interface Props {
  assemblies: BlueprintAssembly[];
}

export function IncludedWorkCard({ assemblies }: Props): React.ReactElement {
  const included = assemblies.filter((a) => a.in_base_scope);

  if (included.length === 0) {
    return (
      <View style={styles.empty} testID="included-work-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="checkmark-circle-outline"
            size={28}
            color="rgba(255,255,255,0.55)"
          />
        </View>
        <Text style={styles.emptyTitle}>No base-scope work yet</Text>
        <Text style={styles.emptyBody}>
          Once Drew finishes classifying the plan set, base-scope assemblies
          will appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scrollContent}
      testID="included-work-card"
    >
      <View style={styles.header}>
        <Text style={styles.headline}>Included Work</Text>
        <Text style={styles.subhead}>
          {included.length} assembl{included.length === 1 ? 'y' : 'ies'} in base scope.
        </Text>
      </View>
      <View style={styles.list}>
        {included.map((assembly) => (
          <AssemblyRow
            key={assembly.assembly_id}
            assembly={assembly}
            testIDPrefix="included-row"
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  header: {
    gap: 4,
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.25,
  },
  subhead: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  list: {
    gap: 8,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    maxWidth: 360,
    lineHeight: 17,
  },
});
