import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { seedDatabase } from '@/lib/mockSeed';
import { getTenant } from '@/lib/mockDb';
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

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  useEffect(() => {
    seedDatabase();
    const timer = setTimeout(() => {
      const t = getTenant();
      if (t) {
        setTenant(t);
        setBusinessName(t.businessName);
        setOwnerName(t.ownerName);
        setOwnerEmail(t.ownerEmail);
      }
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = () => {
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
          <ReadOnlyField label="Suite ID" value={tenant.suiteId} />
          <ReadOnlyField label="Office ID" value={tenant.officeId} />
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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
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
