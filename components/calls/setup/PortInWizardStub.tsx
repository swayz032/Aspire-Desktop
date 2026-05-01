/**
 * PortInWizardStub — Pass 19 Lane A (plan §3.1 + §6.1).
 *
 * V1 placeholder for the full port-in flow (V1.1). When the owner picks
 * "Move my number to Aspire (advanced)", we render this card explaining
 * what the flow will look like (LOA paperwork, 7–14 day port window) and
 * collect their interest via a "Notify me when available" CTA. The CTA
 * records a no-op receipt today; Lane B will wire it to a real interest-
 * tracking endpoint in V1.1.
 *
 * Per §12.1 Framer-style:
 *   - Editorial layout with a 4-step horizontal timeline that reads as
 *     real engineering work, not a hand-wave.
 *   - Layered depth: timeline dots glow, connector line gradients down to
 *     the stub state — visually communicating "coming soon, here's the path".
 *   - Cohesive: matches SectionPanel + ForwardingInstructionsCard chrome.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PortInWizardStubProps {
  /** Optional callback fired when owner taps "Notify me when available". */
  onNotifyMe?: () => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// One-time CSS — atmospheric ambient + timeline glow
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-port-in-css';
  style.textContent = `
    @keyframes fds-port-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fds-port-step { animation: fds-port-fade-up 360ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .fds-port-step:nth-child(1) { animation-delay: 0ms; }
    .fds-port-step:nth-child(2) { animation-delay: 70ms; }
    .fds-port-step:nth-child(3) { animation-delay: 140ms; }
    .fds-port-step:nth-child(4) { animation-delay: 210ms; }
    .fds-port-notify-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out; }
    .fds-port-notify-btn:hover { transform: translateY(-1px); border-color: rgba(59,130,246,0.55); background-color: rgba(59,130,246,0.10); }
    .fds-port-notify-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) {
      .fds-port-step, .fds-port-notify-btn { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

interface StepDef {
  num: number;
  label: string;
  copy: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: StepDef[] = [
  {
    num: 1,
    label: 'Submit LOA',
    copy: 'You sign the Letter of Authorization + share a recent utility bill.',
    icon: 'document-text-outline',
  },
  {
    num: 2,
    label: 'Carrier review',
    copy: 'Your existing carrier validates ownership — usually 24–48h.',
    icon: 'shield-checkmark-outline',
  },
  {
    num: 3,
    label: 'Port window',
    copy: 'Twilio takes over the number. 7–14 day window — calls keep working.',
    icon: 'time-outline',
  },
  {
    num: 4,
    label: 'Cutover',
    copy: 'Sarah answers your number directly. SMS + Ava reminders go end-to-end.',
    icon: 'checkmark-circle-outline',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortInWizardStub({ onNotifyMe }: PortInWizardStubProps) {
  injectCss();

  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleNotify = useCallback(async () => {
    if (registered || busy) return;
    setBusy(true);
    try {
      await onNotifyMe?.();
      setRegistered(true);
    } finally {
      setBusy(false);
    }
  }, [busy, registered, onNotifyMe]);

  return (
    <View
      style={styles.card}
      accessibilityLabel="Port-in coming in V1.1"
      accessibilityRole={Platform.OS === 'web' ? ('region' as any) : 'text'}
    >
      <View pointerEvents="none" style={styles.ambient} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.advancedBadge}>
          <Ionicons name="construct-outline" size={13} color={Colors.semantic.warning} />
          <Text style={styles.advancedBadgeText}>ADVANCED · V1.1</Text>
        </View>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Move your number to Aspire
        </Text>
        <Text style={styles.headerSubtitle}>
          Twilio takes over your existing number. Sarah answers it natively, SMS
          flows through Aspire, and Ava can text from it. The trade-off: a 7–14
          day port window with risk of carrier rejection.
        </Text>
      </View>

      {/* Timeline */}
      <View style={styles.timeline} accessibilityRole={Platform.OS === 'web' ? ('list' as any) : 'text'}>
        {STEPS.map((step, idx) => (
          <View
            key={step.num}
            style={styles.step}
            accessibilityRole={Platform.OS === 'web' ? ('listitem' as any) : 'text'}
            {...(Platform.OS === 'web' ? ({ className: 'fds-port-step' } as any) : {})}
          >
            <View style={styles.stepHead}>
              <View style={styles.stepDot}>
                <Text style={styles.stepDotText}>{step.num}</Text>
              </View>
              {idx < STEPS.length - 1 ? <View style={styles.stepConnector} /> : null}
            </View>
            <View style={styles.stepBody}>
              <View style={styles.stepLabelRow}>
                <Ionicons name={step.icon} size={13} color={Colors.accent.cyan} />
                <Text style={styles.stepLabel}>{step.label}</Text>
              </View>
              <Text style={styles.stepCopy}>{step.copy}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaRow}>
        <View style={styles.ctaCopy}>
          <Text style={styles.ctaTitle}>Want this when it ships?</Text>
          <Text style={styles.ctaSubtitle}>
            We’ll email you the LOA paperwork the day port-in opens.
          </Text>
        </View>
        <Pressable
          onPress={handleNotify}
          disabled={busy || registered}
          accessibilityRole="button"
          accessibilityLabel={registered ? "You're on the list" : 'Notify me when port-in is available'}
          accessibilityState={{ busy, disabled: busy || registered }}
          style={[styles.notifyBtn, registered && styles.notifyBtnRegistered]}
          {...(Platform.OS === 'web' ? ({ className: 'fds-port-notify-btn' } as any) : {})}
        >
          {busy ? (
            <ActivityIndicator size="small" color={Colors.accent.cyan} />
          ) : (
            <Ionicons
              name={registered ? 'checkmark-circle' : 'mail-outline'}
              size={14}
              color={registered ? Colors.semantic.success : Colors.accent.cyan}
            />
          )}
          <Text style={[styles.notifyBtnText, registered && styles.notifyBtnTextRegistered]}>
            {registered ? "You're on the list" : 'Notify me when available'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: BorderRadius.xl,
    backgroundColor: '#101012',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
    padding: 18,
    gap: 18,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.20), 0 0 0 1px rgba(245,158,11,0.05), inset 0 1px 0 rgba(255,255,255,0.025)',
        } as object)
      : {
          shadowColor: '#f59e0b',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.16,
          shadowRadius: 14,
          elevation: 4,
        }),
  } as any,
  ambient: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245,158,11,0.04)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as object) : {}),
  } as any,

  // ----- Header --------------------------------------------------------
  header: {
    gap: 8,
  },
  advancedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
  },
  advancedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.semantic.warning,
    letterSpacing: 1.1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    lineHeight: 26,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 19,
  },

  // ----- Timeline ------------------------------------------------------
  timeline: {
    gap: 0,
    paddingTop: 4,
  },
  step: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 64,
  },
  stepHead: {
    width: 28,
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.40)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 0 0 4px rgba(59,130,246,0.05), 0 0 12px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        } as object)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.40,
          shadowRadius: 7,
          shadowOffset: { width: 0, height: 0 },
        }),
  } as any,
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.2,
  },
  stepConnector: {
    flex: 1,
    width: 2,
    minHeight: 18,
    marginTop: 4,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 18,
    gap: 4,
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  stepCopy: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.muted,
    lineHeight: 17,
  },

  // ----- CTA -----------------------------------------------------------
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  ctaCopy: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  ctaTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  ctaSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    lineHeight: 15,
  },
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
  },
  notifyBtnRegistered: {
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderColor: 'rgba(52,199,89,0.34)',
  },
  notifyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent.cyan,
    letterSpacing: 0.1,
  },
  notifyBtnTextRegistered: {
    color: Colors.semantic.success,
  },
});

export default PortInWizardStub;
