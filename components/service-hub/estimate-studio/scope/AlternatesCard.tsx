/**
 * AlternatesCard — Wave 7.
 *
 * Lists derived-but-low-confidence assemblies the LLM offered as
 * alternates (e.g. "Bid as drywall OR demountable partition — 23% cost
 * delta"). Tapping "Include" / "Exclude" should move the assembly into or
 * out of the base scope.
 *
 * Wave 7 reality: the backend mutation for `markAlternate` lands in a
 * follow-up wave. The buttons are wired but surface a NOT_IMPLEMENTED
 * error inline so the UX clearly tells the contractor what's coming.
 */
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintAssembly } from '@/lib/api/blueprintsApi';
import { AssemblyRow } from './AssemblyRow';
import type { UseBlueprintActionsResult } from '@/hooks/useBlueprintActions';

interface Props {
  assemblies: BlueprintAssembly[];
  actions: UseBlueprintActionsResult;
}

export function AlternatesCard({ assemblies, actions }: Props): React.ReactElement {
  // An "alternate" is any assembly with a non-null alternate_note. Drew
  // sets this when REASON flagged the item as an owner-choice swap.
  const alternates = assemblies.filter((a) => a.alternate_note != null);

  if (alternates.length === 0) {
    return (
      <View style={styles.empty} testID="alternates-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="swap-horizontal-outline"
            size={28}
            color="rgba(255,255,255,0.55)"
          />
        </View>
        <Text style={styles.emptyTitle}>No alternates yet</Text>
        <Text style={styles.emptyBody}>
          REASON didn't surface any owner-choice swaps for this plan set.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scrollContent}
      testID="alternates-card"
    >
      <View style={styles.header}>
        <Text style={styles.headline}>Alternates</Text>
        <Text style={styles.subhead}>
          {alternates.length} owner-choice swap{alternates.length === 1 ? '' : 's'} —
          mark each as included in base scope or excluded.
        </Text>
      </View>
      <View style={styles.list}>
        {alternates.map((assembly) => {
          const phase = actions.phaseFor(assembly.assembly_id);
          const err = actions.errorFor(assembly.assembly_id);
          return (
            <View key={assembly.assembly_id} style={styles.alternateGroup}>
              <AssemblyRow
                assembly={assembly}
                testIDPrefix="alternate-row"
                trailing={
                  <View style={styles.trailingActions}>
                    <Pressable
                      onPress={() =>
                        actions.markAlternate(assembly.assembly_id, { choice: 'include' })
                      }
                      disabled={phase === 'submitting'}
                      accessibilityRole="button"
                      accessibilityLabel="Include in base scope"
                      style={({ hovered, pressed }: any) => [
                        styles.actionBtn,
                        styles.actionBtnPrimary,
                        hovered && styles.actionBtnHover,
                        pressed && styles.actionBtnPressed,
                      ]}
                      testID={`alternate-include-${assembly.assembly_id}`}
                    >
                      <Text style={styles.actionBtnPrimaryText}>Include</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        actions.markAlternate(assembly.assembly_id, { choice: 'exclude' })
                      }
                      disabled={phase === 'submitting'}
                      accessibilityRole="button"
                      accessibilityLabel="Exclude from base scope"
                      style={({ hovered, pressed }: any) => [
                        styles.actionBtn,
                        styles.actionBtnSecondary,
                        hovered && styles.actionBtnHover,
                        pressed && styles.actionBtnPressed,
                      ]}
                      testID={`alternate-exclude-${assembly.assembly_id}`}
                    >
                      <Text style={styles.actionBtnSecondaryText}>Exclude</Text>
                    </Pressable>
                  </View>
                }
              />
              {err ? (
                <Text style={styles.errorInline}>{err.message}</Text>
              ) : null}
            </View>
          );
        })}
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
    gap: 10,
  },
  alternateGroup: {
    gap: 4,
  },
  trailingActions: {
    flexDirection: 'column',
    gap: 4,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 150ms ease' } as any)
      : {}),
  },
  actionBtnPrimary: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  actionBtnPrimaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  actionBtnSecondaryText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionBtnHover: {
    opacity: 0.92,
  },
  actionBtnPressed: {
    opacity: 0.78,
  },
  errorInline: {
    fontSize: 10.5,
    color: '#ff6b6b',
    paddingHorizontal: 12,
    letterSpacing: -0.05,
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
