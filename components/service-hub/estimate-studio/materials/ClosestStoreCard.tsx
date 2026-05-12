/**
 * ClosestStoreCard — surfaces the closest Home Depot inline above the grid.
 * Used inside the Materials tab when results are present.
 *
 * Premium card with hairline border, gold drive-time, action chip to open
 * RouteMapModal.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClosestStore } from '@/hooks/useMaterialsSearch';

interface Props {
  store: ClosestStore;
  onRoutePress?: () => void;
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 200ms ease' } as unknown) as ViewStyle)
    : {};

export function ClosestStoreCard({ store, onRoutePress }: Props) {
  return (
    <View style={styles.card} testID="materials-closest-store-card">
      <View style={styles.iconWrap}>
        <Ionicons name="storefront-outline" size={16} color="#fbbf24" />
      </View>

      <View style={styles.info}>
        <Text style={styles.label}>Closest Supplier</Text>
        <Text style={styles.name} numberOfLines={1}>
          {store.name}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {store.address}
        </Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statTile}>
          <Text style={styles.statLabel}>Drive</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{store.driveMinutes}</Text>
            <Text style={styles.statUnit}>min</Text>
          </View>
          {store.inTraffic && <Text style={styles.statSub}>w/ traffic</Text>}
        </View>

        <Pressable
          onPress={onRoutePress}
          style={({ hovered, pressed }: any) => [
            styles.routeBtn,
            hovered && styles.routeBtnHovered,
            pressed && styles.routeBtnPressed,
            WEB_TRANSITION,
          ]}
          accessibilityRole="button"
          accessibilityLabel="View route to closest store"
          testID="materials-view-route-btn"
        >
          <Ionicons name="map" size={12} color="#fbbf24" />
          <Text style={styles.routeBtnText}>VIEW ROUTE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  info: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.1,
  },
  address: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statTile: {
    alignItems: 'flex-end',
    gap: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    lineHeight: 20,
  },
  statUnit: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0.2,
  },
  statSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.2,
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  routeBtnHovered: {
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderColor: 'rgba(251,191,36,0.42)',
  },
  routeBtnPressed: {
    backgroundColor: 'rgba(251,191,36,0.22)',
  },
  routeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 1.0,
  },
});
