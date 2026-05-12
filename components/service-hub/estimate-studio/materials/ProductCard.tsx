/**
 * ProductCard — premium product tile for the Materials grid.
 *
 *   ┌──────────────────────────────┐
 *   │ [image 1:1, rounded]         │
 *   │ STOCK · DRIVE pills overlay  │
 *   ├──────────────────────────────┤
 *   │ Brand                        │
 *   │ Title (2 lines max)          │
 *   │ ★ 4.7 · 1.8k                 │
 *   │ $218.00                      │
 *   │ [Add to bundle] [Compare]    │
 *   └──────────────────────────────┘
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/hooks/useMaterialsSearch';

interface Props {
  product: Product;
  onAdd: () => void;
  onCompare: () => void;
  isInBundle?: boolean;
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 200ms ease' } as unknown) as ViewStyle)
    : {};

function formatPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatReviewCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function ProductCard({ product, onAdd, onCompare, isInBundle = false }: Props) {
  return (
    <View
      style={[styles.card, WEB_TRANSITION]}
      testID={`materials-product-card-${product.id}`}
    >
      {/* Image area */}
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={`${product.brand} ${product.title}`}
        />

        <View style={styles.imageOverlay}>
          <View style={[styles.chip, product.store.inStock ? styles.chipStock : styles.chipStockOut]}>
            <View style={[styles.dot, product.store.inStock ? styles.dotStock : styles.dotStockOut]} />
            <Text style={[styles.chipText, product.store.inStock ? styles.chipTextStock : styles.chipTextStockOut]}>
              {product.store.inStock ? 'IN STOCK' : 'OUT'}
            </Text>
          </View>

          <View style={styles.chip}>
            <Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.75)" />
            <Text style={styles.chipText}>{product.store.driveMinutes} MIN</Text>
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {product.title}
        </Text>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#fbbf24" />
          <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>· {formatReviewCount(product.reviewCount)}</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          <Text style={styles.unit}>/ {product.unit}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onAdd}
          style={({ hovered, pressed }: any) => [
            styles.addBtn,
            isInBundle && styles.addBtnInBundle,
            hovered && styles.addBtnHovered,
            pressed && styles.addBtnPressed,
            WEB_TRANSITION,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.title} to bundle`}
          testID={`materials-add-btn-${product.id}`}
        >
          <Ionicons
            name={isInBundle ? 'checkmark' : 'add'}
            size={13}
            color={isInBundle ? '#34c759' : '#fbbf24'}
          />
          <Text style={[styles.addBtnText, isInBundle && styles.addBtnTextInBundle]}>
            {isInBundle ? 'IN BUNDLE' : 'ADD'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onCompare}
          style={({ hovered, pressed }: any) => [
            styles.compareBtn,
            hovered && styles.compareBtnHovered,
            pressed && styles.compareBtnPressed,
            WEB_TRANSITION,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Compare ${product.title} across sellers`}
          testID={`materials-compare-btn-${product.id}`}
        >
          <Ionicons name="swap-horizontal" size={12} color="rgba(255,255,255,0.78)" />
          <Text style={styles.compareBtnText}>COMPARE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 10,
    gap: 10,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(8,8,12,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chipStock: {
    backgroundColor: 'rgba(52,199,89,0.18)',
    borderColor: 'rgba(52,199,89,0.40)',
  },
  chipStockOut: {
    backgroundColor: 'rgba(255,107,107,0.18)',
    borderColor: 'rgba(255,107,107,0.40)',
  },
  chipText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.6,
  },
  chipTextStock: { color: '#34c759' },
  chipTextStockOut: { color: '#ff6b6b' },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.50)',
  },
  dotStock: { backgroundColor: '#34c759' },
  dotStockOut: { backgroundColor: '#ff6b6b' },

  info: {
    gap: 3,
    minHeight: 84,
  },
  brand: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    lineHeight: 15,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    fontVariant: ['tabular-nums'],
  },
  ratingCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
  },

  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.32)',
  },
  addBtnHovered: {
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
  addBtnPressed: {
    backgroundColor: 'rgba(251,191,36,0.26)',
  },
  addBtnInBundle: {
    backgroundColor: 'rgba(52,199,89,0.10)',
    borderColor: 'rgba(52,199,89,0.32)',
  },
  addBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.7,
  },
  addBtnTextInBundle: {
    color: '#34c759',
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  compareBtnHovered: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  compareBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  compareBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.7,
  },
});
