/**
 * CatchCallsSection — Pass 19 Lane A (plan §3.2 interlock matrix).
 *
 * Section 2 — How You Catch Calls. Three radio options stacked vertically.
 * Pass 19 adds **interlock validation** against the Public Number mode:
 *
 *   FORWARD_EXISTING + APP_ONLY                  → invalid (calls go to
 *                                                    user's carrier
 *                                                    voicemail, never reach
 *                                                    Aspire)
 *   FORWARD_EXISTING + APP_AND_PHONE_SIMUL_RING  → warn (depends on user's
 *                                                    carrier supporting
 *                                                    simul-ring)
 *   All other combos                             → ok
 *
 * Validation result is rendered as an inline chip above the options + the
 * `onValidityChange` callback notifies the page so it can disable Save when
 * any tab has an `invalid` combo.
 *
 * Per §12.1: every option has hover lift, focus ring, ≥44pt tap area;
 * selected uses Aspire-blue ring + soft glow. The interlock chip is a
 * first-class element with its own accent + 4px left-edge bar — not an
 * afterthought.
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { SectionPanel } from './SectionPanel';
import {
  validateCatchInterlock,
  type CatchMode,
  type CatchInterlockResult,
  type PublicNumberMode,
} from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CatchCallsSectionProps {
  mode: CatchMode;
  onChange: (mode: CatchMode) => void;
  /**
   * Public Number mode — required so the interlock matrix can validate
   * `FORWARD_EXISTING + APP_ONLY` and similar combos. Defaults to
   * `ASPIRE_NEW_NUMBER` if not provided (everything passes).
   */
  publicNumberMode?: PublicNumberMode;
  /** Called whenever validity changes. Page uses this to gate the Save button. */
  onValidityChange?: (result: CatchInterlockResult) => void;
  /** Optional zero-based index for staggered entrance */
  enterIndex?: number;
}

// ---------------------------------------------------------------------------
// Option metadata
// ---------------------------------------------------------------------------

type OptionDef = {
  value: CatchMode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const OPTIONS: OptionDef[] = [
  {
    value: 'APP_ONLY',
    icon: 'desktop-outline',
    title: 'Ring in Aspire',
    subtitle: 'Calls ring in the Aspire desktop and mobile app.',
  },
  {
    value: 'PHONE_ONLY',
    icon: 'phone-portrait-outline',
    title: 'Ring my phone',
    subtitle: 'Calls route to your direct phone number.',
  },
  {
    value: 'APP_AND_PHONE_SIMUL_RING',
    icon: 'flash-outline',
    title: 'Ring both (advanced)',
    subtitle: 'Ring Aspire and your phone at the same time.',
  },
];

// ---------------------------------------------------------------------------
// One-time CSS
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-catch-calls-css';
  style.textContent = `
    .fds-catch-row { transition: border-color 180ms cubic-bezier(0.16,1,0.3,1), background-color 180ms ease-out, box-shadow 180ms ease-out, transform 160ms ease-out; }
    .fds-catch-row:hover { transform: translateY(-1px); border-color: rgba(255,255,255,0.16); }
    .fds-catch-row:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    .fds-catch-row--invalid { opacity: 0.95; }
    @keyframes fds-catch-chip-pop {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fds-catch-chip { animation: fds-catch-chip-pop 240ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    @media (prefers-reduced-motion: reduce) {
      .fds-catch-row, .fds-catch-chip { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CatchCallsSection({
  mode,
  onChange,
  publicNumberMode = 'ASPIRE_NEW_NUMBER',
  onValidityChange,
  enterIndex,
}: CatchCallsSectionProps) {
  injectCss();

  const interlock = useMemo(
    () => validateCatchInterlock(publicNumberMode, mode),
    [publicNumberMode, mode],
  );

  // Notify parent on every change — page uses this to enable/disable Save.
  useEffect(() => {
    onValidityChange?.(interlock);
  }, [interlock, onValidityChange]);

  return (
    <SectionPanel step={2} title="How You Catch Calls" enterIndex={enterIndex}>
      {/* Interlock chip — only renders when there's something to say */}
      {interlock.severity !== 'ok' ? (
        <InterlockChip result={interlock} />
      ) : null}

      <View style={styles.optionsCol} accessibilityRole="radiogroup">
        {OPTIONS.map((opt) => {
          const selected = mode === opt.value;
          // The "invalid" option is the one currently selected when interlock
          // is invalid — we keep it selectable (so user can change to a valid
          // one), but visually flag the RED state on it.
          const isInvalidSelection =
            selected && interlock.severity === 'invalid';
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${opt.title}. ${opt.subtitle}`}
              style={[
                styles.row,
                selected && styles.rowSelected,
                isInvalidSelection && styles.rowSelectedInvalid,
              ]}
              {...(Platform.OS === 'web'
                ? ({
                    className: isInvalidSelection
                      ? 'fds-catch-row fds-catch-row--invalid'
                      : 'fds-catch-row',
                  } as any)
                : {})}
            >
              <View
                style={[
                  styles.radioOuter,
                  selected && styles.radioOuterSelected,
                  isInvalidSelection && styles.radioOuterInvalid,
                ]}
              >
                {selected ? (
                  <View
                    style={[
                      styles.radioInner,
                      isInvalidSelection && styles.radioInnerInvalid,
                    ]}
                  />
                ) : null}
              </View>

              <View
                style={[
                  styles.iconBubble,
                  selected && styles.iconBubbleSelected,
                  isInvalidSelection && styles.iconBubbleInvalid,
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={
                    isInvalidSelection
                      ? Colors.semantic.error
                      : selected
                        ? Colors.accent.cyan
                        : Colors.text.tertiary
                  }
                />
              </View>

              <View style={styles.body}>
                <Text style={[styles.title, selected && styles.titleSelected]}>{opt.title}</Text>
                <Text style={styles.subtitle}>{opt.subtitle}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={13} color={Colors.text.muted} />
        <Text style={styles.noteText}>
          First answer wins. Direct-phone voicemail may answer first.
        </Text>
      </View>
    </SectionPanel>
  );
}

// ---------------------------------------------------------------------------
// InterlockChip — inline error/warn chip per §3.2
// ---------------------------------------------------------------------------

function InterlockChip({ result }: { result: CatchInterlockResult }) {
  const isInvalid = result.severity === 'invalid';
  const palette = isInvalid
    ? {
        bg: 'rgba(239,68,68,0.08)',
        border: 'rgba(239,68,68,0.34)',
        accent: Colors.semantic.error,
        icon: 'alert-circle' as const,
        kicker: 'INVALID COMBO',
      }
    : {
        bg: 'rgba(245,158,11,0.08)',
        border: 'rgba(245,158,11,0.34)',
        accent: Colors.semantic.warning,
        icon: 'warning' as const,
        kicker: 'CARRIER-DEPENDENT',
      };

  return (
    <View
      style={[
        styles.chipCard,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
      accessibilityRole="alert"
      {...(Platform.OS === 'web' ? ({ className: 'fds-catch-chip' } as any) : {})}
    >
      <View style={[styles.chipAccentBar, { backgroundColor: palette.accent }]} />
      <View style={styles.chipIconWrap}>
        <Ionicons name={palette.icon} size={16} color={palette.accent} />
      </View>
      <View style={styles.chipBody}>
        <Text style={[styles.chipKicker, { color: palette.accent }]}>
          {palette.kicker}
        </Text>
        <Text style={styles.chipMessage}>{result.message}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ----- Interlock chip -----------------------------------------------
  chipCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 18,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 14,
  },
  chipAccentBar: {
    position: 'absolute',
    top: 8,
    left: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  chipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 1,
  },
  chipBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  chipKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  chipMessage: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    lineHeight: 17,
  },

  // ----- Options ------------------------------------------------------
  optionsCol: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    minHeight: 60,
  },
  rowSelected: {
    backgroundColor: 'rgba(59,130,246,0.07)',
    borderColor: 'rgba(59,130,246,0.45)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 1px rgba(59,130,246,0.25), 0 0 20px rgba(59,130,246,0.13)',
        } as object)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.32,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,
  rowSelectedInvalid: {
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderColor: 'rgba(239,68,68,0.45)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 1px rgba(239,68,68,0.25), 0 0 20px rgba(239,68,68,0.13)',
        } as object)
      : {
          shadowColor: Colors.semantic.error,
          shadowOpacity: 0.30,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,

  // Radio
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.accent.cyan,
  },
  radioOuterInvalid: {
    borderColor: Colors.semantic.error,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.accent.cyan,
  },
  radioInnerInvalid: {
    backgroundColor: Colors.semantic.error,
  },

  // Icon bubble
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconBubbleSelected: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.30)',
  },
  iconBubbleInvalid: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.34)',
  },

  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  titleSelected: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 16,
  },

  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  noteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.text.muted,
    flex: 1,
  },
});

export default CatchCallsSection;
