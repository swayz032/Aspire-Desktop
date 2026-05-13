/**
 * ProductCard — premium product tile for the Materials grid (Pass F upgrade).
 *
 * Surfaces all 14 fields:
 *  1. Hero image (1:1, rounded)
 *  2. Brand chip (amber outline pill)
 *  3. Title (2 lines max)
 *  4. Price + unit (gold tabular-nums)
 *  5. Rating + review count
 *  6. Stock status chip (IN STOCK / LIMITED / OUT)
 *  7. Drive time chip (18 MIN / — MIN)
 *  8. Store name + address one-liner
 *  9. Availability detail (availability_text)
 * 10. Bay/Aisle badge
 * 11. SKU + Model number
 * 12. Variants count
 * 13. Badges array (SerpApi badges)
 * 14. Price badge (Sale / Discounted)
 *
 * Visual spec:
 *  - bg rgba(255,255,255,0.025), hairline rgba(255,255,255,0.06), radius 12
 *  - hover: amber border rgba(251,191,36,0.22), elevation lift
 *  - 200ms cross-fade for all state changes
 *  - 3 col @1400, 2 col @1100, 1 col mobile
 *  - ADD primary gold, COMPARE secondary outline
 */
import React, { useState } from 'react';
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

// ---------------------------------------------------------------------------
// Extended product fields (Pass F additions surfaced from backend raw fields)
// ---------------------------------------------------------------------------

export interface ProductCardExtended extends Product {
  /** e.g. "Ships in 3 days", "Pickup today", "Limited quantity" */
  availabilityText?: string;
  /** e.g. 24 (bay number) */
  bay?: number | string | null;
  /** e.g. 3 (aisle number) */
  aisle?: number | string | null;
  /** SerpApi badges (e.g. ["Limited stock", "Free delivery"]) */
  badges?: string[];
  /** "Sale", "Discounted" etc */
  priceBadge?: string | null;
  /** e.g. "X-100" */
  modelNumber?: string | null;
  /** number of color/size variants */
  variantCount?: number;
  /** "colors" | "sizes" | "options" */
  variantType?: string;
  /** store address one-liner (passed-through from closest_store or pickup) */
  storeAddress?: string | null;
}

interface Props {
  product: ProductCardExtended;
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hover, setHover] = useState(false);
  const webHoverHandlers =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
        }
      : {};

  const inStock = product.store.inStock;
  const driveMinutes = product.store.driveMinutes;
  const driveDisplay =
    typeof driveMinutes === 'number' && driveMinutes > 0
      ? `${driveMinutes} MIN`
      : '— MIN';

  // Pass F extended fields
  const badges = product.badges ?? [];
  const priceBadge = product.priceBadge;
  const availabilityText = product.availabilityText;
  const bay = product.bay;
  const aisle = product.aisle;
  const hasBayAisle = (bay !== null && bay !== undefined && bay !== '') ||
                      (aisle !== null && aisle !== undefined && aisle !== '');
  const modelNumber = product.modelNumber;
  const sku = product.sku;
  const variantCount = product.variantCount;
  const variantType = product.variantType ?? 'options';
  const storeAddress = product.storeAddress;
  const storeName = product.store.name;

  return (
    <View
      {...(webHoverHandlers as any)}
      style={[
        styles.card,
        hover && styles.cardHovered,
        isInBundle && styles.cardInBundle,
        WEB_TRANSITION,
      ]}
      testID={`materials-product-card-${product.id}`}
    >
      {/* Image area */}
      <View style={styles.imageWrap}>
        {!imgLoaded && (
          <View
            style={styles.imageSkeleton}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
        <Image
          source={{ uri: product.imageUrl }}
          style={[styles.image, !imgLoaded && styles.imageLoading]}
          resizeMode="cover"
          accessibilityLabel={`${product.brand} ${product.title}`}
          onLoad={() => setImgLoaded(true)}
        />

        <View style={styles.imageOverlay}>
          {/* Stock chip */}
          <View style={[
            styles.chip,
            inStock ? styles.chipStock : styles.chipStockOut,
          ]}>
            <View style={[styles.dot, inStock ? styles.dotStock : styles.dotStockOut]} />
            <Text
              style={[styles.chipText, inStock ? styles.chipTextStock : styles.chipTextStockOut]}
              testID={`materials-stock-chip-${product.id}`}
            >
              {inStock ? 'IN STOCK' : 'OUT'}
            </Text>
          </View>

          {/* Drive time chip */}
          <View style={styles.chip}>
            <Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.75)" />
            <Text style={styles.chipText} testID={`materials-drive-chip-${product.id}`}>
              {driveDisplay}
            </Text>
          </View>
        </View>
      </View>

      {/* Badges array (SerpApi badges) — rendered above title */}
      {badges.length > 0 && (
        <View style={styles.badgeRow}>
          {badges.slice(0, 3).map((b) => (
            <View key={b} style={styles.badgeChip}>
              <Text style={styles.badgeChipText} numberOfLines={1}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Info section */}
      <View style={styles.info}>
        {/* Brand */}
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand}
        </Text>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {product.title}
        </Text>

        {/* Rating row */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={10} color="#fbbf24" />
          <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>· {formatReviewCount(product.reviewCount)}</Text>
        </View>

        {/* Price row + price badge */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          <Text style={styles.unit}>/ {product.unit}</Text>
          {priceBadge ? (
            <View style={styles.priceBadgeChip}>
              <Text style={styles.priceBadgeText}>{priceBadge.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        {/* Availability text */}
        {availabilityText ? (
          <Text style={styles.availabilityText} numberOfLines={1}
            testID={`materials-avail-${product.id}`}>
            {availabilityText}
          </Text>
        ) : null}

        {/* Store name + address one-liner */}
        {(storeName || storeAddress) ? (
          <Text style={styles.storeOneLiner} numberOfLines={1}>
            {[storeName, storeAddress].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {/* Bay / Aisle badge */}
        {hasBayAisle ? (
          <View style={styles.bayAisleRow}>
            <Ionicons name="cube-outline" size={10} color="rgba(255,255,255,0.55)" />
            <Text style={styles.bayAisleText}>
              {[aisle != null ? `Aisle ${aisle}` : null, bay != null ? `Bay ${bay}` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}

        {/* Variants count */}
        {variantCount && variantCount > 0 ? (
          <Text style={styles.variantText} numberOfLines={1}
            testID={`materials-variants-${product.id}`}>
            + {variantCount} {variantType}
          </Text>
        ) : null}

        {/* SKU + Model number */}
        {(sku || modelNumber) ? (
          <Text style={styles.skuModelText} numberOfLines={1}
            testID={`materials-sku-${product.id}`}>
            {[sku ? `SKU ${sku}` : null, modelNumber ? `Model #${modelNumber}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onAdd}
          style={({ hovered: h, pressed }: any) => [
            styles.addBtn,
            isInBundle && styles.addBtnInBundle,
            h && styles.addBtnHovered,
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
          style={({ hovered: h, pressed }: any) => [
            styles.compareBtn,
            h && styles.compareBtnHovered,
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
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 10,
    gap: 8,
    ...(Platform.OS === 'web'
      ? (({ transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease, background-color 200ms ease', boxShadow: '0 4px 14px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.03) inset' } as unknown) as ViewStyle)
      : {}),
  },
  cardHovered: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(251,191,36,0.22)',
    ...(Platform.OS === 'web'
      ? (({ transform: 'translateY(-2px)' as any, boxShadow: '0 8px 24px rgba(0,0,0,0.32), 0 1px 0 rgba(255,255,255,0.06) inset' } as unknown) as ViewStyle)
      : {}),
  },
  cardInBundle: {
    borderColor: 'rgba(52,199,89,0.30)',
  },
  imageSkeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  imageLoading: {
    opacity: 0,
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

  // Badges row (SerpApi badges array)
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  badgeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  badgeChipText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 0.5,
  },

  info: {
    gap: 3,
    minHeight: 80,
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
    flexWrap: 'wrap',
  },
  price: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
  },
  priceBadgeChip: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.32)',
  },
  priceBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 0.6,
  },

  availabilityText: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.52)',
    letterSpacing: 0.1,
    marginTop: 1,
  },
  storeOneLiner: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  bayAisleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  bayAisleText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.48)',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  variantText: {
    fontSize: 9,
    color: 'rgba(251,191,36,0.70)',
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  skuModelText: {
    fontSize: 8.5,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.2,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  actions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 36,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.34)',
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
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
