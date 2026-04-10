import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL, safeCallPhone } from '@/lib/safeOpenURL';
import { renderStars, fmtPrice } from './helpers';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
import { ImageSkeleton } from './ImageSkeleton';

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
  enterDelay?: number;
}

export function ProductCard({ record, onAction, isActive, enterDelay }: CardProps) {
  const isStoreSummary = record.card_kind === 'store_summary';
  const productName = isStoreSummary
    ? (record.store_name || record.title || 'Home Depot Store')
    : (record.product_name || record.title || 'Unknown Product');

  const {
    brand,
    model,
    price,
    price_was,
    percentage_off,
    retailer,
    thumbnail,
    image_url,
    rating,
    reviews,
    link,
    url,
    delivery,
    delivery_info,
    pickup_store,
    badges,
    in_store_stock,
    pickup_quantity,
  } = record;

  const extra = record.extra || {};
  const storeName = extra.store_name || record.store_name || pickup_store;
  const storeAddress = record.address || '';
  const storePhone = record.phone || '';
  const storeWebsite = record.website || '';
  const productUrl = link || url;
  const stockCount = in_store_stock ?? pickup_quantity;
  const hasDiscount = percentage_off != null && percentage_off > 0;
  const badgeList: string[] = Array.isArray(badges) ? badges : [];

  const [imageLoaded, setImageLoaded] = useState(false);

  const heroImage = image_url || thumbnail || '';
  const storeAddressLine = [storeAddress, record.city, record.state, record.postal_code]
    .filter(Boolean)
    .join(', ');
  const deliveryLabel = delivery_info || delivery || '';

  const handleVisit = useCallback(() => {
    if (productUrl) safeOpenURL(productUrl);
    onAction('visit', record);
  }, [productUrl, onAction, record]);

  const handleDetails = useCallback(() => {
    onAction('details', record);
  }, [onAction, record]);

  const handleStoreWebsite = useCallback(() => {
    if (storeWebsite) safeOpenURL(storeWebsite);
    onAction('visit', record);
  }, [storeWebsite, onAction, record]);

  const handleStoreCall = useCallback(() => {
    if (storePhone) safeCallPhone(storePhone);
    onAction('call', record);
  }, [storePhone, onAction, record]);

  const heroContent = (
    <>
      {heroImage ? (
        <View style={styles.heroImageWrap}>
          <ImageSkeleton loaded={imageLoaded} />
          <Image
            source={{ uri: heroImage }}
            style={styles.heroImage}
            contentFit="contain"
            transition={200}
            accessibilityLabel={`Photo of ${productName}`}
            onLoad={() => setImageLoaded(true)}
          />
        </View>
      ) : (
        <LinearGradient
          colors={Colors.gradient.cardHero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        >
          <View style={styles.heroFallback}>
            <Ionicons
              name={isStoreSummary ? 'storefront-outline' : 'cube-outline'}
              size={40}
              color={Colors.text.muted}
            />
          </View>
        </LinearGradient>
      )}

      {!isStoreSummary && hasDiscount && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{Math.round(percentage_off)}% off</Text>
        </View>
      )}

      {(retailer || isStoreSummary) && (
        <View style={styles.retailerPill}>
          <Text style={styles.retailerText} numberOfLines={1}>
            {retailer || 'Home Depot'}
          </Text>
        </View>
      )}
    </>
  );

  const actionContent = isStoreSummary ? (
    <>
      {storePhone ? (
        <ActionButton label="Call" icon="call-outline" onPress={handleStoreCall} variant="primary" />
      ) : null}
      {storeWebsite ? (
        <ActionButton label="Website" icon="open-outline" onPress={handleStoreWebsite} variant="secondary" />
      ) : (
        <ActionButton label="Details" icon="chevron-forward" onPress={handleDetails} variant="secondary" />
      )}
    </>
  ) : (
    <>
      {productUrl ? (
        <ActionButton label="Visit" icon="open-outline" onPress={handleVisit} variant="primary" />
      ) : null}
      <ActionButton label="Details" icon="chevron-forward" onPress={handleDetails} variant="secondary" />
    </>
  );

  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={heroContent}
      heroStyle={HERO_STYLE}
      actionSlot={actionContent}
      accessibilityLabel={`${productName} product card`}
      enterDelay={enterDelay}
    >
      {isStoreSummary ? (
        <>
          <Text style={styles.productName} numberOfLines={2} accessibilityRole="header">
            {productName}
          </Text>
          {storeAddressLine ? (
            <Text style={styles.brandModel} numberOfLines={2}>
              {storeAddressLine}
            </Text>
          ) : null}

          {storePhone ? (
            <View style={[styles.infoRow, styles.sectionDivider]}>
              <Ionicons name="call-outline" size={14} color={Colors.text.muted} />
              <Text style={styles.infoText} numberOfLines={1}>
                {storePhone}
              </Text>
            </View>
          ) : null}

          {storeWebsite ? (
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={14} color={Colors.text.muted} />
              <Text style={styles.infoText} numberOfLines={1}>
                {storeWebsite}
              </Text>
            </View>
          ) : null}

          {(record.open_now !== undefined || rating != null) ? (
            <View style={[styles.ratingRow, styles.sectionDivider]}>
              {record.open_now !== undefined ? (
                <Text
                  style={[
                    styles.stockText,
                    { color: record.open_now ? Colors.semantic.success : Colors.semantic.error },
                  ]}
                >
                  {record.open_now ? 'Open now' : 'Closed'}
                </Text>
              ) : null}
              {rating != null ? (
                <Text style={styles.ratingDetail}>
                  {record.open_now !== undefined ? ' • ' : ''}
                  {typeof rating === 'number' ? rating.toFixed(1) : rating} rating
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.productName} numberOfLines={2} accessibilityRole="header">
            {productName}
          </Text>

          {(brand || model) && (
            <Text style={styles.brandModel} numberOfLines={1}>
              {brand || ''}
              {brand && model ? ' - ' : ''}
              {model ? `Model ${model}` : ''}
            </Text>
          )}

          <View style={styles.priceRow}>
            {price != null && (
              <Text style={styles.priceMain}>{fmtPrice(price)}</Text>
            )}
            {price_was != null && hasDiscount && (
              <Text style={styles.priceWas}>{fmtPrice(price_was)}</Text>
            )}
          </View>

          {stockCount != null && (
            <View style={[styles.stockRow, styles.sectionDivider]}>
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

          {storeName && (
            <View style={styles.infoRow}>
              <Ionicons name="storefront-outline" size={14} color={Colors.text.muted} />
              <Text style={styles.infoText} numberOfLines={1}>
                {storeName}
              </Text>
            </View>
          )}

          {deliveryLabel && (
            <View style={styles.infoRow}>
              <Ionicons name="car-outline" size={14} color={Colors.text.muted} />
              <Text style={styles.infoText} numberOfLines={1}>
                {deliveryLabel}
              </Text>
            </View>
          )}

          {rating != null && (
            <View style={[styles.ratingRow, styles.sectionDivider]}>
              <Text style={styles.ratingStars}>{renderStars(rating)}</Text>
              <Text style={styles.ratingDetail}>
                {' '}
                {typeof rating === 'number' ? rating.toFixed(1) : rating}
                {reviews ? ` (${reviews} reviews)` : ''}
              </Text>
            </View>
          )}

          {badgeList.length > 0 && (
            <View style={styles.badgeRow}>
              {badgeList.slice(0, 3).map((b, i) => (
                <View key={i} style={styles.badge}>
                  <Text style={styles.badgeText}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </BaseCard>
  );
}

const HERO_HEIGHT = 200;
const HERO_STYLE: ViewStyle = { height: HERO_HEIGHT, aspectRatio: undefined };

const styles = StyleSheet.create({
  heroImageWrap: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  stockText: {
    ...Typography.captionMedium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  infoText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
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
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
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
  sectionDivider: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.surface.cardBorder,
  },
});

export default ProductCard;

