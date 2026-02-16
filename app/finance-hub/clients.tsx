import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';

const webOnly = (styles: any) => Platform.OS === 'web' ? styles : {};

interface StripeAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface StripeCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  address: StripeAddress | null;
  created: number;
  metadata: Record<string, string>;
  invoice_settings: any;
}

interface StripeInvoice {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  status: string;
  created: number;
  due_date: number | null;
}

function formatCents(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isNewThisMonth(created: number): boolean {
  const now = new Date();
  const d = new Date(created * 1000);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  description: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

export default function ClientsPage() {
  const [customers, setCustomers] = useState<StripeCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<StripeCustomer | null>(null);
  const [detailInvoices, setDetailInvoices] = useState<StripeInvoice[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/customers?limit=100');
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = customers.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  const totalClients = customers.length;
  const newThisMonth = customers.filter(c => isNewThisMonth(c.created)).length;
  const activeClients = customers.filter(c => {
    const age = Date.now() / 1000 - c.created;
    return age < 90 * 24 * 60 * 60;
  }).length;

  const openDetail = async (customer: StripeCustomer) => {
    setSelectedClient(customer);
    setEditing(false);
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      description: customer.description || '',
      line1: customer.address?.line1 || '',
      line2: customer.address?.line2 || '',
      city: customer.address?.city || '',
      state: customer.address?.state || '',
      postal_code: customer.address?.postal_code || '',
      country: customer.address?.country || '',
    });
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/stripe/invoices?customer=${customer.id}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setDetailInvoices(data.invoices || []);
      } else {
        setDetailInvoices([]);
      }
    } catch {
      setDetailInvoices([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.email.trim()) {
      setFormError('Email is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const address = form.line1.trim() ? {
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        postal_code: form.postal_code.trim() || undefined,
        country: form.country.trim() || undefined,
      } : undefined;

      const res = await fetch('/api/stripe/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim() || undefined,
          phone: form.phone.trim() || undefined,
          description: form.description.trim() || undefined,
          address,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create client');
      }
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      await fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedClient) return;
    if (!form.email.trim()) {
      setFormError('Email is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const address = form.line1.trim() ? {
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        postal_code: form.postal_code.trim() || undefined,
        country: form.country.trim() || undefined,
      } : undefined;

      const res = await fetch(`/api/stripe/customers/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim() || undefined,
          phone: form.phone.trim() || undefined,
          description: form.description.trim() || undefined,
          address,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update client');
      }
      const updated = await res.json();
      setSelectedClient(updated);
      setEditing(false);
      await fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/stripe/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete client');
      }
      setConfirmDelete(null);
      setSelectedClient(null);
      await fetchCustomers();
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message);
      } else {
        Alert.alert('Error', err.message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    paid: '#10B981',
    open: '#f59e0b',
    draft: Colors.text.muted,
    void: Colors.text.muted,
    uncollectible: '#ef4444',
  };

  const kpiCards = [
    { label: 'Total Clients', value: totalClients.toString(), icon: 'people-outline' as const, color: Colors.accent.blue },
    { label: 'Active Clients', value: activeClients.toString(), icon: 'pulse-outline' as const, color: '#10B981' },
    { label: 'New This Month', value: newThisMonth.toString(), icon: 'person-add-outline' as const, color: '#f59e0b' },
  ];

  const renderFormFields = (isAdd: boolean) => (
    <>
      <Text style={s.fieldLabel}>Email *</Text>
      <TextInput
        style={s.textInput}
        value={form.email}
        onChangeText={v => setForm(f => ({ ...f, email: v }))}
        placeholder="client@example.com"
        placeholderTextColor={Colors.text.muted}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Text style={s.fieldLabel}>Name</Text>
      <TextInput
        style={s.textInput}
        value={form.name}
        onChangeText={v => setForm(f => ({ ...f, name: v }))}
        placeholder="John Doe"
        placeholderTextColor={Colors.text.muted}
      />
      <Text style={s.fieldLabel}>Phone</Text>
      <TextInput
        style={s.textInput}
        value={form.phone}
        onChangeText={v => setForm(f => ({ ...f, phone: v }))}
        placeholder="+1 555-0100"
        placeholderTextColor={Colors.text.muted}
        keyboardType="phone-pad"
      />
      <Text style={s.fieldLabel}>Description</Text>
      <TextInput
        style={[s.textInput, { minHeight: 60, textAlignVertical: 'top' }]}
        value={form.description}
        onChangeText={v => setForm(f => ({ ...f, description: v }))}
        placeholder="Optional notes"
        placeholderTextColor={Colors.text.muted}
        multiline
      />
      <Text style={s.fieldLabel}>Address</Text>
      <TextInput
        style={s.textInput}
        value={form.line1}
        onChangeText={v => setForm(f => ({ ...f, line1: v }))}
        placeholder="Street address"
        placeholderTextColor={Colors.text.muted}
      />
      <TextInput
        style={s.textInput}
        value={form.line2}
        onChangeText={v => setForm(f => ({ ...f, line2: v }))}
        placeholder="Apt, suite, etc."
        placeholderTextColor={Colors.text.muted}
      />
      <View style={s.addressRow}>
        <TextInput
          style={[s.textInput, { flex: 2, marginRight: 8 }]}
          value={form.city}
          onChangeText={v => setForm(f => ({ ...f, city: v }))}
          placeholder="City"
          placeholderTextColor={Colors.text.muted}
        />
        <TextInput
          style={[s.textInput, { flex: 1, marginRight: 8 }]}
          value={form.state}
          onChangeText={v => setForm(f => ({ ...f, state: v }))}
          placeholder="State"
          placeholderTextColor={Colors.text.muted}
        />
        <TextInput
          style={[s.textInput, { flex: 1 }]}
          value={form.postal_code}
          onChangeText={v => setForm(f => ({ ...f, postal_code: v }))}
          placeholder="ZIP"
          placeholderTextColor={Colors.text.muted}
        />
      </View>
      <TextInput
        style={s.textInput}
        value={form.country}
        onChangeText={v => setForm(f => ({ ...f, country: v }))}
        placeholder="Country (e.g. US)"
        placeholderTextColor={Colors.text.muted}
        autoCapitalize="characters"
      />
      {formError && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text style={s.errorText}>{formError}</Text>
        </View>
      )}
    </>
  );

  return (
    <FinanceHubShell>
      <View style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.pageTitle}>Clients</Text>
            <Text style={s.pageSubtitle}>Manage your Stripe customers</Text>
          </View>
          <Pressable
            style={[s.createBtn, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
            onPress={() => { setForm(EMPTY_FORM); setFormError(null); setShowAddModal(true); }}
          >
            <Ionicons name="person-add-outline" size={16} color="#fff" />
            <Text style={s.createBtnText}>Add Client</Text>
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

        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={18} color={Colors.text.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search clients by name or email..."
              placeholderTextColor={Colors.text.muted}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} style={webOnly({ cursor: 'pointer' })}>
                <Ionicons name="close-circle" size={18} color={Colors.text.muted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[s.listCard, Platform.OS === 'web' && { backgroundImage: svgPatterns.people(), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '15% auto' } as any]}>
          {loading ? (
            <View style={s.centerState}>
              <ActivityIndicator size="large" color={Colors.accent.blue} />
              <Text style={s.stateText}>Loading clients...</Text>
            </View>
          ) : error ? (
            <View style={s.centerState}>
              <Ionicons name="alert-circle" size={40} color="#ef4444" />
              <Text style={s.stateText}>{error}</Text>
              <Pressable style={s.retryBtn} onPress={fetchCustomers}>
                <Text style={s.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.centerState}>
              <Ionicons name="people-outline" size={48} color={Colors.text.muted} />
              <Text style={s.stateText}>{search ? 'No clients match your search' : 'No clients yet'}</Text>
              <Text style={s.stateSubtext}>{search ? 'Try a different search term' : 'Add your first client to get started'}</Text>
            </View>
          ) : (
            <View>
              {Platform.OS === 'web' && (
                <View style={s.tableHeader}>
                  <Text style={[s.thCell, { flex: 1.5 }]}>Name</Text>
                  <Text style={[s.thCell, { flex: 2 }]}>Email</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Phone</Text>
                  <Text style={[s.thCell, { flex: 1 }]}>Created</Text>
                  <Text style={[s.thCell, { flex: 0.8 }]}>Actions</Text>
                </View>
              )}
              {filtered.map(customer => (
                <Pressable
                  key={customer.id}
                  style={[s.tableRow, webOnly({ cursor: 'pointer', transition: 'background 0.15s ease' })]}
                  onPress={() => openDetail(customer)}
                >
                  <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>
                        {(customer.name || customer.email || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[s.tdCell, { color: Colors.text.primary, fontWeight: '600' }]} numberOfLines={1}>
                      {customer.name || '—'}
                    </Text>
                  </View>
                  <Text style={[s.tdCell, { flex: 2, color: Colors.text.secondary }]} numberOfLines={1}>
                    {customer.email || '—'}
                  </Text>
                  <Text style={[s.tdCell, { flex: 1, color: Colors.text.secondary }]} numberOfLines={1}>
                    {customer.phone || '—'}
                  </Text>
                  <Text style={[s.tdCell, { flex: 1, color: Colors.text.muted }]}>
                    {formatDate(customer.created)}
                  </Text>
                  <View style={[s.actionsCell, { flex: 0.8 }]}>
                    <Pressable
                      style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                      onPress={(e) => { e.stopPropagation(); openDetail(customer); }}
                    >
                      <Ionicons name="eye-outline" size={14} color={Colors.accent.blue} />
                    </Pressable>
                    <Pressable
                      style={[s.actionBtn, webOnly({ cursor: 'pointer' })]}
                      onPress={(e) => { e.stopPropagation(); setConfirmDelete(customer.id); }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Add Client Modal */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="fade"
          onRequestClose={() => { setShowAddModal(false); setForm(EMPTY_FORM); setFormError(null); }}
        >
          <View style={s.modalOverlay}>
            <View style={s.formModal}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Add Client</Text>
                <Pressable
                  onPress={() => { setShowAddModal(false); setForm(EMPTY_FORM); setFormError(null); }}
                  style={webOnly({ cursor: 'pointer' })}
                >
                  <Ionicons name="close" size={22} color={Colors.text.muted} />
                </Pressable>
              </View>
              <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                {renderFormFields(true)}
              </ScrollView>
              <View style={s.modalFooter}>
                <Pressable
                  style={[s.cancelBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => { setShowAddModal(false); setForm(EMPTY_FORM); setFormError(null); }}
                >
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.submitBtn, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' }), saving && { opacity: 0.6 }]}
                  onPress={handleAdd}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={16} color="#fff" />
                      <Text style={s.submitBtnText}>Create Client</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Client Detail Modal */}
        <Modal
          visible={!!selectedClient}
          transparent
          animationType="fade"
          onRequestClose={() => { setSelectedClient(null); setEditing(false); setFormError(null); }}
        >
          <View style={s.modalOverlay}>
            <View style={s.detailModal}>
              <View style={s.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[s.avatar, { width: 36, height: 36 }]}>
                    <Text style={[s.avatarText, { fontSize: 16 }]}>
                      {(selectedClient?.name || selectedClient?.email || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={s.modalTitle}>
                    {editing ? 'Edit Client' : (selectedClient?.name || selectedClient?.email || 'Client')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {!editing && (
                    <Pressable
                      style={[s.headerActionBtn, webOnly({ cursor: 'pointer' })]}
                      onPress={() => { setEditing(true); setFormError(null); }}
                    >
                      <Ionicons name="create-outline" size={16} color={Colors.accent.blue} />
                      <Text style={s.headerActionText}>Edit</Text>
                    </Pressable>
                  )}
                  {!editing && (
                    <Pressable
                      style={[s.headerActionBtn, s.headerDeleteBtn, webOnly({ cursor: 'pointer' })]}
                      onPress={() => selectedClient && setConfirmDelete(selectedClient.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => { setSelectedClient(null); setEditing(false); setFormError(null); }}
                    style={webOnly({ cursor: 'pointer' })}
                  >
                    <Ionicons name="close" size={22} color={Colors.text.muted} />
                  </Pressable>
                </View>
              </View>

              <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                {editing ? (
                  <>
                    {renderFormFields(false)}
                    <View style={[s.modalFooter, { paddingHorizontal: 0 }]}>
                      <Pressable
                        style={[s.cancelBtn, webOnly({ cursor: 'pointer' })]}
                        onPress={() => {
                          setEditing(false);
                          setFormError(null);
                          if (selectedClient) {
                            setForm({
                              name: selectedClient.name || '',
                              email: selectedClient.email || '',
                              phone: selectedClient.phone || '',
                              description: selectedClient.description || '',
                              line1: selectedClient.address?.line1 || '',
                              line2: selectedClient.address?.line2 || '',
                              city: selectedClient.address?.city || '',
                              state: selectedClient.address?.state || '',
                              postal_code: selectedClient.address?.postal_code || '',
                              country: selectedClient.address?.country || '',
                            });
                          }
                        }}
                      >
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[s.submitBtn, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' }), saving && { opacity: 0.6 }]}
                        onPress={handleUpdate}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-outline" size={16} color="#fff" />
                            <Text style={s.submitBtnText}>Save Changes</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={s.detailSection}>
                      <Text style={s.detailSectionTitle}>Contact Information</Text>
                      <View style={s.detailRow}>
                        <Ionicons name="mail-outline" size={16} color={Colors.text.muted} />
                        <Text style={s.detailLabel}>Email</Text>
                        <Text style={s.detailValue}>{selectedClient?.email || '—'}</Text>
                      </View>
                      <View style={s.detailRow}>
                        <Ionicons name="call-outline" size={16} color={Colors.text.muted} />
                        <Text style={s.detailLabel}>Phone</Text>
                        <Text style={s.detailValue}>{selectedClient?.phone || '—'}</Text>
                      </View>
                      <View style={s.detailRow}>
                        <Ionicons name="calendar-outline" size={16} color={Colors.text.muted} />
                        <Text style={s.detailLabel}>Created</Text>
                        <Text style={s.detailValue}>{formatDate(selectedClient?.created ?? null)}</Text>
                      </View>
                      {selectedClient?.description && (
                        <View style={s.detailRow}>
                          <Ionicons name="document-text-outline" size={16} color={Colors.text.muted} />
                          <Text style={s.detailLabel}>Notes</Text>
                          <Text style={[s.detailValue, { flex: 1 }]}>{selectedClient.description}</Text>
                        </View>
                      )}
                    </View>

                    {selectedClient?.address?.line1 && (
                      <View style={s.detailSection}>
                        <Text style={s.detailSectionTitle}>Address</Text>
                        <Text style={s.addressText}>{selectedClient.address.line1}</Text>
                        {selectedClient.address.line2 && <Text style={s.addressText}>{selectedClient.address.line2}</Text>}
                        <Text style={s.addressText}>
                          {[selectedClient.address.city, selectedClient.address.state, selectedClient.address.postal_code].filter(Boolean).join(', ')}
                        </Text>
                        {selectedClient.address.country && <Text style={s.addressText}>{selectedClient.address.country}</Text>}
                      </View>
                    )}

                    <View style={s.detailSection}>
                      <Text style={s.detailSectionTitle}>Invoices</Text>
                      {detailLoading ? (
                        <ActivityIndicator size="small" color={Colors.accent.blue} style={{ marginTop: 12 }} />
                      ) : detailInvoices.length === 0 ? (
                        <Text style={s.noInvoicesText}>No invoices found for this client</Text>
                      ) : (
                        detailInvoices.map(inv => (
                          <View key={inv.id} style={s.invoiceRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.invoiceNumber}>{inv.number || inv.id.slice(0, 16)}</Text>
                              <Text style={s.invoiceDate}>{formatDate(inv.created)}</Text>
                            </View>
                            <Text style={s.invoiceAmount}>{formatCents(inv.amount_due)}</Text>
                            <View style={[s.invoiceStatusBadge, { backgroundColor: (STATUS_COLORS[inv.status] || Colors.text.muted) + '20' }]}>
                              <Text style={[s.invoiceStatusText, { color: STATUS_COLORS[inv.status] || Colors.text.muted }]}>
                                {inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : '—'}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={!!confirmDelete}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmDelete(null)}
        >
          <View style={s.modalOverlay}>
            <View style={s.confirmModal}>
              <Ionicons name="trash-outline" size={36} color="#ef4444" style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={s.confirmTitle}>Delete Client?</Text>
              <Text style={s.confirmSubtext}>
                This will permanently delete this customer from Stripe. Any associated data will be lost. This action cannot be undone.
              </Text>
              <View style={s.confirmActions}>
                <Pressable
                  style={[s.confirmCancelBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={() => setConfirmDelete(null)}
                >
                  <Text style={s.confirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.confirmDeleteBtn, webOnly({ cursor: 'pointer' }), deleting && { opacity: 0.6 }]}
                  onPress={() => confirmDelete && handleDelete(confirmDelete)}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.confirmDeleteText}>Delete</Text>
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
    ...Typography.display,
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    ...Typography.caption,
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
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  kpiLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  searchRow: {
    marginBottom: 16,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
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
    borderBottomColor: Colors.border.subtle,
  },
  thCell: {
    ...Typography.micro,
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
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent.blue,
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
  formModal: {
    width: 520,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
    overflow: 'hidden',
  },
  detailModal: {
    width: 580,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
    overflow: 'hidden',
  },
  confirmModal: {
    width: 380,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
    padding: 28,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  modalTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  fieldLabel: {
    ...Typography.smallMedium,
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 4,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelBtnText: {
    color: Colors.text.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.accent.blue,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.accent.blueLight,
  },
  headerActionText: {
    color: Colors.accent.blue,
    fontSize: 13,
    fontWeight: '600',
  },
  headerDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    ...Typography.captionMedium,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.text.muted,
    width: 70,
  },
  detailValue: {
    ...Typography.caption,
    color: Colors.text.primary,
  },
  addressText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  noInvoicesText: {
    ...Typography.caption,
    color: Colors.text.muted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  invoiceNumber: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  invoiceDate: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },
  invoiceAmount: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  invoiceStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  invoiceStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confirmTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmSubtext: {
    ...Typography.caption,
    color: Colors.text.muted,
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
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
