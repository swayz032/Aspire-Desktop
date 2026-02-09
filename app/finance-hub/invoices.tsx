import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal, TextInput, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';
import { DocumentThumbnail } from '@/components/DocumentThumbnail';

const webOnly = (styles: any) => Platform.OS === 'web' ? styles : {};

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';

interface InvoiceLine {
  description: string;
  amount: number;
}

interface StripeInvoice {
  id: string;
  number: string | null;
  customer_email: string | null;
  customer_name: string | null;
  amount_due: number;
  amount_paid: number;
  status: InvoiceStatus;
  due_date: number | null;
  created: number;
  hosted_invoice_url: string | null;
  lines: { data: { description: string; amount: number }[] };
}

type FilterTab = 'all' | 'draft' | 'open' | 'paid' | 'overdue' | 'void';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'open', label: 'Open' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'void', label: 'Void' },
];

const STATUS_COLORS: Record<string, string> = {
  paid: '#10B981',
  open: '#f59e0b',
  uncollectible: '#ef4444',
  draft: '#666',
  void: '#666',
};

const STATUS_BG: Record<string, string> = {
  paid: 'rgba(16, 185, 129, 0.15)',
  open: 'rgba(245, 158, 11, 0.15)',
  uncollectible: 'rgba(239, 68, 68, 0.15)',
  draft: 'rgba(102, 102, 102, 0.15)',
  void: 'rgba(102, 102, 102, 0.15)',
};

function formatCents(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDollars(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(inv: StripeInvoice): boolean {
  if (inv.status !== 'open' || !inv.due_date) return false;
  return inv.due_date * 1000 < Date.now();
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: 'void' | 'delete' } | null>(null);

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [lineItems, setLineItems] = useState<{ description: string; amount: string }[]>([{ description: '', amount: '' }]);
  const [dueDays, setDueDays] = useState('30');
  const [memo, setMemo] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ outstanding: number; overdue: number; paid: number; avgPaymentDays: number } | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/stripe/invoices/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary({
          outstanding: data.outstanding?.total ?? 0,
          overdue: data.overdue?.total ?? 0,
          paid: data.paid_30d?.total ?? 0,
          avgPaymentDays: data.avg_payment_days ?? 0,
        });
      }
    } catch (e) {
      console.error('Failed to fetch invoice summary:', e);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab === 'all' ? '' : activeTab === 'overdue' ? 'open' : activeTab;
      const url = statusParam ? `/api/stripe/invoices?status=${statusParam}&limit=25` : '/api/stripe/invoices?limit=25';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      let filtered = data.invoices || [];
      if (activeTab === 'overdue') {
        filtered = filtered.filter((inv: StripeInvoice) => isOverdue(inv));
      }
      setInvoices(filtered);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchInvoices();
    fetchSummary();
  }, [fetchInvoices, fetchSummary]);

  const totalOutstandingDollars = summary ? summary.outstanding : invoices
    .filter(i => i.status === 'open')
    .reduce((sum, i) => sum + i.amount_due, 0) / 100;

  const overdueTotalDollars = summary ? summary.overdue : invoices.filter(i => isOverdue(i)).reduce((sum, i) => sum + i.amount_due, 0) / 100;

  const paidTotalDollars = summary ? summary.paid : invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount_paid, 0) / 100;

  const avgPaymentDays = summary ? summary.avgPaymentDays : 0;

  const handleAction = async (id: string, action: 'send' | 'finalize' | 'void' | 'delete') => {
    if (action === 'void' || action === 'delete') {
      setConfirmAction({ id, type: action });
      return;
    }
    await executeAction(id, action);
  };

  const executeAction = async (id: string, action: 'send' | 'finalize' | 'void' | 'delete') => {
    setActionLoading(id);
    try {
      const method = action === 'delete' ? 'DELETE' : 'POST';
      const url = action === 'delete' ? `/api/stripe/invoices/${id}` : `/api/stripe/invoices/${id}/${action}`;
      const res = await fetch(url, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${action} invoice`);
      }
      await fetchInvoices();
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message || `Failed to ${action} invoice`);
      } else {
        Alert.alert('Error', err.message || `Failed to ${action} invoice`);
      }
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleCreate = async () => {
    if (!customerEmail.trim()) {
      setCreateError('Customer email is required');
      return;
    }
    const items = lineItems
      .filter(li => li.description.trim() && li.amount.trim())
      .map(li => ({ description: li.description, amount: parseFloat(li.amount) }));
    if (items.length === 0) {
      setCreateError('At least one line item is required');
      return;
    }
    if (items.some(i => isNaN(i.amount) || i.amount <= 0)) {
      setCreateError('All amounts must be positive numbers');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/stripe/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_email: customerEmail.trim(),
          customer_name: customerName.trim() || undefined,
          items,
          due_days: parseInt(dueDays) || 30,
          memo: memo.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create invoice');
      }
      setShowCreateModal(false);
      resetForm();
      await fetchInvoices();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setCustomerEmail('');
    setCustomerName('');
    setLineItems([{ description: '', amount: '' }]);
    setDueDays('30');
    setMemo('');
    setCreateError(null);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', amount: '' }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: 'description' | 'amount', value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const getStatusLabel = (inv: StripeInvoice) => {
    if (isOverdue(inv)) return 'Overdue';
    return inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
  };

  const getStatusColor = (inv: StripeInvoice) => {
    if (isOverdue(inv)) return '#ef4444';
    return STATUS_COLORS[inv.status] || '#666';
  };

  const getStatusBg = (inv: StripeInvoice) => {
    if (isOverdue(inv)) return 'rgba(239, 68, 68, 0.15)';
    return STATUS_BG[inv.status] || 'rgba(102, 102, 102, 0.15)';
  };

  const kpiCards = [
    { label: 'Total Outstanding', value: formatDollars(totalOutstandingDollars), icon: 'wallet-outline' as const, color: '#3B82F6' },
    { label: 'Overdue', value: formatDollars(overdueTotalDollars), icon: 'alert-circle-outline' as const, color: '#ef4444', count: invoices.filter(i => isOverdue(i)).length },
    { label: 'Paid (30d)', value: formatDollars(paidTotalDollars), icon: 'checkmark-circle-outline' as const, color: '#10B981', count: invoices.filter(i => i.status === 'paid').length },
    { label: 'Avg Payment Time', value: `${avgPaymentDays} days`, icon: 'time-outline' as const, color: '#f59e0b' },
  ];

  return (
    <FinanceHubShell>
      <View style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.pageTitle}>Invoices</Text>
            <Text style={s.pageSubtitle}>Manage and track customer invoices</Text>
          </View>
          <Pressable
            style={[s.createBtn, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.createBtnText}>New Invoice</Text>
          </Pressable>
        </View>

        <View style={s.kpiRow}>
          {kpiCards.map((kpi, idx) => (
            <View key={idx} style={[s.kpiCard, webOnly({ cursor: 'default' })]}>
              <View style={s.kpiHeader}>
                <View style={[s.kpiIconWrap, { backgroundColor: kpi.color + '20' }]}>
                  <Ionicons name={kpi.icon} size={18} color={kpi.color} />
                </View>
                {kpi.count !== undefined && (
                  <View style={[s.kpiBadge, { backgroundColor: kpi.color + '25' }]}>
                    <Text style={[s.kpiBadgeText, { color: kpi.color }]}>{kpi.count}</Text>
                  </View>
                )}
              </View>
              <Text style={s.kpiValue}>{kpi.value}</Text>
              <Text style={s.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        <View style={[s.card, Platform.OS === 'web' && { backgroundImage: svgPatterns.invoice(), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '20% auto' } as any]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
            {FILTER_TABS.map(tab => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[s.filterTab, active && s.filterTabActive, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[s.filterTabText, active && s.filterTabTextActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={s.centerState}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={s.stateText}>Loading invoices...</Text>
            </View>
          ) : error ? (
            <View style={s.centerState}>
              <Ionicons name="alert-circle" size={40} color="#ef4444" />
              <Text style={s.stateText}>{error}</Text>
              <Pressable style={s.retryBtn} onPress={fetchInvoices}>
                <Text style={s.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : invoices.length === 0 ? (
            <View style={s.centerState}>
              <Ionicons name="document-text-outline" size={48} color="#444" />
              <Text style={s.stateText}>No invoices found</Text>
              <Text style={s.stateSubtext}>Create your first invoice to get started</Text>
            </View>
          ) : (
            <View>
              {Platform.OS === 'web' && (
                <View style={s.tableHeader}>
                  <Text style={[s.thCell, { flex: 1.2 }]}>Invoice #</Text>
                  <Text style={[s.thCell, { flex: 1.5 }]}>Customer</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Amount</Text>
                  <Text style={[s.thCell, { flex: 0.8 }]}>Status</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Due Date</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Created</Text>
                  <Text style={[s.thCell, { flex: 1.5 }]}>Actions</Text>
                </View>
              )}
              {invoices.map((inv, idx) => (
                <View key={inv.id} style={[s.tableRow, webOnly({ cursor: 'default', transition: 'background 0.15s ease' })]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1.2, gap: 10 }}>
                    <DocumentThumbnail type="invoice" size="md" context="financehub" variant={idx} />
                    <Text style={[s.tdCell, { color: '#fff', fontWeight: '600' as const }]}>
                      {inv.number || inv.id.slice(0, 12)}
                    </Text>
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={[s.tdCell, { color: '#fff' }]} numberOfLines={1}>
                      {inv.customer_name || '—'}
                    </Text>
                    <Text style={[s.tdCellSub]} numberOfLines={1}>
                      {inv.customer_email || '—'}
                    </Text>
                  </View>
                  <Text style={[s.tdCell, { flex: 1, color: '#fff', fontWeight: '500' as const }]}>
                    {formatCents(inv.amount_due)}
                  </Text>
                  <View style={{ flex: 0.8 }}>
                    <View style={[s.statusBadge, { backgroundColor: getStatusBg(inv) }]}>
                      <View style={[s.statusDot, { backgroundColor: getStatusColor(inv) }]} />
                      <Text style={[s.statusText, { color: getStatusColor(inv) }]}>{getStatusLabel(inv)}</Text>
                    </View>
                  </View>
                  <Text style={[s.tdCell, { flex: 1 }]}>{formatDate(inv.due_date)}</Text>
                  <Text style={[s.tdCell, { flex: 1 }]}>{formatDate(inv.created)}</Text>
                  <View style={[s.actionsCell, { flex: 1.5 }]}>
                    {inv.hosted_invoice_url && (
                      <Pressable
                        style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                        onPress={() => Linking.openURL(inv.hosted_invoice_url!)}
                      >
                        <Ionicons name="open-outline" size={14} color="#3B82F6" />
                      </Pressable>
                    )}
                    {inv.status === 'draft' && (
                      <>
                        <Pressable
                          style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                          onPress={() => handleAction(inv.id, 'finalize')}
                          disabled={actionLoading === inv.id}
                        >
                          <Ionicons name="checkmark-done-outline" size={14} color="#10B981" />
                        </Pressable>
                        <Pressable
                          style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                          onPress={() => handleAction(inv.id, 'delete')}
                          disabled={actionLoading === inv.id}
                        >
                          <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        </Pressable>
                      </>
                    )}
                    {inv.status === 'open' && (
                      <>
                        <Pressable
                          style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                          onPress={() => handleAction(inv.id, 'send')}
                          disabled={actionLoading === inv.id}
                        >
                          <Ionicons name="send-outline" size={14} color="#3B82F6" />
                        </Pressable>
                        <Pressable
                          style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                          onPress={() => handleAction(inv.id, 'void')}
                          disabled={actionLoading === inv.id}
                        >
                          <Ionicons name="close-circle-outline" size={14} color="#ef4444" />
                        </Pressable>
                      </>
                    )}
                    {actionLoading === inv.id && (
                      <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <Modal
          visible={!!confirmAction}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmAction(null)}
        >
          <View style={s.modalOverlay}>
            <View style={s.confirmModal}>
              <Ionicons
                name={confirmAction?.type === 'delete' ? 'trash-outline' : 'close-circle-outline'}
                size={36}
                color="#ef4444"
                style={{ alignSelf: 'center', marginBottom: 12 }}
              />
              <Text style={s.confirmTitle}>
                {confirmAction?.type === 'delete' ? 'Delete Invoice?' : 'Void Invoice?'}
              </Text>
              <Text style={s.confirmSubtext}>
                {confirmAction?.type === 'delete'
                  ? 'This will permanently delete this draft invoice. This action cannot be undone.'
                  : 'This will void the invoice and it can no longer be paid. This action cannot be undone.'}
              </Text>
              <View style={s.confirmActions}>
                <Pressable
                  style={[s.confirmCancelBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => setConfirmAction(null)}
                >
                  <Text style={s.confirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.confirmDeleteBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => confirmAction && executeAction(confirmAction.id, confirmAction.type)}
                >
                  <Text style={s.confirmDeleteText}>
                    {confirmAction?.type === 'delete' ? 'Delete' : 'Void'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showCreateModal}
          transparent
          animationType="fade"
          onRequestClose={() => { setShowCreateModal(false); resetForm(); }}
        >
          <View style={s.modalOverlay}>
            <View style={s.createModal}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Create Invoice</Text>
                <Pressable
                  onPress={() => { setShowCreateModal(false); resetForm(); }}
                  style={webOnly({ cursor: 'pointer' })}
                >
                  <Ionicons name="close" size={22} color="#888" />
                </Pressable>
              </View>

              <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={s.fieldLabel}>Customer Email *</Text>
                <TextInput
                  style={s.textInput}
                  value={customerEmail}
                  onChangeText={setCustomerEmail}
                  placeholder="customer@example.com"
                  placeholderTextColor="#555"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={s.fieldLabel}>Customer Name</Text>
                <TextInput
                  style={s.textInput}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="John Doe"
                  placeholderTextColor="#555"
                />

                <View style={s.lineItemsHeader}>
                  <Text style={s.fieldLabel}>Line Items *</Text>
                  <Pressable onPress={addLineItem} style={[s.addItemBtn, webOnly({ cursor: 'pointer' })]}>
                    <Ionicons name="add-circle-outline" size={16} color="#3B82F6" />
                    <Text style={s.addItemText}>Add Item</Text>
                  </Pressable>
                </View>

                {lineItems.map((item, idx) => (
                  <View key={idx} style={s.lineItemRow}>
                    <TextInput
                      style={[s.textInput, { flex: 2, marginRight: 8, marginBottom: 0 }]}
                      value={item.description}
                      onChangeText={(v) => updateLineItem(idx, 'description', v)}
                      placeholder="Description"
                      placeholderTextColor="#555"
                    />
                    <TextInput
                      style={[s.textInput, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                      value={item.amount}
                      onChangeText={(v) => updateLineItem(idx, 'amount', v)}
                      placeholder="Amount ($)"
                      placeholderTextColor="#555"
                      keyboardType="decimal-pad"
                    />
                    {lineItems.length > 1 && (
                      <Pressable onPress={() => removeLineItem(idx)} style={webOnly({ cursor: 'pointer' })}>
                        <Ionicons name="remove-circle" size={22} color="#ef4444" />
                      </Pressable>
                    )}
                  </View>
                ))}

                <Text style={s.fieldLabel}>Due Days</Text>
                <TextInput
                  style={s.textInput}
                  value={dueDays}
                  onChangeText={setDueDays}
                  placeholder="30"
                  placeholderTextColor="#555"
                  keyboardType="number-pad"
                />

                <Text style={s.fieldLabel}>Memo</Text>
                <TextInput
                  style={[s.textInput, { minHeight: 72, textAlignVertical: 'top' }]}
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="Optional note for the customer"
                  placeholderTextColor="#555"
                  multiline
                />

                {createError && (
                  <View style={s.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={s.errorText}>{createError}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={s.modalFooter}>
                <Pressable
                  style={[s.cancelBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => { setShowCreateModal(false); resetForm(); }}
                >
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.submitBtn, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' }), creating && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={16} color="#fff" />
                      <Text style={s.submitBtnText}>Create Invoice</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </FinanceHubShell>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    padding: 18,
    overflow: 'hidden',
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  kpiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: '#3B82F6',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
  },
  filterTabTextActive: {
    color: '#3B82F6',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  stateText: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 12,
  },
  stateSubtext: {
    color: '#666',
    fontSize: 13,
    marginTop: 6,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  retryBtnText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 13,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tdCell: {
    fontSize: 13,
    color: '#aaa',
  },
  tdCellSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } : {}),
  } as any,
  confirmModal: {
    width: 380,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    padding: 28,
    overflow: 'hidden',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmSubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#aaa',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  createModal: {
    width: 540,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    marginBottom: 18,
  },
  lineItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelBtnText: {
    color: '#aaa',
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
