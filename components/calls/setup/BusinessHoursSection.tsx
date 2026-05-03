/**
 * BusinessHoursSection — Pass 10 Lane B (plan §10.3 Section 3)
 *
 * Numbered "3" — Business Hours. Two sub-columns:
 *   Left:  7-day grid (Mon–Sun). Each row: open/closed checkbox + day label
 *          + start time field + "to" + end time field. Sat/Sun unchecked
 *          show "Closed" instead of time fields.
 *   Right: After-hours handling — 3 radio options + business name
 *          pronunciation override input.
 *
 * Per §12.1: optical alignment between checkbox + day + time fields,
 * pronunciation field has its own focus ring, ≥44pt tap targets.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { SectionPanel } from './SectionPanel';
import type {
  BusinessHoursConfig,
  AfterHoursMode,
  BusinessHourDay,
  DayKey,
} from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BusinessHoursSectionProps {
  config: BusinessHoursConfig;
  onChange: (patch: Partial<BusinessHoursConfig>) => void;
  /** Optional zero-based index for staggered entrance */
  enterIndex?: number;
}

// ---------------------------------------------------------------------------
// Day metadata
// ---------------------------------------------------------------------------

const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const AFTER_HOURS_OPTIONS: { value: AfterHoursMode; label: string; recommended?: boolean }[] = [
  { value: 'TAKE_MESSAGE', label: 'Take a message', recommended: true },
  { value: 'ASK_CALLBACK_WINDOW', label: 'Ask for a callback window' },
  { value: 'TRY_TRANSFER_THEN_MESSAGE', label: 'Try transfer once, then message' },
];

// Common US-business timezones surfaced as a curated list. Anything outside
// this list still round-trips correctly because the dropdown re-uses the
// stored IANA value as both key and label.
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain — no DST (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
];

const DEFAULT_TIMEZONE = 'America/New_York';

// ---------------------------------------------------------------------------
// One-time CSS
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-business-hours-css';
  style.textContent = `
    .fds-time-input { transition: border-color 140ms ease-out, box-shadow 140ms ease-out; }
    .fds-time-input:hover { border-color: rgba(255,255,255,0.18); }
    .fds-time-input:focus, .fds-time-input:focus-visible { outline: none; border-color: rgba(59,130,246,0.55); box-shadow: 0 0 0 3px rgba(59,130,246,0.18); }
    .fds-bh-checkbox { transition: background-color 160ms ease-out, border-color 160ms ease-out, box-shadow 160ms ease-out; }
    .fds-bh-checkbox:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    .fds-ah-row { transition: border-color 180ms ease-out, background-color 180ms ease-out; }
    .fds-ah-row:hover { border-color: rgba(255,255,255,0.16); }
    .fds-ah-row:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusinessHoursSection({ config, onChange, enterIndex }: BusinessHoursSectionProps) {
  injectCss();

  // Look up day or fall back to default
  const getDay = (key: DayKey): BusinessHourDay => {
    const found = config.days.find((d) => d.day === key);
    if (found) return found;
    const isWeekend = key === 'sat' || key === 'sun';
    return {
      day: key,
      open: !isWeekend,
      startTime: '09:00',
      endTime: '17:00',
    };
  };

  const updateDay = (key: DayKey, patch: Partial<BusinessHourDay>) => {
    const next = DAY_ORDER.map((k) => {
      const current = getDay(k);
      if (k !== key) return current;
      return { ...current, ...patch };
    });
    onChange({ days: next });
  };

  const setAfterHours = (m: AfterHoursMode) => onChange({ afterHoursMode: m });
  const setPronunciation = (t: string) => onChange({ pronunciationOverride: t });
  const setTimezone = (tz: string) => onChange({ timezone: tz });
  const setVoicemailEmail = (e: string) => onChange({ voicemailEmail: e });

  const currentTz = config.timezone || DEFAULT_TIMEZONE;
  const currentVm = config.voicemailEmail ?? '';

  return (
    <SectionPanel step={3} title="Business Hours" enterIndex={enterIndex}>
      <View style={styles.twoCol}>
        {/* ----- LEFT: Days grid ------------------------------------------ */}
        <View style={styles.col}>
          <Text style={styles.subhead}>Open hours</Text>
          <View style={styles.daysGrid}>
            {DAY_ORDER.map((key) => {
              const day = getDay(key);
              return (
                <View key={key} style={styles.dayRow}>
                  <Pressable
                    onPress={() => updateDay(key, { open: !day.open })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: day.open }}
                    accessibilityLabel={`${DAY_LABEL[key]} ${day.open ? 'open' : 'closed'}`}
                    style={[styles.checkbox, day.open && styles.checkboxChecked]}
                    {...(Platform.OS === 'web' ? ({ className: 'fds-bh-checkbox' } as any) : {})}
                  >
                    {day.open ? (
                      <Ionicons name="checkmark" size={13} color="#ffffff" />
                    ) : null}
                  </Pressable>

                  <Text style={[styles.dayLabel, !day.open && styles.dayLabelMuted]}>
                    {DAY_LABEL[key]}
                  </Text>

                  {day.open ? (
                    <View style={styles.timesRow}>
                      <TimeInput
                        value={day.startTime ?? '09:00'}
                        onChange={(v) => updateDay(key, { startTime: v })}
                        accessibilityLabel={`${DAY_LABEL[key]} start time`}
                      />
                      <Text style={styles.toSep}>to</Text>
                      <TimeInput
                        value={day.endTime ?? '17:00'}
                        onChange={(v) => updateDay(key, { endTime: v })}
                        accessibilityLabel={`${DAY_LABEL[key]} end time`}
                      />
                    </View>
                  ) : (
                    <Text style={styles.closedLabel}>Closed</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ----- RIGHT: After-hours handling + pronunciation ------------- */}
        <View style={styles.col}>
          <Text style={styles.subhead}>After-hours handling</Text>

          <View style={styles.ahCol} accessibilityRole="radiogroup">
            {AFTER_HOURS_OPTIONS.map((opt) => {
              const selected = config.afterHoursMode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setAfterHours(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${opt.label}${opt.recommended ? ' (recommended)' : ''}`}
                  style={[styles.ahRow, selected && styles.ahRowSelected]}
                  {...(Platform.OS === 'web' ? ({ className: 'fds-ah-row' } as any) : {})}
                >
                  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                  <View style={styles.ahBody}>
                    <Text style={[styles.ahLabel, selected && styles.ahLabelSelected]}>
                      {opt.label}
                      {opt.recommended ? <Text style={styles.recommended}>{'  · recommended'}</Text> : null}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.pronWrap}>
            <Text style={styles.subhead}>Timezone</Text>
            {Platform.OS === 'web' ? (
              <select
                value={currentTz}
                onChange={(e) => setTimezone((e.target as HTMLSelectElement).value)}
                aria-label="Office timezone"
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#fff',
                  paddingLeft: 12,
                  paddingRight: 12,
                  fontSize: 14,
                  width: '100%',
                  outline: 'none',
                }}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
                {!TIMEZONE_OPTIONS.some((t) => t.value === currentTz) ? (
                  <option key={currentTz} value={currentTz}>
                    {currentTz}
                  </option>
                ) : null}
              </select>
            ) : (
              <View style={styles.tzNativeRow}>
                {TIMEZONE_OPTIONS.map((tz) => {
                  const selected = currentTz === tz.value;
                  return (
                    <Pressable
                      key={tz.value}
                      onPress={() => setTimezone(tz.value)}
                      style={[styles.tzChip, selected && styles.tzChipSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.tzChipLabel, selected && styles.tzChipLabelSelected]}>
                        {tz.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.pronWrap}>
            <Text style={styles.subhead}>How to say your business name (optional)</Text>
            <TextInput
              value={config.pronunciationOverride ?? ''}
              onChangeText={setPronunciation}
              placeholder="e.g., Zen-ith So-LOO-shuns"
              placeholderTextColor={Colors.text.muted}
              style={styles.pronInput}
              accessibilityLabel="Business name pronunciation override"
              {...(Platform.OS === 'web' ? ({ className: 'fds-time-input' } as any) : {})}
            />
          </View>

          <View style={styles.pronWrap}>
            <Text style={styles.subhead}>Voicemail email (optional)</Text>
            <TextInput
              value={currentVm}
              onChangeText={setVoicemailEmail}
              placeholder="voicemail@yourbusiness.com"
              placeholderTextColor={Colors.text.muted}
              style={styles.pronInput}
              accessibilityLabel="Voicemail email destination"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              {...(Platform.OS === 'web' ? ({ className: 'fds-time-input' } as any) : {})}
            />
            <Text style={styles.helpText}>
              Where Sarah forwards voicemail transcripts. Leave blank to use your account email.
            </Text>
          </View>
        </View>
      </View>
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// TimeInput — masked HH:MM input with cross-platform fallback
// ---------------------------------------------------------------------------

interface TimeInputProps {
  value: string;
  onChange: (v: string) => void;
  accessibilityLabel: string;
}

function TimeInput({ value, onChange, accessibilityLabel }: TimeInputProps) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="time"
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        aria-label={accessibilityLabel}
        className="fds-time-input"
        style={timeInputWebStyle}
      />
    );
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="HH:MM"
      placeholderTextColor={Colors.text.muted}
      style={styles.timeInputNative}
      accessibilityLabel={accessibilityLabel}
      maxLength={5}
    />
  );
}

const timeInputWebStyle: React.CSSProperties = {
  height: 36,
  paddingLeft: 10,
  paddingRight: 8,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.10)',
  backgroundColor: '#0d0d10',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'inherit',
  width: 110,
  letterSpacing: 0.2,
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  twoCol: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  col: {
    flex: 1,
    minWidth: 280,
    gap: 12,
  },

  subhead: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // ----- Days grid ------------------------------------------------------
  daysGrid: {
    gap: 6,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 3px rgba(59,130,246,0.18)' } as object)
      : {}),
  } as any,
  dayLabel: {
    width: 36,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  dayLabelMuted: {
    color: Colors.text.muted,
  },

  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  toSep: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  closedLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
    fontStyle: 'italic',
    paddingLeft: 4,
  },
  timeInputNative: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#0d0d10',
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '500',
    width: 100,
  } as any,

  // ----- After-hours options -------------------------------------------
  ahCol: {
    gap: 6,
  },
  ahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 44,
  },
  ahRowSelected: {
    backgroundColor: 'rgba(59,130,246,0.07)',
    borderColor: 'rgba(59,130,246,0.42)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 1px rgba(59,130,246,0.22), 0 0 14px rgba(59,130,246,0.10)' } as object)
      : { shadowColor: '#3B82F6', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }),
  } as any,
  ahBody: {
    flex: 1,
  },
  ahLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  ahLabelSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  recommended: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.semantic.success,
    fontStyle: 'italic',
  },

  // Radio
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.accent.cyan,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
  },

  // ----- Pronunciation -------------------------------------------------
  pronWrap: {
    gap: 6,
    marginTop: 6,
  },
  pronInput: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#0d0d10',
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  } as any,
  helpText: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
    lineHeight: 14,
  },

  // ----- Timezone (native fallback) ----------------------------------------
  tzNativeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tzChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tzChipSelected: {
    borderColor: 'rgba(59,130,246,0.55)',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  tzChipLabel: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  tzChipLabelSelected: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
});

export default BusinessHoursSection;
