import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL, safeCallPhone } from '@/lib/safeOpenURL';
import { useSupabase } from '@/providers/SupabaseProvider';
import { renderStars, fmtPrice } from './helpers';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
import { ImageSkeleton } from './ImageSkeleton';
import { ProductDetailModal } from './ProductDetailModal';
import type { CardProps } from './CardRegistry';

export function ProductCard({ record, onAction, isActive, enterDelay, orientation }: CardProps) {
  // Auth from context: ProductCard is always rendered inside the SupabaseProvider
  // tree (it lives in ResearchModal which mounts under the dashboard). We pass
  // the token down to ProductDetailModal explicitly so the modal does NOT have
  // to call supabase.auth.getSession() outside the provider tree.
  const { session, suiteId } = useSupabase();
  const authToken = session?.access_token ?? null;

  const isHorizontal = orientation === 'horizontal';
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
    // New SerpAPI fields (Wave 1.3) -- present when backend ships them, else undefined.
    description,
    specifications,
    dimensions,
    weight,
    thumbnails,
    variants,
    sku,
    upc,
    model_number,
    store_availability,
    // Wave 2.0 — pricing unit ("case", "package", "piece"), social proof, currency.
    unit,
    favorite,
    currency,
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

  // Build a unified gallery: hero image first, then any extra thumbnails.
  // Backend ships thumbnails[] already upgraded to _1000.jpg (Wave 1.2). We just render.
  const gallery: string[] = useMemo(() => {
    const set = new Set<string>();
    const out: string[] = [];
    const heroFirst = image_url || thumbnail;
    if (heroFirst) {
      set.add(heroFirst);
      out.push(heroFirst);
    }
    if (Array.isArray(thumbnails)) {
      for (const t of thumbnails) {
        if (typeof t === 'string' && t && !set.has(t)) {
          set.add(t);
          out.push(t);
        }
      }
    }
    return out;
  }, [image_url, thumbnail, thumbnails]);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // When the active gallery image changes, reset the loaded flag for the skeleton.
  const heroImage = gallery[galleryIndex] || '';

  // Horizontal hero picks thumbnails[6] (_1000.jpg variant per SerpAPI) when
  // available -- the highest-res image SerpAPI ships in basic search results.
  // Falls back to the existing first gallery entry on missing/short arrays.
  const horizontalHeroImage = useMemo(() => {
    if (Array.isArray(thumbnails) && thumbnails.length > 6) {
      const big = thumbnails[6];
      if (typeof big === 'string' && big) return big;
    }
    return gallery[0] || '';
  }, [thumbnails, gallery]);

  // Stable product_id for ProductDetailModal lazy enrichment.
  const productIdForEnrich = useMemo(() => {
    const v = record.product_id ?? record.internet_number ?? record.sku;
    return typeof v === 'string' && v.trim() ? v.trim() : '';
  }, [record]);

  const handlePrevImage = useCallback(() => {
    if (gallery.length <= 1) return;
    setImageLoaded(false);
    setGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length);
  }, [gallery.length]);

  const handleNextImage = useCallback(() => {
    if (gallery.length <= 1) return;
    setImageLoaded(false);
    setGalleryIndex((i) => (i + 1) % gallery.length);
  }, [gallery.length]);

  const specEntries = useMemo<Array<[string, string]>>(() => {
    if (!specifications || typeof specifications !== 'object') return [];
    return Object.entries(specifications as Record<string, unknown>)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => [k, String(v)] as [string, string]);
  }, [specifications]);

  const variantList: Array<{ label: string; key?: string }> = useMemo(() => {
    if (!Array.isArray(variants)) return [];
    return variants
      .map((v: any) => {
        if (typeof v === 'string') return { label: v };
        if (v && typeof v === 'object') {
          const label =
            v.label ?? v.name ?? v.value ?? [v.color, v.size].filter(Boolean).join(' / ');
          if (!label) return null;
          return { label: String(label), key: v.key ?? v.id };
        }
        return null;
      })
      .filter(Boolean) as Array<{ label: string; key?: string }>;
  }, [variants]);

  const dimensionsLabel = useMemo(() => {
    if (!dimensions) return '';
    if (typeof dimensions === 'string') return dimensions;
    if (typeof dimensions === 'object') {
      const d = dimensions as Record<string, unknown>;
      const parts = [
        d.height != null ? `H ${d.height}` : null,
        d.width != null ? `W ${d.width}` : null,
        d.depth != null ? `D ${d.depth}` : null,
      ].filter(Boolean);
      return parts.join(' x ');
    }
    return '';
  }, [dimensions]);

  const weightLabel = useMemo(() => {
    if (weight == null) return '';
    if (typeof weight === 'string' || typeof weight === 'number') return String(weight);
    if (typeof weight === 'object') {
      const w = weight as Record<string, unknown>;
      if (w.value != null) return `${w.value}${w.unit ? ` ${w.unit}` : ''}`;
    }
    return '';
  }, [weight]);

  const storeAvailabilityList: Array<{ name: string; stock?: number | string; status?: string }> = useMemo(() => {
    if (!Array.isArray(store_availability)) return [];
    return store_availability
      .map((s: any) => {
        if (!s || typeof s !== 'object') return null;
        const name = s.store_name ?? s.name ?? s.label;
        if (!name) return null;
        return {
          name: String(name),
          stock: s.stock ?? s.quantity ?? s.in_stock_quantity,
          status: s.status,
        };
      })
      .filter(Boolean) as Array<{ name: string; stock?: number | string; status?: string }>;
  }, [store_availability]);
  const storeAddressLine = [storeAddress, record.city, record.state, record.postal_code]
    .filter(Boolean)
    .join(', ');
  const deliveryLabel = delivery_info || delivery || '';

  const handleVisit = useCallback(() => {
    if (productUrl) safeOpenURL(productUrl);
    onAction('visit', record);
  }, [productUrl, onAction, record]);

  const handleDetails = useCallback(() => {
    // Horizontal product cards own a dedicated lazy-enrich modal. Open it
    // locally and DO NOT bubble to onAction('details') which would also push
    // ResearchModal into its level-2 detail view (visual conflict).
    if (isHorizontal && !isStoreSummary && productIdForEnrich) {
      setDetailModalVisible(true);
      return;
    }
    onAction('details', record);
  }, [onAction, record, isHorizontal, isStoreSummary, productIdForEnrich]);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModalVisible(false);
  }, []);

  const handleStoreWebsite = useCallback(() => {
    if (storeWebsite) safeOpenURL(storeWebsite);
    onAction('visit', record);
  }, [storeWebsite, onAction, record]);

  const handleStoreCall = useCallback(() => {
    if (storePhone) safeCallPhone(storePhone);
    onAction('call', record);
  }, [storePhone, onAction, record]);

  // Horizontal hero -- image-dominant pane with optional gallery nav.
  // When the product has multiple images (gallery.length > 1), arrow buttons +
  // dots + counter overlay the hero so the user can swipe between thumbnails
  // without opening the detail modal. Tap on the image itself still opens
  // ProductDetailModal — arrow presses don't bubble (RN Pressable consumes).
  // Uses gallery[galleryIndex] when multi-image; falls back to thumbnails[6]
  // (_1000.jpg high-res) when single-image so square photos stay sharp.
  const horizontalActiveImage =
    gallery.length > 1 ? gallery[galleryIndex] : (horizontalHeroImage || gallery[0] || '');

  const horizontalHeroContent = (
    <Pressable
      onPress={!isStoreSummary && productIdForEnrich ? handleDetails : undefined}
      style={styles.horizontalHeroPressable}
      accessibilityRole={!isStoreSummary && productIdForEnrich ? 'button' : undefined}
      accessibilityLabel={
        !isStoreSummary && productIdForEnrich
          ? `Open ${productName} details${gallery.length > 1 ? ` (image ${galleryIndex + 1} of ${gallery.length})` : ''}`
          : `Photo of ${productName}${gallery.length > 1 ? ` (${galleryIndex + 1} of ${gallery.length})` : ''}`
      }
      testID="product-card-horizontal-hero"
    >
      {horizontalActiveImage ? (
        <>
          <ImageSkeleton loaded={imageLoaded} />
          <Image
            key={horizontalActiveImage}
            source={{ uri: horizontalActiveImage }}
            style={StyleSheet.absoluteFillObject}
            // Wave B.5: contain (letterbox) so square product photos don't get
            // their tops/bottoms clipped on the wide horizontal hero pane. The
            // pressable's elevated bg fills the dead space cleanly.
            contentFit="contain"
            transition={200}
            accessibilityLabel={`Photo of ${productName}`}
            onLoad={() => setImageLoaded(true)}
          />
        </>
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

      {/* Gallery nav — arrows + dots + counter when multiple images.
          Each arrow is its own Pressable so RN consumes the touch and the
          parent's "open details" handler doesn't fire. */}
      {gallery.length > 1 && (
        <>
          <Pressable
            onPress={handlePrevImage}
            style={[styles.galleryArrow, styles.galleryArrowLeft]}
            accessibilityRole="button"
            accessibilityLabel="Previous image"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={Colors.text.primary} />
          </Pressable>
          <Pressable
            onPress={handleNextImage}
            style={[styles.galleryArrow, styles.galleryArrowRight]}
            accessibilityRole="button"
            accessibilityLabel="Next image"
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={Colors.text.primary} />
          </Pressable>
          <View
            style={styles.galleryDots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {gallery.map((_, i) => (
              <View
                key={i}
                style={[styles.galleryDot, i === galleryIndex && styles.galleryDotActive]}
              />
            ))}
          </View>
          <View style={styles.galleryCounter}>
            <Text style={styles.galleryCounterText}>
              {galleryIndex + 1} / {gallery.length}
            </Text>
          </View>
        </>
      )}

      {!isStoreSummary && hasDiscount && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{Math.round(percentage_off!)}% off</Text>
        </View>
      )}

      {(retailer || isStoreSummary) && (
        <View style={styles.retailerPill}>
          <Text style={styles.retailerText} numberOfLines={1}>
            {retailer || 'Home Depot'}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const heroContent = (
    <>
      {heroImage ? (
        <View style={styles.heroImageWrap}>
          <ImageSkeleton loaded={imageLoaded} />
          <Image
            key={heroImage}
            source={{ uri: heroImage }}
            style={styles.heroImage}
            contentFit="contain"
            transition={200}
            accessibilityLabel={`Photo of ${productName}${gallery.length > 1 ? ` (${galleryIndex + 1} of ${gallery.length})` : ''}`}
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

      {gallery.length > 1 && (
        <>
          <Pressable
            onPress={handlePrevImage}
            style={[styles.galleryArrow, styles.galleryArrowLeft]}
            accessibilityRole="button"
            accessibilityLabel="Previous image"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={Colors.text.primary} />
          </Pressable>
          <Pressable
            onPress={handleNextImage}
            style={[styles.galleryArrow, styles.galleryArrowRight]}
            accessibilityRole="button"
            accessibilityLabel="Next image"
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.galleryDots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {gallery.map((_, i) => (
              <View
                key={i}
                style={[styles.galleryDot, i === galleryIndex && styles.galleryDotActive]}
              />
            ))}
          </View>
          <View style={styles.galleryCounter}>
            <Text style={styles.galleryCounterText}>
              {galleryIndex + 1} / {gallery.length}
            </Text>
          </View>
        </>
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

  // ── Horizontal layout (880x440) ─────────────────────────────────────────
  // LEFT 580x440 image-dominant hero, RIGHT 300x440 info stack with stacked
  // CTAs at the bottom. NO scrolling. NO bullets/specs on card -- those live
  // in ProductDetailModal which opens on tap.
  if (isHorizontal) {
    // Pull the rich SerpAPI fields the cards surface in the right pane.
    const fulfillmentPickup =
      (record.fulfillment_pickup && typeof record.fulfillment_pickup === 'object'
        ? (record.fulfillment_pickup as Record<string, any>)
        : {}) || {};
    const fulfillmentDelivery =
      (record.fulfillment_delivery && typeof record.fulfillment_delivery === 'object'
        ? (record.fulfillment_delivery as Record<string, any>)
        : {}) || {};
    const pickupStoreName: string =
      (typeof fulfillmentPickup.store_name === 'string' && fulfillmentPickup.store_name) ||
      storeName ||
      '';
    const pickupQuantity: number | null =
      typeof fulfillmentPickup.quantity === 'number'
        ? fulfillmentPickup.quantity
        : (typeof stockCount === 'number' ? stockCount : null);
    const pickupDistance: number | null =
      typeof fulfillmentPickup.distance === 'number' ? fulfillmentPickup.distance : null;
    const freeShipToStore: boolean = fulfillmentPickup.free_ship_to_store === true;
    const freeDelivery: boolean =
      fulfillmentDelivery.free === true ||
      (typeof deliveryLabel === 'string' && /free/i.test(deliveryLabel));
    const priceSaving: number | null =
      typeof record.price_saving === 'number' ? record.price_saving : null;
    const priceBadge: string =
      typeof record.price_badge === 'string' && record.price_badge
        ? String(record.price_badge).replace(/-/g, ' ')
        : '';
    const distanceMiles: number | null =
      typeof record.distance_miles === 'number' ? record.distance_miles : null;
    const openNow: boolean | null =
      typeof record.open_now === 'boolean' ? record.open_now : null;

    const horizontalActions = isStoreSummary ? (
      <>
        {storePhone ? (
          <ActionButton label="Call" icon="call-outline" onPress={handleStoreCall} variant="primary" />
        ) : (
          <ActionButton label="Details" icon="chevron-forward" onPress={handleDetails} variant="primary" />
        )}
        {storeWebsite ? (
          <ActionButton label="Website" icon="open-outline" onPress={handleStoreWebsite} variant="secondary" />
        ) : null}
      </>
    ) : (
      <>
        <ActionButton
          label="View details"
          icon="chevron-forward"
          onPress={handleDetails}
          variant="primary"
        />
        {productUrl ? (
          <ActionButton
            label="Visit Home Depot"
            icon="open-outline"
            onPress={handleVisit}
            variant="secondary"
          />
        ) : null}
      </>
    );

    return (
      <>
        <BaseCard
          safety={null}
          isActive={isActive}
          heroSlot={horizontalHeroContent}
          actionSlot={horizontalActions}
          accessibilityLabel={`${productName} ${isStoreSummary ? 'store' : 'product'} card`}
          enterDelay={enterDelay}
          orientation="horizontal"
        >
          {isStoreSummary ? (
            <View style={hStyles.stack}>
              <Text
                style={hStyles.title}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {productName}
              </Text>

              {storeAddressLine ? (
                <Text style={hStyles.brand} numberOfLines={2}>
                  {storeAddressLine}
                </Text>
              ) : null}

              {/* Hours / status + rating */}
              {(openNow !== null || rating != null) && (
                <View style={hStyles.statusRow}>
                  {openNow !== null ? (
                    <Text
                      style={[
                        hStyles.statusPill,
                        {
                          color: openNow ? Colors.semantic.success : Colors.semantic.error,
                          backgroundColor: openNow
                            ? Colors.semantic.successLight
                            : Colors.semantic.errorLight,
                        },
                      ]}
                    >
                      {openNow ? 'Open now' : 'Closed'}
                    </Text>
                  ) : null}
                  {rating != null ? (
                    <View style={hStyles.ratingInline}>
                      <Text style={hStyles.ratingStars}>{renderStars(rating)}</Text>
                      <Text style={hStyles.ratingDetail} numberOfLines={1}>
                        {' '}{typeof rating === 'number' ? rating.toFixed(1) : rating}
                        {reviews ? ` (${Number(reviews).toLocaleString('en-US')})` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Contact rows */}
              {storePhone ? (
                <View style={hStyles.contactRow}>
                  <Ionicons name="call-outline" size={14} color={Colors.text.muted} />
                  <Text style={hStyles.contactText} numberOfLines={1}>
                    {storePhone}
                  </Text>
                </View>
              ) : null}
              {storeWebsite ? (
                <View style={hStyles.contactRow}>
                  <Ionicons name="globe-outline" size={14} color={Colors.text.muted} />
                  <Text style={hStyles.contactText} numberOfLines={1}>
                    {String(storeWebsite).replace(/^https?:\/\//, '')}
                  </Text>
                </View>
              ) : null}

              <View style={hStyles.stockSpacer} />

              {distanceMiles != null ? (
                <View style={hStyles.stockRow}>
                  <Ionicons name="navigate-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={hStyles.stockText} numberOfLines={1}>
                    {distanceMiles} mi away
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={hStyles.stack}>
              <Text
                style={hStyles.title}
                numberOfLines={2}
                accessibilityRole="header"
              >
                {productName}
              </Text>

              {brand || model ? (
                <Text style={hStyles.brand} numberOfLines={1}>
                  {brand || ''}
                  {brand && model ? ' · ' : ''}
                  {model ? `Model ${model}` : ''}
                </Text>
              ) : null}

              {price != null && (
                <View style={hStyles.priceRow}>
                  <Text style={hStyles.priceMain}>
                    {fmtPrice(price)}
                    {unit ? <Text style={hStyles.priceUnit}> / {unit}</Text> : null}
                  </Text>
                  {price_was != null && hasDiscount && (
                    <Text style={hStyles.priceWas}>{fmtPrice(price_was)}</Text>
                  )}
                </View>
              )}

              {/* Save line — visible whenever we have a saving or a price-badge */}
              {(priceSaving != null && priceSaving > 0) || priceBadge ? (
                <View style={hStyles.saveRow}>
                  {priceSaving != null && priceSaving > 0 ? (
                    <Text style={hStyles.saveText}>
                      Save {fmtPrice(priceSaving)}
                      {hasDiscount ? ` (${Math.round(percentage_off!)}% off)` : ''}
                    </Text>
                  ) : null}
                  {priceBadge ? (
                    <View style={hStyles.priceBadgeChip}>
                      <Text style={hStyles.priceBadgeText} numberOfLines={1}>
                        {priceBadge}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {rating != null && (
                <View style={hStyles.ratingRow}>
                  <Text style={hStyles.ratingStars}>{renderStars(rating)}</Text>
                  <Text style={hStyles.ratingDetail} numberOfLines={1}>
                    {' '}
                    {typeof rating === 'number' ? rating.toFixed(1) : rating}
                    {reviews ? ` (${Number(reviews).toLocaleString('en-US')})` : ''}
                    {typeof favorite === 'number' && favorite > 0
                      ? ` · ♥ ${Number(favorite).toLocaleString('en-US')}`
                      : ''}
                  </Text>
                </View>
              )}

              {badgeList.length > 0 && (
                <View style={hStyles.badgeRow}>
                  {badgeList.slice(0, 2).map((b, i) => (
                    <View key={i} style={hStyles.badge}>
                      <Text style={hStyles.badgeText} numberOfLines={1}>
                        {b}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {typeof record.description_short === 'string' && record.description_short.trim() ? (
                <Text style={hStyles.descShort} numberOfLines={2}>
                  {String(record.description_short).trim()}
                </Text>
              ) : null}

              <View style={hStyles.stockSpacer} />

              {/* Pickup line — store name + quantity + distance */}
              {pickupQuantity != null && pickupQuantity > 0 && pickupStoreName ? (
                <View style={hStyles.stockRow}>
                  <Ionicons
                    name="storefront-outline"
                    size={14}
                    color={Colors.semantic.success}
                  />
                  <Text
                    style={[hStyles.stockText, { color: Colors.semantic.success }]}
                    numberOfLines={1}
                  >
                    {pickupQuantity} in stock at {pickupStoreName}
                    {pickupDistance != null && pickupDistance > 0
                      ? ` · ${pickupDistance} mi`
                      : ''}
                  </Text>
                </View>
              ) : freeShipToStore ? (
                <View style={hStyles.stockRow}>
                  <Ionicons name="cube-outline" size={14} color={Colors.text.secondary} />
                  <Text style={hStyles.stockText} numberOfLines={1}>
                    Free ship to store
                    {pickupStoreName ? ` · ${pickupStoreName}` : ''}
                  </Text>
                </View>
              ) : pickupQuantity === 0 ? (
                <View style={hStyles.stockRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={14}
                    color={Colors.semantic.error}
                  />
                  <Text
                    style={[hStyles.stockText, { color: Colors.semantic.error }]}
                    numberOfLines={1}
                  >
                    Out of stock{pickupStoreName ? ` at ${pickupStoreName}` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Delivery line — secondary, always shown when available */}
              {freeDelivery ? (
                <View style={hStyles.stockRow}>
                  <Ionicons name="car-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={hStyles.stockText} numberOfLines={1}>
                    Free delivery
                  </Text>
                </View>
              ) : null}

              {/* Aisle / bay — when SerpAPI returns store-specific location */}
              {(record.aisle || record.bay) ? (
                <View style={hStyles.stockRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={hStyles.stockText} numberOfLines={1}>
                    {record.aisle ? `Aisle ${record.aisle}` : ''}
                    {record.aisle && record.bay ? ' · ' : ''}
                    {record.bay ? `Bay ${record.bay}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </BaseCard>

        {productIdForEnrich && !isStoreSummary ? (
          <ProductDetailModal
            visible={detailModalVisible}
            productId={productIdForEnrich}
            basicRecord={record}
            onClose={handleCloseDetailModal}
            authToken={authToken}
            suiteId={suiteId}
          />
        ) : null}
      </>
    );
  }

  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={heroContent}
      heroStyle={HERO_STYLE}
      actionSlot={actionContent}
      accessibilityLabel={`${productName} product card`}
      enterDelay={enterDelay}
      orientation={orientation}
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

          {/* Variants -- color / size chips */}
          {variantList.length > 0 && (
            <View style={[styles.section, styles.sectionDivider]}>
              <Text style={styles.sectionLabel}>Variants</Text>
              <View style={styles.variantRow}>
                {variantList.slice(0, 8).map((v, i) => (
                  <View key={v.key ?? `${v.label}-${i}`} style={styles.variantChip}>
                    <Text style={styles.variantText} numberOfLines={1}>
                      {v.label}
                    </Text>
                  </View>
                ))}
                {variantList.length > 8 && (
                  <Text style={styles.variantMore}>+{variantList.length - 8} more</Text>
                )}
              </View>
            </View>
          )}

          {/* Description -- 3-line clamp + tap to expand */}
          {description ? (
            <View style={[styles.section, styles.sectionDivider]}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Pressable
                onPress={() => setDescExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={descExpanded ? 'Collapse description' : 'Expand description'}
              >
                <Text
                  style={styles.descriptionText}
                  numberOfLines={descExpanded ? undefined : 3}
                >
                  {String(description)}
                </Text>
                <Text style={styles.descriptionToggle}>
                  {descExpanded ? 'Show less' : 'Show more'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Specifications table */}
          {specEntries.length > 0 && (
            <View style={[styles.section, styles.sectionDivider]}>
              <Text style={styles.sectionLabel}>Specifications</Text>
              <View style={styles.specTable}>
                {specEntries.map(([k, v], i) => (
                  <View
                    key={k}
                    style={[
                      styles.specRow,
                      i < specEntries.length - 1 && styles.specRowDivider,
                    ]}
                  >
                    <Text style={styles.specKey} numberOfLines={2}>
                      {k}
                    </Text>
                    <Text style={styles.specValue} numberOfLines={2}>
                      {v}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Dimensions / weight */}
          {(dimensionsLabel || weightLabel) && (
            <View style={[styles.section, styles.sectionDivider]}>
              <Text style={styles.sectionLabel}>Size & Weight</Text>
              {dimensionsLabel ? (
                <View style={styles.infoRow}>
                  <Ionicons name="resize-outline" size={14} color={Colors.text.muted} />
                  <Text style={styles.infoText}>{dimensionsLabel}</Text>
                </View>
              ) : null}
              {weightLabel ? (
                <View style={styles.infoRow}>
                  <Ionicons name="scale-outline" size={14} color={Colors.text.muted} />
                  <Text style={styles.infoText}>{weightLabel}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Identifiers -- SKU / UPC / Model number */}
          {(sku || upc || model_number) && (
            <View style={[styles.section, styles.sectionDivider]}>
              <Text style={styles.sectionLabel}>Identifiers</Text>
              {model_number ? (
                <View style={styles.idRow}>
                  <Text style={styles.idKey}>Model</Text>
                  <Text style={styles.idValue} numberOfLines={1}>{String(model_number)}</Text>
                </View>
              ) : null}
              {sku ? (
                <View style={styles.idRow}>
                  <Text style={styles.idKey}>SKU</Text>
                  <Text style={styles.idValue} numberOfLines={1}>{String(sku)}</Text>
                </View>
              ) : null}
              {upc ? (
                <View style={styles.idRow}>
                  <Text style={styles.idKey}>UPC</Text>
                  <Text style={styles.idValue} numberOfLines={1}>{String(upc)}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Multi-store availability */}
          {storeAvailabilityList.length > 0 && (
            <View style={[styles.section, styles.sectionDivider]}>
              <Text style={styles.sectionLabel}>Other Stores</Text>
              {storeAvailabilityList.slice(0, 4).map((s, i) => (
                <View key={`${s.name}-${i}`} style={styles.storeRow}>
                  <Ionicons name="storefront-outline" size={14} color={Colors.text.muted} />
                  <Text style={styles.storeName} numberOfLines={1}>{s.name}</Text>
                  {s.stock != null ? (
                    <Text style={styles.storeStock}>
                      {typeof s.stock === 'number'
                        ? `${s.stock} in stock`
                        : String(s.stock)}
                    </Text>
                  ) : s.status ? (
                    <Text style={styles.storeStock}>{s.status}</Text>
                  ) : null}
                </View>
              ))}
              {storeAvailabilityList.length > 4 ? (
                <Text style={styles.storeMore}>
                  +{storeAvailabilityList.length - 4} more locations
                </Text>
              ) : null}
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

  // Gallery overlays (multi-image hero)
  galleryArrow: {
    position: 'absolute',
    top: '50%' as unknown as number,
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  galleryArrowLeft: { left: Spacing.sm },
  galleryArrowRight: { right: Spacing.sm },
  galleryDots: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 4,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  galleryDotActive: {
    backgroundColor: Colors.text.primary,
    width: 18,
  },
  galleryCounter: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    zIndex: 4,
  },
  galleryCounterText: {
    ...Typography.small,
    color: Colors.text.primary,
    fontWeight: '600',
  },

  // Section scaffolding
  section: {
    gap: Spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },

  // Description
  descriptionText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  descriptionToggle: {
    ...Typography.smallMedium,
    color: Colors.accent.cyan,
    marginTop: Spacing.xs,
  },

  // Specifications
  specTable: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  specRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surface.cardBorder,
  },
  specKey: {
    ...Typography.small,
    color: Colors.text.muted,
    flex: 1,
  },
  specValue: {
    ...Typography.smallMedium,
    color: Colors.text.primary,
    flex: 1.4,
    textAlign: 'right',
  },

  // Variants
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  variantChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.sm,
    maxWidth: 160,
  },
  variantText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  variantMore: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  // Identifiers
  idRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: Spacing.md,
  },
  idKey: {
    ...Typography.small,
    color: Colors.text.muted,
    width: 60,
  },
  idValue: {
    ...Typography.smallMedium,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },

  // Other stores availability
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  storeName: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
  },
  storeStock: {
    ...Typography.small,
    color: Colors.text.muted,
  },
  storeMore: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  horizontalHeroPressable: {
    flex: 1,
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
    backgroundColor: Colors.background.elevated,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'zoom-in' } as unknown as ViewStyle)
      : {}),
  },
});

// ── Horizontal layout (880x440) info-stack styles ──────────────────────────
const hStyles = StyleSheet.create({
  stack: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  brand: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  priceMain: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
    color: Colors.semantic.success,
    letterSpacing: -0.4,
  },
  priceUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0,
  },
  priceWas: {
    ...Typography.caption,
    color: Colors.text.muted,
    textDecorationLine: 'line-through',
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
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.accent.cyanLight,
    borderRadius: BorderRadius.sm,
    maxWidth: 130,
  },
  badgeText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  descShort: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  stockSpacer: {
    flex: 1,
    minHeight: Spacing.sm,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  stockText: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
    flexShrink: 1,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  saveText: {
    ...Typography.smallMedium,
    color: Colors.semantic.success,
    fontWeight: '600',
  },
  priceBadgeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.accent.amberMedium,
    borderRadius: BorderRadius.sm,
  },
  priceBadgeText: {
    ...Typography.small,
    color: Colors.accent.amber,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  statusPill: {
    ...Typography.small,
    fontWeight: '600',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  contactText: {
    ...Typography.small,
    color: Colors.text.secondary,
    flexShrink: 1,
  },
});

export default ProductCard;

