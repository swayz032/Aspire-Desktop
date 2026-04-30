/**
 * PublicNumberSection — Pass 10 Lane B (plan §10.3 Section 1)
 *
 * Numbered "1" — Public Number. Two stacked option cards (radio-style).
 * When `ASPIRE_NUMBER` is selected, a sub-form reveals beneath:
 *   - Area code dropdown (e.g., 212)
 *   - Contains optional input (vanity filter, e.g., "PAINT")
 *   - Row of 3 selectable AvailableNumber cards (each with capability pills)
 *
 * Per §12.1 Framer-style: every selectable surface has layered depth
 * (border + inner glow on selected), spring transitions on selection,
 * focus rings on every input, ≥44pt tap targets.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { SectionPanel } from './SectionPanel';
import {
  AspireNumberPickerSheet,
  type PurchasedNumberResult,
} from './AspireNumberPickerSheet';
import type {
  PublicNumberConfig,
  PublicNumberMode,
  AvailableNumber,
} from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PublicNumberSectionProps {
  config: PublicNumberConfig;
  onChange: (patch: Partial<PublicNumberConfig>) => void;
  /** Available numbers to select from (when ASPIRE_NUMBER mode) */
  availableNumbers?: AvailableNumber[];
  /** Optional area-code suggestions */
  areaCodeOptions?: string[];
  /** Optional zero-based index for staggered entrance */
  enterIndex?: number;
}

// ---------------------------------------------------------------------------
// One-time CSS — focus rings + select polish (web)
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-public-number-css';
  style.textContent = `
    .fds-input { transition: border-color 140ms ease-out, box-shadow 140ms ease-out, background-color 140ms ease-out; }
    .fds-input:hover { border-color: rgba(255,255,255,0.18); }
    .fds-input:focus, .fds-input:focus-visible { outline: none; border-color: rgba(59,130,246,0.55); box-shadow: 0 0 0 3px rgba(59,130,246,0.18); }
    .fds-option-card { transition: border-color 180ms cubic-bezier(0.16,1,0.3,1), background-color 180ms ease-out, box-shadow 180ms ease-out, transform 160ms ease-out; }
    .fds-option-card:hover { transform: translateY(-1px); }
    .fds-option-card:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    .fds-find-btn { transition: border-color 180ms ease-out, background-color 180ms ease-out, transform 160ms ease-out; }
    .fds-find-btn:hover { transform: translateY(-1px); border-color: rgba(59,130,246,0.55); background-color: rgba(59,130,246,0.06); }
    .fds-find-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    @keyframes fds-reveal {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fds-reveal { animation: fds-reveal 280ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

const DEFAULT_AREA_CODES = ['212', '404', '415', '512', '617', '305', '646', '917'];

export function PublicNumberSection({
  config,
  onChange,
  availableNumbers = [],
  areaCodeOptions = DEFAULT_AREA_CODES,
  enterIndex,
}: PublicNumberSectionProps) {
  injectCss();

  const setMode = (mode: PublicNumberMode) => onChange({ mode });
  const showAspireSubform = config.mode === 'ASPIRE_NUMBER';
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const handlePurchased = React.useCallback(
    (result: PurchasedNumberResult) => {
      // Update parent with the purchased number — Pass 17 will also persist
      // the active number to the FrontDeskConfig.publicNumber via a
      // dedicated mutation. For now we record the selection.
      onChange({
        selectedNumberId: result.phoneNumber,
      });
    },
    [onChange],
  );

  return (
    <SectionPanel step={1} title="Public Number" enterIndex={enterIndex}>
      <View style={styles.optionStack}>
        <OptionCard
          selected={config.mode === 'ASPIRE_NUMBER'}
          onPress={() => setMode('ASPIRE_NUMBER')}
          title="Get an Aspire business number"
          subtitle="Full duplex — inbound and outbound"
          pills={[
            { label: 'Inbound ready', tone: 'success' },
            { label: 'Outbound available', tone: 'info' },
          ]}
        />
        <OptionCard
          selected={config.mode === 'KEEP_CURRENT_NUMBER'}
          onPress={() => setMode('KEEP_CURRENT_NUMBER')}
          title="Keep my current number"
          subtitle="Forward inbound calls to Sarah"
        />
      </View>

      {showAspireSubform ? (
        <View
          style={styles.subform}
          {...(Platform.OS === 'web' ? ({ className: 'fds-reveal' } as any) : {})}
        >
          <View style={styles.subformDivider} />

          {/* Area code + vanity filter row */}
          <View style={styles.filterRow}>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Area code</Text>
              <SimpleSelect
                value={config.areaCode ?? ''}
                placeholder="Select area code"
                options={areaCodeOptions}
                onChange={(v) => onChange({ areaCode: v })}
                accessibilityLabel="Area code"
              />
            </View>
            <View style={styles.fieldCol}>
              <Text style={styles.fieldLabel}>Contains (optional)</Text>
              <TextInput
                value={config.containsFilter ?? ''}
                onChangeText={(t) => onChange({ containsFilter: t })}
                placeholder="e.g., PAINT"
                placeholderTextColor={Colors.text.muted}
                style={styles.textInput}
                autoCapitalize="characters"
                accessibilityLabel="Vanity contains filter"
                {...(Platform.OS === 'web' ? ({ className: 'fds-input' } as any) : {})}
              />
            </View>
          </View>

          {/* Active number display + picker entry point ----------------- */}
          {config.selectedNumberId ? (
            <ActiveNumberCard
              number={
                availableNumbers.find((n) => n.id === config.selectedNumberId)?.number ??
                config.selectedNumberId
              }
              onChange={() => setPickerOpen(true)}
            />
          ) : (
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Find an Aspire number"
              accessibilityHint="Opens a search sheet to pick and purchase a real Twilio number"
              style={styles.findBtn}
              {...(Platform.OS === 'web' ? ({ className: 'fds-find-btn' } as any) : {})}
            >
              <View style={styles.findBtnIcon}>
                <Ionicons name="search" size={16} color={Colors.accent.cyan} />
              </View>
              <View style={styles.findBtnCol}>
                <Text style={styles.findBtnTitle}>Find an Aspire number</Text>
                <Text style={styles.findBtnSubtitle}>
                  Search by area code, optionally filter by a vanity word.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Picker sheet — controlled at section level */}
      <AspireNumberPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPurchased={handlePurchased}
        initialAreaCode={config.areaCode ?? ''}
        initialContains={config.containsFilter ?? ''}
      />
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// ActiveNumberCard — shown after a number is selected/purchased
// ---------------------------------------------------------------------------

interface ActiveNumberCardProps {
  number: string;
  onChange: () => void;
}

function ActiveNumberCard({ number, onChange }: ActiveNumberCardProps) {
  return (
    <View style={styles.activeCard}>
      <View style={styles.activeIcon}>
        <Ionicons name="call" size={16} color={Colors.semantic.success} />
      </View>
      <View style={styles.activeCol}>
        <Text style={styles.activeLabel}>Active Aspire number</Text>
        <Text style={styles.activeNumber}>{number}</Text>
      </View>
      <View style={styles.activePill}>
        <View style={styles.activePillDot} />
        <Text style={styles.activePillText}>Active</Text>
      </View>
      <Pressable
        onPress={onChange}
        accessibilityRole="button"
        accessibilityLabel="Change number"
        style={styles.activeChangeBtn}
        {...(Platform.OS === 'web' ? ({ className: 'fds-find-btn' } as any) : {})}
      >
        <Text style={styles.activeChangeText}>Change</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// OptionCard — large radio-style selectable card
// ---------------------------------------------------------------------------

interface OptionCardProps {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  pills?: { label: string; tone: 'success' | 'info' }[];
}

function OptionCard({ selected, onPress, title, subtitle, pills }: OptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={[
        styles.optionCard,
        selected && styles.optionCardSelected,
      ]}
      {...(Platform.OS === 'web' ? ({ className: 'fds-option-card' } as any) : {})}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>

      <View style={styles.optionBody}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
          {title}
        </Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>

        {pills && pills.length > 0 ? (
          <View style={styles.pillRow}>
            {pills.map((pill) => (
              <CapabilityPill key={pill.label} label={pill.label} tone={pill.tone} />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CapabilityPill — small status pill with semantic tone
// ---------------------------------------------------------------------------

interface CapabilityPillProps {
  label: string;
  tone: 'success' | 'info';
  small?: boolean;
}

function CapabilityPill({ label, tone, small }: CapabilityPillProps) {
  const palette =
    tone === 'success'
      ? { bg: 'rgba(52,199,89,0.14)', border: 'rgba(52,199,89,0.32)', dot: Colors.semantic.success, text: Colors.semantic.success }
      : { bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.32)', dot: Colors.accent.cyan, text: Colors.accent.cyan };

  return (
    <View
      style={[
        styles.capPill,
        small && styles.capPillSm,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
      accessibilityRole="text"
    >
      <View style={[styles.capPillDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.capPillText, small && styles.capPillTextSm, { color: palette.text }]}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SimpleSelect — cross-platform single-value picker
// ---------------------------------------------------------------------------

interface SimpleSelectProps {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
  accessibilityLabel: string;
}

function SimpleSelect({ value, options, placeholder, onChange, accessibilityLabel }: SimpleSelectProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.selectWrap}>
        <select
          value={value}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
          aria-label={accessibilityLabel}
          className="fds-input"
          style={selectWebStyle}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <View style={styles.selectChevron} pointerEvents="none">
          <Ionicons name="chevron-down" size={14} color={Colors.text.tertiary} />
        </View>
      </View>
    );
  }

  // Native fallback — read-only text input that cycles via tap.
  // Real-world implementations would use a modal sheet here.
  return (
    <Pressable
      onPress={() => {
        const idx = options.indexOf(value);
        const next = options[(idx + 1) % options.length];
        onChange(next);
      }}
      style={styles.textInput}
      accessibilityRole="combobox"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: value || placeholder }}
    >
      <Text style={{ color: value ? Colors.text.primary : Colors.text.muted, fontSize: 14, fontWeight: '500' }}>
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

const selectWebStyle: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  width: '100%',
  height: 44,
  paddingLeft: 14,
  paddingRight: 36,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.10)',
  backgroundColor: '#0d0d10',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  letterSpacing: 0.1,
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  optionStack: {
    gap: 10,
  },

  // ----- OptionCard -----------------------------------------------------
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 64,
  },
  optionCardSelected: {
    backgroundColor: 'rgba(59,130,246,0.07)',
    borderColor: 'rgba(59,130,246,0.45)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 1px rgba(59,130,246,0.25), 0 0 24px rgba(59,130,246,0.15)' } as object)
      : { shadowColor: '#3B82F6', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }),
  } as any,
  optionBody: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 20,
  },
  optionTitleSelected: {
    color: '#ffffff',
  },
  optionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },

  // ----- Radio dot ------------------------------------------------------
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioOuterSelected: {
    borderColor: Colors.accent.cyan,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.accent.cyan,
  },
  // ----- CapabilityPill -------------------------------------------------
  capPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  capPillSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  capPillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  capPillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  capPillTextSm: {
    fontSize: 10,
  },

  // ----- Subform reveal -------------------------------------------------
  subform: {
    marginTop: 16,
    gap: 16,
  },
  subformDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  filterRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  fieldCol: {
    flex: 1,
    minWidth: 200,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.2,
    marginBottom: 2,
  },

  textInput: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#0d0d10',
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
    justifyContent: 'center',
  } as any,

  selectWrap: {
    position: 'relative' as const,
    width: '100%',
  },
  selectChevron: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ----- Find button (entry point to the picker sheet) ------------------
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderStyle: 'dashed' as ViewStyle['borderStyle'],
    borderColor: 'rgba(59,130,246,0.28)',
    minHeight: 64,
  },
  findBtnIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
  },
  findBtnCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  findBtnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  findBtnSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 16,
  },

  // ----- Active number card --------------------------------------------
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(52,199,89,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.32)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 1px rgba(52,199,89,0.10), 0 0 22px rgba(52,199,89,0.10)' } as object)
      : {
          shadowColor: Colors.semantic.success,
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,
  activeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,199,89,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.34)',
  },
  activeCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activeNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(52,199,89,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.34)',
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.success,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.semantic.success,
    letterSpacing: 0.2,
  },
  activeChangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  activeChangeText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
});

export default PublicNumberSection;
