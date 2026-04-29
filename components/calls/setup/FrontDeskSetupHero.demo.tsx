/**
 * FrontDeskSetupHero.demo — visual smoke test for the Front Desk hero.
 * Cycles through the four key prop permutations.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { FrontDeskSetupHero } from './FrontDeskSetupHero';

export default function FrontDeskSetupHeroDemo() {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [testedAt, setTestedAt] = useState<string | null>(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Default — dirty, ready to save">
        <FrontDeskSetupHero
          isDirty
          sarahActive
          onSave={() => setSavedAt(new Date().toLocaleTimeString())}
          onTest={() => setTestedAt(new Date().toLocaleTimeString())}
        />
        <Trace savedAt={savedAt} testedAt={testedAt} />
      </Variant>

      <Variant title="No unsaved changes (Save disabled)">
        <FrontDeskSetupHero
          isDirty={false}
          sarahActive
          onSave={() => {}}
          onTest={() => {}}
        />
      </Variant>

      <Variant title="Saving + testing simultaneously">
        <FrontDeskSetupHero
          isDirty
          isSaving
          isTesting
          sarahActive
          onSave={() => {}}
          onTest={() => {}}
        />
      </Variant>

      <Variant title="Sarah inactive (idle presence orb)">
        <FrontDeskSetupHero
          isDirty
          sarahActive={false}
          onSave={() => {}}
          onTest={() => {}}
        />
      </Variant>
    </ScrollView>
  );
}

function Variant({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.variant}>
      <Text style={styles.variantTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Trace({ savedAt, testedAt }: { savedAt: string | null; testedAt: string | null }) {
  if (!savedAt && !testedAt) return null;
  return (
    <View style={styles.trace}>
      {savedAt ? <Text style={styles.traceText}>Last saved at {savedAt}</Text> : null}
      {testedAt ? <Text style={styles.traceText}>Last tested at {testedAt}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}),
  } as any,
  content: {
    padding: 32,
    gap: 32,
  },
  variant: {
    gap: 14,
  },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  trace: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
  },
  traceText: {
    fontSize: 11,
    color: Colors.accent.cyan,
    fontVariant: ['tabular-nums'],
  },
});
