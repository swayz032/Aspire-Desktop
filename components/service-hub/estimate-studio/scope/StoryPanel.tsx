/**
 * StoryPanel — Wave 7.
 *
 * The plain-English story renderer. This is THE deliverable that matters
 * most to a contractor on the Scope tab: a 90-second readable narrative
 * with inline truth-tag chips next to each fact.
 *
 * Renders the phased markdown story from `BlueprintStory.phases`. Each
 * phase is a collapsible section (TI buildout: Demo → MEP rough → Framing
 * → Finishes). Inline `BlueprintStoryFact[]` are rendered as TruthBadge
 * chips with a "Confirm in field" inline button next to `assumed` facts.
 *
 * Premium typography:
 *   - Comfortable reading width (max 720px)
 *   - Tight letter-spacing on body text
 *   - Tabular numbers on confidence percentages
 *
 * Law #7: pure render. The Confirm-in-field affordance dispatches up via
 * onConfirmFact — actual mutation lives in useBlueprintActions().
 */
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintStory,
  BlueprintStoryFact,
  BlueprintStoryPhase,
} from '@/lib/api/blueprintsApi';
import { TruthBadge } from './TruthBadge';

interface Props {
  story: BlueprintStory | null;
  isPolling: boolean;
  /** Invoked when the user taps "Confirm in field" next to an assumed fact. */
  onConfirmFact: (fact: BlueprintStoryFact) => void;
}

const READING_MAX_WIDTH = 720;

export function StoryPanel({ story, isPolling, onConfirmFact }: Props): React.ReactElement {
  if (!story || story.phases.length === 0) {
    return (
      <View style={styles.empty} testID="story-panel-empty">
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="book-outline"
            size={28}
            color="rgba(255,255,255,0.55)"
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isPolling ? 'Reading your plan set...' : 'No story yet'}
        </Text>
        <Text style={styles.emptyBody}>
          {isPolling
            ? 'REASON is composing the phased narrative. This usually takes 30–60 seconds.'
            : 'Once the plan set has been classified, the project story will appear here in plain English.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scrollContent}
      testID="story-panel"
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <Text style={styles.headline}>Project Story</Text>
          <View style={styles.headlineMeta}>
            <Text style={styles.headlineMetaText}>
              {Math.round(story.mean_confidence * 100)}% mean confidence
            </Text>
            {story.updated_at ? (
              <Text style={styles.headlineMetaText}>
                · updated {_friendlyTime(story.updated_at)}
              </Text>
            ) : null}
          </View>
        </View>

        {story.phases.map((phase, idx) => (
          <PhaseSection
            key={phase.key}
            phase={phase}
            phaseNumber={idx + 1}
            onConfirmFact={onConfirmFact}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function PhaseSection({
  phase,
  phaseNumber,
  onConfirmFact,
}: {
  phase: BlueprintStoryPhase;
  phaseNumber: number;
  onConfirmFact: (fact: BlueprintStoryFact) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState<boolean>(true);
  return (
    <View
      style={styles.phase}
      testID={`story-phase-${phase.key}`}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${phase.title} — ${expanded ? 'collapse' : 'expand'}`}
        style={({ hovered, pressed }: any) => [
          styles.phaseHeader,
          hovered && styles.phaseHeaderHover,
          pressed && styles.phaseHeaderPressed,
        ]}
      >
        <View style={styles.phaseNumber}>
          <Text style={styles.phaseNumberText}>{phaseNumber}</Text>
        </View>
        <Text style={styles.phaseTitle}>{phase.title}</Text>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color="rgba(255,255,255,0.55)"
        />
      </Pressable>
      {expanded ? (
        <View style={styles.phaseBody}>
          <Text style={styles.phaseBodyText}>{phase.body_md}</Text>
          {phase.facts.length > 0 ? (
            <View style={styles.factWrap}>
              {phase.facts.map((fact) => (
                <FactChip
                  key={fact.key}
                  fact={fact}
                  onConfirm={() => onConfirmFact(fact)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function FactChip({
  fact,
  onConfirm,
}: {
  fact: BlueprintStoryFact;
  onConfirm: () => void;
}): React.ReactElement {
  const isAssumed = fact.truth === 'assumed' || fact.truth === 'missing';
  return (
    <View style={styles.factRow} testID={`story-fact-${fact.key}`}>
      <Text style={styles.factLabel}>{fact.label}</Text>
      <TruthBadge truth={fact.truth} confidence={fact.confidence} />
      {isAssumed ? (
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          accessibilityLabel={`Confirm ${fact.label} in field`}
          style={({ hovered, pressed }: any) => [
            styles.confirmInline,
            hovered && styles.confirmInlineHover,
            pressed && styles.confirmInlinePressed,
          ]}
          testID={`confirm-fact-${fact.key}`}
        >
          <Ionicons name="checkmark-outline" size={11} color="#fbbf24" />
          <Text style={styles.confirmInlineText}>Confirm in field</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function _friendlyTime(iso: string): string {
  try {
    const date = new Date(iso);
    const delta = Date.now() - date.getTime();
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 24,
  },
  column: {
    width: '100%',
    maxWidth: READING_MAX_WIDTH,
    gap: 18,
  },
  header: {
    gap: 4,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.4,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-serif, Georgia, serif' } as any)
      : {}),
  },
  headlineMeta: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  headlineMetaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  phase: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  phaseHeaderHover: {
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  phaseHeaderPressed: {
    opacity: 0.85,
  },
  phaseNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
  phaseTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.2,
  },
  phaseBody: {
    padding: 16,
    gap: 12,
  },
  phaseBodyText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-serif, Georgia, serif' } as any)
      : {}),
  },
  factWrap: {
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  factLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: -0.05,
  },
  confirmInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
  },
  confirmInlineHover: {
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  confirmInlinePressed: {
    opacity: 0.85,
  },
  confirmInlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
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
