/**
 * MessagesZeroState.demo — single render of the zero-state right pane.
 *
 * Visual smoke + Framer-fidelity check. The component has no variants by
 * design — the zero state IS the single render. We mount it inside a fixed
 * panel that mirrors the actual `/session/messages` right column dimensions
 * so what you see here matches what ships in the page.
 *
 * Drives output-critic's "Would Framer ship this?" review for state (A).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import { MessagesZeroState } from './MessagesZeroState';

export default function MessagesZeroStateDemo() {
  const [composeClicks, setComposeClicks] = useState(0);
  const [contactsClicks, setContactsClicks] = useState(0);

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.label}>
          STATE A — ZERO STATE (NO CONVERSATIONS YET)
        </Text>

        {/* Frame the demo in a panel matching the real page's right column. */}
        <View style={styles.rightPanel}>
          <MessagesZeroState
            onComposeNew={() => setComposeClicks((n) => n + 1)}
            onOpenContacts={() => setContactsClicks((n) => n + 1)}
          />
        </View>

        <View style={styles.trace}>
          <Text style={styles.traceText}>
            Compose pressed: {composeClicks}
          </Text>
          <Text style={styles.traceText}>
            Contacts pressed: {contactsClicks}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}),
  } as any,
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  rightPanel: {
    flex: 1,
    minHeight: 600,
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
