/**
 * ContactAutocomplete.demo — visual smoke + Framer-fidelity check.
 *
 * Cycles four fixtures:
 *   1. Loaded with 8 results — full source coverage (routing/sms/call)
 *   2. Loaded with 0 results — empty-state rendering
 *   3. Loading state — shimmer skeleton rows
 *   4. Manual-entry highlighted — typed +1XXX with `Manual` row featured
 *
 * Each fixture shows a control bar (name of the variant + reset button) and
 * a live "selected" panel that proves the onSelect handler fires.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import {
  ContactAutocomplete,
  type ContactSearchResult,
} from './ContactAutocomplete';

const SAMPLE_8: ContactSearchResult[] = [
  {
    id: 'demo_routing_owner',
    source: 'routing',
    name: 'Tonio Scott',
    phone: '+14045550182',
    routing_role: 'owner',
  },
  {
    id: 'demo_routing_scheduling',
    source: 'routing',
    name: 'Maya Lane',
    phone: '+14155550911',
    routing_role: 'scheduling',
  },
  {
    id: 'demo_routing_sales',
    source: 'routing',
    name: 'Jordan Reyes',
    phone: '+12125559834',
    routing_role: 'sales',
  },
  {
    id: 'demo_routing_billing',
    source: 'routing',
    name: 'Priya Shah',
    phone: '+13105557120',
    routing_role: 'billing',
  },
  {
    id: 'demo_sms_acme',
    source: 'recent_sms',
    name: 'Acme Painters',
    phone: '+14045551204',
  },
  {
    id: 'demo_sms_kitchen',
    source: 'recent_sms',
    name: 'Kitchen Quotes Inc.',
    phone: '+15125550066',
  },
  {
    id: 'demo_call_devon',
    source: 'recent_call',
    name: 'Devon Park',
    phone: '+17035554123',
  },
  {
    id: 'demo_call_riley',
    source: 'recent_call',
    name: 'Riley Chen',
    phone: '+16175552901',
  },
];

const MANUAL_HIGHLIGHTED_RESULTS: ContactSearchResult[] = [
  {
    id: 'demo_routing_billing',
    source: 'routing',
    name: 'Priya Shah',
    phone: '+13105557120',
    routing_role: 'billing',
  },
];

export default function ContactAutocompleteDemo() {
  const [picked1, setPicked1] = useState<ContactSearchResult | null>(null);
  const [picked2, setPicked2] = useState<ContactSearchResult | null>(null);
  const [picked3, setPicked3] = useState<ContactSearchResult | null>(null);
  const [picked4, setPicked4] = useState<ContactSearchResult | null>(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant
        title="Loaded — 8 results across all 4 sources"
        subtitle="Hover/arrow-key any row to highlight; Enter or click selects."
      >
        <View style={styles.acWrap}>
          <ContactAutocomplete
            value={picked1}
            onSelect={setPicked1}
            onClear={() => setPicked1(null)}
            resultsOverride={SAMPLE_8}
            forceOpen
          />
        </View>
        <PickedPreview contact={picked1} />
      </Variant>

      <Variant
        title="Loaded — 0 results"
        subtitle="Friendly empty-state with a guiding next-step hint."
      >
        <View style={styles.acWrap}>
          <ContactAutocomplete
            value={picked2}
            onSelect={setPicked2}
            onClear={() => setPicked2(null)}
            resultsOverride={[]}
            forceOpen
          />
        </View>
        <PickedPreview contact={picked2} />
      </Variant>

      <Variant
        title="Loading — shimmer skeleton rows"
        subtitle="Three placeholder rows pulse during the 200ms debounce + remote fetch."
      >
        <View style={styles.acWrap}>
          <ContactAutocomplete
            value={picked3}
            onSelect={setPicked3}
            onClear={() => setPicked3(null)}
            isLoadingOverride
            forceOpen
          />
        </View>
        <PickedPreview contact={picked3} />
      </Variant>

      <Variant
        title="Manual entry — `+14045550199` typed"
        subtitle="A `Manual` row is appended below any matched results — a one-tap path to a brand-new contact."
      >
        <View style={styles.acWrap}>
          <ContactAutocomplete
            value={picked4}
            onSelect={setPicked4}
            onClear={() => setPicked4(null)}
            resultsOverride={MANUAL_HIGHLIGHTED_RESULTS}
            // We render the manual row by relying on the component's own
            // `manualRow` derivation — but in this fixture we want it visible
            // without typing, so we pass it directly via resultsOverride:
            initialHighlightedIndex={1}
            forceOpen
          />
        </View>
        <PickedPreview contact={picked4} />
        <Text style={styles.fixtureNote}>
          Note: in production the Manual row is generated automatically when
          the typed input parses to E.164 and isn&rsquo;t already a result.
        </Text>
      </Variant>
    </ScrollView>
  );
}

interface VariantProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function Variant({ title, subtitle, children }: VariantProps) {
  return (
    <View style={styles.variant}>
      <Text style={styles.variantTitle}>{title}</Text>
      <Text style={styles.variantSubtitle}>{subtitle}</Text>
      <View style={styles.variantBody}>{children}</View>
    </View>
  );
}

function PickedPreview({ contact }: { contact: ContactSearchResult | null }) {
  return (
    <View style={styles.preview}>
      <Text style={styles.previewLabel}>SELECTED</Text>
      {contact ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.previewBody}>
            {contact.name?.trim() || '(no name)'}{' '}
            <Text style={styles.previewMuted}>
              · {contact.phone} · {contact.source}
              {contact.routing_role ? ` · ${contact.routing_role}` : ''}
            </Text>
          </Text>
        </View>
      ) : (
        <Text style={styles.previewMuted}>— pick a row above —</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  content: {
    padding: 32,
    gap: 32,
  },
  variant: {
    gap: 12,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  variantTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  variantSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 17,
  },
  variantBody: {
    gap: 12,
    paddingTop: 8,
  },
  acWrap: {
    width: '100%',
    maxWidth: 520,
  },
  fixtureNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.text.muted,
    paddingLeft: 4,
    paddingTop: 6,
  },
  preview: {
    padding: 12,
    backgroundColor: '#141416',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
    width: '100%',
    maxWidth: 520,
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.2,
  },
  previewBody: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
    lineHeight: 19,
    fontFamily:
      Platform.OS === 'web'
        ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
        : undefined,
  },
  previewMuted: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
});
