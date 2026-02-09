import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { WizardScenario } from './types';

const SCENARIOS: WizardScenario[] = [
  {
    id: 'paid_vendor',
    label: 'I paid a vendor / supplier',
    icon: 'arrow-up-circle-outline',
    description: 'Record a payment made to a vendor for goods or services.',
    debitAccount: 'Accounts Payable',
    creditAccount: 'Cash',
    fields: [
      { key: 'amount', label: 'Amount Paid', type: 'amount' },
      { key: 'vendor', label: 'Vendor Name', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'memo', label: 'What was it for?', type: 'text' },
    ],
  },
  {
    id: 'received_payment',
    label: 'I received a payment',
    icon: 'arrow-down-circle-outline',
    description: 'Record money received from a client or customer.',
    debitAccount: 'Cash',
    creditAccount: 'Accounts Receivable',
    fields: [
      { key: 'amount', label: 'Amount Received', type: 'amount' },
      { key: 'customer', label: 'From Whom?', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'memo', label: 'What was it for?', type: 'text' },
    ],
  },
  {
    id: 'paid_expense',
    label: 'I paid a business expense',
    icon: 'receipt-outline',
    description: 'Record an operating expense like rent, utilities, or supplies.',
    debitAccount: 'Expense',
    creditAccount: 'Cash',
    fields: [
      { key: 'amount', label: 'Amount', type: 'amount' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'memo', label: 'Description', type: 'text' },
    ],
  },
  {
    id: 'transferred_money',
    label: 'I transferred money between accounts',
    icon: 'swap-horizontal-outline',
    description: 'Record a transfer between bank or asset accounts.',
    debitAccount: 'To Account',
    creditAccount: 'From Account',
    fields: [
      { key: 'amount', label: 'Amount Transferred', type: 'amount' },
      { key: 'from', label: 'From Account', type: 'text' },
      { key: 'to', label: 'To Account', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
    ],
  },
  {
    id: 'made_sale',
    label: 'I made a sale / earned revenue',
    icon: 'cash-outline',
    description: 'Record revenue earned from sales or services.',
    debitAccount: 'Cash',
    creditAccount: 'Revenue',
    fields: [
      { key: 'amount', label: 'Amount', type: 'amount' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'memo', label: 'Description', type: 'text' },
    ],
  },
  {
    id: 'owner_draw',
    label: 'Owner drew money / invested',
    icon: 'person-outline',
    description: 'Record an owner draw or additional investment into the business.',
    debitAccount: 'Owner Draw / Cash',
    creditAccount: 'Cash / Owner Equity',
    fields: [
      { key: 'amount', label: 'Amount', type: 'amount' },
      { key: 'type', label: 'Draw or Investment?', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'memo', label: 'Notes', type: 'text' },
    ],
  },
];

interface StoryWizardProps {
  accounts: any[];
  onSubmit: (journalEntry: { date: string; memo: string; lines: { accountId: string; accountName: string; type: 'Debit' | 'Credit'; amount: string; description: string }[] }) => Promise<void>;
}

export function StoryWizard({ accounts, onSubmit }: StoryWizardProps) {
  const [selectedScenario, setSelectedScenario] = useState<WizardScenario | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'choose' | 'fill' | 'review' | 'done'>('choose');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);

  const handleSelectScenario = (scenario: WizardScenario) => {
    setSelectedScenario(scenario);
    const defaults: Record<string, string> = {};
    scenario.fields.forEach(f => {
      defaults[f.key] = f.type === 'date' ? new Date().toISOString().split('T')[0] : '';
    });
    setFieldValues(defaults);
    setStep('fill');
    setError(null);
  };

  const handleReview = () => {
    if (!selectedScenario) return;
    const amount = fieldValues.amount;
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setError(null);
    setStep('review');
  };

  const handleSubmit = async () => {
    if (!selectedScenario) return;
    setSubmitting(true);
    setError(null);
    try {
      const amount = fieldValues.amount || '0';
      const memoFields = selectedScenario.fields
        .filter(f => f.key !== 'amount' && f.key !== 'date')
        .map(f => fieldValues[f.key])
        .filter(Boolean);
      const memo = `${selectedScenario.label}: ${memoFields.join(' — ')}`;

      await onSubmit({
        date: fieldValues.date || new Date().toISOString().split('T')[0],
        memo,
        lines: [
          { accountId: '', accountName: selectedScenario.debitAccount, type: 'Debit', amount, description: memo },
          { accountId: '', accountName: selectedScenario.creditAccount, type: 'Credit', amount, description: memo },
        ],
      });
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSelectedScenario(null);
    setFieldValues({});
    setStep('choose');
    setError(null);
  };

  if (step === 'done') {
    return (
      <View style={styles.doneContainer}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        </View>
        <Text style={styles.doneTitle}>Entry Recorded</Text>
        <Text style={styles.doneSubtitle}>Your journal entry has been submitted to QuickBooks.</Text>
        <Pressable style={[styles.primaryBtn, { marginTop: 20 }]} onPress={reset}>
          <Text style={styles.primaryBtnText}>Record Another</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'review' && selectedScenario) {
    return (
      <View style={styles.container}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setStep('fill')} style={[styles.backBtn, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}>
            <Ionicons name="arrow-back" size={18} color="#3B82F6" />
          </Pressable>
          <Text style={styles.stepTitle}>Review Entry</Text>
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewLabel}>What happened</Text>
          <Text style={styles.reviewValue}>{selectedScenario.label}</Text>
        </View>

        {selectedScenario.fields.map(field => (
          <View key={field.key} style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>{field.label}</Text>
            <Text style={styles.reviewValue}>
              {field.type === 'amount' ? `$${parseFloat(fieldValues[field.key] || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}` : (fieldValues[field.key] || '—')}
            </Text>
          </View>
        ))}

        <View style={[styles.reviewCard, { backgroundColor: 'rgba(59, 130, 246, 0.06)' }]}>
          <Text style={[styles.reviewLabel, { color: '#60A5FA' }]}>Behind the scenes</Text>
          <Text style={styles.reviewJELine}>Debit: {selectedScenario.debitAccount} — ${parseFloat(fieldValues.amount || '0').toFixed(2)}</Text>
          <Text style={styles.reviewJELine}>Credit: {selectedScenario.creditAccount} — ${parseFloat(fieldValues.amount || '0').toFixed(2)}</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryBtn, { marginTop: 16, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Submit Entry</Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  if (step === 'fill' && selectedScenario) {
    return (
      <View style={styles.container}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setStep('choose')} style={[styles.backBtn, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}>
            <Ionicons name="arrow-back" size={18} color="#3B82F6" />
          </Pressable>
          <View style={[styles.scenarioIconSmall, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
            <Ionicons name={selectedScenario.icon as any} size={16} color="#3B82F6" />
          </View>
          <Text style={styles.stepTitle}>{selectedScenario.label}</Text>
        </View>
        <Text style={styles.stepDesc}>{selectedScenario.description}</Text>

        {selectedScenario.fields.map(field => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              style={styles.fieldInput}
              value={fieldValues[field.key] || ''}
              onChangeText={(v) => setFieldValues(prev => ({ ...prev, [field.key]: v }))}
              placeholder={field.type === 'amount' ? '0.00' : field.type === 'date' ? 'YYYY-MM-DD' : `Enter ${field.label.toLowerCase()}`}
              placeholderTextColor="#6e6e73"
              keyboardType={field.type === 'amount' ? 'numeric' : 'default'}
            />
          </View>
        ))}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable style={[styles.primaryBtn, { marginTop: 16 }]} onPress={handleReview}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="eye-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Review Entry</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.wizardHeader}>
        <View style={[styles.wizardIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
          <Ionicons name="flash-outline" size={22} color="#3B82F6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.wizardTitle}>What happened?</Text>
          <Text style={styles.wizardSubtitle}>Choose what best describes this transaction</Text>
        </View>
      </View>

      <View style={styles.scenarioGrid}>
        {SCENARIOS.map(scenario => {
          const isHovered = hoveredScenario === scenario.id;
          return (
            <Pressable
              key={scenario.id}
              style={[styles.scenarioCard, isHovered && styles.scenarioCardHover, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
              onPress={() => handleSelectScenario(scenario)}
              {...(Platform.OS === 'web' ? {
                onHoverIn: () => setHoveredScenario(scenario.id),
                onHoverOut: () => setHoveredScenario(null),
              } : {})}
            >
              <View style={[styles.scenarioIcon, { backgroundColor: isHovered ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)' }]}>
                <Ionicons name={scenario.icon as any} size={20} color="#3B82F6" />
              </View>
              <Text style={styles.scenarioLabel}>{scenario.label}</Text>
              <Text style={styles.scenarioDesc} numberOfLines={2}>{scenario.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  wizardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  wizardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wizardTitle: { color: '#f2f2f2', fontSize: 18, fontWeight: '700' },
  wizardSubtitle: { color: '#8e8e93', fontSize: 13, marginTop: 2 },
  scenarioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  scenarioCard: {
    width: '48%', backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER,
    borderRadius: 14, padding: 16, gap: 10,
  },
  scenarioCardHover: { borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.04)' },
  scenarioIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scenarioLabel: { color: '#f2f2f2', fontSize: 13, fontWeight: '600' },
  scenarioDesc: { color: '#8e8e93', fontSize: 11, lineHeight: 15 },
  scenarioIconSmall: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepTitle: { color: '#f2f2f2', fontSize: 16, fontWeight: '700', flex: 1 },
  stepDesc: { color: '#8e8e93', fontSize: 13, marginBottom: 16 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { color: '#8e8e93', fontSize: 12, fontWeight: '500', marginBottom: 6 },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: CARD_BORDER,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: '#f2f2f2', fontSize: 14,
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10,
    padding: 12, marginBottom: 8,
  },
  reviewLabel: { color: '#8e8e93', fontSize: 11, fontWeight: '500', marginBottom: 4 },
  reviewValue: { color: '#f2f2f2', fontSize: 14, fontWeight: '600' },
  reviewJELine: { color: '#d1d1d6', fontSize: 13, marginTop: 4, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  primaryBtn: {
    backgroundColor: '#3B82F6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  errorBox: { backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 10, padding: 10, marginTop: 8 },
  errorText: { color: '#ff3b30', fontSize: 12, fontWeight: '500' },
  doneContainer: { alignItems: 'center', paddingVertical: 40 },
  doneIcon: { marginBottom: 16 },
  doneTitle: { color: '#f2f2f2', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  doneSubtitle: { color: '#8e8e93', fontSize: 14, textAlign: 'center' },
});
