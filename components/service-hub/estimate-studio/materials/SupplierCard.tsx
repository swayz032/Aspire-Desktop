/**
 * SupplierCard — premium B2B supplier tile (Pass E v2 redesign).
 *
 * Founder direction 2026-05-13:
 *   - "too much yellow" — was solid amber CTA + amber-tinted card bg
 *   - "should be black with yellow outline" — ghost CTA, deep black card
 *   - "no phone / email / website / photo" — render real contact rows + Yelp photo
 *   - "less cards per page, quality is better" — 6 max via SupplierGrid trim
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │ [photo 16:9, fallback = category tile] │
 *   ├────────────────────────────────────────┤
 *   │ Name                       ★4.8 · 123  │
 *   │ category · category                    │
 *   │ 📍 1234 Industrial Pkwy, Atlanta GA    │
 *   │ ─────────────────────────────────────  │
 *   │ 📞 (404) 555-1234   🌐 example.com     │
 *   │ ─────────────────────────────────────  │
 *   │ 0.8 mi · 4 min        [ Draft RFQ ]    │  ← ghost CTA
 *   └────────────────────────────────────────┘
 *
 * Aesthetic:
 *   - bg #0A0A0F (deep black), border 1px rgba(251,191,36,0.22)
 *   - hover border rgba(251,191,36,0.55), bg rgba(251,191,36,0.04)
 *   - photo cover-fit, 16:9, no crop bars
 *   - Draft RFQ = ghost: transparent bg, 1px amber border, amber text
 *   - phone/website are clickable on web (tel: / https://)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Linking,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Supplier } from '@/hooks/useMaterialsSearch';

interface Props {
  supplier: Supplier;
  onDraftRfq?: (supplier: Supplier) => void;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 180ms ease' } as unknown) as ViewStyle)
    : {};

function iconForSupplier(supplier: Supplier): IoniconName {
  if (supplier.iconHint) return supplier.iconHint as IoniconName;
  const cat = (supplier.category || '').toLowerCase();
  if (cat.includes('lumber') || cat.includes('wood')) return 'leaf-outline';
  if (cat.includes('concrete') || cat.includes('precast')) return 'cube-outline';
  if (cat.includes('steel') || cat.includes('rebar')) return 'hammer-outline';
  if (cat.includes('mep') || cat.includes('electrical')) return 'flash-outline';
  if (cat.includes('plumb')) return 'water-outline';
  if (cat.includes('paint')) return 'color-palette-outline';
  return 'storefront-outline';
}

function _hostname(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SupplierCard({ supplier, onDraftRfq }: Props) {
  const icon = iconForSupplier(supplier);
  const tags = supplier.tags ?? [];
  const hasRating = typeof supplier.rating === 'number' && supplier.rating > 0;
  const hasReviews = typeof supplier.reviewCount === 'number' && supplier.reviewCount > 0;
  const hasDistance = supplier.distanceMiles > 0;
  const hasDrive = supplier.driveMinutes > 0;
  const hasPhone = !!supplier.phone;
  const hasWebsite = !!supplier.website;
  const cleanAddress = (supplier.address || '').trim();
  const fullAddress = cleanAddress
    ? supplier.city
      ? `${cleanAddress}, ${supplier.city}${supplier.state ? `, ${supplier.state}` : ''}`
      : cleanAddress
    : '';

  const openPhone = React.useCallback(() => {
    if (supplier.phone) Linking.openURL(`tel:${supplier.phone.replace(/\s+/g, '')}`);
  }, [supplier.phone]);

  const openWebsite = React.useCallback(() => {
    if (!supplier.website) return;
    const url = supplier.website.startsWith('http')
      ? supplier.website
      : `https://${supplier.website}`;
    Linking.openURL(url);
  }, [supplier.website]);

  // Outer wrapper is a Pressable (without onPress) so the React Native Web
  // hover state can drive the border-glow without making the whole card act
  // like a button — phone/website/CTA inside have their own onPress.
  return (
    <Pressable
      style={({ hovered }: any) => [styles.card, WEB_TRANSITION, hovered && styles.cardHovered]}
      accessibilityRole="none"
      testID={`materials-supplier-card-${supplier.id}`}
    >
      {/* Photo header — Yelp CDN thumbnail, fallback to category icon tile */}
      {supplier.thumbnail ? (
        <Image
          source={{ uri: supplier.thumbnail }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${supplier.name} storefront photo`}
        />
      ) : (
        <View style={styles.photoFallback} accessibilityElementsHidden>
          <Ionicons name={icon} size={32} color="rgba(251,191,36,0.45)" />
        </View>
      )}

      <View style={styles.body}>
        {/* Identity row — name + rating */}
        <View style={styles.identityRow}>
          <Text style={styles.name} numberOfLines={1}>
            {supplier.name}
          </Text>
          {hasRating && (
            <View style={styles.ratingPill} accessibilityElementsHidden>
              <Ionicons name="star" size={10} color="#fbbf24" />
              <Text style={styles.ratingText}>{supplier.rating!.toFixed(1)}</Text>
              {hasReviews && (
                <Text style={styles.ratingCount}>· {supplier.reviewCount}</Text>
              )}
            </View>
          )}
        </View>

        {/* Category chip row */}
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {supplier.category.toUpperCase()}
            </Text>
          </View>
          {tags
            .filter((t) => t.toLowerCase() !== supplier.category.toLowerCase())
            .slice(0, 1)
            .map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {t.toUpperCase()}
                </Text>
              </View>
            ))}
        </View>

        {/* Address row */}
        {!!fullAddress && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.55)" />
            <Text style={styles.infoText} numberOfLines={1}>
              {fullAddress}
            </Text>
          </View>
        )}

        {/* Contact rows — only render when present */}
        {(hasPhone || hasWebsite) && (
          <View style={styles.contactRow}>
            {hasPhone && (
              <Pressable
                onPress={openPhone}
                style={({ hovered }: any) => [styles.contactPill, hovered && styles.contactPillHover]}
                accessibilityRole="link"
                accessibilityLabel={`Call ${supplier.name} at ${supplier.phone}`}
              >
                <Ionicons name="call-outline" size={11} color="#fbbf24" />
                <Text style={styles.contactText} numberOfLines={1}>
                  {supplier.phone}
                </Text>
              </Pressable>
            )}
            {hasWebsite && (
              <Pressable
                onPress={openWebsite}
                style={({ hovered }: any) => [styles.contactPill, hovered && styles.contactPillHover]}
                accessibilityRole="link"
                accessibilityLabel={`Open ${_hostname(supplier.website!)}`}
              >
                <Ionicons name="globe-outline" size={11} color="#fbbf24" />
                <Text style={styles.contactText} numberOfLines={1}>
                  {_hostname(supplier.website!)}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Footer — distance/drive on left, ghost CTA on right */}
        <View style={styles.footerRow}>
          <View style={styles.statsInline}>
            {hasDistance && (
              <Text style={styles.statText}>
                <Text style={styles.statNum}>{supplier.distanceMiles.toFixed(1)}</Text>
                <Text style={styles.statUnit}> mi</Text>
              </Text>
            )}
            {hasDistance && hasDrive && <Text style={styles.statDot}>·</Text>}
            {hasDrive && (
              <Text style={styles.statText}>
                <Text style={styles.statNum}>{supplier.driveMinutes}</Text>
                <Text style={styles.statUnit}> min</Text>
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => onDraftRfq?.(supplier)}
            style={({ hovered, pressed }: any) => [
              styles.cta,
              WEB_TRANSITION,
              hovered && styles.ctaHovered,
              pressed && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Draft RFQ for ${supplier.name}`}
            testID={`materials-supplier-card-${supplier.id}-rfq`}
          >
            <Ionicons name="document-text-outline" size={12} color="#fbbf24" />
            <Text style={styles.ctaText}>Draft RFQ</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0A0A0F',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 1px 3px rgba(0,0,0,0.30)',
        } as unknown) as ViewStyle)
      : {}),
  },
  cardHovered: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(251,191,36,0.04)',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.30), 0 0 0 1px rgba(251,191,36,0.20)',
        } as unknown) as ViewStyle)
      : {}),
  },
  photo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  photoFallback: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'rgba(251,191,36,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251,191,36,0.10)',
  },
  body: {
    padding: 14,
    gap: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    flexShrink: 0,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
  },
  ratingCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
    fontVariant: ['tabular-nums'],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  chipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    flex: 1,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.05,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    maxWidth: '100%',
  },
  contactPillHover: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  contactText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '500',
    letterSpacing: -0.05,
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  statsInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    flexShrink: 1,
  },
  statText: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
    fontVariant: ['tabular-nums'],
  },
  statNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
  },
  statUnit: {
    fontSize: 10,
    color: 'rgba(251,191,36,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statDot: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 11,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
  },
  ctaHovered: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: '#fbbf24',
  },
  ctaPressed: {
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
  },
});
