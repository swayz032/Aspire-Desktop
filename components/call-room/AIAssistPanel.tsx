// components/call-room/AIAssistPanel.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClientContext } from './types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface AIAssistPanelProps {
  /** Caller context — used to derive a context-aware suggested question. */
  client?: ClientContext;
}

/**
 * Phase 1 (rules-based) AI Assist panel.
 *
 * Suggested question + next actions adapt to the caller's known service /
 * urgency / familiarity. The full server-side AI-assist endpoint
 * (POST /v1/calls/ai-assist) ships in v1.1; today's panel runs a small
 * deterministic heuristic so the prompt isn't a hard-coded "Is water
 * entering the attic or ceiling?" no matter who's on the line.
 */
function deriveSuggestedQuestion(client?: ClientContext): string {
  if (!client) return 'How can we help you today?';
  const service = (client.service || '').trim().toLowerCase();
  if (service.includes('plumb') || service.includes('water') || service.includes('leak')) {
    return 'Is water actively entering the home right now?';
  }
  if (service.includes('roof') || service.includes('drywall') || service.includes('ceiling')) {
    return 'When did you first notice the damage?';
  }
  if (service.includes('hvac') || service.includes('ac') || service.includes('heat')) {
    return 'Is the system running but not cooling, or fully off?';
  }
  if (service.includes('paint')) {
    return 'Is this for an interior or exterior job?';
  }
  if (service.includes('electric')) {
    return 'Is anything currently sparking or smoking?';
  }
  if (client.note && client.note.length > 0) {
    return `Confirming the note: "${client.note.slice(0, 80)}"?`;
  }
  if (client.urgency === 'high') {
    return 'Is everyone safe? What’s the urgency right now?';
  }
  return client.name
    ? `Hi ${client.name.split(' ')[0]} — how can we help today?`
    : 'How can we help you today?';
}

export function AIAssistPanel({ client }: AIAssistPanelProps): React.ReactElement {
  const question = deriveSuggestedQuestion(client);
  return (
    <View style={styles.panel} testID="ai-assist">
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={14} color="rgba(120,170,220,0.85)" style={styles.headerIcon} />
        <Text style={styles.sectionLabel}>AI ASSIST</Text>
      </View>

      <Text style={styles.smallLabel}>Suggested question</Text>
      <View style={styles.suggestion}>
        <Text style={styles.suggestionText}>{question}</Text>
      </View>

      <Text style={[styles.smallLabel, { marginTop: 18 }]}>Next actions</Text>
      <ActionRow icon="calendar-outline" label="Schedule Inspection" />
      <ActionRow icon="chatbubble-ellipses-outline" label="Draft SMS" />
      <ActionRow icon="document-text-outline" label="Take a message" />
    </View>
  );
}

function ActionRow({ icon, label }: { icon: IconName; label: string }) {
  return (
    <Pressable style={styles.actionRow} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.85)" style={styles.actionIcon} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    // Locked to 280 so swapping AI Assist <-> Keypad <-> Transfer never
    // shifts the column height. Matches ClientMemoryPanel's minHeight.
    height: 280,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 6 },
  headerIcon: { marginRight: 0 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  smallLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 6 },
  // Restrained suggestion — thin border, low-saturation tint, NOT a loud filled box
  suggestion: {
    borderWidth: 1,
    borderColor: 'rgba(120, 170, 220, 0.55)',
    backgroundColor: 'rgba(120, 170, 220, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  suggestionText: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 },
  // Subtle action rows — dark glass, low contrast, no saturated fills
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  actionIcon: { marginRight: 10 },
  actionLabel: { flex: 1, color: 'rgba(255,255,255,0.88)', fontSize: 13 },
  moreActions: { marginTop: 8, paddingHorizontal: 4, paddingVertical: 6 },
  moreActionsText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
