import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, ActivityIndicator, Pressable, TextInput } from 'react-native';
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

export function PayrollTaxCompliance({ gustoCompany, gustoEmployees, gustoConnected }: PayrollSubTabProps) {
  const [taxDetails, setTaxDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [employeeTaxData, setEmployeeTaxData] = useState<{ [key: string]: any }>({});
  const [editedValues, setEditedValues] = useState({
    filing_form: '',
    deposit_schedule: '',
    tax_payer_type: '',
  });

  useEffect(() => {
    async function fetchTaxDetails() {
      try {
        setLoading(true);
        const res = await fetch('/api/gusto/federal-tax-details');
        if (!res.ok) throw new Error('Failed to fetch tax details');
        const data = await res.json();
        setTaxDetails(data);
        setEditedValues({
          filing_form: data?.filing_form || '',
          deposit_schedule: data?.deposit_schedule || '',
          tax_payer_type: data?.tax_payer_type || '',
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load tax details');
      } finally {
        setLoading(false);
      }
    }
    if (gustoConnected) {
      fetchTaxDetails();
    } else {
      setLoading(false);
    }
  }, [gustoConnected]);

  const handleSaveChanges = async () => {
    try {
      setSavingChanges(true);
      const res = await fetch('/api/gusto/federal-tax-details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filing_form: editedValues.filing_form,
          deposit_schedule: editedValues.deposit_schedule,
          tax_payer_type: editedValues.tax_payer_type,
        }),
      });
      if (!res.ok) throw new Error('Failed to update tax details');
      const updated = await res.json();
      setTaxDetails(updated);
      setIsEditing(false);
    } catch (e: any) {
      console.error('Error saving changes:', e);
    } finally {
      setSavingChanges(false);
    }
  };

  const handleCancel = () => {
    setEditedValues({
      filing_form: taxDetails?.filing_form || '',
      deposit_schedule: taxDetails?.deposit_schedule || '',
      tax_payer_type: taxDetails?.tax_payer_type || '',
    });
    setIsEditing(false);
  };

  const fetchEmployeeTaxData = async (employeeUuid: string) => {
    try {
      const res = await fetch(`/api/gusto/employees/${employeeUuid}/federal-taxes`);
      if (!res.ok) throw new Error('Failed to fetch employee tax data');
      const data = await res.json();
      setEmployeeTaxData(prev => ({ ...prev, [employeeUuid]: data }));
    } catch (e: any) {
      console.error('Error fetching employee tax data:', e);
    }
  };

  const toggleOption = (field: 'filing_form' | 'deposit_schedule' | 'tax_payer_type', value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [field]: prev[field] === value ? '' : value,
    }));
  };

  if (!gustoConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cloud-offline-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>Payroll Not Connected</Text>
        <Text style={styles.emptySubtitle}>Set up payroll in Connections to view tax and compliance details.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading tax details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
        </View>
        <Text style={styles.emptyTitle}>Error Loading Tax Details</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  const companyName = gustoCompany?.name || gustoCompany?.trade_name || '—';
  const einVerified = taxDetails?.ein_verified === true;

  const complianceChecks: { label: string; status: 'verified' | 'default' | 'pending'; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      label: 'EIN Verification',
      status: einVerified ? 'verified' : 'pending',
      description: einVerified ? 'Employer Identification Number verified with the IRS' : 'EIN verification pending',
      icon: 'shield-checkmark-outline',
    },
    {
      label: 'Federal Tax Filing',
      status: taxDetails?.filing_form ? 'default' : 'pending',
      description: taxDetails?.filing_form ? `Filing form: ${taxDetails.filing_form} (Review recommended)` : 'Filing form not configured',
      icon: 'document-text-outline',
    },
    {
      label: 'Tax Deposit Schedule',
      status: taxDetails?.deposit_schedule ? 'default' : 'pending',
      description: taxDetails?.deposit_schedule ? `Schedule: ${formatStatusLabel(taxDetails.deposit_schedule)} (Review recommended)` : 'Deposit schedule not set',
      icon: 'calendar-outline',
    },
    {
      label: 'Taxpayer Type',
      status: taxDetails?.tax_payer_type ? 'verified' : 'pending',
      description: taxDetails?.tax_payer_type ? `Type: ${formatStatusLabel(taxDetails.tax_payer_type)}` : 'Taxpayer type not configured',
      icon: 'business-outline',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Federal Tax Details</Text>

      <View style={styles.taxInfoCard}>
        <View style={styles.taxInfoHeader}>
          <View style={styles.taxInfoIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.taxInfoTitle}>{taxDetails?.legal_name || companyName}</Text>
            <Text style={styles.taxInfoSubtitle}>Federal Tax Information</Text>
          </View>
          <View style={[styles.verifiedBadge, { backgroundColor: einVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' }, Platform.OS === 'web' ? { boxShadow: einVerified ? '0 0 6px #10B98125' : '0 0 6px #f59e0b25' } as any : {}]}>
            <Ionicons name={einVerified ? 'checkmark-circle' : 'time-outline'} size={14} color={einVerified ? '#10B981' : '#f59e0b'} />
            <Text style={[styles.verifiedText, { color: einVerified ? '#10B981' : '#f59e0b' }]}>
              {einVerified ? 'EIN Verified' : 'EIN Pending'}
            </Text>
          </View>
        </View>

        {!isEditing ? (
          <>
            <View style={styles.taxInfoGrid}>
              {taxDetails?.legal_name && (
                <View style={styles.taxInfoItem}>
                  <Text style={styles.taxInfoLabel}>Legal Name</Text>
                  <Text style={styles.taxInfoValue}>{taxDetails.legal_name}</Text>
                </View>
              )}
              {taxDetails?.ein && (
                <View style={styles.taxInfoItem}>
                  <Text style={styles.taxInfoLabel}>EIN</Text>
                  <Text style={styles.taxInfoValue}>••-•••{taxDetails.ein.slice(-4)}</Text>
                </View>
              )}
              {taxDetails?.filing_form && (
                <View style={styles.taxInfoItem}>
                  <Text style={styles.taxInfoLabel}>Filing Form</Text>
                  <Text style={styles.taxInfoValue}>{taxDetails.filing_form}</Text>
                </View>
              )}
              {taxDetails?.deposit_schedule && (
                <View style={styles.taxInfoItem}>
                  <Text style={styles.taxInfoLabel}>Deposit Schedule</Text>
                  <Text style={styles.taxInfoValue}>{formatStatusLabel(taxDetails.deposit_schedule)}</Text>
                </View>
              )}
              {taxDetails?.tax_payer_type && (
                <View style={styles.taxInfoItem}>
                  <Text style={styles.taxInfoLabel}>Taxpayer Type</Text>
                  <Text style={styles.taxInfoValue}>{formatStatusLabel(taxDetails.tax_payer_type)}</Text>
                </View>
              )}
              {taxDetails?.taxable_as_scorp !== undefined && (
                <View style={styles.taxInfoItem}>
                  <Text style={styles.taxInfoLabel}>S-Corp Status</Text>
                  <Text style={styles.taxInfoValue}>{taxDetails.taxable_as_scorp ? 'Yes' : 'No'}</Text>
                </View>
              )}
              {taxDetails?.version !== undefined && (
                <View style={styles.taxInfoItem}>
                  <Text style={styles.taxInfoLabel}>Version</Text>
                  <Text style={styles.taxInfoValue}>{taxDetails.version}</Text>
                </View>
              )}
            </View>
            <Pressable
              style={[styles.updateButton, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="create-outline" size={16} color="#ffffff" />
              <Text style={styles.updateButtonText}>Update Tax Settings</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.editForm}>
            <View style={styles.editSection}>
              <Text style={styles.editLabel}>Filing Form</Text>
              <View style={styles.toggleGroup}>
                {['941', '944'].map(option => (
                  <Pressable
                    key={option}
                    style={[
                      styles.toggleButton,
                      editedValues.filing_form === option && styles.toggleButtonSelected,
                      editedValues.filing_form === option && { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' },
                      Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
                    ]}
                    onPress={() => toggleOption('filing_form', option)}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        editedValues.filing_form === option && { color: '#3B82F6' },
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editLabel}>Deposit Schedule</Text>
              <View style={styles.toggleGroup}>
                {['semi_weekly', 'monthly'].map(option => (
                  <Pressable
                    key={option}
                    style={[
                      styles.toggleButton,
                      editedValues.deposit_schedule === option && styles.toggleButtonSelected,
                      editedValues.deposit_schedule === option && { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' },
                      Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
                    ]}
                    onPress={() => toggleOption('deposit_schedule', option)}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        editedValues.deposit_schedule === option && { color: '#3B82F6' },
                      ]}
                    >
                      {formatStatusLabel(option)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editLabel}>Taxpayer Type</Text>
              <View style={styles.toggleGroup}>
                {['c_corporation', 's_corporation', 'sole_proprietor', 'llc', 'partnership'].map(option => (
                  <Pressable
                    key={option}
                    style={[
                      styles.toggleButton,
                      editedValues.tax_payer_type === option && styles.toggleButtonSelected,
                      editedValues.tax_payer_type === option && { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3B82F6' },
                      Platform.OS === 'web' ? { cursor: 'pointer' } as any : {},
                    ]}
                    onPress={() => toggleOption('tax_payer_type', option)}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        editedValues.tax_payer_type === option && { color: '#3B82F6' },
                      ]}
                    >
                      {formatStatusLabel(option)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.editActions}>
              <Pressable
                style={[styles.actionButton, styles.saveButton, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}
                onPress={handleSaveChanges}
                disabled={savingChanges}
              >
                {savingChanges ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Save Changes</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.cancelButton, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}
                onPress={handleCancel}
                disabled={savingChanges}
              >
                <Ionicons name="close" size={16} color="#ffffff" />
                <Text style={styles.actionButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Compliance Checklist</Text>

      {complianceChecks.map((check, idx) => {
        const statusColors = {
          verified: { bg: 'rgba(16, 185, 129, 0.12)', icon: '#10B981' },
          default: { bg: 'rgba(59, 130, 246, 0.12)', icon: '#3B82F6' },
          pending: { bg: 'rgba(245, 158, 11, 0.12)', icon: '#f59e0b' },
        };
        const sc = statusColors[check.status];
        const statusIcon = check.status === 'verified' ? 'checkmark-circle' : check.status === 'default' ? 'information-circle' : 'ellipse-outline';
        return (
          <View key={idx} style={styles.checkCard}>
            <View style={[styles.checkIcon, { backgroundColor: sc.bg }]}>
              <Ionicons name={check.icon} size={18} color={sc.icon} />
            </View>
            <View style={styles.checkInfo}>
              <Text style={styles.checkLabel}>{check.label}</Text>
              <Text style={styles.checkDescription}>{check.description}</Text>
            </View>
            <View style={styles.checkActions}>
              {check.status !== 'verified' && (
                <Pressable
                  style={[styles.configureButton, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}
                  onPress={() => setIsEditing(true)}
                >
                  <Text style={styles.configureButtonText}>{check.status === 'default' ? 'Review' : 'Configure'}</Text>
                </Pressable>
              )}
              <Ionicons
                name={statusIcon}
                size={20}
                color={sc.icon}
              />
            </View>
          </View>
        );
      })}

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Employee Tax Overview</Text>

      {gustoEmployees && gustoEmployees.length > 0 ? (
        gustoEmployees.map((employee: any) => (
          <View key={employee.uuid} style={styles.checkCard}>
            <View style={styles.employeeInfo}>
              <View style={styles.employeeAvatar}>
                <Text style={styles.employeeAvatarText}>
                  {employee.first_name?.[0]}{employee.last_name?.[0]}
                </Text>
              </View>
              <View style={styles.employeeDetails}>
                <Text style={styles.checkLabel}>
                  {employee.first_name} {employee.last_name}
                </Text>
                <Text style={styles.checkDescription}>{employee.email || 'No email'}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.viewDetailsButton, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}
              onPress={() => {
                if (expandedEmployee === employee.uuid) {
                  setExpandedEmployee(null);
                } else {
                  setExpandedEmployee(employee.uuid);
                  fetchEmployeeTaxData(employee.uuid);
                }
              }}
            >
              <Text style={styles.viewDetailsButtonText}>
                {expandedEmployee === employee.uuid ? 'Hide' : 'View'} Tax Details
              </Text>
              <Ionicons
                name={expandedEmployee === employee.uuid ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#3B82F6"
              />
            </Pressable>
          </View>
        ))
      ) : (
        <View style={styles.emptyEmployees}>
          <Text style={styles.checkDescription}>No employees found</Text>
        </View>
      )}

      {expandedEmployee && employeeTaxData[expandedEmployee] && (
        <View style={styles.employeeTaxDetails}>
          <Text style={styles.taxDetailsTitle}>Federal Tax Details</Text>
          {Object.entries(employeeTaxData[expandedEmployee] || {}).map(([key, value]: [string, any]) => (
            <View key={key} style={styles.taxDetailItem}>
              <Text style={styles.taxDetailLabel}>{formatStatusLabel(key)}</Text>
              <Text style={styles.taxDetailValue}>
                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTitle: {
    color: '#ffffff',
    ...Typography.headline,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  taxInfoCard: {
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
  taxInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  taxInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxInfoTitle: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  taxInfoSubtitle: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  verifiedText: {
    ...Typography.small,
    fontWeight: '500',
  },
  taxInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  taxInfoItem: {
    minWidth: 150,
    marginBottom: 4,
  },
  taxInfoLabel: {
    color: '#6e6e73',
    ...Typography.small,
    marginBottom: 4,
  },
  taxInfoValue: {
    color: '#d1d1d6',
    ...Typography.captionMedium,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  updateButtonText: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  editForm: {
    gap: 20,
    marginTop: 16,
  },
  editSection: {
    gap: 8,
  },
  editLabel: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  toggleGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    minWidth: 100,
    alignItems: 'center',
  },
  toggleButtonSelected: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: '#3B82F6',
  },
  toggleButtonText: {
    color: '#d1d1d6',
    ...Typography.small,
    textAlign: 'center',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionButtonText: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  checkCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  checkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInfo: {
    flex: 1,
  },
  checkLabel: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  checkDescription: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
  },
  checkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configureButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  configureButtonText: {
    color: '#3B82F6',
    ...Typography.small,
    fontWeight: '600',
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  employeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeAvatarText: {
    color: '#3B82F6',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  employeeDetails: {
    flex: 1,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(59,130,246,0.1)',
    borderRadius: 8,
  },
  viewDetailsButtonText: {
    color: '#3B82F6',
    ...Typography.small,
    fontWeight: '600',
  },
  emptyEmployees: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeTaxDetails: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    marginLeft: 8,
    marginRight: 8,
  },
  taxDetailsTitle: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
    marginBottom: 12,
  },
  taxDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  taxDetailLabel: {
    color: '#6e6e73',
    ...Typography.small,
  },
  taxDetailValue: {
    color: '#d1d1d6',
    ...Typography.small,
    fontWeight: '500',
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
});
