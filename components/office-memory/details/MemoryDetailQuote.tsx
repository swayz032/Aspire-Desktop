/**
 * MemoryDetailQuote — PandaDoc-fidelity quote presentation.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Quote number  ·  status pill  ·  expiration warn     │
 *   │ Total amount hero (oversized)                        │
 *   │                                                       │
 *   │ <PDFViewer />                                         │
 *   │ <LineItemsTable />                                    │
 *   │ <StatusTimeline />                                    │
 *   │                                                       │
 *   │ Customer card                                        │
 *   │                                                       │
 *   │ Version history list (revision strip — current = ★)  │
 *   └──────────────────────────────────────────────────────┘
 *
 * Framer notes (§12.1):
 *   - Expiration warning is an inline amber chip in the hero — not a banner.
 *     It earns attention without screaming. Text reads "Expires in Xd" with
 *     subtle pulse when ≤7 days.
 *   - Version history is a horizontal pill chain — current version glows
 *     in accent cyan; prior versions read as muted.
 *   - Status pill set diverges from invoice: accepted=green, rejected=red,
 *     viewed=cyan, sent=blue, draft=neutral.
 *   - Hero amount block matches invoice for visual consistency across
 *     financial documents — the tabular numerics are a brand signature.
 */

import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { PDFViewer } from '../blocks/PDFViewer';
import { LineItemsTable } from '../blocks/LineItemsTable';
import { StatusTimeline } from '../blocks/StatusTimeline';
import { injectMemoryKeyframes } from '../cardAnimations';

injectMemoryKeyframes();

// ─── Status derivation ───────────────────────────────────────────────────────

type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

interface StatusStyle {
  label: string;
  fg: string;
  bg: string;
  ring: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const QUOTE_STATUS: Record<QuoteStatus, StatusStyle> = {
  draft:    { label: 'Draft',    fg: '#A1A1A6', bg: 'rgba(255,255,255,0.04)', ring: 'rgba(255,255,255,0.10)', icon: 'document-outline' },
  sent:     { label: 'Sent',     fg: '#60A5FA', bg: 'rgba(59,130,246,0.10)',  ring: 'rgba(59,130,246,0.30)',  icon: 'paper-plane-outline' },
  viewed:   { label: 'Viewed',   fg: '#5EEAD4', bg: 'rgba(45,212,191,0.10)',  ring: 'rgba(45,212,191,0.30)',  icon: 'eye-outline' },
  accepted: { label: 'Accepted', fg: '#34D399', bg: 'rgba(16,185,129,0.10)',  ring: 'rgba(16,185,129,0.30)',  icon: 'checkmark-circle' },
  rejected: { label: 'Rejected', fg: '#FB7185', bg: 'rgba(244,63,94,0.10)',   ring: 'rgba(244,63,94,0.30)',   icon: 'close-circle' },
  expired:  { label: 'Expired',  fg: '#FBBF24', bg: 'rgba(245,158,11,0.06)',  ring: 'rgba(245,158,11,0.18)',  icon: 'alarm-outline' },
};

function deriveQuoteStatus(memory: MemoryDetail): QuoteStatus {
  const tl = memory.statusTimeline ?? [];
  const active = tl.find((s) => s.current) ?? tl.slice().reverse().find((s) => s.completed);
  const label = (active?.label ?? memory.task?.statusLabel ?? '').toLowerCase();
  if (label.includes('accept')) return 'accepted';
  if (label.includes('reject') || label.includes('declin')) return 'rejected';
  if (label.includes('expire')) return 'expired';
  if (label.includes('view')) return 'viewed';
  if (label.includes('sent')) return 'sent';
  if (label.includes('draft')) return 'draft';
  if (memory.status === 'executed') return 'accepted';
  return 'sent';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function extractQuoteNumber(title: string): string | null {
  const m = title.match(/\b(QUO[-_]?\d+|Q-\d+|#\d{3,})\b/i);
  return m ? m[0].toUpperCase() : null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MemoryDetailQuoteProps {
  memory: MemoryDetail;
}

export function MemoryDetailQuote({ memory }: MemoryDetailQuoteProps) {
  const status = deriveQuoteStatus(memory);
  const s = QUOTE_STATUS[status];

  const lineItems = memory.lineItems ?? [];
  const totals = memory.totals ?? null;
  const timeline = memory.statusTimeline ?? [];
  const file = memory.file;
  const versions = memory.versionHistory ?? [];

  const quoteNumber =
    extractQuoteNumber(memory.title) ??
    memory.task?.statusLabel ??
    memory.id.toUpperCase();

  // Expiration — pull from task.dueDate if present.
  const expiresAt = memory.task?.dueDate;
  const daysLeft = daysUntil(expiresAt);
  const showExpirationWarning =
    expiresAt &&
    daysLeft !== null &&
    daysLeft <= 7 &&
    daysLeft >= 0 &&
    status !== 'accepted' &&
    status !== 'rejected';

  const customerName = memory.entity?.name ?? memory.participants?.[0] ?? 'Customer';
  const customerProject = memory.project?.name;

  return (
    <View style={styles.root}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroNumberWrap}>
            <Text style={styles.heroEyebrow}>Quote</Text>
            <Text style={styles.heroNumber}>{quoteNumber}</Text>
          </View>
          <View style={styles.heroPills}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: s.bg, borderColor: s.ring },
              ]}
            >
              <Ionicons name={s.icon} size={12} color={s.fg} />
              <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
            </View>
            {showExpirationWarning && daysLeft !== null && (
              <View style={styles.expiryPill}>
                <Ionicons name="time-outline" size={11} color="#FBBF24" />
                <Text style={styles.expiryText}>
                  {daysLeft === 0
                    ? 'Expires today'
                    : daysLeft === 1
                      ? 'Expires in 1d'
                      : `Expires in ${daysLeft}d`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {totals && (
          <View style={styles.amountWrap}>
            <Text style={styles.amountLabel}>Quote total</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(totals.totalCents, totals.currency ?? 'USD')}
            </Text>
            {expiresAt && status === 'sent' && (
              <Text style={styles.amountSub}>
                Valid through {formatShortDate(expiresAt)}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* PDF */}
      {file?.src && (
        <PDFViewer
          src={file.src}
          filename={`Quote ${quoteNumber}`}
          meta={file.sizeLabel}
        />
      )}

      {/* Line items */}
      {lineItems.length > 0 && totals && (
        <LineItemsTable
          items={lineItems}
          subtotalCents={totals.subtotalCents}
          taxCents={totals.taxCents}
          totalCents={totals.totalCents}
          currency={totals.currency}
        />
      )}

      {/* Status timeline */}
      {timeline.length > 0 && <StatusTimeline events={timeline} />}

      {/* Customer */}
      <View style={styles.customerCard}>
        <Text style={styles.eyebrow}>Quote for</Text>
        <View style={styles.customerRow}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerInitials}>
              {customerName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.customerBody}>
            <Text style={styles.customerName} numberOfLines={1}>
              {customerName}
            </Text>
            {customerProject && (
              <Text style={styles.customerProject} numberOfLines={1}>
                {customerProject}
              </Text>
            )}
          </View>
          {totals && (
            <View style={styles.customerTotal}>
              <Text style={styles.customerTotalLabel}>Total</Text>
              <Text style={styles.customerTotalValue}>
                {formatCurrency(totals.totalCents, totals.currency ?? 'USD')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Version history — pill chain */}
      {versions.length > 1 && (
        <View style={styles.versionsCard}>
          <Text style={styles.eyebrow}>Revisions</Text>
          <View style={styles.versionRail}>
            {versions.map((v, idx) => {
              const isLast = idx === versions.length - 1;
              const isCurrent = isLast || idx === versions.length - 1;
              return (
                <React.Fragment key={`${v.version}-${idx}`}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quote ${v.version}`}
                    style={({ pressed, hovered }: any) => [
                      styles.versionPill,
                      isCurrent && styles.versionPillCurrent,
                      hovered && !isCurrent && styles.versionPillHover,
                      pressed && styles.versionPillPressed,
                    ]}
                  >
                    {isCurrent && (
                      <Ionicons name="star" size={10} color={Colors.accent.cyan} />
                    )}
                    <Text
                      style={[
                        styles.versionLabel,
                        isCurrent && styles.versionLabelCurrent,
                      ]}
                    >
                      {v.version}
                    </Text>
                    <Text
                      style={[
                        styles.versionDate,
                        isCurrent && styles.versionDateCurrent,
                      ]}
                    >
                      {formatShortDate(v.date)}
                    </Text>
                  </Pressable>
                  {!isLast && <View style={styles.versionConnector} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    gap: 24,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },

  // Hero
  hero: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 28,
    gap: 24,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  heroNumberWrap: {
    minWidth: 0,
    flexShrink: 1,
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  heroNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.4,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
  },
  heroPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  expiryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.30)',
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FBBF24',
    letterSpacing: 0.3,
  },
  amountWrap: { gap: 6 },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  amountValue: {
    fontSize: 38,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -1.2,
    lineHeight: 44,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as unknown as TextStyle)
      : {}),
  },
  amountSub: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },

  // Customer card (mirrors invoice)
  customerCard: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    gap: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(45,212,191,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5EEAD4',
    letterSpacing: 0.5,
  },
  customerBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  customerProject: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  customerTotal: { alignItems: 'flex-end', gap: 2 },
  customerTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  customerTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
    ...(Platform.OS === 'web'
      ? ({ fontVariantNumeric: 'tabular-nums' } as unknown as TextStyle)
      : {}),
  },

  // Versions
  versionsCard: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    gap: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  versionRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    flexWrap: 'wrap',
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  versionPillCurrent: {
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderColor: 'rgba(59,130,246,0.30)',
  },
  versionPillHover: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  versionPillPressed: {
    opacity: 0.75,
  },
  versionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.3,
  },
  versionLabelCurrent: {
    color: Colors.accent.cyan,
  },
  versionDate: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  versionDateCurrent: {
    color: Colors.text.secondary,
  },
  versionConnector: {
    width: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginHorizontal: 4,
  },
});

export default MemoryDetailQuote;
