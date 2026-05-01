/**
 * MessageTemplatePicker.demo — visual smoke + Framer-fidelity check.
 *
 * Cycles three fixtures:
 *   1. Full 5 templates with sample threadContext (token substitution proof)
 *   2. Partial — single template, no context (raw {{tokens}} preserved)
 *   3. Empty — `forceEmpty` true (renders the empty-state with personality)
 *
 * Each fixture stays open by default so the dropdown is visible without
 * needing to click a trigger. Selected body is logged + shown below the
 * picker so you can verify the substitution math without a composer.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';
import {
  MessageTemplatePicker,
  type MessageTemplate,
  type ThreadContext,
} from './MessageTemplatePicker';

const SAMPLE_CONTEXT: ThreadContext = {
  contactName: 'Maya Lane',
  businessName: 'Aspire Painting Co.',
  businessPhone: '(404) 555-0182',
  appointmentDate: 'Tuesday',
  appointmentTime: '2:00 PM',
  relativeTime: 'yesterday',
  responseWindow: '1 business day',
  lastInvoice: {
    number: '1042',
    amount: '$2,400',
    dueDate: 'May 7',
  },
};

const SINGLE_TEMPLATE: MessageTemplate[] = [
  {
    id: 'tpl_demo_partial',
    label: 'Quote follow-up',
    body: "Hi {{first_name}} — quick follow-up on the quote we sent {{relative_time}}. Any questions?",
    tokens: ['first_name', 'relative_time'],
  },
];

export default function MessageTemplatePickerDemo() {
  const [selectedFull, setSelectedFull] = useState<string | null>(null);
  const [selectedPartial, setSelectedPartial] = useState<string | null>(null);
  const [selectedEmpty, setSelectedEmpty] = useState<string | null>(null);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Variant
        title="Full — 5 V1 templates with thread context"
        subtitle="Selecting any row substitutes resolved tokens before firing onSelect."
      >
        <MessageTemplatePicker
          open
          onClose={() => {}}
          onSelect={setSelectedFull}
          threadContext={SAMPLE_CONTEXT}
        />
        <SelectedPreview body={selectedFull} />
      </Variant>

      <Variant
        title="Partial — single template, no context"
        subtitle="No threadContext → tokens stay as {{first_name}} for the owner to fill."
      >
        <MessageTemplatePicker
          open
          onClose={() => {}}
          onSelect={setSelectedPartial}
          templatesOverride={SINGLE_TEMPLATE}
        />
        <SelectedPreview body={selectedPartial} />
      </Variant>

      <Variant
        title="Empty — fetch failed, no templates"
        subtitle="forceEmpty=true exercises the friendly empty-state branch."
      >
        <MessageTemplatePicker
          open
          onClose={() => {}}
          onSelect={setSelectedEmpty}
          forceEmpty
        />
        <SelectedPreview body={selectedEmpty} />
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

function SelectedPreview({ body }: { body: string | null }) {
  return (
    <View style={styles.preview}>
      <Text style={styles.previewLabel}>LAST SELECTED</Text>
      <Text style={styles.previewBody}>
        {body ? body : '— pick a template above —'}
      </Text>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  preview: {
    flex: 1,
    minWidth: 280,
    padding: 14,
    backgroundColor: '#141416',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.2,
  },
  previewBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.secondary,
    lineHeight: 19,
    fontFamily:
      Platform.OS === 'web'
        ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
        : undefined,
  },
});
