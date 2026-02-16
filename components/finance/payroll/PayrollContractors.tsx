import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';

interface PayrollSubTabProps {
  gustoCompany: any;
  gustoEmployees: any[];
  gustoConnected: boolean;
}

function formatStatusLabel(status: string): string {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function PayrollContractors({ gustoCompany, gustoEmployees, gustoConnected }: PayrollSubTabProps) {
  const [contractors, setContractors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [contractorType, setContractorType] = useState<'Individual' | 'Business'>('Individual');
  const [wageType, setWageType] = useState<'hourly' | 'fixed'>('hourly');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContractors() {
      try {
        setLoading(true);
        const res = await fetch('/api/gusto/contractors');
        if (!res.ok) throw new Error('Failed to fetch contractors');
        const data = await res.json();
        setContractors(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message || 'Failed to load contractors');
      } finally {
        setLoading(false);
      }
    }
    if (gustoConnected) {
      fetchContractors();
    } else {
      setLoading(false);
    }
  }, [gustoConnected]);

  const handleAddContractor = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setFormError('Please fill in all required fields');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);
      const res = await fetch('/api/gusto/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          type: contractorType,
          wage_type: wageType,
        }),
      });

      if (!res.ok) throw new Error('Failed to add contractor');
      const newContractor = await res.json();
      setContractors([...contractors, newContractor]);
      
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setContractorType('Individual');
      setWageType('hourly');
      setShowForm(false);
    } catch (e: any) {
      setFormError(e.message || 'Failed to add contractor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setContractorType('Individual');
    setWageType('hourly');
    setFormError(null);
  };

  if (!gustoConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cloud-offline-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>Payroll Not Connected</Text>
        <Text style={styles.emptySubtitle}>Set up payroll in Connections to manage contractors.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading contractors...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
        </View>
        <Text style={styles.emptyTitle}>Error Loading Contractors</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  if (contractors.length === 0 && !showForm) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="briefcase-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>No Contractors</Text>
        <Text style={styles.emptySubtitle}>No contractor records found.</Text>
        <Pressable
          style={styles.emptyAddButton}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.emptyAddButtonText}>Add Contractor</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.sectionTitle}>Contractors</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{contractors.length}</Text>
          </View>
        </View>
        <Pressable
          style={styles.headerAddButton}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.headerAddButtonText}>Add</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={[styles.card, styles.formCard]}>
          <Text style={styles.formTitle}>Add New Contractor</Text>
          
          {formError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          )}

          <Text style={styles.inputLabel}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor="#6e6e73"
            value={firstName}
            onChangeText={setFirstName}
            editable={!formLoading}
          />

          <Text style={styles.inputLabel}>Last Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor="#6e6e73"
            value={lastName}
            onChangeText={setLastName}
            editable={!formLoading}
          />

          <Text style={styles.inputLabel}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#6e6e73"
            value={email}
            onChangeText={setEmail}
            editable={!formLoading}
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Contractor Type</Text>
          <View style={styles.toggleButtonGroup}>
            <Pressable
              style={[
                styles.toggleButton,
                contractorType === 'Individual' && styles.toggleButtonSelected,
              ]}
              onPress={() => setContractorType('Individual')}
              disabled={formLoading}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  contractorType === 'Individual' && styles.toggleButtonTextSelected,
                ]}
              >
                Individual
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                contractorType === 'Business' && styles.toggleButtonSelected,
              ]}
              onPress={() => setContractorType('Business')}
              disabled={formLoading}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  contractorType === 'Business' && styles.toggleButtonTextSelected,
                ]}
              >
                Business
              </Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Wage Type</Text>
          <View style={styles.toggleButtonGroup}>
            <Pressable
              style={[
                styles.toggleButton,
                wageType === 'hourly' && styles.toggleButtonSelected,
              ]}
              onPress={() => setWageType('hourly')}
              disabled={formLoading}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  wageType === 'hourly' && styles.toggleButtonTextSelected,
                ]}
              >
                Hourly
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                wageType === 'fixed' && styles.toggleButtonSelected,
              ]}
              onPress={() => setWageType('fixed')}
              disabled={formLoading}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  wageType === 'fixed' && styles.toggleButtonTextSelected,
                ]}
              >
                Fixed
              </Text>
            </Pressable>
          </View>

          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={formLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.submitButton, formLoading && { opacity: 0.6 }]}
              onPress={handleAddContractor}
              disabled={formLoading}
            >
              {formLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {contractors.map((c: any, idx: number) => {
        const id = c.uuid || c.id || `contractor-${idx}`;
        const isActive = c.is_active !== false;
        const isOnboarded = c.onboarding_status === 'onboarding_completed' || c.onboarding_status === 'completed';
        const name = c.type === 'Business'
          ? (c.business_name || `${c.first_name || ''} ${c.last_name || ''}`.trim())
          : `${c.first_name || ''} ${c.last_name || ''}`.trim();

        return (
          <Pressable
            key={id}
            style={[styles.card, idx % 2 === 0 && styles.cardEvenRow, hoveredId === id && styles.cardHovered]}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredId(id),
              onMouseLeave: () => setHoveredId(null),
            } as any : {})}
          >
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Ionicons name="briefcase-outline" size={18} color="#3B82F6" />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.contractorName}>{name || 'Unnamed Contractor'}</Text>
                {c.email && <Text style={styles.contractorEmail}>{c.email}</Text>}
              </View>
              <View style={styles.badgeRow}>
                <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' }, Platform.OS === 'web' ? { boxShadow: isActive ? '0 0 6px #10B98125' : '0 0 6px #ef444425' } as any : {}]}>
                  <Text style={[styles.statusText, { color: isActive ? '#10B981' : '#ef4444' }]}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isOnboarded ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' }, Platform.OS === 'web' ? { boxShadow: isOnboarded ? '0 0 6px #10B98125' : '0 0 6px #f59e0b25' } as any : {}]}>
                  <Text style={[styles.statusText, { color: isOnboarded ? '#10B981' : '#f59e0b' }]}>
                    {isOnboarded ? 'Onboarded' : 'Not Onboarded'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.cardDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Wage Type</Text>
                <Text style={styles.detailValue}>{c.wage_type === 'hourly' ? 'Hourly' : c.wage_type === 'fixed' ? 'Fixed' : formatStatusLabel(c.wage_type || '—')}</Text>
              </View>
              {c.hourly_rate && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Hourly Rate</Text>
                  <Text style={styles.detailValue}>${parseFloat(c.hourly_rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}/hr</Text>
                </View>
              )}
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Start Date</Text>
                <Text style={styles.detailValue}>{formatDate(c.start_date)}</Text>
              </View>
              {c.address && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{c.address?.city && c.address?.state ? `${c.address.city}, ${c.address.state}` : '—'}</Text>
                </View>
              )}
            </View>

            <View style={styles.cardActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}
                onPress={() => setEditingId(editingId === id ? null : id)}
              >
                <Ionicons name="pencil" size={16} color="#3B82F6" />
                <Text style={styles.editButtonText}>Edit</Text>
              </Pressable>

              <View style={styles.statusToggle}>
                <Text style={styles.toggleLabel}>{isActive ? 'Active' : 'Inactive'}</Text>
                <Pressable
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: isActive ? '#10B981' : '#6e6e73' },
                  ]}
                  onPress={() => {
                    // Toggle active status
                  }}
                >
                  <View
                    style={[
                      styles.toggleSwitchThumb,
                      { transform: [{ translateX: isActive ? 20 : 0 }] },
                    ]}
                  />
                </Pressable>
              </View>
            </View>

            {editingId === id && (
              <View style={styles.editingIndicator}>
                <Ionicons name="pencil-outline" size={14} color="#3B82F6" />
                <Text style={styles.editingText}>Editing mode</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  sectionTitle: {
    color: '#ffffff',
    ...Typography.headline,
  },
  countBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    color: '#3B82F6',
    ...Typography.smallMedium,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.15s ease',
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  cardEvenRow: {
    backgroundColor: 'rgba(28,28,30,0.7)',
  },
  cardHovered: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  contractorName: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  contractorEmail: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    ...Typography.small,
    fontWeight: '500',
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  detailItem: {
    minWidth: 120,
  },
  detailLabel: {
    color: '#6e6e73',
    ...Typography.small,
    marginBottom: 4,
  },
  detailValue: {
    color: '#d1d1d6',
    ...Typography.captionMedium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    ...Typography.headline,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6e6e73',
    ...Typography.caption,
    textAlign: 'center',
  },
  loadingText: {
    color: '#6e6e73',
    ...Typography.caption,
    marginTop: 12,
  },
  // Header Add Button
  headerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerAddButtonText: {
    color: '#ffffff',
    ...Typography.small,
    fontWeight: '600',
  },
  // Form Styles
  formCard: {
    marginBottom: 20,
  },
  formTitle: {
    color: '#ffffff',
    ...Typography.captionMedium,
    marginBottom: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#ef4444',
    ...Typography.small,
    flex: 1,
  },
  inputLabel: {
    color: '#d1d1d6',
    ...Typography.small,
    marginBottom: 8,
    marginTop: 12,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    ...Typography.small,
  },
  toggleButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonSelected: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: '#3B82F6',
  },
  toggleButtonText: {
    color: '#d1d1d6',
    ...Typography.small,
    fontWeight: '500',
  },
  toggleButtonTextSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    ...Typography.small,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#d1d1d6',
    ...Typography.small,
    fontWeight: '600',
  },
  // Action Row
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#3B82F6',
    ...Typography.small,
    fontWeight: '500',
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleLabel: {
    color: '#d1d1d6',
    ...Typography.small,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  toggleSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  editingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  editingText: {
    color: '#3B82F6',
    ...Typography.small,
    fontWeight: '500',
  },
  // Empty state with button
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 16,
  },
  emptyAddButtonText: {
    color: '#ffffff',
    ...Typography.small,
    fontWeight: '600',
  },
});
