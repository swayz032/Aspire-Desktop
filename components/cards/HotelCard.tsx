import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL, safeCallPhone } from '@/lib/safeOpenURL';
import { renderStars, fmtCount, domainOf } from './helpers';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
import { ImageSkeleton } from './ImageSkeleton';

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
  enterDelay?: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SubratingBar({
  label,
  value,
  max = 5,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <View style={styles.subratingRow} accessibilityLabel={`${label}: ${value} out of ${max}`}>
      <Text style={styles.subratingLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.subratingTrack}>
        <View style={[styles.subratingFill, { width: `${pct}%` } as ViewStyle]} />
      </View>
      <Text style={styles.subratingValue}>{value.toFixed(1)}</Text>
    </View>
  );
}

function AmenityChip({ label }: { label: string }) {
  return (
    <View style={styles.amenityChip}>
      <Text style={styles.amenityText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HotelCard({ record, onAction, isActive, enterDelay }: CardProps) {
  const {
    name = 'Unknown Hotel',
    normalized_address,
    traveler_rating,
    review_count,
    ta_rating,
    ta_review_count,
    safety_score,
    subratings,
    amenities,
    photos,
    image_url,
    phone,
    website,
    tripadvisor_url,
    ranking_string,
    star_rating,
  } = record;

  const firstPhoto = Array.isArray(photos) ? photos[0] : null;
  const heroFromPhoto =
    typeof firstPhoto === 'string'
      ? firstPhoto
      : firstPhoto?.large || firstPhoto?.original || firstPhoto?.medium || firstPhoto?.small || firstPhoto?.thumbnail;
  const heroUrl = heroFromPhoto || image_url || null;
  const hasSubratings = subratings && typeof subratings === 'object';
  const amenityList: string[] = Array.isArray(amenities) ? amenities : [];
  const visibleAmenities = amenityList.slice(0, 5);
  const extraAmenityCount = amenityList.length - 5;

  // Image loading state for skeleton shimmer
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleCall = useCallback(() => {
    if (phone) safeCallPhone(phone);
    onAction('call', record);
  }, [phone, onAction, record]);

  const handleVisit = useCallback(() => {
    const url = website || tripadvisor_url;
    if (url) safeOpenURL(url);
    onAction('visit', record);
  }, [website, tripadvisor_url, onAction, record]);

  const handleDetails = useCallback(() => {
    onAction('details', record);
  }, [onAction, record]);

  // ---- Hero content ----
  const heroContent = (
    <>
      {heroUrl ? (
        <>
          <ImageSkeleton loaded={imageLoaded} />
          <Image
            source={{ uri: heroUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Photo of ${name}`}
            onLoad={() => setImageLoaded(true)}
          />
        </>
      ) : (
        <LinearGradient
          colors={Colors.gradient.cardHeroCool}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        >
          <View style={styles.heroFallback}>
            <Ionicons name="bed-outline" size={32} color={Colors.text.muted} />
            <Text style={styles.heroFallbackText} numberOfLines={2}>
              {name}
            </Text>
          </View>
        </LinearGradient>
      )}

      {/* Gradient scrim for text legibility over image */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.heroScrim}
      />

      {/* Star rating overlay — bottom-left */}
      {star_rating != null && star_rating > 0 && (
        <View style={styles.starOverlay}>
          <Text style={styles.starOverlayText}>
            {'\u2605'.repeat(Math.round(star_rating))}
          </Text>
        </View>
      )}
    </>
  );

  // ---- Action buttons ----
  const actionContent = (
    <>
      {phone ? (
        <ActionButton label="Call" icon="call-outline" onPress={handleCall} variant="primary" />
      ) : null}
      {(website || tripadvisor_url) ? (
        <ActionButton label="Visit" icon="open-outline" onPress={handleVisit} variant="primary" />
      ) : null}
      <ActionButton label="Details" icon="chevron-forward" onPress={handleDetails} variant="secondary" />
    </>
  );

  return (
    <BaseCard
      safety={safety_score != null ? { score: safety_score } : null}
      isActive={isActive}
      heroSlot={heroContent}
      heroStyle={HERO_STYLE}
      actionSlot={actionContent}
      accessibilityLabel={`${name} hotel card`}
      enterDelay={enterDelay}
    >
      {/* Name + Address */}
      <Text style={styles.hotelName} numberOfLines={2} accessibilityRole="header">
        {name}
      </Text>
      {normalized_address ? (
        <Text style={styles.address} numberOfLines={1}>
          {normalized_address}
        </Text>
      ) : null}

      {/* Dual Ratings Row — section divider above */}
      {(traveler_rating || ta_rating) && (
        <View style={[styles.ratingsRow, styles.sectionDivider]}>
          {traveler_rating != null && (
            <View style={styles.ratingBlock}>
              <Text style={styles.ratingStars}>
                {renderStars(traveler_rating)}
              </Text>
              <Text style={styles.ratingDetail}>
                {' '}
                {traveler_rating.toFixed(1)}
                {review_count ? ` (${fmtCount(review_count)})` : ''}
              </Text>
            </View>
          )}
          {traveler_rating != null && ta_rating != null && (
            <Text style={styles.ratingDivider}>|</Text>
          )}
          {ta_rating != null && (
            <View style={styles.ratingBlock}>
              <Text style={styles.ratingLabel}>TA </Text>
              <Text style={styles.ratingStars}>
                {renderStars(ta_rating)}
              </Text>
              <Text style={styles.ratingDetail}>
                {' '}
                {ta_rating.toFixed(1)}
                {ta_review_count ? ` (${fmtCount(ta_review_count)})` : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Subrating Bars */}
      {hasSubratings && (
        <View style={styles.subratings}>
          {Object.entries(subratings as Record<string, number>)
            .slice(0, 3)
            .map(([key, val]) => (
              <SubratingBar key={key} label={key} value={val} />
            ))}
        </View>
      )}

      {/* Amenity Chips — section divider above */}
      {visibleAmenities.length > 0 && (
        <View style={[styles.amenityRow, styles.sectionDivider]}>
          {visibleAmenities.map((a, i) => (
            <AmenityChip key={i} label={a} />
          ))}
          {extraAmenityCount > 0 && (
            <View style={styles.amenityChipMore}>
              <Text style={styles.amenityMoreText}>+{extraAmenityCount} more</Text>
            </View>
          )}
        </View>
      )}

      {/* Ranking */}
      {ranking_string ? (
        <Text style={styles.ranking} numberOfLines={1}>
          {ranking_string}
        </Text>
      ) : null}

      {/* Consistent height spacer — ensures all cards are the same visual size */}
      {!hasSubratings && (
        <View style={styles.placeholderSection}>
          <Text style={styles.placeholderText}>No detailed ratings available</Text>
        </View>
      )}
      {visibleAmenities.length === 0 && (
        <View style={styles.placeholderSection}>
          <Text style={styles.placeholderText}>Amenities not listed</Text>
        </View>
      )}
    </BaseCard>
  );
}

// ---------------------------------------------------------------------------
// Styles (card-specific only — shell/actions owned by BaseCard)
// ---------------------------------------------------------------------------

const HERO_HEIGHT = 200;
const HERO_STYLE: ViewStyle = { height: HERO_HEIGHT, aspectRatio: undefined };

const styles = StyleSheet.create({
  // Hero internals
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
  },
  heroFallbackText: {
    ...Typography.headline,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  heroScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  starOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.md,
  },
  starOverlayText: {
    ...Typography.small,
    color: Colors.accent.amber,
    letterSpacing: 1,
  },

  // Content
  hotelName: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  address: {
    ...Typography.caption,
    color: Colors.text.muted,
    marginTop: -Spacing.xs,
  },

  // Dual ratings
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  ratingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingLabel: {
    ...Typography.small,
    color: Colors.text.tertiary,
    fontWeight: '600',
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
  ratingDivider: {
    ...Typography.small,
    color: Colors.text.muted,
  },

  // Subratings
  subratings: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  subratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subratingLabel: {
    ...Typography.small,
    color: Colors.text.tertiary,
    width: 80,
  },
  subratingTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  subratingFill: {
    height: '100%' as unknown as number,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.full,
  },
  subratingValue: {
    ...Typography.small,
    color: Colors.text.secondary,
    width: 28,
    textAlign: 'right',
  },

  // Amenities
  amenityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  amenityChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface.cardBorder,
    borderRadius: BorderRadius.sm,
  },
  amenityText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
  amenityChipMore: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: 'transparent',
  },
  amenityMoreText: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  // Ranking
  ranking: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
  },

  // Section divider — hairline separator between logical content blocks
  sectionDivider: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.surface.cardBorder,
  },

  // Placeholder for missing sections — maintains consistent card height
  placeholderSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.surface.cardBorder,
  },
  placeholderText: {
    ...Typography.small,
    color: Colors.text.disabled,
    fontStyle: 'italic',
  },
});

export default HotelCard;
