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

export function PayrollTimeOff({ gustoCompany, gustoEmployees, gustoConnected }: PayrollSubTabProps) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Policy form state
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    name: '',
    policy_type: 'vacation',
    accrual_method: 'per_pay_period',
    accrual_rate: '',
    max_accrual_hours_per_year: '',
  });
  const [policySubmitting, setPolicySubmitting] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  // Request form state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    employee_uuid: '',
    policy_uuid: '',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Fetch policies
  useEffect(() => {
    async function fetchPolicies() {
      try {
        setLoading(true);
        const res = await fetch('/api/gusto/time-off-policies');
        if (!res.ok) throw new Error('Failed to fetch time-off policies');
        const data = await res.json();
        setPolicies(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message || 'Failed to load time-off policies');
      } finally {
        setLoading(false);
      }
    }
    if (gustoConnected) {
      fetchPolicies();
    } else {
      setLoading(false);
    }
  }, [gustoConnected]);

  // Fetch time-off requests
  useEffect(() => {
    async function fetchRequests() {
      try {
        setRequestsLoading(true);
        const res = await fetch('/api/gusto/time-off-requests');
        if (!res.ok) throw new Error('Failed to fetch time-off requests');
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      } catch (e: any) {
        console.error('Failed to load time-off requests:', e);
      } finally {
        setRequestsLoading(false);
      }
    }
    if (gustoConnected && policies.length > 0) {
      fetchRequests();
    }
  }, [gustoConnected, policies.length]);

  // Handle policy form submission
  async function handleCreatePolicy() {
    if (!policyForm.name.trim()) {
      setPolicyError('Policy name is required');
      return;
    }

    try {
      setPolicySubmitting(true);
      setPolicyError(null);
      const res = await fetch('/api/gusto/time-off-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: policyForm.name,
          policy_type: policyForm.policy_type,
          accrual_method: policyForm.accrual_method,
          accrual_rate: policyForm.accrual_rate ? parseFloat(policyForm.accrual_rate) : null,
          max_accrual_hours_per_year: policyForm.max_accrual_hours_per_year
            ? parseFloat(policyForm.max_accrual_hours_per_year)
            : null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create policy');
      }

      setPolicyForm({
        name: '',
        policy_type: 'vacation',
        accrual_method: 'per_pay_period',
        accrual_rate: '',
        max_accrual_hours_per_year: '',
      });
      setShowPolicyForm(false);

      // Re-fetch policies
      const policiesRes = await fetch('/api/gusto/time-off-policies');
      if (policiesRes.ok) {
        const data = await policiesRes.json();
        setPolicies(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
      setPolicyError(e.message || 'Failed to create policy');
    } finally {
      setPolicySubmitting(false);
    }
  }

  // Handle request form submission
  async function handleSubmitRequest() {
    if (!requestForm.employee_uuid.trim() || !requestForm.policy_uuid.trim() || !requestForm.start_date.trim() || !requestForm.end_date.trim()) {
      setRequestError('All required fields must be filled');
      return;
    }

    try {
      setRequestSubmitting(true);
      setRequestError(null);
      const res = await fetch('/api/gusto/time-off-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_uuid: requestForm.employee_uuid,
          policy_uuid: requestForm.policy_uuid,
          start_date: requestForm.start_date,
          end_date: requestForm.end_date,
          notes: requestForm.notes,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to submit request');
      }

      setRequestForm({
        employee_uuid: '',
        policy_uuid: '',
        start_date: '',
        end_date: '',
        notes: '',
      });
      setShowRequestForm(false);

      // Re-fetch requests
      const requestsRes = await fetch('/api/gusto/time-off-requests');
      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
      setRequestError(e.message || 'Failed to submit request');
    } finally {
      setRequestSubmitting(false);
    }
  }

  const employeePTO = (gustoEmployees || []).filter(
    (e: any) => e.eligible_paid_time_off && e.eligible_paid_time_off.length > 0
  );

  if (!gustoConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cloud-offline-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>Payroll Not Connected</Text>
        <Text style={styles.emptySubtitle}>Set up payroll in Connections to view time-off policies.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading time-off policies...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
        </View>
        <Text style={styles.emptyTitle}>Error Loading Policies</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Time Off Policies</Text>
        {policies.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.requestBtn, pressed && styles.requestBtnPressed]}
            onPress={() => setShowRequestForm(true)}
          >
            <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
            <Text style={styles.requestBtnText}>Request Time Off</Text>
          </Pressable>
        )}
      </View>

      {policies.length === 0 ? (
        <View style={styles.emptyPolicies}>
          <View style={styles.emptyPoliciesIcon}>
            <Ionicons name="calendar-outline" size={28} color="#6e6e73" />
          </View>
          <Text style={styles.emptyPoliciesTitle}>No Time Off Policies Configured</Text>
          <Text style={styles.emptyPoliciesSubtitle}>
            Set up time-off policies to track vacation, sick leave, and other PTO types for your team.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.setupBtn, pressed && styles.setupBtnPressed]}
            onPress={() => setShowPolicyForm(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
            <Text style={styles.setupBtnText}>Set Up Policies</Text>
          </Pressable>

          {showPolicyForm && (
            <View style={[styles.formCard, { marginTop: 24 }]}>
              <Text style={styles.formTitle}>Create New Policy</Text>

              {policyError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{policyError}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Policy Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Vacation Days"
                  placeholderTextColor="#6e6e73"
                  value={policyForm.name}
                  onChangeText={(text) => setPolicyForm({ ...policyForm, name: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Policy Type *</Text>
                <View style={styles.toggleGroup}>
                  {['vacation', 'sick', 'personal'].map((type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.toggleBtn,
                        policyForm.policy_type === type && styles.toggleBtnSelected,
                      ]}
                      onPress={() => setPolicyForm({ ...policyForm, policy_type: type })}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          policyForm.policy_type === type && styles.toggleBtnTextSelected,
                        ]}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Accrual Method *</Text>
                <View style={styles.toggleGroup}>
                  {['per_pay_period', 'per_year', 'unlimited'].map((method) => (
                    <Pressable
                      key={method}
                      style={[
                        styles.toggleBtn,
                        policyForm.accrual_method === method && styles.toggleBtnSelected,
                      ]}
                      onPress={() => setPolicyForm({ ...policyForm, accrual_method: method })}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          policyForm.accrual_method === method && styles.toggleBtnTextSelected,
                        ]}
                      >
                        {method === 'per_pay_period' ? 'Per Pay Period' : method === 'per_year' ? 'Per Year' : 'Unlimited'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {policyForm.accrual_method !== 'unlimited' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Accrual Rate (hours per period)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 2.5"
                      placeholderTextColor="#6e6e73"
                      keyboardType="decimal-pad"
                      value={policyForm.accrual_rate}
                      onChangeText={(text) => setPolicyForm({ ...policyForm, accrual_rate: text })}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Max Accrual Hours Per Year</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 30"
                      placeholderTextColor="#6e6e73"
                      keyboardType="decimal-pad"
                      value={policyForm.max_accrual_hours_per_year}
                      onChangeText={(text) => setPolicyForm({ ...policyForm, max_accrual_hours_per_year: text })}
                    />
                  </View>
                </>
              )}

              <View style={styles.formActions}>
                <Pressable
                  style={[styles.cancelBtn, { opacity: policySubmitting ? 0.6 : 1 }]}
                  onPress={() => {
                    setShowPolicyForm(false);
                    setPolicyError(null);
                  }}
                  disabled={policySubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, { opacity: policySubmitting ? 0.6 : 1 }]}
                  onPress={handleCreatePolicy}
                  disabled={policySubmitting}
                >
                  {policySubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Create Policy</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ) : (
        <>
          <View style={styles.policiesGrid}>
            {policies.map((policy: any, idx: number) => (
              <View key={policy.uuid || policy.id || idx} style={styles.policyCard}>
                <View style={styles.policyHeader}>
                  <View style={styles.policyIcon}>
                    <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.policyName}>{policy.name || 'Unnamed Policy'}</Text>
                    {policy.policy_type && (
                      <Text style={styles.policyType}>{formatStatusLabel(policy.policy_type)}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.policyDetails}>
                  {policy.accrual_method && (
                    <View style={styles.policyDetail}>
                      <Text style={styles.policyDetailLabel}>Accrual Method</Text>
                      <Text style={styles.policyDetailValue}>{formatStatusLabel(policy.accrual_method)}</Text>
                    </View>
                  )}
                  {policy.accrual_rate && (
                    <View style={styles.policyDetail}>
                      <Text style={styles.policyDetailLabel}>Accrual Rate</Text>
                      <Text style={styles.policyDetailValue}>{policy.accrual_rate} hrs/{policy.accrual_period || 'period'}</Text>
                    </View>
                  )}
                  {policy.max_accrual_hours_per_year && (
                    <View style={styles.policyDetail}>
                      <Text style={styles.policyDetailLabel}>Max Accrual/Year</Text>
                      <Text style={styles.policyDetailValue}>{policy.max_accrual_hours_per_year} hrs</Text>
                    </View>
                  )}
                  {policy.max_hours && (
                    <View style={styles.policyDetail}>
                      <Text style={styles.policyDetailLabel}>Max Balance</Text>
                      <Text style={styles.policyDetailValue}>{policy.max_hours} hrs</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          {showRequestForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Request Time Off</Text>

              {requestError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{requestError}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Employee *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Select employee"
                  placeholderTextColor="#6e6e73"
                  value={requestForm.employee_uuid}
                  onChangeText={(text) => setRequestForm({ ...requestForm, employee_uuid: text })}
                />
                {gustoEmployees.length > 0 && (
                  <View style={styles.dropdownHint}>
                    {gustoEmployees.slice(0, 3).map((emp: any) => (
                      <Pressable
                        key={emp.uuid || emp.id}
                        onPress={() => setRequestForm({ ...requestForm, employee_uuid: emp.uuid || emp.id })}
                        style={styles.dropdownItem}
                      >
                        <Text style={styles.dropdownItemText}>
                          {emp.first_name} {emp.last_name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Policy *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Select policy"
                  placeholderTextColor="#6e6e73"
                  value={requestForm.policy_uuid}
                  onChangeText={(text) => setRequestForm({ ...requestForm, policy_uuid: text })}
                />
                {policies.length > 0 && (
                  <View style={styles.dropdownHint}>
                    {policies.map((policy: any) => (
                      <Pressable
                        key={policy.uuid || policy.id}
                        onPress={() => setRequestForm({ ...requestForm, policy_uuid: policy.uuid || policy.id })}
                        style={styles.dropdownItem}
                      >
                        <Text style={styles.dropdownItemText}>{policy.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Start Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6e6e73"
                  value={requestForm.start_date}
                  onChangeText={(text) => setRequestForm({ ...requestForm, start_date: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>End Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6e6e73"
                  value={requestForm.end_date}
                  onChangeText={(text) => setRequestForm({ ...requestForm, end_date: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textAreaInput]}
                  placeholder="Any additional notes..."
                  placeholderTextColor="#6e6e73"
                  multiline
                  numberOfLines={3}
                  value={requestForm.notes}
                  onChangeText={(text) => setRequestForm({ ...requestForm, notes: text })}
                />
              </View>

              <View style={styles.formActions}>
                <Pressable
                  style={[styles.cancelBtn, { opacity: requestSubmitting ? 0.6 : 1 }]}
                  onPress={() => {
                    setShowRequestForm(false);
                    setRequestError(null);
                  }}
                  disabled={requestSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, { opacity: requestSubmitting ? 0.6 : 1 }]}
                  onPress={handleSubmitRequest}
                  disabled={requestSubmitting}
                >
                  {requestSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Request</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}

      {employeePTO.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Employee PTO Balances</Text>
          {employeePTO.map((emp: any) => {
            const id = emp.uuid || emp.id;
            return (
              <View key={id} style={styles.ptoCard}>
                <View style={styles.ptoHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {`${(emp.first_name || '')[0] || ''}${(emp.last_name || '')[0] || ''}`.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ptoName}>{emp.first_name} {emp.last_name}</Text>
                    <Text style={styles.ptoRole}>{emp.jobs?.[0]?.title || '—'}</Text>
                  </View>
                </View>
                <View style={styles.ptoBalances}>
                  {emp.eligible_paid_time_off.map((pto: any, i: number) => (
                    <View key={i} style={styles.ptoBalanceItem}>
                      <Text style={styles.ptoBalanceLabel}>{pto.name}</Text>
                      <View style={styles.ptoBalanceRow}>
                        <View style={styles.ptoStat}>
                          <Text style={styles.ptoStatValue}>{pto.accrued_hours || 0}</Text>
                          <Text style={styles.ptoStatLabel}>Accrued</Text>
                        </View>
                        <View style={styles.ptoStat}>
                          <Text style={styles.ptoStatValue}>{pto.used_hours || 0}</Text>
                          <Text style={styles.ptoStatLabel}>Used</Text>
                        </View>
                        <View style={styles.ptoStat}>
                          <Text style={[styles.ptoStatValue, { color: '#3B82F6' }]}>
                            {((pto.accrued_hours || 0) - (pto.used_hours || 0)).toFixed(1)}
                          </Text>
                          <Text style={styles.ptoStatLabel}>Available</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </>
      )}

      {requests.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Recent Requests</Text>
          {requestsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
            </View>
          ) : (
            <View style={styles.requestsGrid}>
              {requests.map((request: any, idx: number) => (
                <View key={request.uuid || request.id || idx} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestName}>
                        {request.employee_name || `Employee ${idx + 1}`}
                      </Text>
                      <Text style={styles.requestPolicy}>
                        {request.policy_name || 'Unknown Policy'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        request.status === 'approved'
                          ? styles.statusApproved
                          : request.status === 'denied'
                          ? styles.statusDenied
                          : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          request.status === 'approved'
                            ? styles.statusApprovedText
                            : request.status === 'denied'
                            ? styles.statusDeniedText
                            : styles.statusPendingText,
                        ]}
                      >
                        {formatStatusLabel(request.status || 'pending')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.requestDetails}>
                    <View style={styles.requestDate}>
                      <Ionicons name="calendar-outline" size={14} color="#6e6e73" />
                      <Text style={styles.requestDateText}>
                        {request.start_date} to {request.end_date}
                      </Text>
                    </View>
                    {request.notes && (
                      <Text style={styles.requestNotes}>{request.notes}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  sectionTitle: {
    color: '#ffffff',
    ...Typography.headline,
    flex: 1,
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any : {}),
  },
  requestBtnPressed: {
    opacity: 0.8,
  },
  requestBtnText: {
    color: '#ffffff',
    ...Typography.small,
    fontWeight: '600',
  },
  policiesGrid: {
    gap: 10,
  },
  policyCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  policyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyName: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  policyType: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
  },
  policyDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  policyDetail: {
    minWidth: 120,
  },
  policyDetailLabel: {
    color: '#6e6e73',
    ...Typography.small,
    marginBottom: 4,
  },
  policyDetailValue: {
    color: '#d1d1d6',
    ...Typography.captionMedium,
  },
  emptyPolicies: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  emptyPoliciesIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyPoliciesTitle: {
    color: '#ffffff',
    ...Typography.captionMedium,
    marginBottom: 8,
  },
  emptyPoliciesSubtitle: {
    color: '#6e6e73',
    ...Typography.caption,
    textAlign: 'center',
    maxWidth: 400,
    marginBottom: 20,
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any : {}),
  },
  setupBtnPressed: {
    opacity: 0.8,
  },
  setupBtnText: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  ptoCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  ptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#3B82F6',
    ...Typography.smallMedium,
    fontWeight: '600',
  },
  ptoName: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  ptoRole: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 1,
  },
  ptoBalances: {
    gap: 12,
  },
  ptoBalanceItem: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  ptoBalanceLabel: {
    color: '#d1d1d6',
    ...Typography.smallMedium,
    marginBottom: 10,
  },
  ptoBalanceRow: {
    flexDirection: 'row',
    gap: 24,
  },
  ptoStat: {
    alignItems: 'center',
  },
  ptoStatValue: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  ptoStatLabel: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
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
  formCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 20,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  formTitle: {
    color: '#ffffff',
    ...Typography.captionMedium,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#d1d1d6',
    ...Typography.small,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    ...Typography.body,
  },
  textAreaInput: {
    textAlignVertical: 'top' as any,
    minHeight: 80,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  toggleBtnSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  toggleBtnText: {
    color: '#d1d1d6',
    ...Typography.small,
    fontWeight: '500',
  },
  toggleBtnTextSelected: {
    color: '#3B82F6',
  },
  dropdownHint: {
    marginTop: 8,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  dropdownItemText: {
    color: '#ffffff',
    ...Typography.small,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  cancelBtnText: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  submitBtnText: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    ...Typography.small,
    flex: 1,
  },
  requestsGrid: {
    gap: 10,
  },
  requestCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  requestName: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  requestPolicy: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  statusApprovedText: {
    color: '#34c759',
  },
  statusPending: {
    backgroundColor: 'rgba(212, 160, 23, 0.15)',
    borderColor: 'rgba(212, 160, 23, 0.4)',
  },
  statusPendingText: {
    color: '#d4a017',
  },
  statusDenied: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusDeniedText: {
    color: '#ef4444',
  },
  statusBadgeText: {
    ...Typography.micro,
    fontWeight: '600',
  },
  requestDetails: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  requestDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestDateText: {
    color: '#d1d1d6',
    ...Typography.small,
  },
  requestNotes: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
