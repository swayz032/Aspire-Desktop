import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Text, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageHeader } from '@/components/PageHeader';
import { AppearanceSettings } from '@/types/tenant';

type Theme = 'dark' | 'light' | 'system';
type FontSize = 'small' | 'medium' | 'large';

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'light', label: 'Light', icon: 'sunny' },
  { value: 'system', label: 'System', icon: 'phone-portrait' },
];

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export default function AppearanceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 60;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppearanceSettings>({
    theme: 'dark',
    compactMode: false,
    fontSize: 'medium',
  });

  useEffect(() => {
    // Appearance preferences are local-only; use defaults
    setLoading(false);
  }, []);

  const handleUpdate = (key: keyof AppearanceSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
  };

  return (
    <View style={styles.container}>
      <PageHeader title="Appearance" showBackButton />
      
      <ScrollView style={[styles.scrollView, { paddingTop: headerHeight }]} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeOptions}>
            {THEME_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.themeOption, settings.theme === option.value && styles.themeOptionActive]}
                onPress={() => handleUpdate('theme', option.value)}
              >
                <Ionicons 
                  name={option.icon as any} 
                  size={24} 
                  color={settings.theme === option.value ? Colors.accent.cyan : Colors.text.secondary} 
                />
                <Text style={[styles.themeLabel, settings.theme === option.value && styles.themeLabelActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Font Size</Text>
          <View style={styles.fontSizeOptions}>
            {FONT_SIZE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.fontSizeOption, settings.fontSize === option.value && styles.fontSizeOptionActive]}
                onPress={() => handleUpdate('fontSize', option.value)}
              >
                <Text style={[
                  styles.fontSizeLabel, 
                  settings.fontSize === option.value && styles.fontSizeLabelActive,
                  option.value === 'small' && { fontSize: 12 },
                  option.value === 'large' && { fontSize: 18 },
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="apps" size={20} color={Colors.accent.cyan} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Compact Mode</Text>
              <Text style={styles.settingSubtitle}>Show more items on screen</Text>
            </View>
            <Switch
              value={settings.compactMode}
              onValueChange={(v) => handleUpdate('compactMode', v)}
              trackColor={{ false: Colors.background.tertiary, true: Colors.accent.cyanDark }}
              thumbColor={settings.compactMode ? Colors.accent.cyan : Colors.text.muted}
            />
          </View>
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={styles.previewContent}>
            <Text style={styles.previewText}>
              This is how text will appear with your current settings.
            </Text>
          </View>
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
  themeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.xs,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanDark,
  },
  themeLabel: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  themeLabelActive: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  fontSizeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fontSizeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.xs,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fontSizeOptionActive: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyanDark,
  },
  fontSizeLabel: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  fontSizeLabelActive: {
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
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
  previewCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  previewTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  previewContent: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  previewText: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
});
