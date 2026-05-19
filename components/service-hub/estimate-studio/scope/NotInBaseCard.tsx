/**
 * NotInBaseCard — Wave 7.
 *
 * Renders assemblies explicitly excluded from the base scope — alternates,
 * owner-choice items, or work the LLM flagged as out-of-scope. Same flat
 * card geometry as IncludedWorkCard.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintAssembly } from '@/lib/api/blueprintsApi';
import { AssemblyRow } from './AssemblyRow';

interface Props {
  assemblies: BlueprintAssembly[];
}

export function NotInBaseCard({ assemblies }: Props): React.ReactElement {
  const excluded = assemblies.filter((a) => !a.in_base_scope);

  if (excluded.length === 0) {
    return (
      <View style={styles.empty} testID="not-in-base-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="close-circle-outline"
            size={28}
            color="rgba(255,255,255,0.55)"
          />
        </View>
        <Text style={styles.emptyTitle}>Nothing excluded</Text>
        <Text style={styles.emptyBody}>
          Drew didn't flag any assemblies as out-of-scope or owner-choice
          alternates. Anything excluded later (e.g. via Alternates) will land here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scrollContent}
      testID="not-in-base-card"
    >
      <View style={styles.header}>
        <Text style={styles.headline}>Not in Base Scope</Text>
        <Text style={styles.subhead}>
          {excluded.length} assembl{excluded.length === 1 ? 'y' : 'ies'} excluded
          from base. Move to Alternates to bid as add-ons.
        </Text>
      </View>
      <View style={styles.list}>
        {excluded.map((assembly) => (
          <AssemblyRow
            key={assembly.assembly_id}
            assembly={assembly}
            testIDPrefix="excluded-row"
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
    lineHeight: 16,
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
    maxWidth: 380,
    lineHeight: 17,
  },
});
