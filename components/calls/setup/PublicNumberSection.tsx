/**
 * PublicNumberSection — Pass 19 Lane A rewrite (plan §3.1 + §3.8 + §6.1).
 *
 * Section 1 of the Front Desk Setup page. Three honest cards of how Sarah
 * gets a public phone number — the legacy 2-card binary lied about what
 * actually happens in 2026; this is the truthful 3-mode model:
 *
 *   1. ASPIRE_NEW_NUMBER (default selected) — Aspire purchases a new local
 *      10DLC or toll-free via Twilio. Sarah answers it directly. Voice +
 *      SMS work end-to-end. Best for new businesses.
 *
 *   2. FORWARD_EXISTING — User keeps their existing carrier; Aspire issues
 *      a forward-target number; user sets carrier-specific conditional-
 *      forwarding codes (AT&T `**21*` / `**61*`, Verizon `*72` / `*71`,
 *      T-Mobile `**21*` / `**61*`) to forward inbound calls to Sarah. Per
 *      §3.8 the user also gets a new Aspire number for SMS + Ava reminders;
 *      customers texting their existing number stay on the existing carrier
 *      (Aspire never sees those messages).
 *
 *   3. PORT_IN — V1.1 stub. Twilio takes over the number entirely (LOA +
 *      utility bill). 7–14 day port window.
 *
 * Per §12.1 Framer-style:
 *   - Editorial layout: each card is its own composed surface with a
 *     thoughtful icon, kicker, hero title, body copy, capability pills,
 *     and a connecting tab indicator on the selected state.
 *   - Layered depth: outer card → inner glow → ambient background gradient.
 *     Selected state adds a top-edge accent bar + amplified shadow halo.
 *   - Cinematic motion: card lifts on hover, ambient pulse on the
 *     selected one, sub-form reveals with a 280ms cubic-bezier ease.
 *   - Cohesive: matches SectionPanel + ForwardingInstructionsCard chrome.
 *
 * Inline area-code dropdown / vanity input have been **removed** — the
 * `AspireNumberPickerSheet` owns those inputs (single source of truth).
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { SectionPanel } from './SectionPanel';
import {
  AspireNumberPickerSheet,
  type PurchasedNumberResult,
} from './AspireNumberPickerSheet';
import { ForwardingInstructionsCard } from './ForwardingInstructionsCard';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  fetchForwardingInstructions,
  type ForwardingInstructionsWire,
} from '@/lib/api/frontDesk';
import type {
  PublicNumberConfig,
  PublicNumberMode,
  CarrierName,
  ForwardingCodeSet,
} from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PublicNumberSectionProps {
  config: PublicNumberConfig;
  onChange: (patch: Partial<PublicNumberConfig>) => void;
  /** Optional zero-based index for staggered entrance */
  enterIndex?: number;
  /** Fired when forwarding test CTA is pressed (parent fires the orchestrator call). */
  onTestForwarding?: () => void;
  /** Indicates an in-flight forwarding test (drives the spinner on the test CTA). */
  isTestingForwarding?: boolean;
}

// ---------------------------------------------------------------------------
// One-time CSS — option-card depth + sub-form reveal
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-public-number-css';
  style.textContent = `
    @keyframes fds-pn-reveal {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fds-pn-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.32), 0 0 0 1px rgba(59,130,246,0.40), 0 18px 36px -8px rgba(59,130,246,0.30); }
      50%  { box-shadow: 0 0 0 6px rgba(59,130,246,0.00), 0 0 0 1px rgba(59,130,246,0.40), 0 18px 36px -8px rgba(59,130,246,0.30); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.00), 0 0 0 1px rgba(59,130,246,0.40), 0 18px 36px -8px rgba(59,130,246,0.30); }
    }
    .fds-pn-card { transition: border-color 220ms cubic-bezier(0.16,1,0.3,1), background-color 220ms ease-out, box-shadow 220ms ease-out, transform 180ms ease-out; }
    .fds-pn-card:hover { transform: translateY(-2px); }
    .fds-pn-card:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 4px; border-radius: 16px; }
    .fds-pn-card--selected { animation: fds-pn-pulse 2400ms ease-in-out 1; }
    .fds-pn-reveal { animation: fds-pn-reveal 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .fds-pn-input { transition: border-color 140ms ease-out, box-shadow 140ms ease-out, background-color 140ms ease-out; }
    .fds-pn-input:hover { border-color: rgba(255,255,255,0.18); }
    .fds-pn-input:focus, .fds-pn-input:focus-visible { outline: none; border-color: rgba(59,130,246,0.55); box-shadow: 0 0 0 3px rgba(59,130,246,0.18); }
    .fds-pn-cta-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out; }
    .fds-pn-cta-btn:hover { transform: translateY(-1px); border-color: rgba(59,130,246,0.55); background-color: rgba(59,130,246,0.10); }
    .fds-pn-cta-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) {
      .fds-pn-card, .fds-pn-card--selected, .fds-pn-reveal, .fds-pn-input, .fds-pn-cta-btn { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Card metadata — honest 3-mode copy per §3.1
// ---------------------------------------------------------------------------

interface ModeCardDef {
  mode: PublicNumberMode;
  badgeIcon: keyof typeof Ionicons.glyphMap;
  badgeLabel: string;
  title: string;
  body: string;
  pills?: { label: string; tone: 'success' | 'info' | 'warn' }[];
  accent: 'primary' | 'amber';
}

const MODE_CARDS: ModeCardDef[] = [
  {
    mode: 'ASPIRE_NEW_NUMBER',
    badgeIcon: 'sparkles',
    badgeLabel: 'RECOMMENDED',
    title: 'Get a new Aspire number',
    body:
      'Aspire purchases a number for you. Sarah answers it directly. Voice + SMS work end-to-end.',
    pills: [
      { label: 'Inbound ready', tone: 'success' },
      { label: 'Outbound available', tone: 'info' },
    ],
    accent: 'primary',
  },
  {
    mode: 'FORWARD_EXISTING',
    badgeIcon: 'arrow-redo-outline',
    badgeLabel: 'KEEP YOUR CARRIER',
    title: 'Forward my existing number',
    body:
      'Keep your existing carrier. Aspire issues a forward-target number; you set carrier-specific conditional-forwarding codes to forward inbound calls to Sarah. You also get a new Aspire number for SMS and Ava reminders — customers texting your existing number stay on your current carrier.',
    pills: [
      { label: 'Voice forwards', tone: 'info' },
      { label: 'SMS via Aspire #', tone: 'success' },
    ],
    accent: 'primary',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicNumberSection({
  config,
  onChange,
  enterIndex,
  onTestForwarding,
  isTestingForwarding = false,
}: PublicNumberSectionProps) {
  injectCss();

  // Read officeId here (in the React tree under TenantProvider) so we can
  // thread it down into the AspireNumberPickerSheet — RN Modal portals out
  // of the context tree on web, breaking useTenant() inside the sheet.
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? null;

  const setMode = (mode: PublicNumberMode) => {
    if (mode === config.mode) return;
    onChange({ mode });
  };

  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePurchased = useCallback(
    (result: PurchasedNumberResult) => {
      onChange({
        selectedNumberId: result.phoneNumberId,
        selectedNumberPhone: result.phoneNumber,
      });
    },
    [onChange],
  );

  return (
    <SectionPanel step={1} title="Public Number" enterIndex={enterIndex}>
      <View style={styles.cardStack} accessibilityRole="radiogroup">
        {MODE_CARDS.map((card) => (
          <ModeOptionCard
            key={card.mode}
            def={card}
            selected={config.mode === card.mode}
            onPress={() => setMode(card.mode)}
          />
        ))}
      </View>

      {/* Mode-specific sub-form */}
      <View style={styles.subform}>
        {config.mode === 'ASPIRE_NEW_NUMBER' ? (
          <AspireNewNumberFlow
            config={config}
            onOpenPicker={() => setPickerOpen(true)}
            onClearSelection={() => onChange({ selectedNumberId: undefined, selectedNumberPhone: undefined })}
          />
        ) : null}

        {config.mode === 'FORWARD_EXISTING' ? (
          <ForwardExistingFlow
            config={config}
            onChange={onChange}
            onOpenPicker={() => setPickerOpen(true)}
            onTestForwarding={onTestForwarding}
            isTestingForwarding={isTestingForwarding}
          />
        ) : null}

      </View>

      {/* Picker sheet — controlled at section level. Used by both
          ASPIRE_NEW_NUMBER (for the primary number) and FORWARD_EXISTING (for
          the SMS-companion Aspire number). officeId is passed down from the
          parent because RN Modal renders via a portal that's outside the
          TenantProvider context tree on web. */}
      <AspireNumberPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPurchased={handlePurchased}
        initialAreaCode={config.areaCode ?? ''}
        initialContains={config.containsFilter ?? ''}
        officeId={officeId}
      />
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// ASPIRE_NEW_NUMBER flow — picker entry + active-number summary
// ---------------------------------------------------------------------------

interface AspireNewNumberFlowProps {
  config: PublicNumberConfig;
  onOpenPicker: () => void;
  onClearSelection: () => void;
}

function AspireNewNumberFlow({
  config,
  onOpenPicker,
  onClearSelection,
}: AspireNewNumberFlowProps) {
  return (
    <View
      style={styles.subformBody}
      {...(Platform.OS === 'web' ? ({ className: 'fds-pn-reveal' } as any) : {})}
    >
      {config.selectedNumberId ? (
        <ActiveNumberCard
          number={formatPhoneDisplay(config.selectedNumberPhone || '')}
          subtitle="Sarah answers this number directly. Voice + SMS active."
          onChange={onClearSelection}
          onPickAnother={onOpenPicker}
        />
      ) : (
        <FindNumberCta
          title="Find an Aspire number"
          subtitle="Pick a local 10DLC or toll-free. We'll search Twilio's live inventory."
          onPress={onOpenPicker}
          accent="primary"
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// FORWARD_EXISTING flow — existing number input + carrier instructions
// ---------------------------------------------------------------------------

interface ForwardExistingFlowProps {
  config: PublicNumberConfig;
  onChange: (patch: Partial<PublicNumberConfig>) => void;
  onOpenPicker: () => void;
  onTestForwarding?: () => void;
  isTestingForwarding: boolean;
}

function ForwardExistingFlow({
  config,
  onChange,
  onOpenPicker,
  onTestForwarding,
  isTestingForwarding,
}: ForwardExistingFlowProps) {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? null;

  const [instructions, setInstructions] = useState<ForwardingInstructionsWire | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const phoneInput = config.forwardedNumber ?? '';
  const trimmedDigits = phoneInput.replace(/\D/g, '');
  const isValidPhone = trimmedDigits.length === 10 || trimmedDigits.length === 11;

  const handleResolve = useCallback(async () => {
    if (!isValidPhone || !officeId) return;
    setIsResolving(true);
    setResolveError(null);
    setInstructions(null);
    try {
      const e164 = trimmedDigits.length === 10 ? `+1${trimmedDigits}` : `+${trimmedDigits}`;
      const res = await fetchForwardingInstructions(
        { authenticatedFetch, officeId },
        e164,
      );
      setInstructions(res);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Carrier lookup failed.');
    } finally {
      setIsResolving(false);
    }
  }, [isValidPhone, officeId, trimmedDigits, authenticatedFetch]);

  const adaptedCodes: ForwardingCodeSet | null = instructions
    ? {
        always: instructions.codes.always,
        busy: instructions.codes.busy,
        noAnswer: instructions.codes.no_answer,
        unreachable: instructions.codes.unreachable,
      }
    : null;

  return (
    <View
      style={styles.subformBody}
      {...(Platform.OS === 'web' ? ({ className: 'fds-pn-reveal' } as any) : {})}
    >
      {/* Step A — owner enters their existing carrier number */}
      <View style={styles.fwdStep}>
        <View style={styles.fwdStepHeadRow}>
          <View style={styles.fwdStepNumber}>
            <Text style={styles.fwdStepNumberText}>A</Text>
          </View>
          <View style={styles.fwdStepCol}>
            <Text style={styles.fwdStepTitle}>Your existing customer-facing number</Text>
            <Text style={styles.fwdStepSubtitle}>
              We’ll resolve your carrier and generate the right forwarding codes.
            </Text>
          </View>
        </View>
        <View style={styles.fwdInputRow}>
          <TextInput
            value={phoneInput}
            onChangeText={(t) => onChange({ forwardedNumber: t })}
            placeholder="(555) 123-4567"
            placeholderTextColor={Colors.text.muted}
            keyboardType="phone-pad"
            autoComplete={Platform.OS === 'web' ? ('tel-national' as any) : 'tel'}
            style={styles.fwdInput}
            accessibilityLabel="Existing carrier phone number"
            {...(Platform.OS === 'web' ? ({ className: 'fds-pn-input' } as any) : {})}
          />
          <Pressable
            onPress={handleResolve}
            disabled={!isValidPhone || isResolving || !officeId}
            accessibilityRole="button"
            accessibilityLabel="Get forwarding instructions"
            accessibilityState={{ busy: isResolving, disabled: !isValidPhone || isResolving }}
            style={[
              styles.fwdResolveBtn,
              (!isValidPhone || isResolving || !officeId) && styles.fwdResolveBtnDisabled,
            ]}
            {...(Platform.OS === 'web' ? ({ className: 'fds-pn-cta-btn' } as any) : {})}
          >
            {isResolving ? (
              <ActivityIndicator size="small" color={Colors.accent.cyan} />
            ) : (
              <Ionicons name="search" size={14} color={Colors.accent.cyan} />
            )}
            <Text style={styles.fwdResolveBtnText}>
              {isResolving ? 'Resolving…' : 'Get forwarding instructions'}
            </Text>
          </Pressable>
        </View>
        {resolveError ? (
          <View style={styles.fwdErrorRow} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={14} color={Colors.semantic.error} />
            <Text style={styles.fwdErrorText}>{resolveError}</Text>
          </View>
        ) : null}
        {!officeId ? (
          <View style={styles.fwdHintRow}>
            <Ionicons name="information-circle-outline" size={13} color={Colors.text.muted} />
            <Text style={styles.fwdHintText}>
              No active office — refresh and try again.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Step B — render carrier-specific instructions when resolved */}
      {adaptedCodes && instructions ? (
        <View
          style={styles.fwdStep}
          {...(Platform.OS === 'web' ? ({ className: 'fds-pn-reveal' } as any) : {})}
        >
          <View style={styles.fwdStepHeadRow}>
            <View style={styles.fwdStepNumber}>
              <Text style={styles.fwdStepNumberText}>B</Text>
            </View>
            <View style={styles.fwdStepCol}>
              <Text style={styles.fwdStepTitle}>Punch these codes into your phone</Text>
              <Text style={styles.fwdStepSubtitle}>
                Each code tells your carrier when to route an inbound call to Sarah.
              </Text>
            </View>
          </View>
          <ForwardingInstructionsCard
            carrierName={(instructions.carrier_name as CarrierName) || 'Other'}
            codes={adaptedCodes}
            aspireForwardTarget={instructions.aspire_forward_target}
            helpUrl={instructions.help_url}
            onTestForwarding={onTestForwarding}
            isTesting={isTestingForwarding}
          />
        </View>
      ) : null}

      {/* Step C — companion Aspire number for SMS + Ava (per §3.8) */}
      <View style={styles.fwdStep}>
        <View style={styles.fwdStepHeadRow}>
          <View style={styles.fwdStepNumber}>
            <Text style={styles.fwdStepNumberText}>C</Text>
          </View>
          <View style={styles.fwdStepCol}>
            <Text style={styles.fwdStepTitle}>Aspire SMS companion number</Text>
            <Text style={styles.fwdStepSubtitle}>
              For SMS, Ava reminders, and proactive nudges. Required because we
              can’t send SMS through your existing carrier.
            </Text>
          </View>
        </View>
        {config.selectedNumberId ? (
          <ActiveNumberCard
            number={formatPhoneDisplay(config.selectedNumberPhone || '')}
            subtitle="Aspire SMS active. Customers texting your existing number stay on your carrier."
            onChange={() => onChange({ selectedNumberId: undefined, selectedNumberPhone: undefined })}
            onPickAnother={onOpenPicker}
          />
        ) : (
          <FindNumberCta
            title="Pick an Aspire number for SMS"
            subtitle="Local or toll-free. We'll search Twilio's live inventory."
            onPress={onOpenPicker}
            accent="primary"
          />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ModeOptionCard — premium 3-card layout per §12.1
// ---------------------------------------------------------------------------

interface ModeOptionCardProps {
  def: ModeCardDef;
  selected: boolean;
  onPress: () => void;
}

function ModeOptionCard({ def, selected, onPress }: ModeOptionCardProps) {
  const accentColor =
    def.accent === 'amber' ? Colors.semantic.warning : Colors.accent.cyan;
  const accentRgba =
    def.accent === 'amber' ? 'rgba(245,158,11,' : 'rgba(59,130,246,';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${def.title}. ${def.body}`}
      style={[
        styles.optionCard,
        selected && styles.optionCardSelected,
        selected && {
          backgroundColor: `${accentRgba}0.07)`,
          borderColor: `${accentRgba}0.45)`,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: `0 0 0 1px ${accentRgba}0.32), 0 18px 36px -8px ${accentRgba}0.30), inset 0 1px 0 rgba(255,255,255,0.04)`,
              } as object)
            : {
                shadowColor: accentColor,
                shadowOpacity: 0.40,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              }),
        } as ViewStyle,
      ]}
      {...(Platform.OS === 'web'
        ? ({ className: selected ? 'fds-pn-card fds-pn-card--selected' : 'fds-pn-card' } as any)
        : {})}
    >
      {/* Top accent bar — only on selected */}
      {selected ? (
        <View
          pointerEvents="none"
          style={[
            styles.optionAccentBar,
            {
              backgroundColor: accentColor,
              shadowColor: accentColor,
              ...(Platform.OS === 'web'
                ? ({ boxShadow: `0 0 12px ${accentRgba}0.55)` } as object)
                : {
                    shadowOpacity: 0.5,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 },
                  }),
            } as ViewStyle,
          ]}
        />
      ) : null}

      <View style={styles.optionInner}>
        {/* Top row — radio + kicker badge */}
        <View style={styles.optionTopRow}>
          <View
            style={[
              styles.radioOuter,
              selected && {
                borderColor: accentColor,
              },
            ]}
          >
            {selected ? (
              <View
                style={[styles.radioInner, { backgroundColor: accentColor }]}
              />
            ) : null}
          </View>
          <View
            style={[
              styles.kickerPill,
              {
                backgroundColor: `${accentRgba}0.10)`,
                borderColor: `${accentRgba}0.32)`,
              },
            ]}
          >
            <Ionicons name={def.badgeIcon} size={11} color={accentColor} />
            <Text style={[styles.kickerPillText, { color: accentColor }]}>
              {def.badgeLabel}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
          {def.title}
        </Text>

        {/* Body */}
        <Text style={styles.optionBody}>{def.body}</Text>

        {/* Pills */}
        {def.pills && def.pills.length > 0 ? (
          <View style={styles.pillRow}>
            {def.pills.map((pill) => (
              <CapabilityPill key={pill.label} label={pill.label} tone={pill.tone} />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CapabilityPill — small status pill (3 tones)
// ---------------------------------------------------------------------------

function CapabilityPill({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'info' | 'warn';
}) {
  const palette =
    tone === 'success'
      ? {
          bg: 'rgba(52,199,89,0.12)',
          border: 'rgba(52,199,89,0.34)',
          dot: Colors.semantic.success,
          text: Colors.semantic.success,
        }
      : tone === 'warn'
        ? {
            bg: 'rgba(245,158,11,0.12)',
            border: 'rgba(245,158,11,0.34)',
            dot: Colors.semantic.warning,
            text: Colors.semantic.warning,
          }
        : {
            bg: 'rgba(59,130,246,0.12)',
            border: 'rgba(59,130,246,0.34)',
            dot: Colors.accent.cyan,
            text: Colors.accent.cyan,
          };

  return (
    <View
      style={[styles.capPill, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="text"
    >
      <View style={[styles.capPillDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.capPillText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// FindNumberCta — primary CTA into the picker sheet
// ---------------------------------------------------------------------------

interface FindNumberCtaProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  accent: 'primary';
}

function FindNumberCta({ title, subtitle, onPress }: FindNumberCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={styles.findCta}
      {...(Platform.OS === 'web' ? ({ className: 'fds-pn-cta-btn' } as any) : {})}
    >
      <View style={styles.findCtaIcon}>
        <Ionicons name="search" size={16} color={Colors.accent.cyan} />
      </View>
      <View style={styles.findCtaCol}>
        <Text style={styles.findCtaTitle}>{title}</Text>
        <Text style={styles.findCtaSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// ActiveNumberCard
// ---------------------------------------------------------------------------

interface ActiveNumberCardProps {
  number: string;
  subtitle: string;
  onChange: () => void;
  onPickAnother: () => void;
}

function ActiveNumberCard({
  number,
  subtitle,
  onChange,
  onPickAnother,
}: ActiveNumberCardProps) {
  return (
    <View style={styles.activeCard}>
      <View style={styles.activeIcon}>
        <Ionicons name="call" size={16} color={Colors.semantic.success} />
      </View>
      <View style={styles.activeCol}>
        <Text style={styles.activeLabel}>ACTIVE NUMBER</Text>
        <Text style={styles.activeNumber}>{number}</Text>
        <Text style={styles.activeSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.activeActions}>
        <Pressable
          onPress={onPickAnother}
          accessibilityRole="button"
          accessibilityLabel="Pick a different number"
          style={styles.activeChangeBtn}
          {...(Platform.OS === 'web' ? ({ className: 'fds-pn-cta-btn' } as any) : {})}
        >
          <Text style={styles.activeChangeText}>Change</Text>
        </Pressable>
        <Pressable
          onPress={onChange}
          accessibilityRole="button"
          accessibilityLabel="Remove this number"
          style={styles.activeRemoveBtn}
        >
          <Ionicons name="close" size={14} color={Colors.text.tertiary} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhoneDisplay(value: string): string {
  // Support both already-formatted display strings and raw E.164.
  if (/^\(\d{3}\) \d{3}-\d{4}$/.test(value)) return value;
  const digits = value.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return value;
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  cardStack: {
    gap: 12,
  },

  // ----- Mode option cards ---------------------------------------------
  optionCard: {
    position: 'relative',
    borderRadius: BorderRadius.xl,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    minHeight: 124,
  },
  optionCardSelected: {
    // base — accent-driven overrides applied inline above
  },
  optionAccentBar: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 2,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  optionInner: {
    padding: 18,
    gap: 10,
  },

  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  kickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  kickerPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.0,
  },

  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  optionTitleSelected: {
    color: '#ffffff',
  },
  optionBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 19,
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },

  capPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
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

  // ----- Sub-form ------------------------------------------------------
  subform: {
    marginTop: 18,
    gap: 14,
  },
  subformBody: {
    gap: 16,
  },

  // ----- Find CTA (entry to picker) ------------------------------------
  findCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderStyle: 'dashed' as ViewStyle['borderStyle'],
    borderColor: 'rgba(59,130,246,0.30)',
    minHeight: 64,
  },
  findCtaIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
  },
  findCtaCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  findCtaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  findCtaSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 16,
  },

  // ----- ActiveNumberCard ---------------------------------------------
  activeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(52,199,89,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.32)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 1px rgba(52,199,89,0.10), 0 8px 22px rgba(52,199,89,0.10)',
        } as object)
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
    marginTop: 2,
  },
  activeCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.semantic.success,
    letterSpacing: 1.2,
  },
  activeNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  activeSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 17,
  },
  activeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeChangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  activeChangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  activeRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  // ----- Forwarding existing — Step blocks ----------------------------
  fwdStep: {
    gap: 12,
  },
  fwdStepHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  fwdStepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.40)',
    marginTop: 1,
  },
  fwdStepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.4,
  },
  fwdStepCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  fwdStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  fwdStepSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 17,
  },

  fwdInputRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  fwdInput: {
    flex: 1,
    minWidth: 200,
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
  fwdResolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
  },
  fwdResolveBtnDisabled: {
    opacity: 0.55,
  },
  fwdResolveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent.cyan,
    letterSpacing: 0.1,
  },
  fwdErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.32)',
  },
  fwdErrorText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.semantic.error,
    flex: 1,
    minWidth: 0,
  },
  fwdHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fwdHintText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
  },
});

export default PublicNumberSection;
