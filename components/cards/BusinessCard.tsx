import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL, safeCallPhone } from '@/lib/safeOpenURL';
import { renderStars, domainOf } from './helpers';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
import { ImageSkeleton } from './ImageSkeleton';
import type { CardProps } from './CardRegistry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryIcon(category: string | undefined): keyof typeof Ionicons.glyphMap {
  if (!category) return 'business-outline';
  const lower = category.toLowerCase();
  if (lower.includes('plumb')) return 'water-outline';
  if (lower.includes('electr')) return 'flash-outline';
  if (lower.includes('hvac') || lower.includes('heat') || lower.includes('air'))
    return 'thermometer-outline';
  if (lower.includes('roof')) return 'home-outline';
  if (lower.includes('paint')) return 'color-palette-outline';
  if (lower.includes('landscap') || lower.includes('lawn'))
    return 'leaf-outline';
  if (lower.includes('clean')) return 'sparkles-outline';
  if (lower.includes('construct') || lower.includes('contract'))
    return 'construct-outline';
  if (lower.includes('restaurant') || lower.includes('food'))
    return 'restaurant-outline';
  if (lower.includes('auto') || lower.includes('mechanic'))
    return 'car-outline';
  if (lower.includes('legal') || lower.includes('law'))
    return 'document-text-outline';
  if (lower.includes('medical') || lower.includes('doctor') || lower.includes('health'))
    return 'medkit-outline';
  return 'business-outline';
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BusinessCard({ record, onAction, isActive, enterDelay, orientation }: CardProps) {
  const isHorizontal = orientation === 'horizontal';
  const {
    name = 'Unknown Business',
    normalized_address,
    phone,
    website,
    rating,
    review_count,
    category,
    hours,
    distance_miles,
    open_now,
    image_url,
  } = record as Record<string, any>;

  const domain = domainOf(website);
  const icon = categoryIcon(category);
  const heroUrl: string = typeof image_url === 'string' && image_url.trim() ? image_url.trim() : '';

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const showHeroImage = heroUrl && !imageFailed;

  const handleCall = useCallback(() => {
    if (phone) safeCallPhone(phone);
    onAction('call', record);
  }, [phone, onAction, record]);

  const handleWebsite = useCallback(() => {
    if (website) safeOpenURL(website);
    onAction('visit', record);
  }, [website, onAction, record]);

  const handleDetails = useCallback(() => {
    onAction('details', record);
  }, [onAction, record]);

  // ---- Hero content ----
  const heroContent = (
    <LinearGradient
      colors={Colors.gradient.cardHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroGradient}
    >
      <View style={styles.heroIcon}>
        <Ionicons name={icon} size={32} color={Colors.accent.cyan} />
      </View>
      <Text style={styles.heroName} numberOfLines={2} accessibilityRole="header">
        {name}
      </Text>
      {rating != null && (
        <View style={styles.heroRatingRow}>
          <Text style={styles.heroStars}>{renderStars(rating)}</Text>
          <Text style={styles.heroRatingNum}>
            {' '}
            {typeof rating === 'number' ? rating.toFixed(1) : rating}
          </Text>
          {review_count != null && (
            <Text style={styles.heroReviewCount}>
              {' '}
              ({review_count} reviews)
            </Text>
          )}
        </View>
      )}
    </LinearGradient>
  );

  // ---- Action buttons ----
  const actionContent = (
    <>
      {phone ? (
        <ActionButton label="Call" icon="call-outline" onPress={handleCall} variant="primary" />
      ) : null}
      {website ? (
        <ActionButton
          label="Website"
          icon="globe-outline"
          onPress={handleWebsite}
          variant="primary"
        />
      ) : null}
      <ActionButton
        label="Details"
        icon="chevron-forward"
        onPress={handleDetails}
        variant="secondary"
      />
    </>
  );

  // ── Horizontal layout (880x440) ─────────────────────────────────────────
  // LEFT 580x440 hero: Google Places photo (image_url) on neutral canvas,
  // letterboxed via contentFit="contain". Fallback = storefront icon + name.
  // RIGHT 300x440 info stack with stacked CTAs at bottom.
  if (isHorizontal) {
    const horizontalHeroContent = (
      <Pressable
        onPress={handleDetails}
        style={hHeroStyles.pressable}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name} details`}
        testID="business-card-horizontal-hero"
      >
        {showHeroImage ? (
          <>
            <ImageSkeleton loaded={imageLoaded} />
            <Image
              source={{ uri: heroUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="contain"
              transition={200}
              accessibilityLabel={`Photo of ${name}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
            />
          </>
        ) : (
          <View style={hHeroStyles.fallback}>
            <View style={hHeroStyles.fallbackIcon}>
              <Ionicons name={icon} size={56} color={Colors.accent.cyan} />
            </View>
            <Text style={hHeroStyles.fallbackName} numberOfLines={2}>
              {name}
            </Text>
            {category ? (
              <Text style={hHeroStyles.fallbackCategory} numberOfLines={1}>
                {category}
              </Text>
            ) : null}
          </View>
        )}

        {/* Subtle scrim only when an image is present, for retailer pill legibility */}
        {showHeroImage ? (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.45)']}
            style={hHeroStyles.scrim}
            pointerEvents="none"
          />
        ) : null}

        {/* Open / Closed pill — top-left */}
        {open_now != null ? (
          <View
            style={[
              hHeroStyles.statusPill,
              {
                backgroundColor: open_now
                  ? 'rgba(52, 199, 89, 0.92)'
                  : 'rgba(255, 59, 48, 0.92)',
              },
            ]}
          >
            <View style={hHeroStyles.statusDot} />
            <Text style={hHeroStyles.statusText}>
              {open_now ? 'Open now' : 'Closed'}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );

    const horizontalActions = (
      <>
        <ActionButton
          label="View details"
          icon="chevron-forward"
          onPress={handleDetails}
          variant="primary"
        />
        {website ? (
          <ActionButton
            label="Visit"
            icon="open-outline"
            onPress={handleWebsite}
            variant="secondary"
          />
        ) : phone ? (
          <ActionButton
            label="Call"
            icon="call-outline"
            onPress={handleCall}
            variant="secondary"
          />
        ) : null}
      </>
    );

    const distanceLabel =
      typeof distance_miles === 'number'
        ? `${distance_miles.toFixed(1)} mi away`
        : distance_miles
          ? `${distance_miles} mi away`
          : '';

    return (
      <BaseCard
        safety={null}
        isActive={isActive}
        heroSlot={horizontalHeroContent}
        actionSlot={horizontalActions}
        accessibilityLabel={`${name} business card`}
        enterDelay={enterDelay}
        orientation="horizontal"
      >
        <View style={hStyles.stack}>
          <Text style={hStyles.title} numberOfLines={2} accessibilityRole="header">
            {name}
          </Text>

          {category ? (
            <Text style={hStyles.category} numberOfLines={1}>
              {category}
            </Text>
          ) : null}

          {rating != null ? (
            <View style={hStyles.ratingRow}>
              <Text style={hStyles.ratingStars}>{renderStars(rating)}</Text>
              <Text style={hStyles.ratingDetail} numberOfLines={1}>
                {' '}
                {typeof rating === 'number' ? rating.toFixed(1) : rating}
                {review_count ? ` (${Number(review_count).toLocaleString('en-US')})` : ''}
              </Text>
            </View>
          ) : null}

          {normalized_address ? (
            <View style={hStyles.metaRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color={Colors.text.tertiary}
              />
              <Text style={hStyles.metaText} numberOfLines={2}>
                {normalized_address}
              </Text>
            </View>
          ) : null}

          {phone ? (
            <View style={hStyles.metaRow}>
              <Ionicons
                name="call-outline"
                size={14}
                color={Colors.text.tertiary}
              />
              <Text style={hStyles.metaText} numberOfLines={1}>
                {phone}
              </Text>
            </View>
          ) : null}

          {domain ? (
            <View style={hStyles.metaRow}>
              <Ionicons
                name="globe-outline"
                size={14}
                color={Colors.text.tertiary}
              />
              <Text style={hStyles.metaText} numberOfLines={1}>
                {domain}
              </Text>
            </View>
          ) : null}

          <View style={hStyles.spacer} />

          {distanceLabel ? (
            <View style={hStyles.metaRow}>
              <Ionicons
                name="navigate-outline"
                size={14}
                color={Colors.text.tertiary}
              />
              <Text style={hStyles.metaText} numberOfLines={1}>
                {distanceLabel}
              </Text>
            </View>
          ) : hours && typeof hours === 'string' ? (
            <View style={hStyles.metaRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color={Colors.text.tertiary}
              />
              <Text style={hStyles.metaText} numberOfLines={1}>
                {hours}
              </Text>
            </View>
          ) : null}
        </View>
      </BaseCard>
    );
  }

  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={heroContent}
      heroStyle={HERO_STYLE}
      actionSlot={actionContent}
      accessibilityLabel={`${name} business card`}
      enterDelay={enterDelay}
      orientation={orientation}
    >
      {/* Address */}
      {normalized_address ? (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={Colors.text.muted} />
          <Text style={styles.infoText} numberOfLines={2}>
            {normalized_address}
          </Text>
        </View>
      ) : null}

      {/* Phone */}
      {phone ? (
        <Pressable
          style={styles.infoRow}
          onPress={() => safeCallPhone(phone)}
          accessibilityRole="link"
          accessibilityLabel={`Call ${phone}`}
        >
          <Ionicons name="call-outline" size={16} color={Colors.accent.cyan} />
          <Text style={[styles.infoText, styles.infoLink]}>{phone}</Text>
        </Pressable>
      ) : null}

      {/* Website */}
      {website ? (
        <Pressable
          style={styles.infoRow}
          onPress={() => safeOpenURL(website)}
          accessibilityRole="link"
          accessibilityLabel={`Visit ${domain}`}
        >
          <Ionicons name="globe-outline" size={16} color={Colors.accent.cyan} />
          <Text style={[styles.infoText, styles.infoLink]} numberOfLines={1}>
            {domain}
          </Text>
        </Pressable>
      ) : null}

      {/* Status pills: Open/Closed + Distance — section divider above */}
      {(open_now != null || distance_miles != null) && (
        <View style={[styles.pillsRow, styles.sectionDivider]}>
          {open_now != null && (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: open_now
                    ? Colors.semantic.successLight
                    : Colors.semantic.errorLight,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: open_now
                      ? Colors.semantic.success
                      : Colors.semantic.error,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: open_now
                      ? Colors.semantic.success
                      : Colors.semantic.error,
                  },
                ]}
              >
                {open_now ? 'Open now' : 'Closed'}
              </Text>
            </View>
          )}
          {distance_miles != null && (
            <View style={styles.distancePill}>
              <Ionicons
                name="navigate-outline"
                size={12}
                color={Colors.text.tertiary}
              />
              <Text style={styles.distanceText}>
                {typeof distance_miles === 'number'
                  ? `${distance_miles.toFixed(1)} mi`
                  : `${distance_miles} mi`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Category */}
      {category ? (
        <Text style={styles.category} numberOfLines={1}>
          {category}
        </Text>
      ) : null}

      {/* Hours */}
      {hours && typeof hours === 'string' ? (
        <Text style={styles.hours} numberOfLines={1}>
          {hours}
        </Text>
      ) : null}
    </BaseCard>
  );
}

// ---------------------------------------------------------------------------
// Styles (card-specific only — shell/actions owned by BaseCard)
// ---------------------------------------------------------------------------

const HERO_HEIGHT = 200; // Matches all card types for consistent sizing
const HERO_STYLE = { height: HERO_HEIGHT, aspectRatio: undefined };

const styles = StyleSheet.create({
  // Hero internals
  heroGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent.cyanLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStars: {
    ...Typography.caption,
    color: Colors.accent.amber,
    letterSpacing: 1,
  },
  heroRatingNum: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  heroReviewCount: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    minHeight: 24,
    marginTop: Spacing.xs,
  },
  infoText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },
  infoLink: {
    color: Colors.accent.cyan,
  },

  // Status pills
  pillsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
  },
  statusPillText: {
    ...Typography.smallMedium,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.full,
  },
  distanceText: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },

  // Category + Hours
  category: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  hours: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  // Section divider — hairline separator between logical content blocks
  sectionDivider: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.surface.cardBorder,
  },
});

// ── Horizontal layout (880x440) hero pressable + fallback ─────────────────
const hHeroStyles = StyleSheet.create({
  pressable: {
    flex: 1,
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
    backgroundColor: Colors.background.elevated,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer' } as unknown as ViewStyle)
      : {}),
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  fallbackIcon: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent.cyanLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackName: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginTop: Spacing.sm,
  },
  fallbackCategory: {
    ...Typography.small,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  statusPill: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#ffffff',
  },
  statusText: {
    ...Typography.small,
    color: '#ffffff',
    fontWeight: '600',
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
  category: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  metaText: {
    ...Typography.small,
    color: Colors.text.tertiary,
    flexShrink: 1,
    flex: 1,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.sm,
  },
});

export default BusinessCard;
