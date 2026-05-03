/**
 * AspireNumberPill — small reusable badge that surfaces the office's
 * purchased Aspire phone number (or a "not set up" CTA when missing).
 *
 * Used on:
 *  - Return Call page header (`app/session/calls.tsx`)
 *  - Front Desk Setup Sarah Status Rail (`components/calls/setup/SarahStatusRail.tsx`)
 *
 * Consumes the `aspire_number` field from `FrontDeskConfigResponse` (joined
 * from `tenant_phone_numbers` server-side, no second round-trip required).
 */

import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/tokens';
import type { AspireNumberInfo } from '@/lib/api/frontDesk';

export interface AspireNumberPillProps {
  /** Office's purchased number, or null when not bought yet. */
  aspireNumber: AspireNumberInfo | null | undefined;
  /** Hide the "Set up" CTA when null — useful inside FDS Setup itself. */
  hideSetupCta?: boolean;
  /** Compact mode for tight headers. */
  compact?: boolean;
}

function describeCapabilities(caps: AspireNumberInfo['capabilities']): string {
  const bits: string[] = [];
  if (caps.voice) bits.push('Voice');
  if (caps.sms) bits.push('SMS');
  if (caps.mms) bits.push('MMS');
  return bits.length > 0 ? bits.join(' + ') : 'Voice';
}

export function AspireNumberPill({
  aspireNumber,
  hideSetupCta,
  compact,
}: AspireNumberPillProps): React.ReactElement | null {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!aspireNumber?.e164) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(aspireNumber.e164);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // best-effort — fail silently
    }
  }, [aspireNumber?.e164]);

  if (!aspireNumber || !aspireNumber.e164) {
    if (hideSetupCta) return null;
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Aspire number not set up — open Front Desk Setup"
        onPress={() => router.push('/session/calls/setup' as never)}
        style={[styles.pill, styles.pillEmpty, compact && styles.pillCompact]}
      >
        <Ionicons name="alert-circle-outline" size={14} color={Colors.text.muted} />
        <Text style={styles.emptyLabel}>No Aspire number yet</Text>
        <Text style={styles.emptyCta}>Set up →</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.pill, compact && styles.pillCompact]}>
      <Ionicons name="call" size={13} color="rgba(59, 130, 246, 0.85)" />
      <Text style={styles.label}>Your number</Text>
      <Text style={styles.numberText} accessibilityLabel={`Your Aspire number is ${aspireNumber.formatted}`}>
        {aspireNumber.formatted}
      </Text>
      <View style={styles.divider} />
      <Text style={styles.capsText}>{describeCapabilities(aspireNumber.capabilities)}</Text>
      {Platform.OS === 'web' ? (
        <Pressable
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Copied to clipboard' : 'Copy number to clipboard'}
          style={styles.copyBtn}
          hitSlop={8}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={13}
            color={copied ? '#22c55e' : Colors.text.muted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    alignSelf: 'flex-start',
  },
  pillCompact: {
    paddingVertical: 4,
    gap: 6,
  },
  pillEmpty: {
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  numberText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  capsText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  copyBtn: {
    marginLeft: 4,
    padding: 2,
  },
  emptyLabel: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  emptyCta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
});

export default AspireNumberPill;
