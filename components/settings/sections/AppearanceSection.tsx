/**
 * Appearance section.
 * Theme selection, accent color, display density.
 * Currently dark theme only, but structured for future expansion.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader, PillGroup, SelectField, ToggleField, Divider } from '../SettingsField';
import { SettingsColors, TRANSITION_SMOOTH } from '../settingsConstants';

const ACCENT_COLORS = [
  { value: 'blue', label: 'Sapphire', color: '#3B82F6' },
  { value: 'cyan', label: 'Cyan', color: '#06B6D4' },
  { value: 'violet', label: 'Violet', color: '#8B5CF6' },
  { value: 'emerald', label: 'Emerald', color: '#10B981' },
  { value: 'amber', label: 'Amber', color: '#F59E0B' },
  { value: 'rose', label: 'Rose', color: '#F43F5E' },
];

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
  { value: 'spacious', label: 'Spacious' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export default function AppearanceSection() {
  const [accentColor, setAccentColor] = useState('blue');
  const [density, setDensity] = useState('comfortable');
  const [fontSize, setFontSize] = useState('medium');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);

  return (
    <View>
      <SectionHeader
        title="Appearance"
        subtitle="Customize how Aspire looks and feels"
        icon="color-palette-outline"
      />

      {/* Theme */}
      <Text style={styles.groupTitle}>Theme</Text>
      <View style={styles.themeGrid}>
        {[
          { id: 'dark', label: 'Dark', icon: 'moon-outline' as const, active: true },
          { id: 'light', label: 'Light', icon: 'sunny-outline' as const, active: false, comingSoon: true },
          { id: 'system', label: 'System', icon: 'desktop-outline' as const, active: false, comingSoon: true },
        ].map(t => (
          <Pressable
            key={t.id}
            style={[
              styles.themeCard,
              t.active && styles.themeCardActive,
              t.comingSoon && styles.themeCardDisabled,
            ]}
            disabled={t.comingSoon}
          >
            <View style={[styles.themePreview, t.active && styles.themePreviewActive]}>
              <Ionicons
                name={t.icon}
                size={24}
                color={t.active ? SettingsColors.accent : '#48484a'}
              />
            </View>
            <Text style={[styles.themeLabel, t.active && styles.themeLabelActive]}>{t.label}</Text>
            {t.active && (
              <View style={styles.themeCheckmark}>
                <Ionicons name="checkmark-circle" size={16} color={SettingsColors.accent} />
              </View>
            )}
            {t.comingSoon && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Soon</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <Divider />

      {/* Accent Color */}
      <PillGroup
        label="Accent Color"
        options={ACCENT_COLORS}
        value={accentColor}
        onValueChange={setAccentColor}
      />

      <View style={styles.spacer} />

      {/* Accent preview */}
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Preview</Text>
        </View>
        <View style={styles.previewBody}>
          <View style={[
            styles.previewButton,
            { backgroundColor: ACCENT_COLORS.find(c => c.value === accentColor)?.color || '#3B82F6' },
          ]}>
            <Text style={styles.previewButtonText}>Primary Action</Text>
          </View>
          <View style={[
            styles.previewBadge,
            {
              backgroundColor: `${ACCENT_COLORS.find(c => c.value === accentColor)?.color || '#3B82F6'}18`,
              borderColor: `${ACCENT_COLORS.find(c => c.value === accentColor)?.color || '#3B82F6'}30`,
            },
          ]}>
            <Text style={[
              styles.previewBadgeText,
              { color: ACCENT_COLORS.find(c => c.value === accentColor)?.color || '#3B82F6' },
            ]}>Active</Text>
          </View>
          <View style={[
            styles.previewDot,
            { backgroundColor: ACCENT_COLORS.find(c => c.value === accentColor)?.color || '#3B82F6' },
          ]} />
        </View>
      </View>

      <Divider />

      {/* Layout & Display */}
      <Text style={styles.groupTitle}>Layout & Display</Text>
      <SelectField
        label="Display Density"
        value={density}
        options={DENSITY_OPTIONS}
        onValueChange={setDensity}
        hint="Controls spacing between UI elements"
      />
      <SelectField
        label="Font Size"
        value={fontSize}
        options={FONT_SIZE_OPTIONS}
        onValueChange={setFontSize}
      />

      <Divider />

      {/* Accessibility */}
      <Text style={styles.groupTitle}>Accessibility</Text>
      <ToggleField
        label="Reduce Motion"
        description="Minimize animations and transitions throughout the interface"
        value={reduceMotion}
        onValueChange={setReduceMotion}
      />
      <ToggleField
        label="Reduce Transparency"
        description="Use solid backgrounds instead of blur effects"
        value={reduceTransparency}
        onValueChange={setReduceTransparency}
      />
      <ToggleField
        label="Show Breadcrumbs"
        description="Display navigation breadcrumbs at the top of pages"
        value={showBreadcrumbs}
        onValueChange={setShowBreadcrumbs}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d1d6',
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  themeCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#111113',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    ...(Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH, cursor: 'pointer' } : {}),
  } as ViewStyle,
  themeCardActive: {
    borderColor: SettingsColors.accentBorder,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  themeCardDisabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web' ? { cursor: 'default' as const } : {}),
  } as ViewStyle,
  themePreview: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themePreviewActive: {
    backgroundColor: SettingsColors.accentBg,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6e6e73',
  },
  themeLabelActive: {
    color: '#f2f2f2',
  },
  themeCheckmark: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#48484a',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  spacer: {
    height: 20,
  },
  previewCard: {
    backgroundColor: '#111113',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  previewHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6e6e73',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  previewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  previewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
