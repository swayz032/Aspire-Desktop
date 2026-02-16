import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TextInput, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { WizardScenario } from './types';

const ACCOUNT_NAME_MAP: Record<string, string[]> = {
  'Accounts Payable': ['Accounts Payable', 'A/P', 'AP'],
  'Accounts Receivable': ['Accounts Receivable', 'A/R', 'AR'],
  'Cash': ['Checking', 'Cash', 'Savings', 'Bank', 'Cash and cash equivalents', 'Cash on hand'],
  'Expense': ['Expense', 'Expenses', 'Operating Expense', 'Other Expense', 'Utilities', 'Rent', 'Office Supplies', 'Miscellaneous'],
  'Revenue': ['Revenue', 'Income', 'Sales', 'Service', 'Services', 'Sales of Product Income'],
  'Owner Draw / Cash': ['Owner Draw', 'Owners Draw', 'Owner\'s Draw', 'Distributions', 'Partner Distributions'],
  'Cash / Owner Equity': ['Owner\'s Equity', 'Owners Equity', 'Owner Equity', 'Opening Balance Equity', 'Retained Earnings', 'Capital', 'Paid-In Capital'],
  'To Account': ['Checking', 'Savings', 'Cash', 'Bank'],
  'From Account': ['Checking', 'Savings', 'Cash', 'Bank'],
};

function findAccountId(scenarioAccountName: string, accounts: any[]): { id: string; name: string } {
  if (!accounts || accounts.length === 0) return { id: '', name: scenarioAccountName };

  const searchNames = ACCOUNT_NAME_MAP[scenarioAccountName] || [scenarioAccountName];

  for (const searchName of searchNames) {
    const exactMatch = accounts.find((a: any) => {
      const accName = (a.Name || a.name || '').toLowerCase();
      return accName === searchName.toLowerCase();
    });
    if (exactMatch) return { id: String(exactMatch.Id || exactMatch.id || ''), name: exactMatch.Name || exactMatch.name };
  }

  for (const searchName of searchNames) {
    const partialMatch = accounts.find((a: any) => {
      const accName = (a.Name || a.name || '').toLowerCase();
      return accName.includes(searchName.toLowerCase()) || searchName.toLowerCase().includes(accName);
    });
    if (partialMatch) return { id: String(partialMatch.Id || partialMatch.id || ''), name: partialMatch.Name || partialMatch.name };
  }

  const typeMap: Record<string, string[]> = {
    'Accounts Payable': ['Accounts Payable'],
    'Accounts Receivable': ['Accounts Receivable'],
    'Cash': ['Bank', 'Other Current Asset'],
    'Expense': ['Expense', 'Other Expense'],
    'Revenue': ['Income', 'Other Income'],
    'Owner Draw / Cash': ['Equity'],
    'Cash / Owner Equity': ['Equity'],
    'To Account': ['Bank', 'Other Current Asset'],
    'From Account': ['Bank', 'Other Current Asset'],
  };

  const accountTypes = typeMap[scenarioAccountName] || [];
  for (const accType of accountTypes) {
    const typeMatch = accounts.find((a: any) => {
      const at = (a.AccountType || a.account_type || '').toLowerCase();
      return at === accType.toLowerCase();
    });
    if (typeMatch) return { id: String(typeMatch.Id || typeMatch.id || ''), name: typeMatch.Name || typeMatch.name };
  }

  return { id: '', name: scenarioAccountName };
}

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
  const [attachments, setAttachments] = useState<{ name: string; uri: string; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectScenario = (scenario: WizardScenario) => {
    setSelectedScenario(scenario);
    const defaults: Record<string, string> = {};
    scenario.fields.forEach(f => {
      defaults[f.key] = f.type === 'date' ? new Date().toISOString().split('T')[0] : '';
    });
    setFieldValues(defaults);
    setStep('fill');
    setError(null);
    setAttachments([]);
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

  const handleFileSelect = () => {
    if (Platform.OS === 'web') {
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf,.jpg,.jpeg,.png,.heic';
        input.multiple = true;
        input.style.display = 'none';
        input.onchange = (e: any) => {
          const files = e.target?.files;
          if (!files) return;
          const newAttachments: { name: string; uri: string; type: string }[] = [];
          Array.from(files).forEach((file: any) => {
            const reader = new FileReader();
            reader.onload = () => {
              newAttachments.push({
                name: file.name,
                uri: reader.result as string,
                type: file.type,
              });
              if (newAttachments.length === files.length) {
                setAttachments(prev => [...prev, ...newAttachments]);
              }
            };
            reader.readAsDataURL(file);
          });
        };
        document.body.appendChild(input);
        fileInputRef.current = input;
      }
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedScenario) return;
    setSubmitting(true);
    setError(null);
    try {
      const amount = fieldValues.amount || '0';
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('Please enter a valid amount greater than zero');
        setSubmitting(false);
        return;
      }

      const memoFields = selectedScenario.fields
        .filter(f => f.key !== 'amount' && f.key !== 'date')
        .map(f => fieldValues[f.key])
        .filter(Boolean);
      const memo = `${selectedScenario.label}: ${memoFields.join(' — ')}`;

      const debitAccount = findAccountId(selectedScenario.debitAccount, accounts);
      const creditAccount = findAccountId(selectedScenario.creditAccount, accounts);

      if (!debitAccount.id || !creditAccount.id) {
        const missing = [];
        if (!debitAccount.id) missing.push(selectedScenario.debitAccount);
        if (!creditAccount.id) missing.push(selectedScenario.creditAccount);
        setError(`Could not find matching QuickBooks accounts for: ${missing.join(', ')}. Please ensure your Chart of Accounts has these account types set up.`);
        setSubmitting(false);
        return;
      }

      await onSubmit({
        date: fieldValues.date || new Date().toISOString().split('T')[0],
        memo,
        lines: [
          { accountId: debitAccount.id, accountName: debitAccount.name, type: 'Debit', amount: String(parsedAmount), description: memo },
          { accountId: creditAccount.id, accountName: creditAccount.name, type: 'Credit', amount: String(parsedAmount), description: memo },
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
    setAttachments([]);
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
    const debitMatch = findAccountId(selectedScenario.debitAccount, accounts);
    const creditMatch = findAccountId(selectedScenario.creditAccount, accounts);

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

        {attachments.length > 0 && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>Attachments ({attachments.length})</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {attachments.map((att, i) => (
                <View key={i} style={styles.attachPreview}>
                  {att.type.startsWith('image/') ? (
                    <Image source={{ uri: att.uri }} style={{ width: 48, height: 48, borderRadius: 6 }} resizeMode="cover" />
                  ) : (
                    <View style={[styles.attachFileIcon]}>
                      <Ionicons name="document-text" size={22} color="#3B82F6" />
                    </View>
                  )}
                  <Text style={styles.attachName} numberOfLines={1}>{att.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.reviewCard, { backgroundColor: 'rgba(59, 130, 246, 0.06)' }]}>
          <Text style={[styles.reviewLabel, { color: '#60A5FA' }]}>Behind the scenes</Text>
          <Text style={styles.reviewJELine}>
            Debit: {debitMatch.name}{debitMatch.id ? ` (ID: ${debitMatch.id})` : ''} — ${parseFloat(fieldValues.amount || '0').toFixed(2)}
          </Text>
          <Text style={styles.reviewJELine}>
            Credit: {creditMatch.name}{creditMatch.id ? ` (ID: ${creditMatch.id})` : ''} — ${parseFloat(fieldValues.amount || '0').toFixed(2)}
          </Text>
          {(!debitMatch.id || !creditMatch.id) && (
            <Text style={{ color: '#ff9500', fontSize: 11, marginTop: 6 }}>
              Some accounts could not be matched. Make sure your QuickBooks Chart of Accounts is set up.
            </Text>
          )}
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

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Receipt / Attachment (optional)</Text>
          <Pressable
            style={[styles.attachBtn, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
            onPress={handleFileSelect}
          >
            <Ionicons name="camera-outline" size={18} color="#3B82F6" />
            <Text style={styles.attachBtnText}>Add Photo or File</Text>
          </Pressable>
          {attachments.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {attachments.map((att, i) => (
                <View key={i} style={styles.attachItem}>
                  {att.type.startsWith('image/') ? (
                    <Image source={{ uri: att.uri }} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="cover" />
                  ) : (
                    <View style={styles.attachFileIcon}>
                      <Ionicons name="document-text" size={24} color="#3B82F6" />
                    </View>
                  )}
                  <Text style={styles.attachItemName} numberOfLines={1}>{att.name}</Text>
                  <Pressable
                    style={[styles.attachRemove, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                    onPress={() => removeAttachment(i)}
                  >
                    <Ionicons name="close-circle" size={18} color="#ff3b30" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

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
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderStyle: 'dashed',
  },
  attachBtnText: { color: '#3B82F6', fontSize: 13, fontWeight: '600' },
  attachItem: { alignItems: 'center', width: 70, position: 'relative' },
  attachItemName: { color: '#8e8e93', fontSize: 10, marginTop: 4, textAlign: 'center', width: 70 },
  attachRemove: { position: 'absolute', top: -4, right: -4 },
  attachPreview: { alignItems: 'center', width: 56 },
  attachFileIcon: { width: 48, height: 48, borderRadius: 6, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' },
  attachName: { color: '#8e8e93', fontSize: 9, marginTop: 3, textAlign: 'center', width: 56 },
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
