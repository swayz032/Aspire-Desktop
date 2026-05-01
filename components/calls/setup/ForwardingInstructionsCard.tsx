/**
 * ForwardingInstructionsCard — Pass 19 Lane A (plan §3.1 + §6.1).
 *
 * Renders the carrier-specific conditional-forwarding codes returned from
 * `GET /v1/front-desk/forwarding-instructions?phone=...` (backend Lane B).
 * Each of the four codes (always / busy / no-answer / unreachable) gets its
 * own row with a copy-to-clipboard button. A "Test forwarding" CTA at the
 * bottom is the call-to-action that — once the owner punches the codes into
 * their carrier — fires a Twilio test call against the Aspire forward-target
 * to verify forwarding works.
 *
 * Per §12.1 Framer-style:
 *   - Editorial layout: kicker label, hero carrier name, ambient blue
 *     atmosphere behind code rows, no flat surfaces.
 *   - Layered depth: each code row is a small interactive card with a
 *     blue-tinted code box on the left + copy button on the right + status
 *     glyph that flips to checkmark when copied.
 *   - Cinematic motion: copied state pulses the row briefly, then fades.
 *   - Cohesive: matches SectionPanel chrome.
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
import { copyToClipboard } from '@/lib/clipboard';
import type { ForwardingCodeSet, CarrierName } from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ForwardingInstructionsCardProps {
  carrierName: CarrierName | string;
  codes: ForwardingCodeSet;
  /** The Aspire-issued forward-target number the codes route inbound calls to. */
  aspireForwardTarget: string;
  /** Optional carrier help-page URL (deep link / KB article). */
  helpUrl?: string;
  /** Loading state for the "Test forwarding" CTA. */
  isTesting?: boolean;
  /** Wire to the test-call endpoint (Lane B `POST /v1/front-desk/config/test-call`). */
  onTestForwarding?: () => void;
  /** Optional callback when user copies a code (telemetry / dev). */
  onCopyCode?: (kind: keyof ForwardingCodeSet) => void;
}

// ---------------------------------------------------------------------------
// One-time CSS — copy pulse + atmospheric ambient glow
// ---------------------------------------------------------------------------

let cssInjected = false;
function injectCss() {
  if (cssInjected || Platform.OS !== 'web') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'fds-fwd-instructions-css';
  style.textContent = `
    @keyframes fds-fwd-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(52,199,89,0.40); }
      50%  { box-shadow: 0 0 0 6px rgba(52,199,89,0.00); }
      100% { box-shadow: 0 0 0 0 rgba(52,199,89,0.00); }
    }
    .fds-fwd-row { transition: border-color 180ms ease-out, background-color 180ms ease-out, transform 160ms ease-out; }
    .fds-fwd-row:hover { transform: translateY(-1px); border-color: rgba(59,130,246,0.32); }
    .fds-fwd-copy-btn { transition: transform 140ms ease-out, background-color 140ms ease-out, border-color 140ms ease-out; }
    .fds-fwd-copy-btn:hover { transform: translateY(-1px); }
    .fds-fwd-copy-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    .fds-fwd-copy-btn--copied { animation: fds-fwd-pulse 600ms cubic-bezier(0.16, 1, 0.3, 1); }
    .fds-fwd-test-btn { transition: transform 160ms ease-out, background-color 160ms ease-out, box-shadow 160ms ease-out; }
    .fds-fwd-test-btn:hover { transform: translateY(-1px); }
    .fds-fwd-test-btn:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) {
      .fds-fwd-row, .fds-fwd-copy-btn, .fds-fwd-test-btn, .fds-fwd-copy-btn--copied { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Code-row metadata
// ---------------------------------------------------------------------------

type CodeKind = keyof ForwardingCodeSet;

const ROW_META: Record<
  CodeKind,
  {
    label: string;
    helper: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  always: {
    label: 'Forward all calls',
    helper: 'Inbound calls go to Sarah immediately, no ring on your phone first.',
    icon: 'arrow-redo-outline',
  },
  busy: {
    label: 'Forward when busy',
    helper: 'When your line is on another call, the next inbound rings Sarah.',
    icon: 'call-outline',
  },
  noAnswer: {
    label: 'Forward when you don’t answer',
    helper: 'Sarah picks up after the carrier-set ring count (usually 4–6 rings).',
    icon: 'time-outline',
  },
  unreachable: {
    label: 'Forward when unreachable',
    helper: 'Out of coverage or phone off — Sarah catches the call.',
    icon: 'cloud-offline-outline',
  },
};

const ROW_ORDER: CodeKind[] = ['always', 'busy', 'noAnswer', 'unreachable'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ForwardingInstructionsCard({
  carrierName,
  codes,
  aspireForwardTarget,
  helpUrl,
  isTesting = false,
  onTestForwarding,
  onCopyCode,
}: ForwardingInstructionsCardProps) {
  injectCss();

  const [copiedKind, setCopiedKind] = useState<CodeKind | null>(null);

  const handleCopy = useCallback(
    async (kind: CodeKind, value: string) => {
      const ok = await copyToClipboard(value);
      if (ok) {
        setCopiedKind(kind);
        onCopyCode?.(kind);
        // Reset after the pulse animation completes.
        window.setTimeout?.(() => setCopiedKind(null), 1400);
      }
    },
    [onCopyCode],
  );

  return (
    <View style={styles.card} accessibilityLabel={`Forwarding instructions for ${carrierName}`}>
      {/* Atmospheric ambient backdrop — adds depth, not noise */}
      <View pointerEvents="none" style={styles.ambient} />

      {/* Header strip */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.carrierBadge}>
            <Ionicons name="cellular" size={14} color={Colors.accent.cyan} />
          </View>
          <View style={styles.headerCol}>
            <Text style={styles.kicker}>YOUR CARRIER · {String(carrierName).toUpperCase()}</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Forward inbound calls to Sarah
            </Text>
          </View>
        </View>
        {helpUrl && Platform.OS === 'web' ? (
          <Pressable
            onPress={() => window.open(helpUrl, '_blank', 'noopener,noreferrer')}
            accessibilityRole="link"
            accessibilityLabel="Carrier help article"
            style={styles.helpLinkBtn}
          >
            <Ionicons name="help-circle-outline" size={14} color={Colors.text.tertiary} />
            <Text style={styles.helpLinkText}>Carrier docs</Text>
            <Ionicons name="open-outline" size={12} color={Colors.text.tertiary} />
          </Pressable>
        ) : null}
      </View>

      {/* Forward-target callout — what the codes route TO */}
      <View style={styles.targetCallout} accessibilityRole="text">
        <Ionicons name="arrow-down" size={14} color={Colors.accent.cyan} />
        <Text style={styles.targetCalloutText}>
          The codes below forward to <Text style={styles.targetCalloutNumber}>{aspireForwardTarget}</Text>
          {' '}— that’s Sarah’s line.
        </Text>
      </View>

      {/* Code rows */}
      <View style={styles.codeList}>
        {ROW_ORDER.map((kind) => (
          <CodeRow
            key={kind}
            kind={kind}
            value={codes[kind]}
            copied={copiedKind === kind}
            onCopy={() => handleCopy(kind, codes[kind])}
          />
        ))}
      </View>

      {/* Test forwarding CTA */}
      <View style={styles.testRow}>
        <View style={styles.testCopyCol}>
          <Text style={styles.testTitle}>Verify it works</Text>
          <Text style={styles.testSubtitle}>
            We’ll dial your existing line — make sure it routes to Sarah cleanly.
          </Text>
        </View>
        <Pressable
          onPress={onTestForwarding}
          disabled={isTesting || !onTestForwarding}
          accessibilityRole="button"
          accessibilityLabel="Test forwarding"
          accessibilityState={{ busy: isTesting, disabled: !onTestForwarding }}
          style={[styles.testBtn, (isTesting || !onTestForwarding) && styles.testBtnBusy]}
          {...(Platform.OS === 'web' ? ({ className: 'fds-fwd-test-btn' } as any) : {})}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="play" size={13} color="#ffffff" />
          )}
          <Text style={styles.testBtnText}>{isTesting ? 'Calling…' : 'Test forwarding'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CodeRow — one of the 4 forwarding codes
// ---------------------------------------------------------------------------

interface CodeRowProps {
  kind: CodeKind;
  value: string;
  copied: boolean;
  onCopy: () => void;
}

function CodeRow({ kind, value, copied, onCopy }: CodeRowProps) {
  const meta = ROW_META[kind];
  return (
    <View
      style={styles.codeRow}
      {...(Platform.OS === 'web' ? ({ className: 'fds-fwd-row' } as any) : {})}
    >
      <View style={styles.codeIconWrap}>
        <Ionicons name={meta.icon} size={15} color={Colors.accent.cyan} />
      </View>
      <View style={styles.codeBody}>
        <Text style={styles.codeLabel}>{meta.label}</Text>
        <Text style={styles.codeHelper}>{meta.helper}</Text>
        <View style={styles.codeValueWrap} accessibilityLabel={`${meta.label} code: ${value}`}>
          <Text style={styles.codeValueText} selectable>
            {value}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={`Copy ${meta.label} code`}
        style={[styles.copyBtn, copied && styles.copyBtnCopied]}
        {...(Platform.OS === 'web'
          ? ({ className: copied ? 'fds-fwd-copy-btn fds-fwd-copy-btn--copied' : 'fds-fwd-copy-btn' } as any)
          : {})}
      >
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={14}
          color={copied ? Colors.semantic.success : '#ffffff'}
        />
        <Text style={[styles.copyBtnText, copied && styles.copyBtnTextCopied]}>
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </Pressable>
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
    borderColor: 'rgba(59,130,246,0.18)',
    padding: 18,
    gap: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.20), 0 0 0 1px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.025)',
        } as object)
      : {
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
          elevation: 4,
        }),
  } as any,
  ambient: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(59,130,246,0.05)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as object) : {}),
  } as any,

  // ----- Header --------------------------------------------------------
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  carrierBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 0 4px rgba(59,130,246,0.05), 0 0 14px rgba(59,130,246,0.18)' } as object)
      : {}),
  } as any,
  headerCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  helpLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  helpLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.2,
  },

  // ----- Target callout ------------------------------------------------
  targetCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  targetCalloutText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    flex: 1,
    minWidth: 0,
    lineHeight: 17,
  },
  targetCalloutNumber: {
    color: Colors.text.primary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },

  // ----- Code rows -----------------------------------------------------
  codeList: {
    gap: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  codeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    marginTop: 2,
  },
  codeBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  codeHelper: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    lineHeight: 15,
  },
  codeValueWrap: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  codeValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
  } as any,
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
    marginTop: 2,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.30), 0 4px 10px rgba(59,130,246,0.22)' } as object)
      : {
          shadowColor: Colors.accent.cyan,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.32,
          shadowRadius: 7,
        }),
  } as any,
  copyBtnCopied: {
    backgroundColor: 'rgba(52,199,89,0.14)',
    borderColor: 'rgba(52,199,89,0.40)',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  copyBtnTextCopied: {
    color: Colors.semantic.success,
  },

  // ----- Test forwarding ----------------------------------------------
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  testCopyCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  testTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  testSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    lineHeight: 15,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.30), 0 6px 14px rgba(59,130,246,0.28)' } as object)
      : {
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.36,
          shadowRadius: 10,
        }),
  } as any,
  testBtnBusy: {
    opacity: 0.78,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
});

export default ForwardingInstructionsCard;
