/**
 * ContactsSidePanel.demo — visual smoke + Framer-fidelity check.
 *
 * Cycles three fixtures via mode buttons (panel is full-overlay):
 *
 *   1. All sections loaded — full mock dataset (5 routing + 3 sms + 3 calls)
 *   2. Partial — only routing populated; sms + calls empty
 *   3. Loading — skeleton rows render in every section
 *
 * Selected contact event surfaces below the trigger row so output-critic
 * can verify the onComposeNew callback fires with the right shape.
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
import {
  ContactsSidePanel,
  type ContactsSidePanelData,
} from './ContactsSidePanel';
import type { ContactSearchResult } from './ContactAutocomplete';

type Fixture = 'full' | 'partial' | 'loading';

const FULL_DATA: ContactsSidePanelData = {
  routing: [
    {
      id: 'demo_routing_owner',
      name: 'Tonio Scott',
      phone: '+14045550182',
      routing_role: 'owner',
    },
    {
      id: 'demo_routing_sales',
      name: 'Jordan Reyes',
      phone: '+12125559834',
      routing_role: 'sales',
    },
    {
      id: 'demo_routing_support',
      name: 'Sam Park',
      phone: '+14155558810',
      routing_role: 'support',
    },
    {
      id: 'demo_routing_billing',
      name: 'Priya Shah',
      phone: '+13105557120',
      routing_role: 'billing',
    },
    {
      id: 'demo_routing_scheduling',
      name: 'Maya Lane',
      phone: '+14155550911',
      routing_role: 'scheduling',
    },
  ],
  recentSms: [
    {
      id: 'demo_sms_acme',
      name: 'Acme Painters',
      phone: '+14045551204',
      last_interaction_at: new Date(Date.now() - 23 * 60_000).toISOString(),
      last_message_preview: "Thanks for the quote — we'll get back to you by Friday.",
    },
    {
      id: 'demo_sms_kitchen',
      name: 'Kitchen Quotes Inc.',
      phone: '+15125550066',
      last_interaction_at: new Date(Date.now() - 8 * 60_000).toISOString(),
      last_message_preview: 'Hi — is this the right number for kitchen quotes?',
    },
    {
      id: 'demo_sms_jordan',
      name: 'Jordan Reyes',
      phone: '+12125559834',
      last_interaction_at: new Date(Date.now() - 34 * 86_400_000).toISOString(),
      last_message_preview: 'Followed up on the proposal — circling back when budget reopens.',
    },
  ],
  recentCalls: [
    {
      id: 'demo_call_devon',
      name: 'Devon Park',
      phone: '+17035554123',
      last_interaction_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
    {
      id: 'demo_call_riley',
      name: 'Riley Chen',
      phone: '+16175552901',
      last_interaction_at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    },
    {
      id: 'demo_call_maria',
      name: 'Maria Lopez',
      phone: '+13235558807',
      last_interaction_at: new Date(Date.now() - 16 * 86_400_000).toISOString(),
    },
  ],
};

const PARTIAL_DATA: ContactsSidePanelData = {
  routing: FULL_DATA.routing.slice(0, 2),
  recentSms: [],
  recentCalls: [],
};

const EMPTY_DATA: ContactsSidePanelData = {
  routing: [],
  recentSms: [],
  recentCalls: [],
};

export default function ContactsSidePanelDemo() {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [lastEvent, setLastEvent] = useState<string>('');

  const handleClose = () => {
    setLastEvent('onClose fired');
    setFixture(null);
  };
  const handleComposeNew = (c: ContactSearchResult) => {
    setLastEvent(
      `onComposeNew → ${c.name?.trim() || c.phone} (${c.source}${
        c.routing_role ? ` · ${c.routing_role}` : ''
      })`,
    );
    setFixture(null);
  };

  const data =
    fixture === 'partial'
      ? PARTIAL_DATA
      : fixture === 'loading'
      ? EMPTY_DATA
      : FULL_DATA;
  const isLoadingOverride = fixture === 'loading';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading}>ContactsSidePanel — fixture cycle</Text>
        <Text style={styles.subheading}>
          Each button slides the panel in from the right with the corresponding
          dataset. Click backdrop or X to close. Picking a row fires
          onComposeNew with the contact shape ContactAutocomplete uses.
        </Text>

        <View style={styles.row}>
          <FixtureButton
            label="1. Full"
            sublabel="All 3 sections populated"
            onPress={() => setFixture('full')}
          />
          <FixtureButton
            label="2. Partial"
            sublabel="Only routing populated"
            onPress={() => setFixture('partial')}
          />
          <FixtureButton
            label="3. Loading"
            sublabel="Skeleton rows in every section"
            onPress={() => setFixture('loading')}
          />
        </View>

        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>LAST EVENT</Text>
          <Text style={styles.eventBody}>{lastEvent || '— none yet —'}</Text>
        </View>
      </ScrollView>

      <ContactsSidePanel
        visible={fixture !== null}
        onClose={handleClose}
        onComposeNew={handleComposeNew}
        dataOverride={data}
        isLoadingOverride={isLoadingOverride}
      />
    </View>
  );
}

interface FixtureButtonProps {
  label: string;
  sublabel: string;
  onPress: () => void;
}

function FixtureButton({ label, sublabel, onPress }: FixtureButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
    >
      <Text style={styles.btnLabel}>{label}</Text>
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
  btnPressed: {
    backgroundColor: '#1c1c20',
  },
  btnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
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
