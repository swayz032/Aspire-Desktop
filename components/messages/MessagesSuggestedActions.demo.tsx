/**
 * MessagesSuggestedActions.demo — visual smoke for the state (B) right pane.
 *
 * Three variants:
 *   1. Loaded — 3 sample suggestions (default mock — typical Ava output)
 *   2. Empty — "Nothing pending. You're up to date."
 *   3. Loading — small spinner with helper copy
 *
 * Each variant frames the component in a panel matching the real page's
 * right column so what shows here matches what ships.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import {
  MessagesSuggestedActions,
  type MessageSuggestion,
} from './MessagesSuggestedActions';

const THREE_SAMPLE_SUGGESTIONS: MessageSuggestion[] = [
  {
    suggestion_id: 'demo_sg_01',
    contact_name: 'Maya Lane',
    contact_phone: '+14155550911',
    draft_body:
      "Hi Maya — confirming Tuesday at 2pm at the loft. Want me to bring extra swatches?",
    reason:
      "Maya hasn't replied to your Tuesday quote — send a check-in?",
    routing_role: 'scheduling',
  },
  {
    suggestion_id: 'demo_sg_02',
    contact_name: 'Tonio Scott',
    contact_phone: '+14045550182',
    draft_body:
      "Hey Tonio — quick follow-up on the Maya project timing question. Have a moment to chat?",
    reason: 'Tonio messaged 45s ago — reply still pending.',
    routing_role: 'owner',
  },
  {
    suggestion_id: 'demo_sg_03',
    contact_name: 'Acme Painters',
    contact_phone: '+14045551204',
    draft_body:
      "Hi — just a heads up the proposal expires Friday. Happy to extend if you need more time.",
    reason: "Acme's quote expires in 3 days — nudge them.",
  },
];

export default function MessagesSuggestedActionsDemo() {
  const [composeClicks, setComposeClicks] = useState(0);
  const [contactsClicks, setContactsClicks] = useState(0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Loaded — 3 Ava-recommended follow-ups">
        <Frame>
          <MessagesSuggestedActions
            suggestionsOverride={THREE_SAMPLE_SUGGESTIONS}
            onComposeNew={() => setComposeClicks((n) => n + 1)}
            onOpenContacts={() => setContactsClicks((n) => n + 1)}
          />
        </Frame>
      </Variant>

      <Variant title="Empty — nothing pending, owner is caught up">
        <Frame>
          <MessagesSuggestedActions
            suggestionsOverride={[]}
            onComposeNew={() => setComposeClicks((n) => n + 1)}
            onOpenContacts={() => setContactsClicks((n) => n + 1)}
          />
        </Frame>
      </Variant>

      <Variant title="Loading — first fetch in flight">
        <Frame>
          <MessagesSuggestedActions
            suggestionsOverride={[]}
            isLoadingOverride
            onComposeNew={() => setComposeClicks((n) => n + 1)}
            onOpenContacts={() => setContactsClicks((n) => n + 1)}
          />
        </Frame>
      </Variant>

      <View style={styles.trace}>
        <Text style={styles.traceText}>
          Compose pressed: {composeClicks}
        </Text>
        <Text style={styles.traceText}>
          Contacts pressed: {contactsClicks}
        </Text>
      </View>
    </ScrollView>
  );
}

function Variant({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.variant}>
      <Text style={styles.variantTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <View style={styles.frame}>{children}</View>;
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
    paddingBottom: 80,
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
  frame: {
    height: 540,
    backgroundColor: '#0d0d0d',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  trace: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  traceText: {
    fontSize: 11,
    color: Colors.accent.cyan,
    fontVariant: ['tabular-nums'],
  },
});
