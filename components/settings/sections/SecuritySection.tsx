/**
 * Security section.
 * Password change, two-factor auth, and active sessions management.
 * TODO: Wire to Supabase auth API for password changes.
 * TODO: Wire to real session tracking API for active sessions.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader, TextField, ToggleField, Divider } from '../SettingsField';
import { SettingsColors, TRANSITION_SMOOTH } from '../settingsConstants';

/** Mock active sessions -- TODO: Replace with real session data from API */
const MOCK_SESSIONS = [
  {
    id: '1',
    device: 'Chrome on Windows',
    icon: 'desktop-outline' as const,
    location: 'New York, NY',
    lastActive: 'Active now',
    current: true,
  },
  {
    id: '2',
    device: 'Safari on iPhone 16',
    icon: 'phone-portrait-outline' as const,
    location: 'New York, NY',
    lastActive: '2 hours ago',
    current: false,
  },
  {
    id: '3',
    device: 'Firefox on MacBook Pro',
    icon: 'laptop-outline' as const,
    location: 'Brooklyn, NY',
    lastActive: '3 days ago',
    current: false,
  },
];

export default function SecuritySection() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [autoLock, setAutoLock] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordMismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <View>
      <SectionHeader
        title="Security"
        subtitle="Protect your account and manage access"
        icon="shield-checkmark-outline"
      />

      {/* Security score */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreLeft}>
          <View style={styles.scoreBadge}>
            <Ionicons name="shield-checkmark" size={20} color={twoFactor ? '#34c759' : '#f59e0b'} />
          </View>
          <View>
            <Text style={styles.scoreTitle}>Security Score</Text>
            <Text style={styles.scoreSubtitle}>
              {twoFactor ? 'Strong protection active' : 'Enable 2FA to improve'}
            </Text>
          </View>
        </View>
        <View style={[styles.scorePill, twoFactor ? styles.scorePillGood : styles.scorePillWarn]}>
          <Text style={[styles.scorePillText, twoFactor ? styles.scorePillTextGood : styles.scorePillTextWarn]}>
            {twoFactor ? 'Strong' : 'Moderate'}
          </Text>
        </View>
      </View>

      <Divider />

      {/* Two-Factor & Biometric */}
      <Text style={styles.groupTitle}>Authentication</Text>
      <ToggleField
        label="Two-Factor Authentication"
        description="Add an extra layer of security with TOTP codes from your authenticator app"
        value={twoFactor}
        onValueChange={setTwoFactor}
      />
      <ToggleField
        label="Biometric Login"
        description="Use Face ID, Touch ID, or fingerprint to sign in on supported devices"
        value={biometric}
        onValueChange={setBiometric}
      />
      <ToggleField
        label="Auto-Lock Session"
        description="Automatically lock your session after 15 minutes of inactivity"
        value={autoLock}
        onValueChange={setAutoLock}
      />

      <Divider />

      {/* Password Change */}
      <Text style={styles.groupTitle}>Change Password</Text>
      <TextField
        label="Current Password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Enter current password"
      />
      <TextField
        label="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="Enter new password"
        hint="Must be at least 12 characters with a mix of letters, numbers, and symbols"
      />
      <TextField
        label="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter new password"
        error={passwordMismatch ? 'Passwords do not match' : undefined}
      />
      <Pressable
        style={({ hovered }: { hovered?: boolean }) => [
          styles.changePasswordBtn,
          hovered && styles.changePasswordBtnHover,
        ] as ViewStyle[]}
      >
        <Text style={styles.changePasswordBtnText}>Update Password</Text>
      </Pressable>

      <Divider />

      {/* Active Sessions */}
      <View style={styles.sessionsHeader}>
        <Text style={styles.groupTitle}>Active Sessions</Text>
        <Pressable
          style={({ hovered }: { hovered?: boolean }) => [
            styles.revokeAllBtn,
            hovered && styles.revokeAllBtnHover,
          ] as ViewStyle[]}
        >
          <Text style={styles.revokeAllText}>Revoke All Others</Text>
        </Pressable>
      </View>

      {MOCK_SESSIONS.map((s) => (
        <View key={s.id} style={styles.sessionRow}>
          <View style={styles.sessionIconWrapper}>
            <Ionicons name={s.icon} size={18} color="#a1a1a6" />
          </View>
          <View style={styles.sessionInfo}>
            <View style={styles.sessionTitleRow}>
              <Text style={styles.sessionDevice}>{s.device}</Text>
              {s.current && (
                <View style={styles.currentBadge}>
                  <View style={styles.currentDot} />
                  <Text style={styles.currentText}>This device</Text>
                </View>
              )}
            </View>
            <Text style={styles.sessionMeta}>{s.location} -- {s.lastActive}</Text>
          </View>
          {!s.current && (
            <Pressable
              style={({ hovered }: { hovered?: boolean }) => [
                styles.revokeBtn,
                hovered && styles.revokeBtnHover,
              ] as ViewStyle[]}
            >
              <Ionicons name="close-circle-outline" size={16} color={SettingsColors.destructive} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#111113',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  scoreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scoreBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  scoreSubtitle: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },
  scorePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  scorePillGood: {
    backgroundColor: SettingsColors.successBg,
    borderColor: 'rgba(52, 199, 89, 0.25)',
  },
  scorePillWarn: {
    backgroundColor: SettingsColors.amberBg,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scorePillTextGood: {
    color: SettingsColors.success,
  },
  scorePillTextWarn: {
    color: SettingsColors.amber,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  changePasswordBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SettingsColors.accent,
    marginTop: 4,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  changePasswordBtnHover: {
    backgroundColor: '#2563EB',
  },
  changePasswordBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  sessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  revokeAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  revokeAllBtnHover: {
    backgroundColor: SettingsColors.destructiveBg,
  },
  revokeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: SettingsColors.destructive,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: '#111113',
    gap: 14,
    marginBottom: 8,
  },
  sessionIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDevice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: SettingsColors.successBg,
  },
  currentDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SettingsColors.success,
  },
  currentText: {
    fontSize: 10,
    fontWeight: '700',
    color: SettingsColors.success,
  },
  sessionMeta: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 3,
  },
  revokeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  revokeBtnHover: {
    backgroundColor: SettingsColors.destructiveBg,
  },
});
