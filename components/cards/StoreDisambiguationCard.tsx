import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
// IMPORTANT: do NOT import `registerCard` at runtime here. CardRegistry
// already imports this module and calls registerCard for it — adding a
// self-registration here creates a circular import that triggers a TDZ
// at the bundler level: when CardRegistry's `var l = r(d[5])` import
// resolves this module during init, the module would call back into
// CardRegistry's `registerCard` BEFORE its `const CARD_MAP = new Map`
// has been initialized. Result: blank-white production page with
// `ReferenceError: Cannot access 'p' before initialization`.
import type { CardProps } from './CardRegistry';

/**
 * StoreDisambiguationCard — renders a single Home Depot candidate from a
 * StoreDisambiguation artifact (Wave A.5 / Task #32).
 *
 * Backend returns artifact_type="StoreDisambiguation" when multiple HD stores
 * exist in the requested city and Ava cannot auto-resolve. records[] carries
 * one candidate per entry (card_kind="store_candidate").
 *
 * Tap "Choose this store" → fires onAction('pick_store', { store_id }) which
 * the parent AdamCardsRenderer/ResearchModal wires to a follow-up invoke_adam
 * with the chosen store_id so the next price-check query uses the right store.
 *
 * Layout: vertical 500x580 (BaseCard default).
 * Hero: storefront icon + gradient (no photo available for candidates).
 */
export function StoreDisambiguationCard({
  record,
  onAction,
  isActive,
  enterDelay,
  orientation,
}: CardProps) {
  const storeId: string = typeof record.store_id === 'string' ? record.store_id : '';
  const name: string = typeof record.name === 'string' && record.name.trim()
    ? record.name.trim()
    : 'Home Depot';
  const street: string = typeof record.address === 'string' && record.address.trim()
    ? record.address.trim()
    : typeof record.street === 'string' && record.street.trim()
    ? record.street.trim()
    : '';
  const city: string = typeof record.city === 'string' ? record.city : '';
  const state: string = typeof record.state === 'string' ? record.state : '';
  const distanceMiles: number | null =
    typeof record.distance_miles === 'number' ? record.distance_miles : null;

  const addressLine = [street, city, state].filter(Boolean).join(', ');

  const handlePick = useCallback(() => {
    onAction('pick_store' as any, { ...record, store_id: storeId });
  }, [onAction, record, storeId]);

  const heroSlot = (
    <LinearGradient
      colors={Colors.gradient.cardHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    >
      <View style={styles.heroContent}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="storefront-outline" size={52} color={Colors.accent.cyan} />
        </View>
        {storeId ? (
          <View style={styles.storeIdPill}>
            <Text style={styles.storeIdText}>Store #{storeId}</Text>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );

  const actionSlot = (
    <ActionButton
      label="Choose this store"
      icon="checkmark-circle-outline"
      onPress={handlePick}
      variant="primary"
    />
  );

  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={heroSlot}
      heroStyle={styles.heroStyle}
      actionSlot={actionSlot}
      accessibilityLabel={`Home Depot store candidate: ${name}`}
      enterDelay={enterDelay}
      orientation={orientation ?? 'vertical'}
      testID={`store-disambiguation-candidate-${storeId}`}
    >
      <Text
        style={styles.storeName}
        numberOfLines={2}
        accessibilityRole="header"
        testID={`store-disambiguation-name-${storeId}`}
      >
        {name}
      </Text>

      {addressLine ? (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={14} color={Colors.text.muted} />
          <Text
            style={styles.addressText}
            numberOfLines={2}
            testID={`store-disambiguation-street-${storeId}`}
          >
            {addressLine}
          </Text>
        </View>
      ) : null}

      {distanceMiles !== null ? (
        <View style={styles.distanceRow}>
          <Ionicons name="navigate-outline" size={14} color={Colors.accent.cyan} />
          <Text style={styles.distanceText}>
            {distanceMiles.toFixed(1)} miles away
          </Text>
        </View>
      ) : (
        <View style={styles.distanceRow}>
          <Ionicons name="navigate-outline" size={14} color={Colors.text.muted} />
          <Text style={styles.nearbyText}>Nearby</Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.hdBrandRow}>
        <Ionicons name="home-outline" size={16} color={Colors.text.muted} />
        <Text style={styles.hdBrandText}>The Home Depot</Text>
      </View>

      <Text style={styles.hintText}>
        Tap "Choose this store" and your next search will use this location.
      </Text>
    </BaseCard>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heroStyle: {
    height: 180,
    aspectRatio: undefined,
  },
  heroContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  heroIconWrap: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  storeIdPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: BorderRadius.sm,
  },
  storeIdText: {
    ...Typography.small,
    color: Colors.text.secondary,
    letterSpacing: 0.5,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  addressText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  distanceText: {
    ...Typography.captionMedium,
    color: Colors.accent.cyan,
  },
  nearbyText: {
    ...Typography.captionMedium,
    color: Colors.text.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface.cardBorder,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  hdBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  hdBrandText: {
    ...Typography.small,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  hintText: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

// Registration moved to CardRegistry.ts (one-way import).
// Self-registration here creates a circular import — see top-of-file comment.
// CardRegistry.ts:148 calls registerCard('StoreDisambiguation', StoreDisambiguationCard).

export default StoreDisambiguationCard;
