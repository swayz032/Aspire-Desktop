/**
 * MemoryDetailInvoice — Stripe-Dashboard-fidelity invoice presentation.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Invoice number  ·  status pill                       │
 *   │ Amount due display (oversized hero)                  │
 *   │ Due date secondary line                              │
 *   │                                                       │
 *   │ <PDFViewer src={pdf_url} collapsible/>               │
 *   │                                                       │
 *   │ <LineItemsTable items={lineItems} totals={totals}/>  │
 *   │                                                       │
 *   │ <StatusTimeline events={timeline}/>                  │
 *   │                                                       │
 *   │ Customer card · totalAmount large display            │
 *   │                                                       │
 *   │ Linked receipts (payments / refunds)                 │
 *   └──────────────────────────────────────────────────────┘
 *
 * Framer notes (§12.1):
 *   - Hero amount is the "Bloomberg Terminal" moment — 38px tabular numerics,
 *     letter-spacing −1, white-on-black, no decoration.
 *   - Status pill uses Stripe's earned-color discipline: paid=green, sent=blue,
 *     viewed=cyan, draft=neutral, voided=muted-red. Status-flash on transition.
 *   - Customer card sits below the timeline (not above) — invoice is the
 *     subject, customer is the recipient. Editorial hierarchy.
 *   - Tabular numeric font on every dollar amount via SF Mono / system mono.
 */

import React from 'react';
import {
  Platform,
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

type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'voided' | 'overdue';

interface StatusStyle {
  label: string;
  fg: string;
  bg: string;
  ring: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const INVOICE_STATUS: Record<InvoiceStatus, StatusStyle> = {
  draft:    { label: 'Draft',    fg: '#A1A1A6', bg: 'rgba(255,255,255,0.04)', ring: 'rgba(255,255,255,0.10)', icon: 'document-outline' },
  sent:     { label: 'Sent',     fg: '#60A5FA', bg: 'rgba(59,130,246,0.10)',  ring: 'rgba(59,130,246,0.30)',  icon: 'paper-plane-outline' },
  viewed:   { label: 'Viewed',   fg: '#5EEAD4', bg: 'rgba(45,212,191,0.10)',  ring: 'rgba(45,212,191,0.30)',  icon: 'eye-outline' },
  paid:     { label: 'Paid',     fg: '#34D399', bg: 'rgba(16,185,129,0.10)',  ring: 'rgba(16,185,129,0.30)',  icon: 'checkmark-circle' },
  voided:   { label: 'Voided',   fg: '#FB7185', bg: 'rgba(244,63,94,0.06)',   ring: 'rgba(244,63,94,0.18)',   icon: 'close-circle-outline' },
  overdue:  { label: 'Overdue',  fg: '#FBBF24', bg: 'rgba(245,158,11,0.10)',  ring: 'rgba(245,158,11,0.30)',  icon: 'alarm-outline' },
};

function deriveInvoiceStatus(memory: MemoryDetail): InvoiceStatus {
  // Look for the active step in the timeline first — it's the freshest signal.
  const tl = memory.statusTimeline ?? [];
  const active = tl.find((s) => s.current) ?? tl.slice().reverse().find((s) => s.completed);
  const label = (active?.label ?? memory.task?.statusLabel ?? '').toLowerCase();
  if (label.includes('paid')) return 'paid';
  if (label.includes('void')) return 'voided';
  if (label.includes('overdue')) return 'overdue';
  if (label.includes('view')) return 'viewed';
  if (label.includes('sent')) return 'sent';
  if (label.includes('draft')) return 'draft';
  if (memory.status === 'executed') return 'paid';
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

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MemoryDetailInvoiceProps {
  memory: MemoryDetail;
}

export function MemoryDetailInvoice({ memory }: MemoryDetailInvoiceProps) {
  const status = deriveInvoiceStatus(memory);
  const s = INVOICE_STATUS[status];

  const lineItems = memory.lineItems ?? [];
  const totals = memory.totals ?? null;
  const timeline = memory.statusTimeline ?? [];
  const file = memory.file;
  const linkedReceipts = memory.linkedReceipts ?? [];

  // Invoice number — derive from title fallback ("INV-1024 · ...") or task field.
  const invoiceNumber =
    extractInvoiceNumber(memory.title) ??
    memory.task?.statusLabel ??
    memory.id.toUpperCase();

  // Customer block — derived from entity / participants.
  const customerName = memory.entity?.name ?? memory.participants?.[0] ?? 'Customer';
  const customerEmail = (memory as any).contact?.phone ?? undefined;

  return (
    <View style={styles.root}>
      {/* Hero strip — invoice number, status, total amount */}
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroNumberWrap}>
            <Text style={styles.heroEyebrow}>Invoice</Text>
            <Text style={styles.heroNumber}>{invoiceNumber}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: s.bg, borderColor: s.ring },
            ]}
          >
            <Ionicons name={s.icon} size={12} color={s.fg} />
            <Text style={[styles.statusText, { color: s.fg }]}>{s.label}</Text>
          </View>
        </View>

        {totals && (
          <View style={styles.amountWrap}>
            <Text style={styles.amountLabel}>
              {status === 'paid' ? 'Amount paid' : 'Amount due'}
            </Text>
            <Text style={styles.amountValue}>
              {formatCurrency(totals.totalCents, totals.currency ?? 'USD')}
            </Text>
            {memory.task?.dueDate && status !== 'paid' && (
              <Text style={styles.amountSub}>
                Due {formatDate(memory.task.dueDate)}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* PDF viewer */}
      {file?.src && (
        <PDFViewer
          src={file.src}
          filename={file.mime ? `Invoice ${invoiceNumber}` : undefined}
          meta={file.sizeLabel}
        />
      )}

      {/* Line items table */}
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

      {/* Customer card — premium recipient row */}
      <View style={styles.customerCard}>
        <Text style={styles.eyebrow}>Bill to</Text>
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
            {customerEmail && (
              <Text style={styles.customerEmail} numberOfLines={1}>
                {customerEmail}
              </Text>
            )}
            {memory.project?.name && (
              <Text style={styles.customerProject} numberOfLines={1}>
                {memory.project.name}
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

      {/* Linked receipts (payment, refund) */}
      {linkedReceipts.length > 0 && (
        <View style={styles.receiptsRow}>
          <Text style={styles.eyebrow}>Linked receipts</Text>
          <View style={styles.receiptPills}>
            {linkedReceipts.map((r) => (
              <View key={r.id} style={styles.receiptPill}>
                <Ionicons name="cash-outline" size={11} color="#34D399" />
                <Text style={styles.receiptPillText} numberOfLines={1}>
                  {r.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Helper: extract "INV-1234" from a title ─────────────────────────────────

function extractInvoiceNumber(title: string): string | null {
  const m = title.match(/\b(INV[-_]?\d+|#\d{3,})\b/i);
  return m ? m[0].toUpperCase() : null;
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
  amountWrap: {
    gap: 6,
  },
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
    letterSpacing: 0,
  },

  // Customer card
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
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34D399',
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
  customerEmail: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  customerProject: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  customerTotal: {
    alignItems: 'flex-end',
    gap: 2,
  },
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

  // Receipts
  receiptsRow: {
    gap: 10,
  },
  receiptPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  receiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.20)',
    maxWidth: 240,
  },
  receiptPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#34D399',
    letterSpacing: 0.2,
  },
});

export default MemoryDetailInvoice;
