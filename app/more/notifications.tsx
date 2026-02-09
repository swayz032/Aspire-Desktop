import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { seedDatabase } from '@/lib/mockSeed';
import { getNotificationSettings, updateNotificationSettings } from '@/lib/mockDb';
import { NotificationSettings } from '@/types/tenant';

function SettingRow({ icon, title, subtitle, value, onChange }: { 
  icon: string; 
  title: string; 
  subtitle: string; 
  value: boolean; 
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.accent.cyan} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.background.tertiary, true: Colors.accent.cyanDark }}
        thumbColor={value ? Colors.accent.cyan : Colors.text.muted}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    dailyDigest: true,
    urgentOnly: false,
  });

  useEffect(() => {
    seedDatabase();
    const timer = setTimeout(() => {
      setSettings(getNotificationSettings());
      setLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = (key: keyof NotificationSettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    updateNotificationSettings(updated);
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Notifications" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Channels</Text>
          <SettingRow
            icon="notifications"
            title="Push Notifications"
            subtitle="Receive alerts on your device"
            value={settings.pushEnabled}
            onChange={(v) => handleUpdate('pushEnabled', v)}
          />
          <SettingRow
            icon="mail"
            title="Email Notifications"
            subtitle="Get updates in your inbox"
            value={settings.emailEnabled}
            onChange={(v) => handleUpdate('emailEnabled', v)}
          />
          <SettingRow
            icon="chatbubble"
            title="SMS Notifications"
            subtitle="Receive text message alerts"
            value={settings.smsEnabled}
            onChange={(v) => handleUpdate('smsEnabled', v)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <SettingRow
            icon="today"
            title="Daily Digest"
            subtitle="Receive a daily summary email"
            value={settings.dailyDigest}
            onChange={(v) => handleUpdate('dailyDigest', v)}
          />
          <SettingRow
            icon="alert-circle"
            title="Urgent Only"
            subtitle="Only notify for high priority items"
            value={settings.urgentOnly}
            onChange={(v) => handleUpdate('urgentOnly', v)}
          />
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.accent.cyan} />
          <Text style={styles.infoText}>
            Changes to notification settings are logged as receipts for compliance purposes.
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.accent.cyanDark,
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
