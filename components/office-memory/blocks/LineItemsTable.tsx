/**
 * LineItemsTable — premium invoice / quote line items table.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Description                Qty   Unit Price       Total     │  <- header
 *   │ ─────────────────────────────────────────────────────────── │
 *   │ Lobby finishes              1     $42,500.00   $42,500.00   │
 *   │ Custom millwork             4      $4,800.00   $19,200.00   │
 *   │ ...                                                          │
 *   │ ─────────────────────────────────────────────────────────── │
 *   │                                       Subtotal   $61,700.00 │
 *   │                                            Tax    $4,936.00 │
 *   │                                          TOTAL  $66,636.00  │  <- accent
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Editorial details per §12.1:
 *   - Description column flexes 1; numeric columns are right-aligned with
 *     tabular-nums so digits stack.
 *   - Header row uses 11/700 uppercase tracking +1.5 ("magazine ledger" feel).
 *   - Total row uses 18/700 Aspire-blue + soft halo so the eye lands on it.
 *   - On native, columns collapse into a stacked "card per item" layout for
 *     readability. The web table is the canonical shape.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '@/constants/tokens';

export interface LineItem {
  description: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface LineItemsTableProps {
  items: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** ISO 4217 currency code; default 'USD'. */
  currency?: string;
  /** Eyebrow override (default: "Line Items"). */
  eyebrow?: string;
}

function fmtMoney(cents: number, currency = 'USD'): string {
  try {
    const n = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function LineItemsTable({
  items,
  subtotalCents,
  taxCents,
  totalCents,
  currency = 'USD',
  eyebrow = 'Line Items',
}: LineItemsTableProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      {/* Header row */}
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.headerCell, styles.descCell]}>Description</Text>
        <Text style={[styles.headerCell, styles.qtyCell]}>Qty</Text>
        <Text style={[styles.headerCell, styles.unitCell]}>Unit Price</Text>
        <Text style={[styles.headerCell, styles.totalCell]}>Total</Text>
      </View>

      <View style={styles.divider} />

      {/* Items */}
      {items.length === 0 ? (
        <Text style={styles.empty}>No line items.</Text>
      ) : (
        items.map((item, idx) => (
          <View key={`${item.description}-${idx}`} style={styles.itemRow}>
            <View style={[styles.row, styles.itemContentRow]}>
              <Text
                style={[styles.bodyCell, styles.descCell, styles.descText]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
              <Text style={[styles.bodyCell, styles.qtyCell]}>{item.qty}</Text>
              <Text style={[styles.bodyCell, styles.unitCell]}>
                {fmtMoney(item.unitPriceCents, currency)}
              </Text>
              <Text style={[styles.bodyCell, styles.totalCell, styles.totalText]}>
                {fmtMoney(item.totalCents, currency)}
              </Text>
            </View>
            {idx < items.length - 1 && <View style={styles.itemDivider} />}
          </View>
        ))
      )}

      <View style={styles.divider} />

      {/* Totals */}
      <View style={styles.totalsBlock}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>{fmtMoney(subtotalCents, currency)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Tax</Text>
          <Text style={styles.totalsValue}>{fmtMoney(taxCents, currency)}</Text>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{fmtMoney(totalCents, currency)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
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
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRow: {
    paddingVertical: 8,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  itemRow: {
    paddingVertical: 4,
  },
  itemContentRow: {
    paddingVertical: 10,
  },
  itemDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bodyCell: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary as string,
  },
  descCell: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  qtyCell: {
    width: 56,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  unitCell: {
    width: 120,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  totalCell: {
    width: 120,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  descText: {
    color: Colors.text.primary as string,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  totalText: {
    fontWeight: '600',
    color: Colors.text.bright as string,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 4,
  },
  empty: {
    fontSize: 14,
    color: Colors.text.tertiary as string,
    fontStyle: 'italic',
    paddingVertical: 16,
    textAlign: 'center',
  },
  totalsBlock: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  totalsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.1,
  },
  totalsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    width: 120,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  grandTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59,130,246,0.18)',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93C5FD',
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.accent.cyan as string,
    width: 120,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0 0 16px rgba(59,130,246,0.30)' } as unknown as TextStyle)
      : {}),
  },
});

export default LineItemsTable;
