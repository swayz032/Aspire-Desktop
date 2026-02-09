import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal, TextInput, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';
import { DocumentThumbnail } from '@/components/DocumentThumbnail';

const webOnly = (styles: any) => Platform.OS === 'web' ? styles : {};

type QuoteStatus = 'draft' | 'open' | 'accepted' | 'canceled';

interface StripeQuote {
  id: string;
  number: string | null;
  customer: string | null;
  amount_total: number;
  amount_subtotal: number;
  status: QuoteStatus;
  created: number;
  expires_at: number | null;
  description: string | null;
  line_items?: { data: { description: string; amount: number; quantity: number }[] };
}

type FilterTab = 'all' | 'draft' | 'open' | 'accepted' | 'canceled';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'open', label: 'Open' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'canceled', label: 'Canceled' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: Colors.text.muted,
  open: '#f59e0b',
  accepted: '#10B981',
  canceled: '#ef4444',
};

const STATUS_BG: Record<string, string> = {
  draft: 'rgba(110, 110, 115, 0.15)',
  open: 'rgba(245, 158, 11, 0.15)',
  accepted: 'rgba(16, 185, 129, 0.15)',
  canceled: 'rgba(239, 68, 68, 0.15)',
};

function formatCents(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpired(q: StripeQuote): boolean {
  if (q.status !== 'open' || !q.expires_at) return false;
  return q.expires_at * 1000 < Date.now();
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<StripeQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: 'cancel' } | null>(null);

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [lineItems, setLineItems] = useState<{ description: string; amount: string }[]>([{ description: '', amount: '' }]);
  const [expiryDays, setExpiryDays] = useState('30');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab === 'all' ? '' : activeTab;
      const url = statusParam ? `/api/stripe/quotes?status=${statusParam}&limit=25` : '/api/stripe/quotes?limit=25';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const data = await res.json();
      setQuotes(data.quotes || []);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const totalQuotes = quotes.length;
  const acceptedCount = quotes.filter(q => q.status === 'accepted').length;
  const pendingCount = quotes.filter(q => q.status === 'open' || q.status === 'draft').length;
  const expiredCount = quotes.filter(q => isExpired(q)).length;

  const handleAction = async (id: string, action: 'finalize' | 'accept' | 'cancel') => {
    if (action === 'cancel') {
      setConfirmAction({ id, type: 'cancel' });
      return;
    }
    await executeAction(id, action);
  };

  const executeAction = async (id: string, action: 'finalize' | 'accept' | 'cancel') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/stripe/quotes/${id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${action} quote`);
      }
      await fetchQuotes();
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message || `Failed to ${action} quote`);
      } else {
        Alert.alert('Error', err.message || `Failed to ${action} quote`);
      }
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleDownloadPdf = (id: string) => {
    if (Platform.OS === 'web') {
      window.open(`/api/stripe/quotes/${id}/pdf`, '_blank');
    } else {
      Linking.openURL(`/api/stripe/quotes/${id}/pdf`);
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
      const customerRes = await fetch('/api/stripe/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerEmail.trim(),
          name: customerName.trim() || undefined,
        }),
      });

      let customerId: string;
      if (customerRes.ok) {
        const customerData = await customerRes.json();
        customerId = customerData.id;
      } else {
        const searchRes = await fetch(`/api/stripe/customers?email=${encodeURIComponent(customerEmail.trim())}`);
        if (!searchRes.ok) throw new Error('Failed to find or create customer');
        const searchData = await searchRes.json();
        if (searchData.customers && searchData.customers.length > 0) {
          customerId = searchData.customers[0].id;
        } else {
          throw new Error('Failed to create customer');
        }
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (parseInt(expiryDays) || 30));

      const res = await fetch('/api/stripe/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          line_items: items,
          expires_at: expiresAt.toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create quote');
      }
      setShowCreateModal(false);
      resetForm();
      await fetchQuotes();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create quote');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setCustomerEmail('');
    setCustomerName('');
    setLineItems([{ description: '', amount: '' }]);
    setExpiryDays('30');
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

  const getStatusLabel = (q: StripeQuote) => {
    if (isExpired(q)) return 'Expired';
    return q.status.charAt(0).toUpperCase() + q.status.slice(1);
  };

  const getStatusColor = (q: StripeQuote) => {
    if (isExpired(q)) return '#ef4444';
    return STATUS_COLORS[q.status] || Colors.text.muted;
  };

  const getStatusBg = (q: StripeQuote) => {
    if (isExpired(q)) return 'rgba(239, 68, 68, 0.15)';
    return STATUS_BG[q.status] || 'rgba(110, 110, 115, 0.15)';
  };

  const kpiCards = [
    { label: 'Total Quotes', value: `${totalQuotes}`, icon: 'pricetag-outline' as const, color: Colors.accent.blue },
    { label: 'Accepted', value: `${acceptedCount}`, icon: 'checkmark-circle-outline' as const, color: '#10B981' },
    { label: 'Pending', value: `${pendingCount}`, icon: 'time-outline' as const, color: '#f59e0b' },
    { label: 'Expired', value: `${expiredCount}`, icon: 'alert-circle-outline' as const, color: '#ef4444' },
  ];

  return (
    <FinanceHubShell>
      <View style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.pageTitle}>Quotes</Text>
            <Text style={s.pageSubtitle}>Create and manage customer quotes</Text>
          </View>
          <Pressable
            style={[s.createBtn, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={18} color={Colors.text.primary} />
            <Text style={s.createBtnText}>New Quote</Text>
          </Pressable>
        </View>

        <View style={s.kpiRow}>
          {kpiCards.map((kpi, idx) => (
            <View key={idx} style={[s.kpiCard, webOnly({ cursor: 'default' })]}>
              <View style={s.kpiHeader}>
                <View style={[s.kpiIconWrap, { backgroundColor: kpi.color + '20' }]}>
                  <Ionicons name={kpi.icon} size={18} color={kpi.color} />
                </View>
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
              <ActivityIndicator size="large" color={Colors.accent.blue} />
              <Text style={s.stateText}>Loading quotes...</Text>
            </View>
          ) : error ? (
            <View style={s.centerState}>
              <Ionicons name="alert-circle" size={40} color="#ef4444" />
              <Text style={s.stateText}>{error}</Text>
              <Pressable style={s.retryBtn} onPress={fetchQuotes}>
                <Text style={s.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : quotes.length === 0 ? (
            <View style={s.centerState}>
              <Ionicons name="pricetag-outline" size={48} color={Colors.text.muted} />
              <Text style={s.stateText}>No quotes found</Text>
              <Text style={s.stateSubtext}>Create your first quote to get started</Text>
            </View>
          ) : (
            <View>
              {Platform.OS === 'web' && (
                <View style={s.tableHeader}>
                  <Text style={[s.thCell, { flex: 1.2 }]}>Quote #</Text>
                  <Text style={[s.thCell, { flex: 1.5 }]}>Customer</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Amount</Text>
                  <Text style={[s.thCell, { flex: 0.8 }]}>Status</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Created</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Expires</Text>
                  <Text style={[s.thCell, { flex: 1.5 }]}>Actions</Text>
                </View>
              )}
              {quotes.map((q, idx) => (
                <View key={q.id} style={[s.tableRow, webOnly({ cursor: 'default', transition: 'background 0.15s ease' })]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1.2, gap: 10 }}>
                    <DocumentThumbnail type="contract" size="md" context="financehub" variant={idx} />
                    <Text style={[s.tdCell, { color: Colors.text.primary, fontWeight: '600' as const }]}>
                      {q.number || q.id.slice(0, 12)}
                    </Text>
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={[s.tdCell, { color: Colors.text.primary }]} numberOfLines={1}>
                      {q.customer || '—'}
                    </Text>
                  </View>
                  <Text style={[s.tdCell, { flex: 1, color: Colors.text.primary, fontWeight: '500' as const }]}>
                    {formatCents(q.amount_total || 0)}
                  </Text>
                  <View style={{ flex: 0.8 }}>
                    <View style={[s.statusBadge, { backgroundColor: getStatusBg(q) }]}>
                      <View style={[s.statusDot, { backgroundColor: getStatusColor(q) }]} />
                      <Text style={[s.statusText, { color: getStatusColor(q) }]}>{getStatusLabel(q)}</Text>
                    </View>
                  </View>
                  <Text style={[s.tdCell, { flex: 1 }]}>{formatDate(q.created)}</Text>
                  <Text style={[s.tdCell, { flex: 1 }]}>{formatDate(q.expires_at)}</Text>
                  <View style={[s.actionsCell, { flex: 1.5 }]}>
                    {q.status === 'draft' && (
                      <Pressable
                        style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                        onPress={() => handleAction(q.id, 'finalize')}
                        disabled={actionLoading === q.id}
                      >
                        <Ionicons name="checkmark-done-outline" size={14} color="#10B981" />
                      </Pressable>
                    )}
                    {q.status === 'open' && (
                      <Pressable
                        style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                        onPress={() => handleAction(q.id, 'accept')}
                        disabled={actionLoading === q.id}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
                      </Pressable>
                    )}
                    {(q.status === 'draft' || q.status === 'open') && (
                      <Pressable
                        style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                        onPress={() => handleAction(q.id, 'cancel')}
                        disabled={actionLoading === q.id}
                      >
                        <Ionicons name="close-circle-outline" size={14} color="#ef4444" />
                      </Pressable>
                    )}
                    {(q.status === 'open' || q.status === 'accepted') && (
                      <Pressable
                        style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                        onPress={() => handleDownloadPdf(q.id)}
                        disabled={actionLoading === q.id}
                      >
                        <Ionicons name="download-outline" size={14} color={Colors.accent.blue} />
                      </Pressable>
                    )}
                    {actionLoading === q.id && (
                      <ActivityIndicator size="small" color={Colors.accent.blue} style={{ marginLeft: 4 }} />
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
                name="close-circle-outline"
                size={36}
                color="#ef4444"
                style={{ alignSelf: 'center', marginBottom: 12 }}
              />
              <Text style={s.confirmTitle}>Cancel Quote?</Text>
              <Text style={s.confirmSubtext}>
                This will cancel the quote and it can no longer be accepted. This action cannot be undone.
              </Text>
              <View style={s.confirmActions}>
                <Pressable
                  style={[s.confirmCancelBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => setConfirmAction(null)}
                >
                  <Text style={s.confirmCancelText}>Go Back</Text>
                </Pressable>
                <Pressable
                  style={[s.confirmDeleteBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => confirmAction && executeAction(confirmAction.id, confirmAction.type)}
                >
                  <Text style={s.confirmDeleteText}>Cancel Quote</Text>
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
                <Text style={s.modalTitle}>Create Quote</Text>
                <Pressable
                  onPress={() => { setShowCreateModal(false); resetForm(); }}
                  style={webOnly({ cursor: 'pointer' })}
                >
                  <Ionicons name="close" size={22} color={Colors.text.muted} />
                </Pressable>
              </View>

              <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={s.fieldLabel}>Customer Email *</Text>
                <TextInput
                  style={s.textInput}
                  value={customerEmail}
                  onChangeText={setCustomerEmail}
                  placeholder="customer@example.com"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={s.fieldLabel}>Customer Name</Text>
                <TextInput
                  style={s.textInput}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.text.muted}
                />

                <View style={s.lineItemsHeader}>
                  <Text style={s.fieldLabel}>Line Items *</Text>
                  <Pressable onPress={addLineItem} style={[s.addItemBtn, webOnly({ cursor: 'pointer' })]}>
                    <Ionicons name="add-circle-outline" size={16} color={Colors.accent.blue} />
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
                      placeholderTextColor={Colors.text.muted}
                    />
                    <TextInput
                      style={[s.textInput, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                      value={item.amount}
                      onChangeText={(v) => updateLineItem(idx, 'amount', v)}
                      placeholder="Amount ($)"
                      placeholderTextColor={Colors.text.muted}
                      keyboardType="decimal-pad"
                    />
                    {lineItems.length > 1 && (
                      <Pressable onPress={() => removeLineItem(idx)} style={webOnly({ cursor: 'pointer' })}>
                        <Ionicons name="remove-circle" size={22} color="#ef4444" />
                      </Pressable>
                    )}
                  </View>
                ))}

                <Text style={s.fieldLabel}>Expiry Days</Text>
                <TextInput
                  style={s.textInput}
                  value={expiryDays}
                  onChangeText={setExpiryDays}
                  placeholder="30"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
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
                  style={[s.cancelModalBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => { setShowCreateModal(false); resetForm(); }}
                >
                  <Text style={s.cancelModalBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.submitBtn, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' }), creating && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color={Colors.text.primary} />
                  ) : (
                    <>
                      <Ionicons name="pricetag-outline" size={16} color={Colors.text.primary} />
                      <Text style={s.submitBtnText}>Create Quote</Text>
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
    backgroundColor: Colors.background.primary,
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
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: 4,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.blue,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  createBtnText: {
    color: Colors.text.primary,
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
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: Colors.text.muted,
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
    borderBottomColor: Colors.surface.cardBorder,
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
    borderBottomColor: Colors.accent.blue,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  filterTabTextActive: {
    color: Colors.accent.blue,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  stateText: {
    color: Colors.text.secondary,
    fontSize: 15,
    marginTop: 12,
  },
  stateSubtext: {
    color: Colors.text.muted,
    fontSize: 13,
    marginTop: 6,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.accent.blueLight,
  },
  retryBtnText: {
    color: Colors.accent.blue,
    fontWeight: '600',
    fontSize: 13,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface.cardBorder,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
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
    color: Colors.text.secondary,
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
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
    padding: 28,
    overflow: 'hidden',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmSubtext: {
    fontSize: 13,
    color: Colors.text.secondary,
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
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  createModal: {
    width: 540,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface.cardBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
    maxHeight: 420,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.text.primary,
    fontSize: 14,
    marginBottom: 16,
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
    fontSize: 13,
    color: Colors.accent.blue,
    fontWeight: '500',
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
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
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
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.surface.cardBorder,
  },
  cancelModalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelModalBtnText: {
    color: Colors.text.secondary,
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
    backgroundColor: Colors.accent.blue,
  },
  submitBtnText: {
    color: Colors.text.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
