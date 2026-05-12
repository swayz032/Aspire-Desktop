/**
 * BundleSummaryBar — sticky bottom bar showing bundle stats + Push to Estimate
 * and Draft RFQ Packet actions. Hidden when bundle is empty.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  itemCount: number;
  supplierCount: number;
  subtotal: number;
  onPushToEstimate: () => void;
  onDraftRfq: () => void;
  onClear?: () => void;
  /**
   * Pass E: when true, the bundle contains supplier_line items. The primary
   * CTA swaps from "Push to Estimate" to "Draft RFQs", and the secondary
   * Draft-RFQ button is suppressed (it would be redundant).
   */
  hasSupplierLines?: boolean;
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 200ms ease' } as unknown) as ViewStyle)
    : {};

function formatPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BundleSummaryBar({
  itemCount,
  supplierCount,
  subtotal,
  onPushToEstimate,
  onDraftRfq,
  onClear,
  hasSupplierLines = false,
}: Props) {
  if (itemCount === 0) return null;

  // Pass E: primary CTA adapts to bundle contents.
  const primaryLabel = hasSupplierLines ? 'DRAFT RFQS' : 'PUSH TO ESTIMATE';
  const primaryA11y = hasSupplierLines
    ? 'Draft RFQs from supplier bundle'
    : 'Push bundle to estimate';
  const primaryHandler = hasSupplierLines ? onDraftRfq : onPushToEstimate;
  const primaryTestID = hasSupplierLines
    ? 'bundle-draft-rfqs-btn'
    : 'bundle-push-to-estimate-btn';

  return (
    <View style={styles.bar} testID="materials-bundle-summary-bar">
      <View style={styles.stats}>
        <Stat label="Items" value={String(itemCount)} />
        <Stat label="Suppliers" value={String(supplierCount)} />
        <Stat label="Subtotal" value={formatPrice(subtotal)} accent testID="bundle-subtotal" />
      </View>

      <View style={styles.actions}>
        {onClear && (
          <Pressable
            onPress={onClear}
            style={({ hovered, pressed }: any) => [
              styles.ghostBtn,
              hovered && styles.ghostBtnHovered,
              pressed && styles.ghostBtnPressed,
              WEB_TRANSITION,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Clear bundle"
          >
            <Text style={styles.ghostBtnText}>CLEAR</Text>
          </Pressable>
        )}
        {/* Secondary Draft-RFQ button only shows in tool mode; when the
            bundle is supplier-led, primary CTA already drafts RFQs. */}
        {!hasSupplierLines && (
          <Pressable
            onPress={onDraftRfq}
            style={({ hovered, pressed }: any) => [
              styles.secondaryBtn,
              hovered && styles.secondaryBtnHovered,
              pressed && styles.secondaryBtnPressed,
              WEB_TRANSITION,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Draft RFQ packet from bundle"
            testID="bundle-draft-rfq-btn"
          >
            <Ionicons name="document-text-outline" size={13} color="#60a5fa" />
            <Text style={styles.secondaryBtnText}>DRAFT RFQ</Text>
          </Pressable>
        )}
        <Pressable
          onPress={primaryHandler}
          style={({ hovered, pressed }: any) => [
            styles.primaryBtn,
            hovered && styles.primaryBtnHovered,
            pressed && styles.primaryBtnPressed,
            WEB_TRANSITION,
          ]}
          accessibilityRole="button"
          accessibilityLabel={primaryA11y}
          testID={primaryTestID}
        >
          <Ionicons
            name={hasSupplierLines ? 'document-text-outline' : 'arrow-forward'}
            size={13}
            color="#0a0a0f"
          />
          <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface StatProps {
  label: string;
  value: string;
  accent?: boolean;
  testID?: string;
}

function Stat({ label, value, accent, testID }: StatProps) {
  return (
    <View style={styles.statTile} testID={testID}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(14,14,18,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.26)',
    flexWrap: 'wrap',
    ...(Platform.OS === 'web'
      ? (({
          position: 'sticky' as any,
          bottom: 8,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow:
            '0 -8px 32px rgba(0,0,0,0.40), 0 1px 0 rgba(251,191,36,0.08) inset',
        } as unknown) as ViewStyle)
      : {}),
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  statTile: {
    gap: 3,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  statValueAccent: {
    fontSize: 18,
    color: '#fbbf24',
    letterSpacing: -0.4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ghostBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ghostBtnHovered: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ghostBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ghostBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.30)',
  },
  secondaryBtnHovered: {
    backgroundColor: 'rgba(96,165,250,0.18)',
  },
  secondaryBtnPressed: {
    backgroundColor: 'rgba(96,165,250,0.26)',
  },
  secondaryBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 0.8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fbbf24',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 4px 12px rgba(251,191,36,0.30)',
        } as unknown) as ViewStyle)
      : {}),
  },
  primaryBtnHovered: {
    backgroundColor: '#f5a623',
  },
  primaryBtnPressed: {
    backgroundColor: '#e09010',
  },
  primaryBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0a0a0f',
    letterSpacing: 0.8,
  },
});
