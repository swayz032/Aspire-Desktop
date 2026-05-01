/**
 * MessagesHero.demo — visual smoke + Framer-fidelity check.
 *
 * Cycles four count permutations:
 *   1. Empty (zero state) — recipient of empty-state language test
 *   2. Mixed — typical "alive" state with unread + drafts
 *   3. High volume — stresses the subtitle truncation and number layout
 *   4. Single conversation, no unread — pluralization edge case
 *
 * Drives output-critic's "Would Framer ship this hero?" review.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import { MessagesHero } from './MessagesHero';

export default function MessagesHeroDemo() {
  const [contactsClicks, setContactsClicks] = useState(0);
  const [composeClicks, setComposeClicks] = useState(0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Zero state — fresh tenant">
        <MessagesHero
          threadCount={0}
          unreadCount={0}
          draftCount={0}
          onContactsPress={() => setContactsClicks((n) => n + 1)}
          onNewMessagePress={() => setComposeClicks((n) => n + 1)}
        />
      </Variant>

      <Variant title="Typical — 42 conversations, 7 unread, 2 drafts">
        <MessagesHero
          threadCount={42}
          unreadCount={7}
          draftCount={2}
          onContactsPress={() => setContactsClicks((n) => n + 1)}
          onNewMessagePress={() => setComposeClicks((n) => n + 1)}
        />
      </Variant>

      <Variant title="High volume — 1287 conversations, 134 unread">
        <MessagesHero
          threadCount={1287}
          unreadCount={134}
          draftCount={0}
          onContactsPress={() => setContactsClicks((n) => n + 1)}
          onNewMessagePress={() => setComposeClicks((n) => n + 1)}
        />
      </Variant>

      <Variant title="Single conversation, no unread — pluralization edge">
        <MessagesHero
          threadCount={1}
          unreadCount={0}
          draftCount={0}
          onContactsPress={() => setContactsClicks((n) => n + 1)}
          onNewMessagePress={() => setComposeClicks((n) => n + 1)}
        />
      </Variant>

      <View style={styles.trace}>
        <Text style={styles.traceText}>
          Contacts pressed: {contactsClicks}
        </Text>
        <Text style={styles.traceText}>
          New Message pressed: {composeClicks}
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
