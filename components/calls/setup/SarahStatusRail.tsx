/**
 * SarahStatusRail — Pass 19 update (plan §3.8 + §6.1).
 *
 * Right-rail composite of 3 stacked cards:
 *   A. Sarah Status         — avatar + name + role + Active pill
 *   B. Current Setup Summary — labeled rows with icons, plus a dual-number
 *                              callout when the Public Number mode is
 *                              FORWARD_EXISTING (per §3.8 — owner sees BOTH
 *                              the Aspire SMS-companion number AND the
 *                              customer-facing forwarding number).
 *   C. Verification         — forwarding-test status (mode-aware)
 *
 * §3.8 dual-number display rationale:
 *   In `FORWARD_EXISTING`, the owner has TWO numbers — the Aspire-issued
 *   companion (used for SMS + Ava reminders) and their existing-carrier
 *   number (the customer-facing one that forwards to Sarah). The legacy
 *   single-number summary line was misleading. Pass 19 surfaces both.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { AspireNumberInfo } from '@/lib/api/frontDesk';
import { AspireNumberPill } from '@/components/calls/AspireNumberPill';
import type {
  SarahStatus,
  SetupSummaryItem,
  ForwardingVerification,
  PublicNumberMode,
  ForwardingStatus,
  PublicNumberConfig,
} from './setup-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SarahStatusRailProps {
  sarah: SarahStatus;
  summary: SetupSummaryItem[];
  forwarding?: ForwardingVerification;
  publicNumberMode: PublicNumberMode;
  /**
   * Pass the full Public Number config so the rail can show BOTH numbers in
   * `FORWARD_EXISTING` mode (Aspire SMS companion + existing carrier #).
   * Falls back gracefully when undefined.
   */
  publicNumberConfig?: PublicNumberConfig;
  /**
   * ISO-8601 timestamp of Sarah's most recent call. When provided, Card A
   * shows "Last call: Xm ago". When omitted, the line falls back to "—".
   * Pass 17 will wire this to the memory_objects feed.
   */
  lastCallAt?: string;
  /**
   * Office's purchased Aspire number (joined from tenant_phone_numbers).
   * Renders the AspireNumberPill in the rail across all PublicNumberModes
   * — single source of truth so the FE doesn't have to deduce the number
   * from publicNumberConfig.selectedNumberId in some modes only.
   */
  aspireNumber?: AspireNumberInfo | null;
  /**
   * Persona-driven headshot URL — `/personas/<slug>.png` served as a static
   * asset by Aspire-desktop. Optional; falls back to the generic person
   * Ionicon when missing or when the image fails to load.
   */
  headshotUrl?: string;
  /**
   * Persona accent color (hex). Drives the active pill highlight + avatar
   * ring when present so Sarah-vs-Tiffany are visually distinct in the rail.
   */
  accentColor?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SarahStatusRail({
  sarah,
  summary,
  forwarding,
  publicNumberMode,
  publicNumberConfig,
  lastCallAt,
  aspireNumber,
  headshotUrl,
  accentColor,
}: SarahStatusRailProps) {
  return (
    <View style={styles.rail}>
      <SarahStatusCard
        sarah={sarah}
        lastCallAt={lastCallAt}
        headshotUrl={headshotUrl}
        accentColor={accentColor}
      />

      {/* Aspire number badge — appears in every PublicNumberMode (Pass 19 §2.5).
          The pill itself renders a "Set up →" CTA when no number is purchased. */}
      <View style={styles.aspireNumberRow}>
        <AspireNumberPill aspireNumber={aspireNumber} />
      </View>

      {publicNumberMode === 'FORWARD_EXISTING' && publicNumberConfig ? (
        <DualNumberCard
          aspireCompanion={publicNumberConfig.selectedNumberId}
          customerFacing={publicNumberConfig.forwardedNumber}
        />
      ) : null}

      <SetupSummaryCard items={summary} />
      <VerificationCard publicNumberMode={publicNumberMode} forwarding={forwarding} />
    </View>
  );
}

/**
 * Format an ISO timestamp as "Xm ago", "Xh ago", or "Xd ago". Falls back to
 * "—" when null/invalid. Kept in this file (small helper, not worth a util).
 */
function formatLastCall(iso?: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatPhone(value?: string): string {
  if (!value) return '—';
  if (/^\(\d{3}\) \d{3}-\d{4}$/.test(value)) return value;
  const digits = value.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return value;
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

// ---------------------------------------------------------------------------
// Card A — Sarah Status
// ---------------------------------------------------------------------------

function SarahStatusCard({
  sarah,
  lastCallAt,
  headshotUrl,
  accentColor,
}: {
  sarah: SarahStatus;
  lastCallAt?: string;
  headshotUrl?: string;
  accentColor?: string;
}) {
  const lastCallLabel = formatLastCall(lastCallAt);
  const [headshotFailed, setHeadshotFailed] = React.useState(false);
  const ringColor = accentColor || (Colors.accent.cyan as string);
  const showHeadshot = !!headshotUrl && !headshotFailed;

  return (
    <View style={styles.card}>
      <Text style={styles.cardHead} accessibilityRole="header">
        {sarah.displayName ? `${sarah.displayName} Status` : 'Receptionist Status'}
      </Text>

      <View style={styles.identityRow}>
        <View
          style={[
            styles.avatar,
            showHeadshot && styles.avatarImageWrap,
            { borderColor: ringColor + '66' },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {showHeadshot ? (
            <Image
              source={{ uri: headshotUrl }}
              onError={() => setHeadshotFailed(true)}
              style={styles.avatarImage}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Ionicons name="person" size={22} color={ringColor} />
          )}
          <View
            style={[
              styles.avatarPing,
              accentColor ? { backgroundColor: ringColor } : null,
            ]}
          />
        </View>

        <View style={styles.identityCol}>
          <Text style={styles.sarahName}>{sarah.displayName}</Text>
          <Text style={styles.sarahRole}>{sarah.roleLabel}</Text>
        </View>

        <ActivePill active={sarah.active} />
      </View>

      {/* Last call timestamp */}
      <View
        style={styles.lastCallRow}
        accessibilityRole="text"
        accessibilityLabel={`Last call ${lastCallLabel === '—' ? 'unknown' : lastCallLabel}`}
      >
        <Ionicons name="time-outline" size={12} color={Colors.text.muted} />
        <Text style={styles.lastCallText}>
          Last call: <Text style={styles.lastCallStrong}>{lastCallLabel}</Text>
        </Text>
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
// Card A.5 — Dual-number display (FORWARD_EXISTING only, per §3.8)
// ---------------------------------------------------------------------------

function DualNumberCard({
  aspireCompanion,
  customerFacing,
}: {
  aspireCompanion?: string;
  customerFacing?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardHead} accessibilityRole="header">
        Your Numbers
      </Text>

      {/* Aspire companion */}
      <View style={styles.numRow} accessibilityRole="text">
        <View style={[styles.numDot, styles.numDotAspire]} />
        <View style={styles.numCol}>
          <Text style={styles.numKicker}>ASPIRE NUMBER</Text>
          <Text style={styles.numValue}>{formatPhone(aspireCompanion)}</Text>
          <Text style={styles.numHelper}>SMS + Ava reminders</Text>
        </View>
      </View>

      {/* Hairline divider */}
      <View style={styles.numDivider} />

      {/* Customer-facing existing number */}
      <View style={styles.numRow} accessibilityRole="text">
        <View style={[styles.numDot, styles.numDotForward]} />
        <View style={styles.numCol}>
          <Text style={styles.numKicker}>CUSTOMER-FACING</Text>
          <Text style={styles.numValue}>{formatPhone(customerFacing)}</Text>
          <Text style={styles.numHelper}>Forwards to Sarah</Text>
        </View>
      </View>
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
  // Pass 19 reframe: ASPIRE_NEW_NUMBER and PORT_IN don't need forwarding
  // verification (Sarah answers the number directly). Only FORWARD_EXISTING
  // surfaces the forwarding-test state machine.
  const needsForwarding = publicNumberMode === 'FORWARD_EXISTING';
  const status: ForwardingStatus = forwarding?.status ?? 'NOT_CONFIGURED';

  let icon: keyof typeof Ionicons.glyphMap;
  let iconColor: string;
  let title: string;
  let subtitle: string;
  let titleColor: string = Colors.text.primary;

  if (!needsForwarding) {
    icon = 'checkmark-circle';
    iconColor = Colors.semantic.success;
    title =
      publicNumberMode === 'PORT_IN'
        ? 'Direct ownership'
        : 'Forwarding test';
    subtitle =
      publicNumberMode === 'PORT_IN'
        ? 'Aspire owns the number end-to-end after port-in completes.'
        : 'Not needed — Sarah answers your Aspire number directly.';
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
          {needsForwarding && status === 'PENDING' ? (
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

  // Single-row holder for the AspireNumberPill so the pill aligns flush with
  // the cards that bracket it.
  aspireNumberRow: {
    paddingHorizontal: 4,
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
  avatarImageWrap: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
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

  // Last call row
  lastCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  lastCallText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.1,
  },
  lastCallStrong: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
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

  // ----- Card A.5 — Dual-number callout (FORWARD_EXISTING only) -------
  numRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  numDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  numDotAspire: {
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 8px rgba(59,130,246,0.55)' } as any)
      : {}),
  } as any,
  numDotForward: {
    backgroundColor: Colors.semantic.warning,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 8px rgba(245,158,11,0.55)' } as any)
      : {}),
  } as any,
  numCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  numKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.2,
  },
  numValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  numHelper: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  numDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
