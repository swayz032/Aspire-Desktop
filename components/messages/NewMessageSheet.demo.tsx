/**
 * NewMessageSheet.demo — visual smoke + Framer-fidelity check.
 *
 * Cycles four fixtures via mode buttons (the sheet is full-overlay so we
 * can't show all four at once like other demos):
 *
 *   1. Empty — no prefill, A2P registered (the canonical happy path)
 *   2. Pre-filled body — opens with a templated body, no contact yet
 *   3. Pre-filled contact + body — full prefill from a suggestion card
 *   4. A2P unregistered — amber banner visible, send disabled
 *
 * Each open also exposes the live state of the sheet's `onSent` and
 * `onClose` callbacks so output-critic can verify the flow.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import { NewMessageSheet, type TenantA2pStatus } from './NewMessageSheet';
import type { ContactSearchResult } from './ContactAutocomplete';

type Fixture = 'empty' | 'body_only' | 'full_prefill' | 'a2p_blocked';

const SAMPLE_CONTACT: ContactSearchResult = {
  id: 'demo_routing_scheduling',
  source: 'routing',
  name: 'Maya Lane',
  phone: '+14155550911',
  routing_role: 'scheduling',
};

const TEMPLATED_BODY =
  "Hi Maya — quick follow-up on the quote we sent yesterday. Any questions?";

export default function NewMessageSheetDemo() {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [lastEvent, setLastEvent] = useState<string>('');

  const handleClose = () => {
    setLastEvent('onClose fired');
    setFixture(null);
  };
  const handleSent = (threadId: string, messageId: string) => {
    setLastEvent(`onSent: ${threadId} · ${messageId}`);
    setFixture(null);
  };

  // Build the sheet's prefill + a2p props from the selected fixture.
  const prefill =
    fixture === 'body_only'
      ? { body: TEMPLATED_BODY }
      : fixture === 'full_prefill'
      ? { contact: SAMPLE_CONTACT, body: TEMPLATED_BODY }
      : undefined;

  const a2pStatus: TenantA2pStatus =
    fixture === 'a2p_blocked' ? 'unregistered' : 'registered';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading}>NewMessageSheet — fixture cycle</Text>
        <Text style={styles.subheading}>
          Each button opens the sheet in a different starting state. The sheet
          is a full-screen overlay (z-index 9999) so it covers the demo page
          entirely until closed.
        </Text>

        <View style={styles.row}>
          <FixtureButton
            label="1. Empty"
            sublabel="No prefill — happy-path open"
            onPress={() => setFixture('empty')}
          />
          <FixtureButton
            label="2. Pre-filled body"
            sublabel="Quote follow-up template, no contact yet"
            onPress={() => setFixture('body_only')}
          />
          <FixtureButton
            label="3. Full prefill"
            sublabel="Contact + body from a suggestion card"
            onPress={() => setFixture('full_prefill')}
          />
          <FixtureButton
            label="4. A2P unregistered"
            sublabel="Amber banner, send disabled"
            onPress={() => setFixture('a2p_blocked')}
            tone="warn"
          />
        </View>

        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>LAST EVENT</Text>
          <Text style={styles.eventBody}>{lastEvent || '— none yet —'}</Text>
        </View>
      </ScrollView>

      <NewMessageSheet
        visible={fixture !== null}
        onClose={handleClose}
        onSent={handleSent}
        prefill={prefill}
        a2pStatusOverride={a2pStatus}
      />
    </View>
  );
}

interface FixtureButtonProps {
  label: string;
  sublabel: string;
  onPress: () => void;
  tone?: 'default' | 'warn';
}

function FixtureButton({
  label,
  sublabel,
  onPress,
  tone = 'default',
}: FixtureButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      style={({ pressed }) => [
        styles.btn,
        tone === 'warn' && styles.btnWarn,
        pressed && styles.btnPressed,
      ]}
    >
      <Text
        style={[styles.btnLabel, tone === 'warn' && styles.btnLabelWarn]}
      >
        {label}
      </Text>
      <Text style={styles.btnSub}>{sublabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 32,
    gap: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 19,
    maxWidth: 560,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
  },
  btn: {
    minWidth: 220,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#141416',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 4,
  },
  btnWarn: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.30)',
  },
  btnPressed: {
    backgroundColor: '#1c1c20',
  },
  btnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  btnLabelWarn: {
    color: '#FBBF24',
  },
  btnSub: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
  eventCard: {
    padding: 14,
    backgroundColor: '#141416',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
    marginTop: 8,
    maxWidth: 560,
  },
  eventLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.2,
  },
  eventBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.secondary,
    fontFamily:
      Platform.OS === 'web'
        ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
        : undefined,
  },
});
