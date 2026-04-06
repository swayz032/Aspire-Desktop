import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL } from '@/lib/safeOpenURL';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardProps {
  record: Record<string, any>;
  artifactType: string;
  index: number;
  total: number;
  confidence: { status: string; score: number } | null;
  onAction: (
    action: 'call' | 'visit' | 'book' | 'details' | 'tell_more',
    record: any,
  ) => void;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  return (
    '\u2605'.repeat(full) +
    (hasHalf ? '\u00BD' : '') +
    '\u2606'.repeat(empty)
  );
}

function formatPrice(price: number | string | undefined): string {
  if (price == null) return '';
  const n = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) : price;
  if (isNaN(n)) return String(price);
  return `$${n.toFixed(2)}`;
}

function ActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Ionicons name={icon} size={16} color={Colors.accent.cyan} />
      <Text style={styles.actionBtnText}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProductCard({ record, onAction, isActive }: CardProps) {
  const productName = record.product_name || record.title || 'Unknown Product';
  const {
    brand,
    model,
    sku,
    price,
    price_was,
    percentage_off,
    retailer,
    thumbnail,
    rating,
    reviews,
    link,
    url,
    delivery,
    pickup_store,
    badges,
    in_store_stock,
    pickup_quantity,
  } = record;

  const extra = record.extra || {};
  const storeName = extra.store_name || pickup_store;
  const productUrl = link || url;
  const stockCount = in_store_stock ?? pickup_quantity;
  const hasDiscount = percentage_off != null && percentage_off > 0;
  const badgeList: string[] = Array.isArray(badges) ? badges : [];

  const handleVisit = useCallback(() => {
    if (productUrl) {
      safeOpenURL(productUrl);
    }
    onAction('visit', record);
  }, [productUrl, onAction, record]);

  const handleDetails = useCallback(() => {
    onAction('details', record);
  }, [onAction, record]);

  return (
    <View
      style={[styles.card, isActive && styles.cardActive]}
      accessibilityRole="summary"
      accessibilityLabel={`${productName} product card`}
    >
      {/* ---- Hero Image ---- */}
      <View style={styles.heroContainer}>
        {thumbnail ? (
          <View style={styles.heroImageWrap}>
            <Image
              source={{ uri: thumbnail }}
              style={styles.heroImage}
              contentFit="contain"
              transition={200}
              accessibilityLabel={`Photo of ${productName}`}
            />
          </View>
        ) : (
          <LinearGradient
            colors={['#1a1e24', '#12151a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroFallback}
          >
            <Ionicons name="cube-outline" size={40} color={Colors.text.muted} />
          </LinearGradient>
        )}

        {/* Discount badge — top-left */}
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{Math.round(percentage_off)}% off</Text>
          </View>
        )}

        {/* Retailer pill — top-right */}
        {retailer && (
          <View style={styles.retailerPill}>
            <Text style={styles.retailerText} numberOfLines={1}>
              {retailer}
            </Text>
          </View>
        )}
      </View>

      {/* ---- Content ---- */}
      <View style={styles.content}>
        {/* Product Name */}
        <Text style={styles.productName} numberOfLines={2} accessibilityRole="header">
          {productName}
        </Text>

        {/* Brand + Model */}
        {(brand || model) && (
          <Text style={styles.brandModel} numberOfLines={1}>
            {brand || ''}
            {brand && model ? ' \u2014 ' : ''}
            {model ? `Model ${model}` : ''}
          </Text>
        )}

        {/* Price Block */}
        <View style={styles.priceRow}>
          {price != null && (
            <Text style={styles.priceMain}>{formatPrice(price)}</Text>
          )}
          {price_was != null && hasDiscount && (
            <Text style={styles.priceWas}>{formatPrice(price_was)}</Text>
          )}
        </View>

        {/* Stock Availability */}
        {stockCount != null && (
          <View style={styles.stockRow}>
            <View
              style={[
                styles.stockDot,
                {
                  backgroundColor:
                    stockCount > 0
                      ? Colors.semantic.success
                      : Colors.semantic.error,
                },
              ]}
            />
            <Text
              style={[
                styles.stockText,
                {
                  color:
                    stockCount > 0
                      ? Colors.semantic.success
                      : Colors.semantic.error,
                },
              ]}
            >
              {stockCount > 0 ? `${stockCount} in stock` : 'Out of stock'}
            </Text>
          </View>
        )}

        {/* Store Info */}
        {storeName && (
          <View style={styles.storeRow}>
            <Ionicons name="storefront-outline" size={14} color={Colors.text.muted} />
            <Text style={styles.storeText} numberOfLines={1}>
              {storeName}
            </Text>
          </View>
        )}

        {/* Delivery */}
        {delivery && (
          <View style={styles.storeRow}>
            <Ionicons name="car-outline" size={14} color={Colors.text.muted} />
            <Text style={styles.storeText} numberOfLines={1}>
              {delivery}
            </Text>
          </View>
        )}

        {/* Rating */}
        {rating != null && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingStars}>{renderStars(rating)}</Text>
            <Text style={styles.ratingDetail}>
              {' '}
              {typeof rating === 'number' ? rating.toFixed(1) : rating}
              {reviews ? ` (${reviews} reviews)` : ''}
            </Text>
          </View>
        )}

        {/* Badges */}
        {badgeList.length > 0 && (
          <View style={styles.badgeRow}>
            {badgeList.slice(0, 3).map((b, i) => (
              <View key={i} style={styles.badge}>
                <Text style={styles.badgeText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {productUrl ? (
            <ActionButton label="Visit" icon="open-outline" onPress={handleVisit} />
          ) : null}
          <ActionButton label="Details" icon="chevron-forward" onPress={handleDetails} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CARD_WIDTH = 500;
const HERO_HEIGHT = 200;

const styles = StyleSheet.create({
  // Card shell
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: Colors.accent.cyan,
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 1px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.25)',
      } as unknown as ViewStyle,
      default: {},
    }),
  },

  // Hero
  heroContainer: {
    width: '100%' as unknown as number,
    height: HERO_HEIGHT,
    backgroundColor: Colors.background.primary,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageWrap: {
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
  },
  heroFallback: {
    flex: 1,
    width: '100%' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Discount badge
  discountBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.accent.amberMedium,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  discountText: {
    ...Typography.smallMedium,
    color: Colors.accent.amber,
    fontWeight: '700',
  },

  // Retailer pill
  retailerPill: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface.cardBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    maxWidth: 140,
  },
  retailerText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },

  // Content
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  brandModel: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    marginTop: -Spacing.xs,
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  priceMain: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    color: Colors.semantic.success,
    letterSpacing: -0.5,
  },
  priceWas: {
    ...Typography.caption,
    color: Colors.text.muted,
    textDecorationLine: 'line-through',
  },

  // Stock
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  stockText: {
    ...Typography.captionMedium,
  },

  // Store / Delivery
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  storeText: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // Rating
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    ...Typography.small,
    color: Colors.accent.amber,
    letterSpacing: 1,
  },
  ratingDetail: {
    ...Typography.small,
    color: Colors.text.secondary,
  },

  // Badges
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.accent.cyanLight,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.small,
    color: Colors.accent.cyan,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
    minWidth: 44,
    justifyContent: 'center',
  },
  actionBtnPressed: {
    opacity: 0.7,
    backgroundColor: Colors.accent.cyanLight,
  },
  actionBtnText: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
  },
});

export default ProductCard;
