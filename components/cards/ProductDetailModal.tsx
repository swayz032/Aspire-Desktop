/**
 * ProductDetailModal -- Lazy-enriched product detail overlay.
 *
 * Opens with a basic ProductRecord and a product_id, then fires a one-shot
 * POST /api/tools/enrich-product (server proxy that mints a capability token
 * and forwards to the orchestrator's /v1/tools/enrich_product). The basic
 * record renders immediately; enriched fields swap in when the response
 * arrives. Cached per product_id at module scope so reopen is instant.
 *
 * Law compliance:
 *  - Law #2: Receipts emitted by the backend (success + failure).
 *  - Law #3: Fail closed -- on enrichment failure we render an explicit error
 *    state with [Retry] and [Visit Home Depot]. NO degraded/partial render.
 *  - Law #5: Capability token minted server-side, never exposed to client.
 *  - Law #6: Tenant isolation -- server proxy enforces suite_id from JWT.
 *  - Risk tier: GREEN (read-only).
 *
 * Cross-platform: works on web and Expo native. No DOM-only APIs.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { safeOpenURL } from '@/lib/safeOpenURL';
import { buildTraceHeaders } from '@/lib/traceHeaders';
import { renderStars, fmtPrice } from './helpers';
import { ActionButton } from './ActionButton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SpecificationCategory {
  category?: string;
  name?: string;
  items?: Array<{ name?: string; key?: string; value?: string | number }>;
  [k: string]: unknown;
}

interface FulfillmentInfo {
  arrival_date?: string;
  earliest_date?: string;
  store_id?: string;
  store_name?: string;
  [k: string]: unknown;
}

interface EnrichedProductRecord {
  product_id?: string;
  title?: string;
  brand?: string;
  model?: string;
  price?: number | string;
  price_was?: number | string;
  rating?: number;
  review_count?: number;
  reviews?: number;
  badges?: string[];
  link?: string;
  url?: string;
  thumbnails?: string[];
  // Lazy-enriched
  images?: string[];
  bullets?: string[];
  specifications?: Record<string, unknown> | SpecificationCategory[];
  description_short?: string;
  description_full?: string;
  description?: string;
  stock_quantity?: number;
  bay?: string;
  aisle?: string;
  fulfillment_pickup?: FulfillmentInfo;
  fulfillment_delivery?: FulfillmentInfo;
  purchasing_limit_notes?: string;
  store_name?: string;
  pickup_store_name?: string;
  pickup_store_id?: string;
  [k: string]: unknown;
}

export interface ProductDetailModalProps {
  productId: string;
  basicRecord: Record<string, any>;
  visible: boolean;
  onClose: () => void;
  /**
   * Supabase access token from the parent component (read via useSupabase()).
   * When null, the modal renders an explicit "Sign in" empty state instead of
   * attempting the enrichment fetch. Law #3: fail closed.
   */
  authToken: string | null;
  /** Tenant scope id from useSupabase(). Required for X-Suite-Id header. */
  suiteId: string | null;
}

// ─── Cache (module-level, per session) ──────────────────────────────────────

const enrichCache = new Map<string, EnrichedProductRecord>();

// ─── Web styles (idempotent injection) ──────────────────────────────────────

function injectModalStyles() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('product-detail-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'product-detail-modal-styles';
  style.textContent = `
    .pdm-shimmer {
      background: linear-gradient(
        90deg,
        rgba(44, 44, 46, 0.6) 0%,
        rgba(60, 60, 62, 0.8) 50%,
        rgba(44, 44, 46, 0.6) 100%
      );
      background-size: 200% 100%;
      animation: pdmShimmer 1.5s ease-in-out infinite;
    }
    @keyframes pdmShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .pdm-thumb { transition: opacity 200ms ease, transform 200ms ease; }
    .pdm-thumb:hover { opacity: 1 !important; transform: scale(1.04); }
    .pdm-close:hover { background-color: rgba(255,255,255,0.12) !important; }
    .pdm-arrow { transition: background-color 180ms ease, transform 180ms ease; }
    .pdm-arrow:hover {
      background-color: rgba(0,0,0,0.7) !important;
      transform: scale(1.05);
    }
    .pdm-arrow:active { transform: scale(0.95); }
  `;
  document.head.appendChild(style);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pickGalleryImages(record: EnrichedProductRecord): string[] {
  const images = Array.isArray(record.images) ? record.images : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const img of images) {
    if (typeof img === 'string' && img && !seen.has(img)) {
      seen.add(img);
      out.push(img);
      if (out.length >= 12) break;
    }
  }
  return out;
}

function pickBasicHeroImage(basic: Record<string, any>): string | null {
  const thumbs = basic.thumbnails;
  if (Array.isArray(thumbs) && thumbs.length > 6) {
    const big = thumbs[6];
    if (typeof big === 'string' && big) return big;
  }
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    const first = thumbs[0];
    if (typeof first === 'string' && first) return first;
  }
  if (typeof basic.image_url === 'string' && basic.image_url) return basic.image_url;
  if (typeof basic.thumbnail === 'string' && basic.thumbnail) return basic.thumbnail;
  return null;
}

function normalizeSpecCategories(
  specs: EnrichedProductRecord['specifications'],
): Array<{ name: string; rows: Array<{ key: string; value: string }> }> {
  if (!specs) return [];
  // Array form: [{ category, items: [{name,value}, ...] }]
  if (Array.isArray(specs)) {
    return specs
      .map((cat: any) => {
        const name = String(cat?.category || cat?.name || 'Details');
        const items = Array.isArray(cat?.items) ? cat.items : [];
        const rows = items
          .map((item: any) => {
            const key = String(item?.name ?? item?.key ?? '').trim();
            const value = item?.value;
            if (!key || value == null) return null;
            return { key, value: String(value) };
          })
          .filter(Boolean) as Array<{ key: string; value: string }>;
        return rows.length > 0 ? { name, rows } : null;
      })
      .filter(Boolean) as Array<{ name: string; rows: Array<{ key: string; value: string }> }>;
  }
  // Object form: { Details: {...}, Dimensions: {...} } OR flat key/value
  if (typeof specs === 'object') {
    const entries = Object.entries(specs).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) return [];
    // Check if values are themselves objects (categorized) or scalars (flat)
    const hasNestedObjects = entries.some(
      ([, v]) => v !== null && typeof v === 'object' && !Array.isArray(v),
    );
    if (hasNestedObjects) {
      return entries
        .map(([cat, val]) => {
          if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            const rows = Object.entries(val as Record<string, unknown>)
              .filter(([, vv]) => vv != null && String(vv).trim() !== '')
              .map(([k, vv]) => ({ key: k, value: String(vv) }));
            return rows.length > 0 ? { name: cat, rows } : null;
          }
          return null;
        })
        .filter(Boolean) as Array<{ name: string; rows: Array<{ key: string; value: string }> }>;
    }
    // Flat object -- single "Details" group.
    const rows = entries.map(([k, v]) => ({ key: k, value: String(v) }));
    return [{ name: 'Details', rows }];
  }
  return [];
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Reanimated pulse on native; web uses CSS keyframes via className.
      opacity.value = withTiming(1, { duration: 1500 });
    }
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[styles.skeletonBase, style as ViewStyle, Platform.OS === 'web' ? null : animatedStyle]}
      className={Platform.OS === 'web' ? 'pdm-shimmer' : undefined}
    />
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'success' | 'error';

export function ProductDetailModal({
  productId,
  basicRecord,
  visible,
  onClose,
  authToken,
  suiteId,
}: ProductDetailModalProps) {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [enriched, setEnriched] = useState<EnrichedProductRecord | null>(
    () => enrichCache.get(productId) ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  const isUnauthenticated = !authToken;
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const fetchInFlight = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') injectModalStyles();
  }, []);

  // Reset gallery index when productId changes (re-open with different product).
  useEffect(() => {
    setGalleryIdx(0);
    setDescExpanded(false);
    setOpenCategory(null);
    const cached = enrichCache.get(productId);
    if (cached) {
      setEnriched(cached);
      setLoadState('success');
    } else {
      setEnriched(null);
      setLoadState('idle');
    }
  }, [productId]);

  // Fire enrichment when the modal becomes visible.
  // Auth is supplied via props (authToken, suiteId) so the modal works whether
  // or not it sits inside the SupabaseProvider tree at render time. When
  // authToken is null, we skip the fetch entirely and surface a clear "Sign in"
  // empty state (Law #3 -- fail closed).
  const fetchEnrichment = useCallback(async () => {
    if (!visible || !productId || fetchInFlight.current) return;
    if (!authToken) return; // unauthenticated path handled in render
    const cached = enrichCache.get(productId);
    if (cached) {
      setEnriched(cached);
      setLoadState('success');
      return;
    }
    fetchInFlight.current = true;
    setLoadState('loading');
    setErrorMessage('');
    try {
      const trace = buildTraceHeaders();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'X-Correlation-Id': trace.correlationId,
        'X-Trace-Id': trace.traceId,
      };
      if (suiteId) headers['X-Suite-Id'] = suiteId;
      const resp = await fetch('/api/tools/enrich-product', {
        method: 'POST',
        headers,
        body: JSON.stringify({ product_id: productId }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Enrichment failed (${resp.status}): ${text.slice(0, 120)}`);
      }
      const json = await resp.json();
      const product: EnrichedProductRecord =
        (json?.product as EnrichedProductRecord) || {};
      enrichCache.set(productId, product);
      setEnriched(product);
      setLoadState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(msg);
      setLoadState('error');
    } finally {
      fetchInFlight.current = false;
    }
  }, [visible, productId, authToken, suiteId]);

  useEffect(() => {
    if (visible && loadState === 'idle' && authToken) {
      fetchEnrichment();
    }
  }, [visible, loadState, fetchEnrichment, authToken]);

  // ESC key on web closes the modal.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  // ── Derived render data (basic always available; enriched may be null) ──
  const display = enriched ?? (basicRecord as EnrichedProductRecord);
  const title = display.title || basicRecord.title || basicRecord.product_name || 'Product';
  const brand = display.brand || basicRecord.brand || '';
  const price = display.price ?? basicRecord.price;
  const priceWas = display.price_was ?? basicRecord.price_was;
  const rating = display.rating ?? basicRecord.rating;
  const reviewCount =
    display.review_count ?? basicRecord.review_count ?? display.reviews ?? basicRecord.reviews;
  const badges: string[] = Array.isArray(display.badges)
    ? display.badges
    : Array.isArray(basicRecord.badges)
      ? basicRecord.badges
      : [];
  const externalUrl = display.link || display.url || basicRecord.link || basicRecord.url || '';

  const enrichedGallery = useMemo(() => {
    if (loadState === 'success' && enriched) {
      return pickGalleryImages(enriched);
    }
    return [];
  }, [loadState, enriched]);

  const fallbackHero = useMemo(() => pickBasicHeroImage(basicRecord), [basicRecord]);
  const galleryImages = enrichedGallery.length > 0
    ? enrichedGallery
    : fallbackHero
      ? [fallbackHero]
      : [];
  const heroImage = galleryImages[Math.min(galleryIdx, galleryImages.length - 1)] || '';

  const goPrevImage = useCallback(() => {
    setGalleryIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const goNextImage = useCallback(() => {
    setGalleryIdx((i) => (i + 1) % galleryImages.length);
  }, [galleryImages.length]);

  const specCategories = useMemo(
    () => normalizeSpecCategories(enriched?.specifications),
    [enriched?.specifications],
  );

  const bullets: string[] = Array.isArray(enriched?.bullets) ? enriched!.bullets! : [];
  const descShort = enriched?.description_short || enriched?.description || '';
  const descFull = enriched?.description_full || '';
  const stockQty = enriched?.stock_quantity;
  const storeName =
    enriched?.store_name || enriched?.pickup_store_name || basicRecord.pickup_store_name || basicRecord.store_name || '';
  const bay = enriched?.bay || '';
  const aisle = enriched?.aisle || '';
  const pickupArrival = enriched?.fulfillment_pickup?.arrival_date || enriched?.fulfillment_pickup?.earliest_date || '';
  const deliveryArrival =
    enriched?.fulfillment_delivery?.arrival_date || enriched?.fulfillment_delivery?.earliest_date || '';
  const purchasingLimitNotes = enriched?.purchasing_limit_notes || '';

  const handleVisit = useCallback(() => {
    if (externalUrl) safeOpenURL(externalUrl);
  }, [externalUrl]);

  const handleRetry = useCallback(() => {
    setLoadState('idle');
    setErrorMessage('');
  }, []);

  // When unauthenticated we skip the fetch entirely. Treat as "not loading"
  // so skeletons don't render and the empty state below is the only body.
  const isLoading = !isUnauthenticated && (loadState === 'loading' || loadState === 'idle');
  const hasEnriched = loadState === 'success' && enriched != null;
  const hasError = !isUnauthenticated && loadState === 'error';

  // RN Modal handles its own visibility; we still gate child mount on `visible`
  // so the fetch effect does not fire when closed.
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // Web: react-native-web renders this to a portal on document.body, so
      // the panel is no longer trapped inside ResearchModal's z-index 9999
      // stacking context.
      // Native: RN's native modal stack renders above all sibling views.
      statusBarTranslucent
    >
      <View
        style={styles.root}
        pointerEvents="auto"
        testID="product-detail-modal"
        accessibilityViewIsModal
      >
        {/* Backdrop -- solid 95% black, click-to-close (matches ResearchModal). */}
        <Pressable
          onPress={onClose}
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close product details"
        />

      {/* Modal panel. Pressable swallows clicks so the backdrop only closes
          when the user taps outside the panel. */}
      <Pressable
        onPress={() => {}}
        style={styles.panel}
        className={Platform.OS === 'web' ? 'pdm-panel' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {title}
            </Text>
            {brand ? (
              <Text style={styles.headerBrand} numberOfLines={1}>
                {brand}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="product-detail-modal-close"
            className={Platform.OS === 'web' ? 'pdm-close' : undefined}
          >
            <Ionicons name="close" size={22} color={Colors.text.secondary} />
          </Pressable>
        </View>

        {/* Body */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          accessibilityLabel="Product details"
        >
          {/* GALLERY */}
          <View style={styles.gallery}>
            <View style={styles.heroFrame}>
              {heroImage ? (
                <>
                  <Image
                    source={{ uri: heroImage }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="contain"
                    transition={200}
                    accessibilityLabel={`${title} image ${galleryIdx + 1} of ${galleryImages.length}`}
                  />
                  {galleryImages.length > 1 && (
                    <>
                      <Pressable
                        onPress={goPrevImage}
                        style={[styles.galleryArrow, styles.galleryArrowLeft]}
                        accessibilityRole="button"
                        accessibilityLabel="Previous image"
                        testID="product-detail-modal-prev-image"
                        className={Platform.OS === 'web' ? 'pdm-arrow' : undefined}
                        hitSlop={8}
                      >
                        <Ionicons name="chevron-back" size={26} color={Colors.text.primary} />
                      </Pressable>
                      <Pressable
                        onPress={goNextImage}
                        style={[styles.galleryArrow, styles.galleryArrowRight]}
                        accessibilityRole="button"
                        accessibilityLabel="Next image"
                        testID="product-detail-modal-next-image"
                        className={Platform.OS === 'web' ? 'pdm-arrow' : undefined}
                        hitSlop={8}
                      >
                        <Ionicons name="chevron-forward" size={26} color={Colors.text.primary} />
                      </Pressable>
                      <View style={styles.galleryCounter}>
                        <Text style={styles.galleryCounterText}>
                          {galleryIdx + 1} / {galleryImages.length}
                        </Text>
                      </View>
                    </>
                  )}
                </>
              ) : isLoading ? (
                <SkeletonBlock style={styles.heroSkeleton} />
              ) : (
                <View style={styles.heroFallback}>
                  <Ionicons name="cube-outline" size={48} color={Colors.text.muted} />
                </View>
              )}
            </View>

            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbStripContent}
                style={styles.thumbStrip}
              >
                {galleryImages.map((src, i) => (
                  <Pressable
                    key={`${src}-${i}`}
                    onPress={() => setGalleryIdx(i)}
                    style={[styles.thumb, i === galleryIdx && styles.thumbActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Show image ${i + 1}`}
                    testID={`product-detail-modal-thumb-${i}`}
                    className={Platform.OS === 'web' ? 'pdm-thumb' : undefined}
                  >
                    <Image
                      source={{ uri: src }}
                      style={styles.thumbImage}
                      contentFit="cover"
                      transition={150}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {isLoading && galleryImages.length <= 1 && (
              <View style={styles.thumbStripSkeleton}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <SkeletonBlock key={k} style={styles.thumbSkeleton} />
                ))}
              </View>
            )}
          </View>

          {/* OVERVIEW */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Overview</Text>
            <View style={styles.overviewRow}>
              {price != null ? (
                <Text style={styles.priceMain}>{fmtPrice(price)}</Text>
              ) : null}
              {priceWas != null && Number(priceWas) > Number(price ?? 0) ? (
                <Text style={styles.priceWas}>{fmtPrice(priceWas)}</Text>
              ) : null}
            </View>
            {rating != null && (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingStars}>{renderStars(Number(rating))}</Text>
                <Text style={styles.ratingDetail}>
                  {' '}
                  {Number(rating).toFixed(1)}
                  {reviewCount ? ` (${Number(reviewCount).toLocaleString('en-US')} reviews)` : ''}
                </Text>
              </View>
            )}
            {badges.length > 0 && (
              <View style={styles.badgeRow}>
                {badges.slice(0, 4).map((b, i) => (
                  <View key={i} style={styles.badge}>
                    <Text style={styles.badgeText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
            {hasEnriched && descShort ? (
              <Text style={styles.descShort} selectable>
                {descShort}
              </Text>
            ) : isLoading ? (
              <SkeletonBlock style={styles.descSkeleton} />
            ) : null}
          </View>

          {/* KEY FEATURES (bullets) */}
          {hasEnriched && bullets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key features</Text>
              <View style={styles.bulletList}>
                {bullets.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText} selectable>
                      {b}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {isLoading && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key features</Text>
              <SkeletonBlock style={styles.bulletSkeleton} />
              <SkeletonBlock style={styles.bulletSkeleton} />
              <SkeletonBlock style={styles.bulletSkeleton} />
            </View>
          )}

          {/* SPECIFICATIONS */}
          {hasEnriched && specCategories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Specifications</Text>
              {specCategories.map((cat) => {
                const isOpen = openCategory === cat.name;
                return (
                  <View key={cat.name} style={styles.specCategory}>
                    <Pressable
                      onPress={() => setOpenCategory(isOpen ? null : cat.name)}
                      style={styles.specHeader}
                      accessibilityRole="button"
                      accessibilityLabel={`${isOpen ? 'Collapse' : 'Expand'} ${cat.name}`}
                    >
                      <Text style={styles.specHeaderText}>{cat.name}</Text>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={Colors.text.tertiary}
                      />
                    </Pressable>
                    {isOpen && (
                      <View style={styles.specRows}>
                        {cat.rows.map((row, i) => (
                          <View
                            key={`${row.key}-${i}`}
                            style={[
                              styles.specRow,
                              i < cat.rows.length - 1 && styles.specRowDivider,
                            ]}
                          >
                            <Text style={styles.specKey} numberOfLines={2}>
                              {row.key}
                            </Text>
                            <Text style={styles.specValue} numberOfLines={3} selectable>
                              {row.value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          {isLoading && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Specifications</Text>
              <SkeletonBlock style={styles.specSkeleton} />
              <SkeletonBlock style={styles.specSkeleton} />
            </View>
          )}

          {/* IN-STORE */}
          {hasEnriched && (storeName || bay || aisle || stockQty != null) ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>In store</Text>
              {storeName ? (
                <View style={styles.infoRow}>
                  <Ionicons name="storefront-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.infoText} selectable>
                    {storeName}
                  </Text>
                </View>
              ) : null}
              {(bay || aisle) ? (
                <View style={styles.infoRow}>
                  <Ionicons name="navigate-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.infoText} selectable>
                    {[aisle ? `Aisle ${aisle}` : '', bay ? `Bay ${bay}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              ) : null}
              {stockQty != null ? (
                <View style={styles.infoRow}>
                  <Ionicons name="cube-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.infoText}>
                    {stockQty > 0 ? `${stockQty} in stock` : 'Out of stock'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* FULFILLMENT */}
          {hasEnriched && (pickupArrival || deliveryArrival || purchasingLimitNotes) ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Fulfillment</Text>
              {pickupArrival ? (
                <View style={styles.infoRow}>
                  <Ionicons name="bag-handle-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.infoText}>Pickup: {pickupArrival}</Text>
                </View>
              ) : null}
              {deliveryArrival ? (
                <View style={styles.infoRow}>
                  <Ionicons name="car-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.infoText}>Delivery: {deliveryArrival}</Text>
                </View>
              ) : null}
              {purchasingLimitNotes ? (
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.infoText} selectable>
                    {purchasingLimitNotes}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* FULL DESCRIPTION */}
          {hasEnriched && descFull ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text
                style={styles.descFull}
                numberOfLines={descExpanded ? undefined : 5}
                selectable
              >
                {descFull}
              </Text>
              {descFull.length > 240 ? (
                <Pressable
                  onPress={() => setDescExpanded((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={descExpanded ? 'Show less' : 'Show more'}
                >
                  <Text style={styles.descToggle}>
                    {descExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* UNAUTHENTICATED STATE -- Law #3: fail closed when no token. */}
          {isUnauthenticated && (
            <View style={styles.errorBox} testID="product-detail-modal-unauthenticated">
              <Ionicons name="lock-closed-outline" size={28} color={Colors.text.tertiary} />
              <Text style={styles.errorTitle}>Sign in to see full details</Text>
              <Text style={styles.errorMessage} numberOfLines={2}>
                Full specs, in-store availability, and shipping ETAs require an
                authenticated session.
              </Text>
              {externalUrl ? (
                <View style={styles.errorActions}>
                  <ActionButton
                    label="Visit Home Depot"
                    icon="open-outline"
                    onPress={handleVisit}
                    variant="primary"
                  />
                </View>
              ) : null}
            </View>
          )}

          {/* ERROR STATE -- Law #3: explicit error, no degraded render */}
          {hasError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={28} color={Colors.semantic.error} />
              <Text style={styles.errorTitle}>Couldn't load full details.</Text>
              {errorMessage ? (
                <Text style={styles.errorMessage} numberOfLines={2}>
                  {errorMessage}
                </Text>
              ) : null}
              <View style={styles.errorActions}>
                <ActionButton
                  label="Retry"
                  icon="refresh-outline"
                  onPress={handleRetry}
                  variant="primary"
                />
                {externalUrl ? (
                  <ActionButton
                    label="Visit Home Depot"
                    icon="open-outline"
                    onPress={handleVisit}
                    variant="secondary"
                  />
                ) : null}
              </View>
            </View>
          )}

          {/* Loading indicator at the bottom while skeletons render */}
          {isLoading && (
            <View style={styles.loadingFooter}>
              <ActivityIndicator color={Colors.accent.cyan} size="small" />
              <Text style={styles.loadingText}>Loading details...</Text>
            </View>
          )}
        </ScrollView>

        {/* FOOTER -- always-available CTA (suppressed when error or
            unauthenticated state already shows the same CTA inline). */}
        {externalUrl && !hasError && !isUnauthenticated ? (
          <View style={styles.footer}>
            <ActionButton
              label="Visit Home Depot"
              icon="open-outline"
              onPress={handleVisit}
              variant="primary"
            />
          </View>
        ) : null}
      </Pressable>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  panel: {
    width: '92%' as unknown as number,
    maxWidth: 880,
    height: '90%' as unknown as number,
    maxHeight: 920,
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    overflow: 'hidden',
    flexDirection: 'column',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' } as unknown as ViewStyle)
      : {}),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surface.cardBorder,
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  headerBrand: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Body
  body: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', overflowX: 'hidden' } as unknown as ViewStyle)
      : {}),
  },
  bodyContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },

  // Gallery
  gallery: {
    gap: Spacing.md,
  },
  heroFrame: {
    width: '100%' as unknown as number,
    aspectRatio: 4 / 3,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  heroSkeleton: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.lg,
  },
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryArrow: {
    position: 'absolute',
    top: '50%' as unknown as number,
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    // Subtle ring so arrows stay legible on bright product photos.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  galleryArrowLeft: { left: Spacing.md },
  galleryArrowRight: { right: Spacing.md },
  galleryCounter: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    zIndex: 4,
  },
  galleryCounterText: {
    ...Typography.small,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  thumbStrip: {
    width: '100%' as unknown as number,
  },
  thumbStripContent: {
    gap: Spacing.sm,
    paddingHorizontal: 2,
  },
  thumbStripSkeleton: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.background.elevated,
    opacity: 0.7,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {
    opacity: 1,
    borderColor: Colors.accent.cyan,
  },
  thumbImage: {
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
  },
  thumbSkeleton: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  priceMain: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
    color: Colors.semantic.success,
    letterSpacing: -0.5,
  },
  priceWas: {
    ...Typography.body,
    color: Colors.text.muted,
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    ...Typography.body,
    color: Colors.accent.amber,
    letterSpacing: 1,
  },
  ratingDetail: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.accent.cyanLight,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.small,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  descShort: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  descSkeleton: {
    height: 60,
    borderRadius: BorderRadius.sm,
  },

  // Bullets
  bulletList: {
    gap: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent.cyan,
    marginTop: 8,
    flexShrink: 0,
  },
  bulletText: {
    ...Typography.body,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },
  bulletSkeleton: {
    height: 18,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },

  // Specifications
  specCategory: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  specHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  specHeaderText: {
    ...Typography.smallMedium,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  specRows: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface.card,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  specSkeleton: {
    height: 38,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },

  // Info rows (in-store, fulfillment)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    color: Colors.text.secondary,
    flex: 1,
  },

  // Description full
  descFull: {
    ...Typography.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  descToggle: {
    ...Typography.smallMedium,
    color: Colors.accent.cyan,
    marginTop: Spacing.xs,
  },

  // Error state
  errorBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.semantic.errorLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)',
  },
  errorTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  errorMessage: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  errorActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  // Loading footer
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  loadingText: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // Footer (sticky CTA)
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
  },

  // Skeleton base
  skeletonBase: {
    backgroundColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
});

export default ProductDetailModal;
