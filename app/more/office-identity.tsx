import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { getSuiteProfile } from '@/lib/api';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { Tenant } from '@/types/tenant';

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={Colors.text.muted}
      />
    </View>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.readOnlyField}>
        <Text style={styles.readOnlyText}>{value}</Text>
        <Ionicons name="lock-closed" size={14} color={Colors.text.muted} />
      </View>
    </View>
  );
}

export default function OfficeIdentityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;
  const { authenticatedFetch } = useAuthFetch();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const profile = await getSuiteProfile();
        const t: Tenant = {
          id: profile.id ?? '',
          businessName: profile.business_name ?? profile.businessName ?? '',
          suiteId: profile.suite_id ?? '',
          officeId: profile.office_id ?? '',
          displayId: profile.display_id ?? undefined,
          officeDisplayId: profile.office_display_id ?? undefined,
          ownerName: profile.owner_name ?? profile.ownerName ?? '',
          ownerEmail: profile.owner_email ?? profile.ownerEmail ?? '',
          role: profile.role ?? 'Founder',
          timezone: profile.timezone ?? 'America/Los_Angeles',
          currency: profile.currency ?? 'USD',
          createdAt: profile.created_at ?? new Date().toISOString(),
          updatedAt: profile.updated_at ?? new Date().toISOString(),
          industry: profile.industry ?? null,
          industrySpecialty: profile.industry_specialty ?? null,
          incomeRange: profile.income_range ?? null,
          referralSource: profile.referral_source ?? null,
          gender: profile.gender ?? null,
          teamSize: profile.team_size ?? null,
          entityType: profile.entity_type ?? null,
          yearsInBusiness: profile.years_in_business ?? null,
          businessGoals: profile.business_goals ?? null,
          painPoint: profile.pain_point ?? null,
          salesChannel: profile.sales_channel ?? null,
          customerType: profile.customer_type ?? null,
          preferredChannel: profile.preferred_channel ?? null,
          onboardingCompleted: !!(profile.onboarding_completed_at),
        };
        setTenant(t);
        setBusinessName(t.businessName);
        setOwnerName(t.ownerName);
        setOwnerEmail(t.ownerEmail);
      } catch (e) {
        console.warn('Failed to load tenant profile:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTenant();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Runs once on mount, authenticatedFetch is stable

  const handleSave = async () => {
    try {
      setSaving(true);
      const resp = await authenticatedFetch('/api/onboarding/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          ownerName,
          ownerEmail,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Save failed');
      }
      // Re-fetch to sync updated data
      const profile = await getSuiteProfile();
      const t: Tenant = {
        id: profile.id ?? '',
        businessName: profile.business_name ?? profile.businessName ?? '',
        suiteId: profile.suite_id ?? '',
        officeId: profile.office_id ?? '',
        displayId: profile.display_id ?? undefined,
        officeDisplayId: profile.office_display_id ?? undefined,
        ownerName: profile.owner_name ?? profile.ownerName ?? '',
        ownerEmail: profile.owner_email ?? profile.ownerEmail ?? '',
        role: profile.role ?? 'Founder',
        timezone: profile.timezone ?? 'America/Los_Angeles',
        currency: profile.currency ?? 'USD',
        createdAt: profile.created_at ?? new Date().toISOString(),
        updatedAt: profile.updated_at ?? new Date().toISOString(),
        industry: profile.industry ?? null,
        industrySpecialty: profile.industry_specialty ?? null,
        incomeRange: profile.income_range ?? null,
        referralSource: profile.referral_source ?? null,
        gender: profile.gender ?? null,
        teamSize: profile.team_size ?? null,
        entityType: profile.entity_type ?? null,
        yearsInBusiness: profile.years_in_business ?? null,
        businessGoals: profile.business_goals ?? null,
        painPoint: profile.pain_point ?? null,
        salesChannel: profile.sales_channel ?? null,
        customerType: profile.customer_type ?? null,
        preferredChannel: profile.preferred_channel ?? null,
        onboardingCompleted: !!(profile.onboarding_completed_at),
      };
      setTenant(t);
      Alert.alert('Saved', 'Office identity updated successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !tenant) {
    return (
      <View style={styles.container}>
        <PageHeader title="Office Identity" showBackButton />
        <View style={[styles.loadingContainer, { paddingTop: headerHeight }]}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHeader title="Office Identity" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{businessName.charAt(0)}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.businessName}>{businessName}</Text>
              <Text style={styles.roleText}>{tenant.role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          <EditableField label="Business Name" value={businessName} onChange={setBusinessName} />
          <ReadOnlyField label="Suite ID" value={tenant.displayId || tenant.suiteId} />
          <ReadOnlyField label="Office ID" value={tenant.officeDisplayId || tenant.officeId} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Owner Information</Text>
          <EditableField label="Owner Name" value={ownerName} onChange={setOwnerName} />
          <EditableField label="Email" value={ownerEmail} onChange={setOwnerEmail} />
          <ReadOnlyField label="Role" value={tenant.role} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regional Settings</Text>
          <ReadOnlyField label="Timezone" value={tenant.timezone} />
          <ReadOnlyField label="Currency" value={tenant.currency} />
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Changes to your office identity will be logged as a receipt for audit purposes.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.muted,
  },
  card: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  avatarText: {
    ...Typography.display,
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
  },
  businessName: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  roleText: {
    ...Typography.body,
    color: Colors.accent.cyan,
  },
  section: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  field: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    ...Typography.small,
    color: Colors.text.muted,
    marginBottom: Spacing.xs,
  },
  fieldInput: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  readOnlyText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  saveButton: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  footerNote: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
