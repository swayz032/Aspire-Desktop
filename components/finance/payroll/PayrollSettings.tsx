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

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function maskEin(ein: string | undefined): string {
  if (!ein) return '••-•••••••';
  const digits = ein.replace(/\D/g, '');
  if (digits.length < 4) return '••-•••••••';
  return `••-•••${digits.slice(-4)}`;
}

export function PayrollSettings({ gustoCompany, gustoEmployees, gustoConnected }: PayrollSubTabProps) {
  const [paySchedules, setPaySchedules] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [editScheduleData, setEditScheduleData] = useState<any>({});

  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editDeptTitle, setEditDeptTitle] = useState('');

  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editLocationData, setEditLocationData] = useState<any>({});

  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptTitle, setNewDeptTitle] = useState('');
  const [addingDept, setAddingDept] = useState(false);

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ street_1: '', city: '', state: '', zip: '' });
  const [addingLocation, setAddingLocation] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [schedRes, deptRes, locRes, bankRes] = await Promise.all([
          fetch('/api/gusto/pay-schedules'),
          fetch('/api/gusto/departments'),
          fetch('/api/gusto/locations'),
          fetch('/api/gusto/bank-accounts'),
        ]);

        if (schedRes.ok) {
          const data = await schedRes.json();
          setPaySchedules(Array.isArray(data) ? data : []);
        }
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments(Array.isArray(data) ? data : []);
        }
        if (locRes.ok) {
          const data = await locRes.json();
          setLocations(Array.isArray(data) ? data : []);
        }
        if (bankRes.ok) {
          const data = await bankRes.json();
          setBankAccounts(Array.isArray(data) ? data : []);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    if (gustoConnected) {
      fetchAll();
    } else {
      setLoading(false);
    }
  }, [gustoConnected]);

  const handleAddDepartment = async () => {
    if (!newDeptTitle.trim()) return;
    setAddingDept(true);
    try {
      const res = await fetch('/api/gusto/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newDeptTitle.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setDepartments(prev => [...prev, created]);
        setNewDeptTitle('');
        setShowAddDept(false);
      }
    } catch (e) {
    } finally {
      setAddingDept(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.street_1.trim() || !newLocation.city.trim() || !newLocation.state.trim() || !newLocation.zip.trim()) return;
    setAddingLocation(true);
    try {
      const res = await fetch('/api/gusto/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocation),
      });
      if (res.ok) {
        const created = await res.json();
        setLocations(prev => [...prev, created]);
        setNewLocation({ street_1: '', city: '', state: '', zip: '' });
        setShowAddLocation(false);
      }
    } catch (e) {
    } finally {
      setAddingLocation(false);
    }
  };

  const startEditSchedule = (schedule: any) => {
    const key = schedule.uuid || schedule.name || 'schedule';
    setEditingSchedule(key);
    setEditScheduleData({
      frequency: schedule.frequency || '',
      day_1: schedule.day_1 !== undefined ? String(schedule.day_1) : '',
      day_2: schedule.day_2 !== undefined ? String(schedule.day_2) : '',
    });
  };

  const cancelEditSchedule = () => {
    setEditingSchedule(null);
    setEditScheduleData({});
  };

  const startEditDept = (dept: any) => {
    const key = dept.uuid || dept.title || 'dept';
    setEditingDept(key);
    setEditDeptTitle(dept.title || dept.name || '');
  };

  const cancelEditDept = () => {
    setEditingDept(null);
    setEditDeptTitle('');
  };

  const startEditLocation = (loc: any) => {
    const key = loc.uuid || 'loc';
    setEditingLocation(key);
    setEditLocationData({
      street_1: loc.street_1 || '',
      street_2: loc.street_2 || '',
      city: loc.city || '',
      state: loc.state || '',
      zip: loc.zip || '',
    });
  };

  const cancelEditLocation = () => {
    setEditingLocation(null);
    setEditLocationData({});
  };

  if (!gustoConnected) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cloud-offline-outline" size={32} color="#6e6e73" />
        </View>
        <Text style={styles.emptyTitle}>Payroll Not Connected</Text>
        <Text style={styles.emptySubtitle}>Set up payroll in Connections to view company settings.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading company settings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
        </View>
        <Text style={styles.emptyTitle}>Error Loading Settings</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {gustoCompany && (
        <>
          <Text style={styles.sectionTitle}>Company Info</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="business-outline" size={18} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{gustoCompany.name || gustoCompany.trade_name || 'Company'}</Text>
              </View>
            </View>
            <View style={styles.cardGrid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>COMPANY NAME</Text>
                <Text style={styles.gridValue}>{gustoCompany.name || gustoCompany.trade_name || '—'}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>EIN</Text>
                <Text style={styles.gridValue}>{maskEin(gustoCompany.ein)}</Text>
              </View>
              {gustoCompany.entity_type && (
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>ENTITY TYPE</Text>
                  <Text style={styles.gridValue}>{formatStatusLabel(gustoCompany.entity_type)}</Text>
                </View>
              )}
            </View>
          </View>
        </>
      )}

      <Text style={[styles.sectionTitle, gustoCompany ? { marginTop: 28 } : {}]}>Pay Schedules</Text>
      {paySchedules.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={20} color="#6e6e73" />
          <Text style={styles.emptyCardText}>No pay schedules configured</Text>
        </View>
      ) : (
        paySchedules.map((schedule: any, idx: number) => {
          const isActive = schedule.active !== undefined ? schedule.active : schedule.auto_pilot !== false;
          const schedKey = schedule.uuid || schedule.name || `sched-${idx}`;
          const isEditing = editingSchedule === schedKey;
          return (
            <View key={schedKey} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{formatStatusLabel(schedule.frequency || 'Unknown')} Schedule</Text>
                  {schedule.name && <Text style={styles.cardSubtitle}>{schedule.name}</Text>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(110, 110, 115, 0.12)' }, Platform.OS === 'web' ? { boxShadow: isActive ? '0 0 6px #10B98125' : 'none' } as any : {}]}>
                  <Text style={[styles.statusText, { color: isActive ? '#10B981' : '#6e6e73' }]}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                {!isEditing && (
                  <Pressable style={styles.editPill} onPress={() => startEditSchedule(schedule)}>
                    <Ionicons name="pencil" size={12} color="#3B82F6" />
                    <Text style={styles.editPillText}>Edit</Text>
                  </Pressable>
                )}
              </View>

              {isEditing ? (
                <View style={styles.editSection}>
                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>FREQUENCY</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editScheduleData.frequency}
                        onChangeText={(t) => setEditScheduleData((p: any) => ({ ...p, frequency: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="e.g. Every other week"
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>DAY 1</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editScheduleData.day_1}
                        onChangeText={(t) => setEditScheduleData((p: any) => ({ ...p, day_1: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="Day 1"
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>DAY 2</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editScheduleData.day_2}
                        onChangeText={(t) => setEditScheduleData((p: any) => ({ ...p, day_2: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="Day 2"
                      />
                    </View>
                  </View>
                  <View style={styles.formActions}>
                    <Pressable style={styles.cancelBtn} onPress={cancelEditSchedule}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.saveBtn} onPress={cancelEditSchedule}>
                      <Text style={styles.saveBtnText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>FREQUENCY</Text>
                    <Text style={styles.gridValue}>{formatStatusLabel(schedule.frequency || '—')}</Text>
                  </View>
                  {schedule.anchor_pay_date && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>ANCHOR PAY DATE</Text>
                      <Text style={styles.gridValue}>{formatDate(schedule.anchor_pay_date)}</Text>
                    </View>
                  )}
                  {schedule.anchor_end_of_pay_period && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>ANCHOR END OF PERIOD</Text>
                      <Text style={styles.gridValue}>{formatDate(schedule.anchor_end_of_pay_period)}</Text>
                    </View>
                  )}
                  {schedule.day_1 !== undefined && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>DAY 1</Text>
                      <Text style={styles.gridValue}>{schedule.day_1}</Text>
                    </View>
                  )}
                  {schedule.day_2 !== undefined && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>DAY 2</Text>
                      <Text style={styles.gridValue}>{schedule.day_2}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { marginTop: 28, flex: 1 }]}>Departments</Text>
        <Pressable style={[styles.editPill, { marginTop: 28 }]} onPress={() => setShowAddDept(true)}>
          <Ionicons name="add" size={14} color="#3B82F6" />
          <Text style={styles.editPillText}>Add Department</Text>
        </Pressable>
      </View>
      {showAddDept && (
        <View style={styles.card}>
          <View style={styles.formRow}>
            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={styles.formLabel}>DEPARTMENT NAME</Text>
              <TextInput
                style={styles.formInput}
                value={newDeptTitle}
                onChangeText={setNewDeptTitle}
                placeholderTextColor="#6e6e73"
                placeholder="e.g. Engineering"
                autoFocus
              />
            </View>
          </View>
          <View style={styles.formActions}>
            <Pressable style={styles.cancelBtn} onPress={() => { setShowAddDept(false); setNewDeptTitle(''); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, addingDept && { opacity: 0.6 }]}
              onPress={handleAddDepartment}
              disabled={addingDept}
            >
              {addingDept ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
      {departments.length === 0 && !showAddDept ? (
        <View style={styles.emptyCard}>
          <Ionicons name="grid-outline" size={20} color="#6e6e73" />
          <Text style={styles.emptyCardText}>No departments configured</Text>
        </View>
      ) : (
        departments.map((dept: any, idx: number) => {
          const deptKey = dept.uuid || dept.title || `dept-${idx}`;
          const isEditing = editingDept === deptKey;
          return (
            <View key={deptKey} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="grid-outline" size={18} color="#3B82F6" />
                </View>
                {isEditing ? (
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.formInput}
                      value={editDeptTitle}
                      onChangeText={setEditDeptTitle}
                      placeholderTextColor="#6e6e73"
                      placeholder="Department name"
                      autoFocus
                    />
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{dept.title || dept.name || 'Unnamed Department'}</Text>
                  </View>
                )}
                {(dept.employees || dept.contractors) && !isEditing && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {(dept.employees?.length || 0) + (dept.contractors?.length || 0)} members
                    </Text>
                  </View>
                )}
                {!isEditing && (
                  <Pressable style={styles.editPill} onPress={() => startEditDept(dept)}>
                    <Ionicons name="pencil" size={12} color="#3B82F6" />
                    <Text style={styles.editPillText}>Edit</Text>
                  </Pressable>
                )}
              </View>
              {isEditing && (
                <View style={styles.formActions}>
                  <Pressable style={styles.cancelBtn} onPress={cancelEditDept}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveBtn} onPress={cancelEditDept}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { marginTop: 28, flex: 1 }]}>Locations</Text>
        <Pressable style={[styles.editPill, { marginTop: 28 }]} onPress={() => setShowAddLocation(true)}>
          <Ionicons name="add" size={14} color="#3B82F6" />
          <Text style={styles.editPillText}>Add Location</Text>
        </Pressable>
      </View>
      {showAddLocation && (
        <View style={styles.card}>
          <View style={styles.formRow}>
            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={styles.formLabel}>STREET ADDRESS</Text>
              <TextInput
                style={styles.formInput}
                value={newLocation.street_1}
                onChangeText={(t) => setNewLocation(p => ({ ...p, street_1: t }))}
                placeholderTextColor="#6e6e73"
                placeholder="123 Main St"
                autoFocus
              />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>CITY</Text>
              <TextInput
                style={styles.formInput}
                value={newLocation.city}
                onChangeText={(t) => setNewLocation(p => ({ ...p, city: t }))}
                placeholderTextColor="#6e6e73"
                placeholder="San Francisco"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>STATE</Text>
              <TextInput
                style={styles.formInput}
                value={newLocation.state}
                onChangeText={(t) => setNewLocation(p => ({ ...p, state: t }))}
                placeholderTextColor="#6e6e73"
                placeholder="CA"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>ZIP</Text>
              <TextInput
                style={styles.formInput}
                value={newLocation.zip}
                onChangeText={(t) => setNewLocation(p => ({ ...p, zip: t }))}
                placeholderTextColor="#6e6e73"
                placeholder="94105"
              />
            </View>
          </View>
          <View style={styles.formActions}>
            <Pressable style={styles.cancelBtn} onPress={() => { setShowAddLocation(false); setNewLocation({ street_1: '', city: '', state: '', zip: '' }); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, addingLocation && { opacity: 0.6 }]}
              onPress={handleAddLocation}
              disabled={addingLocation}
            >
              {addingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
      {locations.length === 0 && !showAddLocation ? (
        <View style={styles.emptyCard}>
          <Ionicons name="location-outline" size={20} color="#6e6e73" />
          <Text style={styles.emptyCardText}>No locations configured</Text>
        </View>
      ) : (
        locations.map((loc: any, idx: number) => {
          const isActive = loc.active !== false;
          const locKey = loc.uuid || `loc-${idx}`;
          const isEditing = editingLocation === locKey;
          return (
            <View key={locKey} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="location-outline" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {[loc.street_1, loc.city, loc.state].filter(Boolean).join(', ') || 'Unknown Location'}
                  </Text>
                  {loc.street_2 && <Text style={styles.cardSubtitle}>{loc.street_2}</Text>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(110, 110, 115, 0.12)' }, Platform.OS === 'web' ? { boxShadow: isActive ? '0 0 6px #10B98125' : 'none' } as any : {}]}>
                  <Text style={[styles.statusText, { color: isActive ? '#10B981' : '#6e6e73' }]}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                {!isEditing && (
                  <Pressable style={styles.editPill} onPress={() => startEditLocation(loc)}>
                    <Ionicons name="pencil" size={12} color="#3B82F6" />
                    <Text style={styles.editPillText}>Edit</Text>
                  </Pressable>
                )}
              </View>

              {isEditing ? (
                <View style={styles.editSection}>
                  <View style={styles.formRow}>
                    <View style={[styles.formField, { flex: 1 }]}>
                      <Text style={styles.formLabel}>STREET ADDRESS</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editLocationData.street_1}
                        onChangeText={(t) => setEditLocationData((p: any) => ({ ...p, street_1: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="Street address"
                      />
                    </View>
                  </View>
                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>STREET 2</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editLocationData.street_2}
                        onChangeText={(t) => setEditLocationData((p: any) => ({ ...p, street_2: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="Suite, unit, etc."
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>CITY</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editLocationData.city}
                        onChangeText={(t) => setEditLocationData((p: any) => ({ ...p, city: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="City"
                      />
                    </View>
                  </View>
                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>STATE</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editLocationData.state}
                        onChangeText={(t) => setEditLocationData((p: any) => ({ ...p, state: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="State"
                      />
                    </View>
                    <View style={styles.formField}>
                      <Text style={styles.formLabel}>ZIP</Text>
                      <TextInput
                        style={styles.formInput}
                        value={editLocationData.zip}
                        onChangeText={(t) => setEditLocationData((p: any) => ({ ...p, zip: t }))}
                        placeholderTextColor="#6e6e73"
                        placeholder="ZIP code"
                      />
                    </View>
                  </View>
                  <View style={styles.formActions}>
                    <Pressable style={styles.cancelBtn} onPress={cancelEditLocation}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.saveBtn} onPress={cancelEditLocation}>
                      <Text style={styles.saveBtnText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  {loc.zip && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>ZIP</Text>
                      <Text style={styles.gridValue}>{loc.zip}</Text>
                    </View>
                  )}
                  {loc.country && (
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>COUNTRY</Text>
                      <Text style={styles.gridValue}>{loc.country}</Text>
                    </View>
                  )}
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>FILING ADDRESS</Text>
                    <Text style={styles.gridValue}>{loc.filing_address ? 'Yes' : 'No'}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>MAILING ADDRESS</Text>
                    <Text style={styles.gridValue}>{loc.mailing_address ? 'Yes' : 'No'}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {bankAccounts.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Bank Accounts</Text>
          {bankAccounts.map((bank: any, idx: number) => (
            <View key={bank.uuid || idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="wallet-outline" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{bank.name || bank.bank_name || 'Bank Account'}</Text>
                  <Text style={styles.cardSubtitle}>
                    ••••{bank.hidden_account_number?.slice(-4) || bank.account_number?.slice(-4) || '••••'}
                  </Text>
                </View>
                {bank.verification_status && (
                  <View style={[styles.statusBadge, {
                    backgroundColor: bank.verification_status === 'verified' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)'
                  }, Platform.OS === 'web' ? { boxShadow: bank.verification_status === 'verified' ? '0 0 6px #10B98125' : '0 0 6px #f59e0b25' } as any : {}]}>
                    <Text style={[styles.statusText, {
                      color: bank.verification_status === 'verified' ? '#10B981' : '#f59e0b'
                    }]}>
                      {formatStatusLabel(bank.verification_status)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.cardGrid}>
                {bank.routing_number && (
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>ROUTING</Text>
                    <Text style={styles.gridValue}>••••{bank.routing_number.slice(-4)}</Text>
                  </View>
                )}
                {bank.account_type && (
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>TYPE</Text>
                    <Text style={styles.gridValue}>{formatStatusLabel(bank.account_type)}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  cardSubtitle: {
    color: '#6e6e73',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '500',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  gridItem: {
    minWidth: 120,
  },
  gridLabel: {
    color: '#6e6e73',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  gridValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  editPillText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  editSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formField: {
    flex: 1,
    minWidth: 100,
  },
  formLabel: {
    color: '#6e6e73',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } as any : {}),
  },
  emptyCardText: {
    color: '#6e6e73',
    fontSize: 14,
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
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    color: '#6e6e73',
    fontSize: 14,
    marginTop: 12,
  },
});
