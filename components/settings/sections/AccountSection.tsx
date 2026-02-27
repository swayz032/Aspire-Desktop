/**
 * Account Settings section.
 * Displays owner profile, business info, and identity fields.
 * Values are pre-populated from TenantProvider (suite_profiles).
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTenant, useSupabase } from '@/providers';
import { getInitials, getAvatarColor } from '@/utils/avatar';
import { SectionHeader, TextField, SelectField, Divider } from '../SettingsField';
import { SettingsColors, TRANSITION_SMOOTH } from '../settingsConstants';

const ENTITY_OPTIONS = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'llc', label: 'LLC' },
  { value: 'scorp', label: 'S-Corp' },
  { value: 'ccorp', label: 'C-Corp' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
];

const TEAM_SIZE_OPTIONS = [
  { value: 'solo', label: 'Just Me' },
  { value: '2-5', label: '2-5 people' },
  { value: '6-15', label: '6-15 people' },
  { value: '16-50', label: '16-50 people' },
  { value: '51+', label: '51+ people' },
];

export default function AccountSection() {
  const { session } = useSupabase();
  const { tenant } = useTenant();

  const userName = tenant?.ownerName || session?.user?.user_metadata?.full_name || '';
  const userEmail = session?.user?.email || '';
  const initials = useMemo(() => getInitials(userName || 'U'), [userName]);
  const avatarColor = useMemo(() => getAvatarColor(userName || 'U'), [userName]);

  // TODO: Wire to PATCH /api/suite-profile when save is implemented
  const [displayName, setDisplayName] = useState(userName);
  const [businessName, setBusinessName] = useState(tenant?.businessName || '');
  const [industry, setIndustry] = useState(tenant?.industry || '');
  const [entityType, setEntityType] = useState(tenant?.entityType || 'llc');
  const [teamSize, setTeamSize] = useState(tenant?.teamSize || 'solo');
  const [title, setTitle] = useState(tenant?.role || 'Founder');

  return (
    <View>
      <SectionHeader
        title="Account Settings"
        subtitle="Manage your profile and business information"
        icon="person-circle-outline"
      />

      {/* Avatar + identity card */}
      <View style={styles.identityCard}>
        <View style={[styles.avatarRing, { borderColor: avatarColor }]}>
          <View style={[styles.avatarCircle, { backgroundColor: `${avatarColor}20` }]}>
            <Text style={[styles.avatarInitials, { color: avatarColor }]}>{initials}</Text>
          </View>
        </View>
        <View style={styles.identityInfo}>
          <Text style={styles.identityName}>{displayName || 'Your Name'}</Text>
          <Text style={styles.identityEmail}>{userEmail}</Text>
          {tenant?.displayId && (
            <View style={styles.suiteIdRow}>
              <View style={styles.suiteIdDot} />
              <Text style={styles.suiteIdText}>Suite {tenant.displayId}</Text>
            </View>
          )}
        </View>
        <Pressable
          style={({ hovered }: { hovered?: boolean }) => [
            styles.changeAvatarBtn,
            hovered && styles.changeAvatarBtnHover,
          ] as ViewStyle[]}
        >
          <Ionicons name="camera-outline" size={14} color={SettingsColors.accent} />
          <Text style={styles.changeAvatarText}>Change</Text>
        </Pressable>
      </View>

      <Divider />

      {/* Personal Info */}
      <Text style={styles.groupTitle}>Personal Information</Text>
      <TextField
        label="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Enter your name"
      />
      <TextField
        label="Email Address"
        value={userEmail}
        readOnly
        hint="Managed by your authentication provider"
      />
      <TextField
        label="Title / Role"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founder, CEO, Managing Partner"
      />

      <Divider />

      {/* Business Info */}
      <Text style={styles.groupTitle}>Business Information</Text>
      <TextField
        label="Business Name"
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Your company name"
      />
      <TextField
        label="Industry"
        value={industry}
        onChangeText={setIndustry}
        placeholder="e.g. Legal Services, Construction, Retail"
      />
      <SelectField
        label="Entity Type"
        value={entityType}
        options={ENTITY_OPTIONS}
        onValueChange={setEntityType}
      />
      <SelectField
        label="Team Size"
        value={teamSize}
        options={TEAM_SIZE_OPTIONS}
        onValueChange={setTeamSize}
      />

      {/* Save button */}
      <View style={styles.saveRow}>
        <Pressable
          style={({ hovered }: { hovered?: boolean }) => [
            styles.saveButton,
            hovered && styles.saveButtonHover,
          ] as ViewStyle[]}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
        <Text style={styles.saveHint}>Changes are saved to your suite profile</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#111113',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 16,
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  identityInfo: {
    flex: 1,
  },
  identityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.2,
  },
  identityEmail: {
    fontSize: 13,
    color: '#6e6e73',
    marginTop: 2,
  },
  suiteIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  suiteIdDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4facfe',
  },
  suiteIdText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#48484a',
    letterSpacing: 0.3,
  },
  changeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: SettingsColors.accentBg,
    borderWidth: 1,
    borderColor: SettingsColors.accentBorder,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  changeAvatarBtnHover: {
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  changeAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: SettingsColors.accent,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  saveButton: {
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: SettingsColors.accent,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  saveButtonHover: {
    backgroundColor: '#2563EB',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.1,
  },
  saveHint: {
    fontSize: 12,
    color: '#48484a',
  },
});
