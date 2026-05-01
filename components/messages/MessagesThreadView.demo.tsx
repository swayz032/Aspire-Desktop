/**
 * MessagesThreadView.demo — visual smoke for the state (C) right pane.
 *
 * Three variants:
 *   1. Active conversation — owner + contact bubbles, delivered/sent/sending
 *      states all visible, A2P registered (banner hidden, send enabled)
 *   2. Fresh thread — zero messages yet, "Fresh thread" empty state inside
 *      the bubble stream, composer enabled (A2P registered)
 *   3. A2P unregistered — owner just signed up, banner visible at top of
 *      composer, send disabled with helper placeholder
 *
 * Each variant frames the component in a panel matching the real page's
 * right column dimensions.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import {
  MessagesThreadView,
  type ThreadMessage,
} from './MessagesThreadView';
import { MOCK_THREADS_5, type MessageThreadSummary } from './fixtures';

// Pick a routing-contact thread for variant 1 — Maya Lane (scheduling).
const ACTIVE_THREAD: MessageThreadSummary = MOCK_THREADS_5[2];

// Build a richer message log demonstrating delivery-state variety + bubble
// clustering with time separators between groups.
const ACTIVE_MESSAGES: ThreadMessage[] = (() => {
  const tid = ACTIVE_THREAD.thread_id;
  const now = Date.now();
  const min = (n: number) => new Date(now - n * 60_000).toISOString();
  return [
    {
      message_id: `${tid}_demo_1`,
      thread_id: tid,
      direction: 'inbound',
      body:
        "Hey — hoping to lock in the Tuesday slot for the loft. Does 2pm still work for you?",
      sent_at: min(48),
      delivery_status: 'delivered',
    },
    {
      message_id: `${tid}_demo_2`,
      thread_id: tid,
      direction: 'inbound',
      body: 'Also wanted to ask whether you can bring the dark walnut swatches.',
      sent_at: min(47),
      delivery_status: 'delivered',
    },
    {
      message_id: `${tid}_demo_3`,
      thread_id: tid,
      direction: 'outbound',
      author: 'owner',
      body: '2pm Tuesday works. I’ll bring walnut + a couple of oak comparisons.',
      sent_at: min(40),
      delivery_status: 'delivered',
      num_segments: 1,
    },
    {
      message_id: `${tid}_demo_4`,
      thread_id: tid,
      direction: 'inbound',
      body:
        'Perfect. One more thing — could you share the timeline doc once we’re there?',
      sent_at: min(8),
      delivery_status: 'delivered',
    },
    {
      message_id: `${tid}_demo_5`,
      thread_id: tid,
      direction: 'outbound',
      author: 'ava',
      body:
        'Heads up — Ava drafted a quick reply for review: "Yes, I’ll have the timeline doc printed and a digital copy ready to send. See you Tuesday."',
      sent_at: min(2),
      delivery_status: 'sent',
      num_segments: 2,
    },
    {
      message_id: `${tid}_demo_6`,
      thread_id: tid,
      direction: 'outbound',
      author: 'owner',
      body: 'Heading over now.',
      sent_at: min(0.2),
      delivery_status: 'sending',
      num_segments: 1,
    },
  ];
})();

// A new thread with no messages — variant 2.
const FRESH_THREAD: MessageThreadSummary = {
  thread_id: 'thr_demo_fresh',
  contact_name: 'Aria Vega',
  contact_phone: '+14045552233',
  last_message_preview: '',
  last_activity_at: new Date().toISOString(),
  unread_count: 0,
  is_pinned: false,
  is_archived: false,
  last_drafter: 'owner',
};

// Reuse the unread routing-contact thread for variant 3 — Tonio.
const A2P_THREAD: MessageThreadSummary = MOCK_THREADS_5[0];

export default function MessagesThreadViewDemo() {
  const [, setSendCount] = useState(0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant title="Active conversation — A2P registered, send enabled">
        <Frame>
          <MessagesThreadView
            selectedThread={ACTIVE_THREAD}
            messagesOverride={ACTIVE_MESSAGES}
            a2pStatusOverride="registered"
            hideA2pBanner
          />
        </Frame>
      </Variant>

      <Variant title="Fresh thread — zero messages, composer enabled">
        <Frame>
          <MessagesThreadView
            selectedThread={FRESH_THREAD}
            messagesOverride={[]}
            a2pStatusOverride="registered"
            hideA2pBanner
          />
        </Frame>
      </Variant>

      <Variant title="A2P unregistered — banner visible, send gated">
        <Frame>
          <MessagesThreadView
            selectedThread={A2P_THREAD}
            a2pStatusOverride="unregistered"
          />
        </Frame>
      </Variant>

      <View style={styles.trace} onLayout={() => setSendCount(0)}>
        <Text style={styles.traceText}>
          Tip: try the Send button on each variant to see the optimistic
          bubble + delivery-status cycle.
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
    height: 640,
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
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  traceText: {
    flex: 1,
    fontSize: 11,
    color: Colors.text.tertiary,
  },
});
