/**
 * Reusable form field primitives for Settings sections.
 * Provides TextField, ToggleField, SelectField, and SectionHeader.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsColors, TRANSITION_SMOOTH } from './settingsConstants';

/* ------------------------------------------------------------------ */
/*  Section Header                                                     */
/* ------------------------------------------------------------------ */

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  badge?: string;
  badgeColor?: string;
}

export function SectionHeader({ title, subtitle, icon, badge, badgeColor }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon && (
          <View style={styles.sectionIcon}>
            <Ionicons name={icon} size={18} color={SettingsColors.accent} />
          </View>
        )}
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {badge && (
        <View style={[styles.sectionBadge, badgeColor ? { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}30` } : undefined]}>
          <Text style={[styles.sectionBadgeText, badgeColor ? { color: badgeColor } : undefined]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Text Field                                                         */
/* ------------------------------------------------------------------ */

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  hint?: string;
  error?: string;
  suffix?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  readOnly = false,
  multiline = false,
  numberOfLines = 1,
  hint,
  error,
  suffix,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[
        styles.inputRow,
        focused && styles.inputRowFocused,
        readOnly && styles.inputRowReadOnly,
        error ? styles.inputRowError : undefined,
      ]}>
        <TextInput
          style={[
            styles.textInput,
            multiline && { minHeight: numberOfLines * 22, textAlignVertical: 'top' as const },
            readOnly && styles.textInputReadOnly,
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as unknown as TextStyle),
          ]}
          value={value}
          onChangeText={readOnly ? undefined : onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#48484a"
          editable={!readOnly}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
        {readOnly && (
          <View style={styles.readOnlyBadge}>
            <Ionicons name="lock-closed" size={12} color="#6e6e73" />
          </View>
        )}
      </View>
      {hint && !error && <Text style={styles.fieldHint}>{hint}</Text>}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Field                                                       */
/* ------------------------------------------------------------------ */

interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleField({ label, description, value, onValueChange, disabled = false }: ToggleFieldProps) {
  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.toggleRow,
        hovered && !disabled ? styles.toggleRowHover : undefined,
        disabled ? styles.toggleRowDisabled : undefined,
      ] as ViewStyle[]}
    >
      <View style={styles.toggleInfo}>
        <Text style={[styles.toggleLabel, disabled && styles.toggleLabelDisabled]}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn, disabled && styles.toggleTrackDisabled]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  Select Field (dropdown-like)                                       */
/* ------------------------------------------------------------------ */

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange?: (value: string) => void;
  hint?: string;
}

export function SelectField({ label, value, options, onValueChange, hint }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => setOpen(!open)}
        style={({ hovered }: { hovered?: boolean }) => [
          styles.selectTrigger,
          hovered && styles.selectTriggerHover,
          open && styles.selectTriggerOpen,
        ] as ViewStyle[]}
      >
        <Text style={styles.selectValue}>{selectedLabel}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#6e6e73" />
      </Pressable>
      {open && (
        <View style={styles.selectDropdown}>
          {options.map(opt => (
            <Pressable
              key={opt.value}
              onPress={() => { onValueChange?.(opt.value); setOpen(false); }}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.selectOption,
                opt.value === value && styles.selectOptionActive,
                hovered && styles.selectOptionHover,
              ] as ViewStyle[]}
            >
              <Text style={[styles.selectOptionText, opt.value === value && styles.selectOptionTextActive]}>{opt.label}</Text>
              {opt.value === value && <Ionicons name="checkmark" size={14} color={SettingsColors.accent} />}
            </Pressable>
          ))}
        </View>
      )}
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Pill Group (for non-dropdown multi-option like accent colors)       */
/* ------------------------------------------------------------------ */

interface PillGroupProps {
  label: string;
  options: { value: string; label: string; color?: string }[];
  value: string;
  onValueChange?: (value: string) => void;
}

export function PillGroup({ label, options, value, onValueChange }: PillGroupProps) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map(opt => (
          <Pressable
            key={opt.value}
            onPress={() => onValueChange?.(opt.value)}
            style={[
              styles.pill,
              opt.value === value && styles.pillActive,
            ]}
          >
            {opt.color && <View style={[styles.pillDot, { backgroundColor: opt.color }]} />}
            <Text style={[styles.pillText, opt.value === value && styles.pillTextActive]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Divider                                                            */
/* ------------------------------------------------------------------ */

export function Divider() {
  return <View style={styles.divider} />;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const webTransition = Platform.OS === 'web' ? { transition: TRANSITION_SMOOTH } : {};
const webCursor = Platform.OS === 'web' ? { cursor: 'pointer' as const } : {};
const webInputOutline = Platform.OS === 'web' ? { outlineStyle: 'none' as const } : {};

const styles = StyleSheet.create({
  /* Section Header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: SettingsColors.divider,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: SettingsColors.accentBg,
    borderWidth: 1,
    borderColor: SettingsColors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f2f2f2',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 2,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: SettingsColors.accentBg,
    borderWidth: 1,
    borderColor: SettingsColors.accentBorder,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: SettingsColors.accent,
    letterSpacing: 0.3,
  },

  /* Text Field */
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1a6',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SettingsColors.input,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SettingsColors.inputBorder,
    paddingHorizontal: 14,
    minHeight: 44,
    ...webTransition,
  } as ViewStyle,
  inputRowFocused: {
    borderColor: SettingsColors.inputBorderFocus,
    backgroundColor: '#16161A',
  },
  inputRowReadOnly: {
    backgroundColor: '#0E0E10',
    borderColor: '#1E1E20',
  },
  inputRowError: {
    borderColor: SettingsColors.destructive,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#f2f2f2',
    fontWeight: '500' as const,
    paddingVertical: 10,
  },
  textInputReadOnly: {
    color: '#6e6e73',
  },
  inputSuffix: {
    fontSize: 12,
    color: '#48484a',
    marginLeft: 8,
  },
  readOnlyBadge: {
    marginLeft: 8,
    opacity: 0.5,
  },
  fieldHint: {
    fontSize: 11,
    color: '#48484a',
    marginTop: 6,
  },
  fieldError: {
    fontSize: 11,
    color: SettingsColors.destructive,
    marginTop: 6,
  },

  /* Toggle Field */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
    ...webTransition,
    ...webCursor,
  } as ViewStyle,
  toggleRowHover: {
    backgroundColor: SettingsColors.fieldRowHover,
  },
  toggleRowDisabled: {
    opacity: 0.5,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#d1d1d6',
  },
  toggleLabelDisabled: {
    color: '#6e6e73',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 3,
    lineHeight: 16,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: SettingsColors.toggleOff,
    justifyContent: 'center',
    paddingHorizontal: 2,
    ...webTransition,
  } as ViewStyle,
  toggleTrackOn: {
    backgroundColor: SettingsColors.toggleOn,
  },
  toggleTrackDisabled: {
    opacity: 0.4,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    ...webTransition,
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 3px rgba(0,0,0,0.3)' } : {}),
  } as ViewStyle,
  toggleThumbOn: {
    ...(Platform.OS === 'web' ? { transform: 'translateX(20px)' } : { transform: [{ translateX: 20 }] }),
  } as ViewStyle,

  /* Select Field */
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SettingsColors.input,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SettingsColors.inputBorder,
    paddingHorizontal: 14,
    minHeight: 44,
    ...webTransition,
    ...webCursor,
  } as ViewStyle,
  selectTriggerHover: {
    borderColor: '#3C3C3E',
    backgroundColor: '#18181A',
  },
  selectTriggerOpen: {
    borderColor: SettingsColors.accent,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  selectDropdown: {
    backgroundColor: SettingsColors.input,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: SettingsColors.inputBorder,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0,0,0,0.4)' } : {}),
  } as ViewStyle,
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...webTransition,
    ...webCursor,
  } as ViewStyle,
  selectOptionActive: {
    backgroundColor: SettingsColors.accentBg,
  },
  selectOptionHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  selectOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#d1d1d6',
  },
  selectOptionTextActive: {
    color: SettingsColors.accent,
    fontWeight: '600',
  },

  /* Pill Group */
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
    ...webTransition,
    ...webCursor,
  } as ViewStyle,
  pillActive: {
    backgroundColor: SettingsColors.accentBg,
    borderColor: SettingsColors.accentBorder,
  },
  pillDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a1a1a6',
  },
  pillTextActive: {
    color: SettingsColors.accent,
    fontWeight: '600',
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: SettingsColors.divider,
    marginVertical: 24,
  },
});
