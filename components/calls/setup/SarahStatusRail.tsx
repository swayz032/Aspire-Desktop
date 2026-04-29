/**
 * SarahStatusRail — Pass 10 Lane B (plan §10.4)
 *
 * Right-rail composite of 3 stacked cards:
 *   A. Sarah Status         — avatar + name + role + Active pill
 *   B. Current Setup Summary — 5 labeled rows with icons
 *   C. Verification         — forwarding test status (mode-aware)
 *
 * Per §12.1: rail cards share the same visual language as section
 * panels — same border + shadow stack — but use a tighter type
 * scale and persistent left-icon + right-value pattern. Verification
 * card is mode-aware: shows "Not needed in Aspire number mode" when
 * mode === ASPIRE_NUMBER, otherwise renders the forwarding state
 * machine (NOT_CONFIGURED / PENDING / VERIFIED / LAST_TEST_FAILED).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type {
  SarahStatus,
  SetupSummaryItem,
  ForwardingVerification,
  PublicNumberMode,
  ForwardingStatus,
} from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SarahStatusRailProps {
  sarah: SarahStatus;
  summary: SetupSummaryItem[];
  forwarding?: ForwardingVerification;
  publicNumberMode: PublicNumberMode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SarahStatusRail({
  sarah,
  summary,
  forwarding,
  publicNumberMode,
}: SarahStatusRailProps) {
  return (
    <View style={styles.rail}>
      <SarahStatusCard sarah={sarah} />
      <SetupSummaryCard items={summary} />
      <VerificationCard publicNumberMode={publicNumberMode} forwarding={forwarding} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card A — Sarah Status
// ---------------------------------------------------------------------------

function SarahStatusCard({ sarah }: { sarah: SarahStatus }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHead} accessibilityRole="header">
        Sarah Status
      </Text>

      <View style={styles.identityRow}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="person" size={22} color={Colors.accent.cyan} />
          <View style={styles.avatarPing} />
        </View>

        <View style={styles.identityCol}>
          <Text style={styles.sarahName}>{sarah.displayName}</Text>
          <Text style={styles.sarahRole}>{sarah.roleLabel}</Text>
        </View>

        <ActivePill active={sarah.active} />
      </View>
    </View>
  );
}

function ActivePill({ active }: { active: boolean }) {
  const palette = active
    ? { bg: 'rgba(52,199,89,0.14)', border: 'rgba(52,199,89,0.34)', dot: Colors.semantic.success, text: Colors.semantic.success, label: 'Active' }
    : { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', dot: Colors.text.muted, text: Colors.text.muted, label: 'Idle' };

  return (
    <View
      style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessibilityRole="text"
      accessibilityLabel={`Sarah is ${palette.label.toLowerCase()}`}
    >
      <View
        style={[
          styles.pillDot,
          { backgroundColor: palette.dot },
          active && Platform.OS === 'web'
            ? ({ boxShadow: `0 0 8px ${Colors.semantic.success}` } as any)
            : null,
        ]}
      />
      <Text style={[styles.pillText, { color: palette.text }]}>{palette.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card B — Current Setup Summary
// ---------------------------------------------------------------------------

function SetupSummaryCard({ items }: { items: SetupSummaryItem[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHead} accessibilityRole="header">
        Current Setup Summary
      </Text>

      <View style={styles.summaryList}>
        {items.map((item, idx) => (
          <View
            key={`${item.label}-${idx}`}
            style={[styles.summaryRow, idx === items.length - 1 && styles.summaryRowLast]}
          >
            <View style={styles.summaryIcon}>
              <Ionicons
                name={item.iconName as keyof typeof Ionicons.glyphMap}
                size={14}
                color={Colors.text.tertiary}
              />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card C — Verification
// ---------------------------------------------------------------------------

function VerificationCard({
  publicNumberMode,
  forwarding,
}: {
  publicNumberMode: PublicNumberMode;
  forwarding?: ForwardingVerification;
}) {
  const isAspire = publicNumberMode === 'ASPIRE_NUMBER';
  const status: ForwardingStatus = forwarding?.status ?? 'NOT_CONFIGURED';

  // Mode-aware presentation (plan §10.4 Card C)
  let icon: keyof typeof Ionicons.glyphMap;
  let iconColor: string;
  let title: string;
  let subtitle: string;
  let titleColor: string = Colors.text.primary;

  if (isAspire) {
    icon = 'checkmark-circle';
    iconColor = Colors.semantic.success;
    title = 'Forwarding test';
    subtitle = 'Not needed in Aspire number mode';
  } else {
    switch (status) {
      case 'VERIFIED':
        icon = 'checkmark-circle';
        iconColor = Colors.semantic.success;
        title = 'Forwarding verified';
        subtitle = forwarding?.lastTestAt
          ? `Last tested ${forwarding.lastTestAt}`
          : 'Inbound calls reach Sarah successfully.';
        break;
      case 'PENDING':
        icon = 'time-outline';
        iconColor = Colors.semantic.warning;
        title = 'Verification pending';
        subtitle = 'We are confirming your forwarding setup.';
        break;
      case 'LAST_TEST_FAILED':
        icon = 'alert-circle';
        iconColor = Colors.semantic.error;
        title = 'Forwarding test failed';
        subtitle = forwarding?.lastTestErrorMessage ?? 'Last test did not complete. Try again.';
        titleColor = Colors.semantic.error;
        break;
      case 'NOT_CONFIGURED':
      default:
        icon = 'ellipse-outline';
        iconColor = Colors.text.tertiary;
        title = 'Forwarding not configured';
        subtitle = 'Add your existing number to verify forwarding.';
        break;
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHead} accessibilityRole="header">
        Verification
      </Text>

      <View
        style={styles.verifyRow}
        accessibilityRole="text"
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <View style={styles.verifyIconWrap}>
          {status === 'PENDING' && !isAspire ? (
            <ActivityIndicator size="small" color={Colors.semantic.warning} />
          ) : (
            <Ionicons name={icon} size={20} color={iconColor} />
          )}
        </View>
        <View style={styles.verifyBody}>
          <Text style={[styles.verifyTitle, { color: titleColor }]}>{title}</Text>
          <Text style={styles.verifySubtitle}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ----- Rail container -------------------------------------------------
  rail: {
    gap: 14,
  },

  // ----- Card shell (shared) -------------------------------------------
  card: {
    backgroundColor: '#101012',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.4), 0 6px 18px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.025)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 3,
        }),
  } as any,

  cardHead: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },

  // ----- Card A — Sarah Status -----------------------------------------
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
    position: 'relative',
  },
  avatarPing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sarahName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  sarahRole: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },

  // Active/idle pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ----- Card B — Setup Summary ----------------------------------------
  summaryList: {
    gap: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
    flex: 1,
    minWidth: 0,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'right',
    maxWidth: '55%',
  },

  // ----- Card C — Verification -----------------------------------------
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  verifyIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  verifyTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  verifySubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    lineHeight: 15,
  },
});

export default SarahStatusRail;
