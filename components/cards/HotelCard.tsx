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
import { SafetyBadge as SharedSafetyBadge } from './SafetyBadge';

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

/** Render rating stars from a numeric score (0-5). Half stars at >= .25 */
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


/** Abbreviate large numbers: 3227 -> "3.2K" */
function fmtCount(n: number | undefined): string {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Clamp text to a domain for display */
function domainOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
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

export function HotelCard({ record, onAction, isActive }: CardProps) {
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
    phone,
    website,
    tripadvisor_url,
    ranking_string,
    star_rating,
  } = record;

  const heroUrl = photos?.[0]?.large || photos?.[0]?.medium || null;
  const hasSubratings = subratings && typeof subratings === 'object';
  const amenityList: string[] = Array.isArray(amenities) ? amenities : [];
  const visibleAmenities = amenityList.slice(0, 5);
  const extraAmenityCount = amenityList.length - 5;

  // Handlers — keep pure, no side-effects
  const handleCall = useCallback(() => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    }
    onAction('call', record);
  }, [phone, onAction, record]);

  const handleVisit = useCallback(() => {
    const url = website || tripadvisor_url;
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
    onAction('visit', record);
  }, [website, tripadvisor_url, onAction, record]);

  const handleDetails = useCallback(() => {
    onAction('details', record);
  }, [onAction, record]);

  return (
    <View
      style={[styles.card, isActive && styles.cardActive]}
      accessibilityRole="summary"
      accessibilityLabel={`${name} hotel card`}
    >
      {/* ---- Hero Image / Fallback ---- */}
      <View style={styles.heroContainer}>
        {heroUrl ? (
          <Image
            source={{ uri: heroUrl }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Photo of ${name}`}
          />
        ) : (
          <LinearGradient
            colors={['#1a2332', '#0f1923']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroFallback}
          >
            <Ionicons name="bed-outline" size={32} color={Colors.text.muted} />
            <Text style={styles.heroFallbackText} numberOfLines={2}>
              {name}
            </Text>
          </LinearGradient>
        )}

        {/* Gradient scrim for text legibility over image */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.heroScrim}
        />

        {/* Star rating overlay — bottom-left of hero */}
        {star_rating != null && star_rating > 0 && (
          <View style={styles.starOverlay}>
            <Text style={styles.starOverlayText}>
              {'\u2605'.repeat(Math.round(star_rating))}
            </Text>
          </View>
        )}

        {/* Safety badge — top-right, overlapping hero edge */}
        {safety_score != null && <SharedSafetyBadge score={safety_score} />}
      </View>

      {/* ---- Content ---- */}
      <View style={styles.content}>
        {/* Name + Address */}
        <Text style={styles.hotelName} numberOfLines={2} accessibilityRole="header">
          {name}
        </Text>
        {normalized_address ? (
          <Text style={styles.address} numberOfLines={1}>
            {normalized_address}
          </Text>
        ) : null}

        {/* Dual Ratings Row */}
        {(traveler_rating || ta_rating) && (
          <View style={styles.ratingsRow}>
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

        {/* Amenity Chips */}
        {visibleAmenities.length > 0 && (
          <View style={styles.amenityRow}>
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

        {/* Action Buttons */}
        <View style={styles.actions}>
          {phone ? (
            <ActionButton label="Call" icon="call-outline" onPress={handleCall} />
          ) : null}
          {(website || tripadvisor_url) ? (
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
    position: 'relative',
  },
  heroImage: {
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
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

  // Safety badge
  safetyBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      } as unknown as ViewStyle,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  safetyScore: {
    ...Typography.captionMedium,
    color: '#ffffff',
    fontWeight: '700',
  },

  // Content
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
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

export default HotelCard;
