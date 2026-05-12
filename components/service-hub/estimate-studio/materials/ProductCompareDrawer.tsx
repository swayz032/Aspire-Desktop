/**
 * ProductCompareDrawer — slide-over (right side) showing cross-seller pricing
 * for a single product. Pass B: mock 3-seller data. Pass F: real shopping API.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/hooks/useMaterialsSearch';
import { getMockCompareSellers, type CompareSeller } from '@/hooks/useMaterialsSearch';

interface Props {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
  onUseAlt?: (sellerId: string) => void;
}

function formatPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDelta(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ProductCompareDrawer({ visible, onClose, product, onUseAlt }: Props) {
  // Escape key close on web — hook must run unconditionally.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  // Keep the last product around so the drawer can finish its slide-out
  // animation after `product` is cleared to null. Without this, the Modal
  // would unmount mid-transition and the user would see an empty flicker.
  const lastProductRef = useRef<Product | null>(product);
  useEffect(() => {
    if (product) lastProductRef.current = product;
  }, [product]);

  const shown = product ?? lastProductRef.current;
  const sellers: CompareSeller[] = shown ? getMockCompareSellers(shown) : [];
  const cheapest = sellers.length > 0
    ? sellers.reduce((min, s) => (s.price < min.price ? s : min), sellers[0])
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="compare-drawer-backdrop">
        <Pressable
          style={styles.drawer}
          onPress={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
          testID="materials-compare-drawer"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Cross-Seller Comparison</Text>
              <Text style={styles.title} numberOfLines={2}>
                {shown?.title ?? ''}
              </Text>
              <Text style={styles.brand}>{shown?.brand ?? ''}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }: any) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Close comparison"
              testID="materials-compare-close"
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>

          {/* Best price callout */}
          {cheapest && (
            <View style={styles.bestBox}>
              <Ionicons name="trending-down" size={14} color="#34c759" />
              <Text style={styles.bestLabel}>BEST PRICE</Text>
              <Text style={styles.bestSeller}>{cheapest.sellerName}</Text>
              <Text style={styles.bestPrice}>{formatPrice(cheapest.price)}</Text>
            </View>
          )}

          {/* Seller table */}
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.col, styles.colSeller, styles.headText]}>SELLER</Text>
              <Text style={[styles.col, styles.colPrice, styles.headText]}>PRICE</Text>
              <Text style={[styles.col, styles.colDelta, styles.headText]}>VS HD</Text>
              <Text style={[styles.col, styles.colShip, styles.headText]}>SHIP</Text>
              <View style={[styles.col, styles.colAction]} />
            </View>
            {sellers.map((s) => {
              const isCheapest = cheapest !== null && s.sellerId === cheapest.sellerId;
              return (
                <View
                  key={s.sellerId}
                  style={[styles.tableRow, isCheapest && styles.tableRowBest]}
                  testID={`compare-row-${s.sellerId}`}
                >
                  <View style={[styles.col, styles.colSeller]}>
                    <Text style={styles.sellerName} numberOfLines={1}>
                      {s.sellerName}
                    </Text>
                    {!s.inStock && <Text style={styles.outOfStock}>Out of stock</Text>}
                  </View>
                  <Text style={[styles.col, styles.colPrice, styles.priceCell]}>
                    {formatPrice(s.price)}
                  </Text>
                  <Text
                    style={[
                      styles.col,
                      styles.colDelta,
                      styles.deltaCell,
                      s.delta < 0 && styles.deltaCellSave,
                      s.delta > 0 && styles.deltaCellOver,
                    ]}
                  >
                    {s.delta === 0 ? '—' : formatDelta(s.delta)}
                  </Text>
                  <Text style={[styles.col, styles.colShip, styles.shipCell]}>
                    {s.shippingDays != null
                      ? s.shippingDays === 0
                        ? 'Today'
                        : `${s.shippingDays}d`
                      : '—'}
                  </Text>
                  <View style={[styles.col, styles.colAction]}>
                    <Pressable
                      onPress={() => onUseAlt?.(s.sellerId)}
                      disabled={s.sellerId === 'home_depot'}
                      style={({ hovered, pressed }: any) => [
                        styles.useAltBtn,
                        s.sellerId === 'home_depot' && styles.useAltBtnDisabled,
                        hovered && styles.useAltBtnHovered,
                        pressed && styles.useAltBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${s.sellerName} as supplier`}
                    >
                      <Text style={styles.useAltBtnText}>
                        {s.sellerId === 'home_depot' ? 'CURRENT' : 'USE THIS'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.footer}>
            Pass B — sample data. Live Google Shopping pricing lands in Pass F.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const drawerStyle: ViewStyle = {
  width: '100%',
  maxWidth: 560,
  height: '100%',
  backgroundColor: '#0c0c12',
  borderLeftWidth: 1,
  borderLeftColor: 'rgba(255,255,255,0.10)',
  ...(Platform.OS === 'web'
    ? (({ boxShadow: '-20px 0 60px rgba(0,0,0,0.45)' } as unknown) as ViewStyle)
    : {}),
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web'
      ? (({ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as unknown) as ViewStyle)
      : {}),
  },
  drawer: drawerStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.2,
    lineHeight: 19,
    marginBottom: 4,
  },
  brand: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  bestBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.22)',
  },
  bestLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: 1.0,
  },
  bestSeller: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  bestPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34c759',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },

  table: {
    marginTop: 16,
    marginHorizontal: 12,
  },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tableRowBest: {
    backgroundColor: 'rgba(52,199,89,0.03)',
  },
  col: {
    paddingHorizontal: 3,
  },
  colSeller: { flex: 2 },
  colPrice: { flex: 1.2, textAlign: 'right' as const },
  colDelta: { flex: 1, textAlign: 'right' as const },
  colShip: { flex: 0.8, textAlign: 'right' as const },
  colAction: { flex: 1.2, alignItems: 'flex-end' as const },

  sellerName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  outOfStock: {
    fontSize: 9.5,
    color: '#ff6b6b',
    marginTop: 1,
  },
  priceCell: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    fontVariant: ['tabular-nums'],
  },
  deltaCell: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  deltaCellSave: { color: '#34c759' },
  deltaCellOver: { color: '#ff6b6b' },
  shipCell: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontVariant: ['tabular-nums'],
  },
  useAltBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
  },
  useAltBtnHovered: {
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
  useAltBtnPressed: {
    backgroundColor: 'rgba(251,191,36,0.26)',
  },
  useAltBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    opacity: 0.55,
  },
  useAltBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.7,
  },

  footer: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
