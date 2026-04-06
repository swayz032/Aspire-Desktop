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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';

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

function domainOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/** Pick an icon for the business category */
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

export function BusinessCard({ record, onAction, isActive }: CardProps) {
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
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    }
    onAction('call', record);
  }, [phone, onAction, record]);

  const handleWebsite = useCallback(() => {
    if (website) {
      Linking.openURL(website).catch(() => {});
    }
    onAction('visit', record);
  }, [website, onAction, record]);

  const handleDetails = useCallback(() => {
    onAction('details', record);
  }, [onAction, record]);

  return (
    <View
      style={[styles.card, isActive && styles.cardActive]}
      accessibilityRole="summary"
      accessibilityLabel={`${name} business card`}
    >
      {/* ---- Hero Area ---- */}
      <LinearGradient
        colors={['#161b22', '#0f1318']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
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

      {/* ---- Content ---- */}
      <View style={styles.content}>
        {/* Address */}
        {normalized_address ? (
          <View style={styles.infoRow}>
            <Ionicons
              name="location-outline"
              size={16}
              color={Colors.text.muted}
            />
            <Text style={styles.infoText} numberOfLines={2}>
              {normalized_address}
            </Text>
          </View>
        ) : null}

        {/* Phone */}
        {phone ? (
          <Pressable
            style={styles.infoRow}
            onPress={() => Linking.openURL(`tel:${phone}`).catch(() => {})}
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
            onPress={() => Linking.openURL(website).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`Visit ${domain}`}
          >
            <Ionicons name="globe-outline" size={16} color={Colors.accent.cyan} />
            <Text style={[styles.infoText, styles.infoLink]} numberOfLines={1}>
              {domain}
            </Text>
          </Pressable>
        ) : null}

        {/* Status pills row: Open/Closed + Distance */}
        {(open_now != null || distance_miles != null) && (
          <View style={styles.pillsRow}>
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

        {/* Actions */}
        <View style={styles.actions}>
          {phone ? (
            <ActionButton label="Call" icon="call-outline" onPress={handleCall} />
          ) : null}
          {website ? (
            <ActionButton
              label="Website"
              icon="globe-outline"
              onPress={handleWebsite}
            />
          ) : null}
          <ActionButton
            label="Details"
            icon="chevron-forward"
            onPress={handleDetails}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CARD_WIDTH = 500;
const HERO_HEIGHT = 160;

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
  hero: {
    width: '100%' as unknown as number,
    height: HERO_HEIGHT,
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

  // Content
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    minHeight: 24,
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
  },
  hours: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
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

export default BusinessCard;
