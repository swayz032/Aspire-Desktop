import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';

interface PayrollSubTabProps {
  gustoCompany: any;
  gustoEmployees: any[];
  gustoConnected: boolean;
}

function getInitials(first: string, last: string): string {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
}

function formatRate(rate: string | number, unit: string): string {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (isNaN(num)) return '—';
  const formatted = '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (unit === 'Hour') return `${formatted}/hr`;
  if (unit === 'Year') return `${formatted}/yr`;
  if (unit === 'Month') return `${formatted}/mo`;
  return formatted;
}

function getStatusColor(status: string): { bg: string; text: string } {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'full_time' || s === 'completed' || s === 'onboarding_completed') {
    return { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981' };
  }
  if (s === 'part_time') {
    return { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6' };
  }
  if (s === 'pending' || s === 'admin_onboarding_incomplete' || s === 'self_onboarding_pending_invite' || s === 'self_onboarding_invited' || s === 'self_onboarding_awaiting_admin_review') {
    return { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b' };
  }
  return { bg: 'rgba(110, 110, 115, 0.12)', text: '#6e6e73' };
}

function formatStatusLabel(status: string): string {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function PayrollPeople({ gustoCompany, gustoEmployees, gustoConnected }: PayrollSubTabProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', job_title: '', pay_type: 'Hour' as 'Hour' | 'Year', rate: '', department: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localEmployees, setLocalEmployees] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ rate: '', pay_type: 'Hour' as 'Hour' | 'Year', job_title: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const allEmployees = useMemo(() => {
    const combined = [...(gustoEmployees || [])];
    for (const le of localEmployees) {
      if (!combined.find((e: any) => (e.uuid || e.id) === (le.uuid || le.id))) {
        combined.push(le);
      }
    }
    return combined;
  }, [gustoEmployees, localEmployees]);

  const filtered = useMemo(() => {
    if (!allEmployees.length) return [];
    const q = search.toLowerCase();
    return allEmployees.filter((e: any) => {
      const name = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [allEmployees, search]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return allEmployees?.find((e: any) => (e.uuid || e.id) === selectedId) || null;
  }, [selectedId, allEmployees]);

  const handleAddEmployee = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) {
      setMessage({ type: 'error', text: 'All fields are required' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/gusto/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to add employee');
      }

      const newEmp = await response.json();
      let partialWarning: string | null = null;

      if (newEmp.uuid && formData.job_title.trim()) {
        let locationId: string | null = null;
        try {
          const locRes = await fetch('/api/gusto/locations');
          if (locRes.ok) {
            const locations = await locRes.json();
            if (Array.isArray(locations) && locations.length > 0) {
              locationId = locations[0].id || locations[0].uuid;
            }
          }
        } catch (_) {}

        const todayISO = new Date().toISOString().split('T')[0];

        try {
          const jobBody: Record<string, string> = {
            title: formData.job_title.trim(),
            hire_date: todayISO,
          };
          if (locationId) {
            jobBody.location_id = locationId;
          }

          const jobRes = await fetch(`/api/gusto/employees/${newEmp.uuid}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobBody),
          });

          if (!jobRes.ok) {
            const jobErr = await jobRes.json().catch(() => ({}));
            throw new Error(jobErr.message || 'Job creation failed');
          }

          const job = await jobRes.json();

          if (job.uuid && formData.rate.trim()) {
            const defaultComp = job.compensations?.[0];

            if (defaultComp?.uuid && defaultComp?.version) {
              try {
                const compRes = await fetch(`/api/gusto/compensations/${defaultComp.uuid}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    version: defaultComp.version,
                    rate: formData.rate.trim(),
                    payment_unit: formData.pay_type,
                    flsa_status: formData.pay_type === 'Year' ? 'Exempt' : 'Nonexempt',
                  }),
                });

                if (!compRes.ok) {
                  const compErr = await compRes.json().catch(() => ({}));
                  throw new Error(compErr.message || 'Compensation update failed');
                }

                const updatedComp = await compRes.json();
                newEmp.jobs = [{ ...job, compensations: [updatedComp] }];
              } catch (compError) {
                const compErrText = compError instanceof Error ? compError.message : 'Unknown error';
                partialWarning = `Employee created but pay rate setup failed: ${compErrText}`;
                newEmp.jobs = [{ ...job, compensations: job.compensations || [] }];
              }
            } else {
              newEmp.jobs = [{ ...job, compensations: job.compensations || [] }];
            }
          } else {
            newEmp.jobs = [{ ...job, compensations: job.compensations || [] }];
          }
        } catch (jobError) {
          if (!partialWarning) {
            const jobErrText = jobError instanceof Error ? jobError.message : 'Unknown error';
            partialWarning = `Employee created but job setup failed: ${jobErrText}`;
          }
        }
      }

      setLocalEmployees(prev => [...prev, newEmp]);

      if (partialWarning) {
        setMessage({ type: 'error', text: partialWarning });
      } else {
        setMessage({ type: 'success', text: 'Employee added successfully' });
      }

      setFormData({ first_name: '', last_name: '', email: '', job_title: '', pay_type: 'Hour', rate: '', department: '' });
      setShowAddForm(false);

      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Failed to add employee';
      setMessage({ type: 'error', text: errorText });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditMode = (emp: any) => {
    const job = emp.jobs?.[0];
    const comp = job?.compensations?.[0];
    setEditData({
      rate: comp?.rate?.toString() || '0',
      pay_type: (comp?.payment_unit === 'Year' ? 'Year' : 'Hour') as 'Hour' | 'Year',
      job_title: job?.title || '',
    });
    setEditMode(true);
    setEditError(null);
    setEditSuccess(null);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const job = selected.jobs?.[0];
    const comp = job?.compensations?.[0];
    if (!comp?.uuid || !comp?.version) {
      setEditError('No compensation record found to update. The employee may need a job assigned first.');
      return;
    }

    const newRate = editData.rate.trim();
    if (!newRate || parseFloat(newRate) <= 0) {
      setEditError('Please enter a valid pay rate greater than $0.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/gusto/compensations/${comp.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: comp.version,
          rate: newRate,
          payment_unit: editData.pay_type,
          flsa_status: editData.pay_type === 'Year' ? 'Exempt' : 'Nonexempt',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Failed to update compensation');
      }

      const updated = await res.json();
      setLocalEmployees(prev => {
        const existing = prev.find((e: any) => (e.uuid || e.id) === (selected.uuid || selected.id));
        if (existing) {
          return prev.map((e: any) => {
            if ((e.uuid || e.id) !== (selected.uuid || selected.id)) return e;
            const jobs = [...(e.jobs || [])];
            if (jobs[0]) {
              jobs[0] = { ...jobs[0], title: editData.job_title || jobs[0].title, compensations: [{ ...updated }] };
            }
            return { ...e, jobs };
          });
        } else {
          const copy = { ...selected };
          const jobs = [...(copy.jobs || [])];
          if (jobs[0]) {
            jobs[0] = { ...jobs[0], title: editData.job_title || jobs[0].title, compensations: [{ ...updated }] };
          }
          copy.jobs = jobs;
          return [...prev, copy];
        }
      });

      setEditSuccess('Compensation updated successfully');
      setEditMode(false);
      setTimeout(() => setEditSuccess(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  if (!gustoConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cloud-offline-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>Payroll Not Connected</Text>
        <Text style={styles.emptySubtitle}>Set up payroll in Connections to view employee data.</Text>
      </View>
    );
  }

  if (!allEmployees.length && !showAddForm) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="people-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>No Employees Found</Text>
        <Text style={styles.emptySubtitle}>No employee records found.</Text>
        {message && (
          <View style={[styles.messageBox, { backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 59, 48, 0.12)' }]}>
            <Text style={[styles.messageText, { color: message.type === 'success' ? '#10B981' : '#ff3b30' }]}>
              {message.text}
            </Text>
          </View>
        )}
        <Pressable 
          style={styles.emptyAddButton}
          onPress={() => setShowAddForm(true)}
          {...(Platform.OS === 'web' ? { onMouseEnter: (e: any) => {}, onMouseLeave: (e: any) => {} } as any : {})}
        >
          <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
          <Text style={styles.emptyAddButtonText}>Add Employee</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#6e6e73" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            placeholderTextColor="#6e6e73"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#6e6e73" />
            </Pressable>
          )}
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable 
          style={styles.addButton}
          onPress={() => setShowAddForm(true)}
          {...(Platform.OS === 'web' ? { 
            onMouseEnter: (e: any) => {}, 
            onMouseLeave: (e: any) => {} 
          } as any : {})}
        >
          <Ionicons name="add-outline" size={18} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Employee</Text>
        </Pressable>
      </View>

      {message && (
        <View style={[styles.messageBox, { backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 59, 48, 0.12)', marginBottom: 16 }]}>
          <Ionicons name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={16} color={message.type === 'success' ? '#10B981' : '#ff3b30'} />
          <Text style={[styles.messageText, { color: message.type === 'success' ? '#10B981' : '#ff3b30' }]}>
            {message.text}
          </Text>
        </View>
      )}

      {showAddForm && (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Add New Employee</Text>
            <Pressable onPress={() => { setShowAddForm(false); setMessage(null); }} style={styles.formCloseBtn}>
              <Ionicons name="close" size={20} color="#d1d1d6" />
            </Pressable>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>First Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="John"
              placeholderTextColor="#6e6e73"
              value={formData.first_name}
              onChangeText={(text) => setFormData({ ...formData, first_name: text })}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Last Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Doe"
              placeholderTextColor="#6e6e73"
              value={formData.last_name}
              onChangeText={(text) => setFormData({ ...formData, last_name: text })}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Email *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="john@example.com"
              placeholderTextColor="#6e6e73"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              editable={!isSubmitting}
              keyboardType="email-address"
            />
          </View>

          <View style={{ height: 1, backgroundColor: CARD_BORDER, marginVertical: 12 }} />
          <Text style={[styles.formLabel, { marginBottom: 8, color: '#8E8E93', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }]}>Job & Compensation (Optional)</Text>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Job Title</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Software Engineer"
              placeholderTextColor="#6e6e73"
              value={formData.job_title}
              onChangeText={(text) => setFormData({ ...formData, job_title: text })}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Pay Type</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Hour', 'Year'] as const).map(pt => (
                <Pressable
                  key={pt}
                  onPress={() => setFormData({ ...formData, pay_type: pt })}
                  style={{
                    flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8,
                    backgroundColor: formData.pay_type === pt ? 'rgba(59,130,246,0.15)' : 'rgba(30,30,35,0.6)',
                    borderWidth: 1, borderColor: formData.pay_type === pt ? 'rgba(59,130,246,0.4)' : CARD_BORDER,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: formData.pay_type === pt ? '#60A5FA' : '#d1d1d6', fontSize: 14, fontWeight: formData.pay_type === pt ? '600' : '400' }}>
                    {pt === 'Hour' ? 'Hourly' : 'Salary'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>{formData.pay_type === 'Hour' ? 'Hourly Rate ($)' : 'Annual Salary ($)'}</Text>
            <TextInput
              style={styles.formInput}
              placeholder={formData.pay_type === 'Hour' ? '35.00' : '85000.00'}
              placeholderTextColor="#6e6e73"
              value={formData.rate}
              onChangeText={(text) => setFormData({ ...formData, rate: text })}
              editable={!isSubmitting}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.formLabel}>Department</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Engineering"
              placeholderTextColor="#6e6e73"
              value={formData.department}
              onChangeText={(text) => setFormData({ ...formData, department: text })}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.formActions}>
            <Pressable
              style={[styles.saveButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleAddEmployee}
              disabled={isSubmitting}
              {...(Platform.OS === 'web' ? { 
                onMouseEnter: (e: any) => {}, 
                onMouseLeave: (e: any) => {} 
              } as any : {})}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={16} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={styles.cancelButton}
              onPress={() => { 
                setShowAddForm(false); 
                setFormData({ first_name: '', last_name: '', email: '', job_title: '', pay_type: 'Hour', rate: '', department: '' });
                setMessage(null);
              }}
              disabled={isSubmitting}
              {...(Platform.OS === 'web' ? { 
                onMouseEnter: (e: any) => {}, 
                onMouseLeave: (e: any) => {} 
              } as any : {})}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.contentRow}>
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filtered.map((emp: any, idx: number) => {
            const id = emp.uuid || emp.id;
            const job = emp.jobs?.[0];
            const comp = job?.compensations?.[0];
            const isSelected = selectedId === id;
            const isHovered = hoveredId === id;
            const empStatus = getStatusColor(emp.current_employment_status);
            const onboardStatus = getStatusColor(emp.onboarding_status);

            return (
              <Pressable
                key={id}
                style={[
                  styles.card,
                  idx % 2 === 0 && styles.cardEvenRow,
                  isSelected && styles.cardSelected,
                  isHovered && !isSelected && styles.cardHovered,
                ]}
                onPress={() => setSelectedId(isSelected ? null : id)}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredId(id),
                  onMouseLeave: () => setHoveredId(null),
                } as any : {})}
              >
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(emp.first_name, emp.last_name)}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.empName}>{emp.first_name} {emp.last_name}</Text>
                    <Text style={styles.empRole}>{job?.title || '—'}</Text>
                  </View>
                  <View style={styles.cardMeta}>
                    {emp.department && (
                      <View style={styles.deptBadge}>
                        <Text style={styles.deptText}>{emp.department}</Text>
                      </View>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: empStatus.bg }, Platform.OS === 'web' ? { boxShadow: `0 0 6px ${empStatus.text}25` } as any : {}]}>
                      <Text style={[styles.statusText, { color: empStatus.text }]}>
                        {emp.current_employment_status === 'full_time' ? 'Full Time' : emp.current_employment_status === 'part_time' ? 'Part Time' : formatStatusLabel(emp.current_employment_status)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardRate}>
                    <Text style={styles.rateText}>
                      {comp ? formatRate(comp.rate, comp.payment_unit) : '—'}
                    </Text>
                  </View>
                  <Ionicons name={isSelected ? 'chevron-up' : 'chevron-forward'} size={16} color="#6e6e73" />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {selected && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View style={styles.detailAvatar}>
                <Text style={styles.detailAvatarText}>{getInitials(selected.first_name, selected.last_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{selected.first_name} {selected.last_name}</Text>
                <Text style={styles.detailRole}>{selected.jobs?.[0]?.title || '—'}</Text>
              </View>
              <Pressable onPress={() => { setSelectedId(null); setEditMode(false); }} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#d1d1d6" />
              </Pressable>
            </View>

            {editSuccess && (
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', borderRadius: 10, padding: 10, marginTop: 8, marginHorizontal: 4 }}>
                <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '600' }}>{editSuccess}</Text>
              </View>
            )}

            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Contact</Text>
                <DetailRow label="Email" value={selected.email} />
                <DetailRow label="Date of Birth" value={selected.date_of_birth || '—'} />
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Employment</Text>
                <DetailRow label="Status" value={formatStatusLabel(selected.current_employment_status)} />
                <DetailRow label="Department" value={selected.department || '—'} />
                <DetailRow label="Onboarding" value={formatStatusLabel(selected.onboarding_status)} />
                <DetailRow label="Payment Method" value={formatStatusLabel(selected.payment_method || '—')} />
              </View>

              <View style={styles.detailSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.detailSectionTitle}>Compensation</Text>
                  {!editMode && (
                    <Pressable onPress={() => startEditMode(selected)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                      <Ionicons name="pencil-outline" size={13} color="#3B82F6" />
                      <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>Edit</Text>
                    </Pressable>
                  )}
                </View>

                {editMode ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: '#8e8e93', fontSize: 12, marginBottom: 4 }}>Job Title</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editData.job_title}
                        onChangeText={(t) => setEditData({ ...editData, job_title: t })}
                        placeholder="Job title"
                        placeholderTextColor="#6e6e73"
                      />
                    </View>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: '#8e8e93', fontSize: 12, marginBottom: 4 }}>Pay Type</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {(['Hour', 'Year'] as const).map(pt => (
                          <Pressable
                            key={pt}
                            onPress={() => setEditData({ ...editData, pay_type: pt })}
                            style={{
                              flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
                              backgroundColor: editData.pay_type === pt ? 'rgba(59,130,246,0.15)' : 'rgba(30,30,35,0.6)',
                              borderWidth: 1, borderColor: editData.pay_type === pt ? 'rgba(59,130,246,0.4)' : CARD_BORDER,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: editData.pay_type === pt ? '#60A5FA' : '#d1d1d6', fontSize: 13, fontWeight: editData.pay_type === pt ? '600' : '400' }}>
                              {pt === 'Hour' ? 'Hourly' : 'Salary'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: '#8e8e93', fontSize: 12, marginBottom: 4 }}>
                        {editData.pay_type === 'Hour' ? 'Hourly Rate ($)' : 'Annual Salary ($)'}
                      </Text>
                      <TextInput
                        style={styles.editInput}
                        value={editData.rate}
                        onChangeText={(t) => setEditData({ ...editData, rate: t })}
                        placeholder={editData.pay_type === 'Hour' ? '18.00' : '85000.00'}
                        placeholderTextColor="#6e6e73"
                        keyboardType="numeric"
                      />
                    </View>

                    {editError && (
                      <View style={{ backgroundColor: 'rgba(255, 59, 48, 0.12)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <Text style={{ color: '#ff3b30', fontSize: 12, fontWeight: '500' }}>{editError}</Text>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        style={{ flex: 1, backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: editSaving ? 0.7 : 1 }}
                        onPress={handleSaveEdit}
                        disabled={editSaving}
                      >
                        {editSaving ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-outline" size={16} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Save Changes</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center' }}
                        onPress={() => { setEditMode(false); setEditError(null); }}
                      >
                        <Text style={{ color: '#d1d1d6', fontSize: 13 }}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <DetailRow label="Title" value={selected.jobs?.[0]?.title || '—'} />
                    {selected.jobs?.[0]?.compensations?.[0] ? (
                      <>
                        <DetailRow
                          label="Rate"
                          value={formatRate(selected.jobs[0].compensations[0].rate, selected.jobs[0].compensations[0].payment_unit)}
                        />
                        <DetailRow label="FLSA Status" value={formatStatusLabel(selected.jobs[0].compensations[0].flsa_status || '—')} />
                      </>
                    ) : (
                      <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderRadius: 8, padding: 10, marginTop: 6 }}>
                        <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '500' }}>No compensation set. Tap Edit to configure pay rate.</Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {selected.eligible_paid_time_off?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Paid Time Off</Text>
                  {selected.eligible_paid_time_off.map((pto: any, i: number) => (
                    <View key={i} style={styles.ptoRow}>
                      <Text style={styles.ptoName}>{pto.name}</Text>
                      <Text style={styles.ptoBalance}>{pto.accrued_hours || 0}h accrued</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    ...Typography.caption,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  countBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  countText: {
    color: '#3B82F6',
    ...Typography.smallMedium,
  },
  contentRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 16,
  },
  listContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  cardEvenRow: {
    backgroundColor: 'rgba(28,28,30,0.7)',
  },
  cardSelected: {
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  cardHovered: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#3B82F6',
    ...Typography.smallMedium,
    fontWeight: '600',
  },
  cardInfo: {
    flex: 1,
    minWidth: 120,
  },
  empName: {
    color: '#ffffff',
    ...Typography.captionMedium,
  },
  empRole: {
    color: '#6e6e73',
    ...Typography.small,
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deptBadge: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptText: {
    color: '#d1d1d6',
    ...Typography.small,
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
  cardRate: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  rateText: {
    color: '#d1d1d6',
    ...Typography.captionMedium,
  },
  detailPanel: {
    width: 340,
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
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    marginBottom: 16,
  },
  detailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAvatarText: {
    color: '#3B82F6',
    ...Typography.captionMedium,
    fontWeight: '700',
  },
  detailName: {
    color: '#ffffff',
    ...Typography.headline,
  },
  detailRole: {
    color: '#6e6e73',
    ...Typography.caption,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: {
    flex: 1,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    color: '#6e6e73',
    ...Typography.smallMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  detailLabel: {
    color: '#6e6e73',
    ...Typography.caption,
  },
  detailValue: {
    color: '#d1d1d6',
    ...Typography.captionMedium,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  ptoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  ptoName: {
    color: '#d1d1d6',
    ...Typography.caption,
  },
  ptoBalance: {
    color: '#3B82F6',
    ...Typography.captionMedium,
  },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  addButtonText: {
    color: '#ffffff',
    ...Typography.smallMedium,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  messageText: {
    flex: 1,
    ...Typography.caption,
  },
  formCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  formTitle: {
    color: '#ffffff',
    ...Typography.headline,
  },
  formCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } as any : {}),
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    color: '#d1d1d6',
    ...Typography.smallMedium,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#ffffff',
    ...Typography.caption,
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none' as any,
    } as any : {}),
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  saveButtonText: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  cancelButtonText: {
    color: '#d1d1d6',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
    ...(Platform.OS === 'web' ? {
      cursor: 'not-allowed' as any,
    } as any : {}),
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 20,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any : {}),
  },
  emptyAddButtonText: {
    color: '#ffffff',
    ...Typography.captionMedium,
    fontWeight: '600',
  },
});
