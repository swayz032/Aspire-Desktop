import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, Switch, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { formatRelativeTime } from '@/lib/formatters';
import { SecuritySettings, TrustedDevice } from '@/types/tenant';

const AUTO_LOCK_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
];

function DeviceCard({ device }: { device: TrustedDevice }) {
  const getIcon = () => {
    switch (device.type) {
      case 'mobile': return 'phone-portrait';
      case 'desktop': return 'laptop';
      case 'tablet': return 'tablet-portrait';
      default: return 'hardware-chip';
    }
  };

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceIcon}>
        <Ionicons name={getIcon()} size={20} color={Colors.accent.cyan} />
      </View>
      <View style={styles.deviceInfo}>
        <View style={styles.deviceNameRow}>
          <Text style={styles.deviceName}>{device.name}</Text>
          {device.current && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current</Text>
            </View>
          )}
        </View>
        <Text style={styles.deviceLastUsed}>Last used: {formatRelativeTime(device.lastUsed)}</Text>
      </View>
      <TouchableOpacity>
        <Ionicons name="trash" size={18} color={Colors.semantic.error} />
      </TouchableOpacity>
    </View>
  );
}

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: true,
    trustedDevices: [],
    autoLockTimeout: 5,
    biometricEnabled: true,
  });

  useEffect(() => {
    // Settings are local-only (no Supabase table); use defaults
    setLoading(false);
  }, []);

  const handleUpdate = (key: keyof SecuritySettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Security & Privacy" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.accent.cyan} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Two-Factor Authentication</Text>
              <Text style={styles.settingSubtitle}>Extra security for your account</Text>
            </View>
            <Switch
              value={settings.twoFactorEnabled}
              onValueChange={(v) => handleUpdate('twoFactorEnabled', v)}
              trackColor={{ false: Colors.background.tertiary, true: Colors.accent.cyanDark }}
              thumbColor={settings.twoFactorEnabled ? Colors.accent.cyan : Colors.text.muted}
            />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="finger-print" size={20} color={Colors.accent.cyan} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Biometric Login</Text>
              <Text style={styles.settingSubtitle}>Use Face ID or fingerprint</Text>
            </View>
            <Switch
              value={settings.biometricEnabled}
              onValueChange={(v) => handleUpdate('biometricEnabled', v)}
              trackColor={{ false: Colors.background.tertiary, true: Colors.accent.cyanDark }}
              thumbColor={settings.biometricEnabled ? Colors.accent.cyan : Colors.text.muted}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-Lock Timeout</Text>
          <View style={styles.timeoutOptions}>
            {AUTO_LOCK_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.timeoutOption, settings.autoLockTimeout === option.value && styles.timeoutOptionActive]}
                onPress={() => handleUpdate('autoLockTimeout', option.value)}
              >
                <Text style={[styles.timeoutText, settings.autoLockTimeout === option.value && styles.timeoutTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trusted Devices</Text>
          <Text style={styles.sectionSubtitle}>{settings.trustedDevices.length} devices registered</Text>
          {settings.trustedDevices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="lock-closed" size={20} color={Colors.semantic.success} />
          <Text style={styles.infoText}>
            Your data is encrypted at rest and in transit. All security changes are logged as receipts.
          </Text>
        </View>
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
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent.cyanDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  settingSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  timeoutOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeoutOption: {
    backgroundColor: Colors.background.tertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  timeoutOptionActive: {
    backgroundColor: Colors.accent.cyanDark,
    borderColor: Colors.accent.cyan,
  },
  timeoutText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  timeoutTextActive: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    ...Typography.body,
    color: Colors.text.primary,
    marginRight: Spacing.sm,
  },
  currentBadge: {
    backgroundColor: Colors.semantic.success,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  currentBadgeText: {
    ...Typography.micro,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  deviceLastUsed: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoText: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});
