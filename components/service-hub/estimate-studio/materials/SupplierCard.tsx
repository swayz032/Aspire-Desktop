/**
 * SupplierCard — Pass E premium B2B specialty-supplier card.
 *
 * Replaces the inline-rail `SupplierMatchesRail` card variant when the
 * Materials tab is in `mode='supplier'`. Wider, richer, denser. Surfaces:
 *   - 44×44 amber-tinted icon tile (category-aware Ionicon)
 *   - Company name + one-line address
 *   - Category chip row (primary + tag chips)
 *   - Distance tile, drive-time tile, rating row
 *   - Full-width "Draft RFQ" CTA (amber gradient)
 *
 * Aesthetic: matches ClosestStoreCard + Visuals locked tokens:
 *   - bg `rgba(251,191,36,0.04)`, border `rgba(251,191,36,0.22)`
 *   - hover bg `rgba(251,191,36,0.07)`, border `rgba(251,191,36,0.36)`
 *   - pressed bg `rgba(251,191,36,0.10)`
 *   - radius 12, inset box-shadow for depth
 *   - tabular-nums on all numbers
 *   - 180ms premium transitions
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Supplier } from '@/hooks/useMaterialsSearch';

interface Props {
  supplier: Supplier;
  onDraftRfq?: (supplier: Supplier) => void;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const WEB_TRANSITION_FAST: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 180ms ease' } as unknown) as ViewStyle)
    : {};

const WEB_INSET_SHADOW: ViewStyle =
  Platform.OS === 'web'
    ? (({
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 3px rgba(0,0,0,0.20)',
      } as unknown) as ViewStyle)
    : {};

/** Resolve an Ionicon name from a category string or explicit hint. */
function iconForSupplier(supplier: Supplier): IoniconName {
  if (supplier.iconHint) return supplier.iconHint as IoniconName;
  const cat = (supplier.category || '').toLowerCase();
  if (cat.includes('lumber') || cat.includes('wood')) return 'leaf-outline';
  if (cat.includes('concrete') || cat.includes('precast')) return 'cube-outline';
  if (cat.includes('steel') || cat.includes('rebar')) return 'hammer-outline';
  if (cat.includes('mep') || cat.includes('electrical')) return 'flash-outline';
  if (cat.includes('plumb')) return 'water-outline';
  return 'storefront-outline';
}

export function SupplierCard({ supplier, onDraftRfq }: Props) {
  const icon = iconForSupplier(supplier);
  const tags = supplier.tags ?? [];

  return (
    <Pressable
      style={({ hovered, pressed }: any) => [
        styles.card,
        WEB_TRANSITION_FAST,
        WEB_INSET_SHADOW,
        hovered && styles.cardHovered,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${supplier.name}, ${supplier.distanceMiles.toFixed(1)} miles, ${supplier.driveMinutes} minute drive`}
      testID={`materials-supplier-card-${supplier.id}`}
      onPress={() => onDraftRfq?.(supplier)}
    >
      <View style={styles.topRow}>
        {/* Left: icon tile */}
        <View style={styles.iconTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={icon} size={20} color="#fbbf24" />
        </View>

        {/* Middle: identity + chips */}
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {supplier.name}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
            {supplier.address}
          </Text>
          <View style={styles.chipRow}>
            <View style={styles.primaryChip}>
              <Text style={styles.primaryChipText} numberOfLines={1}>
                {supplier.category.toUpperCase()}
              </Text>
            </View>
            {tags.slice(0, 2).map((t) => (
              <View key={t} style={styles.tagChip}>
                <Text style={styles.tagChipText} numberOfLines={1}>
                  {t.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Right: stats */}
        <View style={styles.stats}>
          <View style={styles.statTile}>
            <View style={styles.statValueRow}>
              <Text style={styles.statValueLg}>{supplier.distanceMiles.toFixed(1)}</Text>
              <Text style={styles.statUnit}>mi</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <View style={styles.statValueRow}>
              <Text style={styles.statValueLg}>{supplier.driveMinutes}</Text>
              <Text style={styles.statUnit}>min</Text>
            </View>
          </View>
          {typeof supplier.rating === 'number' && supplier.rating > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={11} color="#fbbf24" />
                <Text style={styles.ratingText}>{supplier.rating.toFixed(1)}</Text>
                {typeof supplier.reviewCount === 'number' && supplier.reviewCount > 0 && (
                  <Text style={styles.ratingCount}>· {supplier.reviewCount}</Text>
                )}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Bottom row: full-width Draft RFQ CTA */}
      <Pressable
        onPress={(e) => {
          // Prevent the outer card press from also firing.
          (e as any)?.stopPropagation?.();
          onDraftRfq?.(supplier);
        }}
        style={({ hovered, pressed }: any) => [
          styles.cta,
          WEB_TRANSITION_FAST,
          hovered && styles.ctaHovered,
          pressed && styles.ctaPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Draft RFQ for ${supplier.name}`}
        testID={`materials-supplier-card-${supplier.id}-rfq`}
      >
        <Ionicons name="document-text-outline" size={13} color="#0A0A0F" />
        <Text style={styles.ctaText}>Draft RFQ</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 120,
    padding: 14,
    gap: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  cardHovered: {
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderColor: 'rgba(251,191,36,0.36)',
  },
  cardPressed: {
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    flexShrink: 0,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.15,
  },
  address: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  primaryChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  primaryChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.92)',
    letterSpacing: 1.2,
  },
  tagChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tagChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 1.2,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  statTile: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValueLg: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(251,191,36,0.65)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  ratingCount: {
    fontSize: 10.5,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fbbf24',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 2px 8px rgba(251,191,36,0.25)',
        } as unknown) as ViewStyle)
      : {}),
  },
  ctaHovered: {
    backgroundColor: '#f5a623',
    borderColor: '#f5a623',
  },
  ctaPressed: {
    backgroundColor: '#e09010',
    borderColor: '#e09010',
  },
  ctaText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0A0A0F',
    letterSpacing: 0.5,
  },
});
