import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL, safeCallPhone } from '@/lib/safeOpenURL';
import { renderStars, domainOf } from './helpers';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';

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

export function BusinessCard({ record, onAction, isActive, enterDelay }: CardProps) {
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
  } = record;

  const domain = domainOf(website);
  const icon = categoryIcon(category);

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

  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={heroContent}
      heroStyle={HERO_STYLE}
      actionSlot={actionContent}
      accessibilityLabel={`${name} business card`}
      enterDelay={enterDelay}
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

export default BusinessCard;
