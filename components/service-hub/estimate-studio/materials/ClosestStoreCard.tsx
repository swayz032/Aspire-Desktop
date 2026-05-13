/**
 * ClosestStoreCard — surfaces the closest Home Depot inline above the grid.
 * Used inside the Materials tab when results are present.
 *
 * Bug B fix (2026-05-13): drive_minutes is now an int from the backend
 * (resolved via Distance Matrix). When null (Distance Matrix failed or not
 * yet resolved), render "—" instead of "0" so the user is not misled.
 *
 * Pass F (2026-05-13): phone + hours enrichment from Google Places.
 *   - phone: tappable (tel: link on web, Linking.openURL on native)
 *   - hours_open_now + current_status → OPEN / CLOSING SOON / CLOSED chip
 *   - hours_today: "🕒 6 AM - 10 PM" mini row
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  type ViewStyle,
} from 'react-native';
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
  const driveDisplay =
    typeof store.driveMinutes === 'number' && store.driveMinutes > 0
      ? String(store.driveMinutes)
      : '—';

  // Pass F: phone handling
  const phone = (store as any).phone as string | undefined;
  const hoursOpenNow = (store as any).hours_open_now as boolean | undefined;
  const hoursToday = (store as any).hours_today as string | undefined;
  const currentStatus = (store as any).current_status as
    | 'OPEN'
    | 'CLOSING_SOON'
    | 'CLOSED'
    | undefined;

  function _openPhone() {
    if (!phone) return;
    const tel = `tel:${phone.replace(/[^+\d]/g, '')}`;
    if (Platform.OS === 'web') {
      window.open(tel, '_self');
    } else {
      Linking.openURL(tel);
    }
  }

  // Status chip config
  const statusChipVisible = currentStatus !== undefined;
  const statusLabel =
    currentStatus === 'CLOSING_SOON'
      ? 'CLOSING SOON'
      : currentStatus === 'CLOSED'
      ? 'CLOSED'
      : 'OPEN';
  const statusColor =
    currentStatus === 'CLOSING_SOON'
      ? '#fbbf24'
      : currentStatus === 'CLOSED'
      ? '#ff6b6b'
      : '#34c759';
  const statusBg =
    currentStatus === 'CLOSING_SOON'
      ? 'rgba(251,191,36,0.14)'
      : currentStatus === 'CLOSED'
      ? 'rgba(255,107,107,0.14)'
      : 'rgba(52,199,89,0.14)';
  const statusBorder =
    currentStatus === 'CLOSING_SOON'
      ? 'rgba(251,191,36,0.36)'
      : currentStatus === 'CLOSED'
      ? 'rgba(255,107,107,0.36)'
      : 'rgba(52,199,89,0.36)';

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

        {/* Status chip */}
        {statusChipVisible && (
          <View style={[
            styles.statusChip,
            { backgroundColor: statusBg, borderColor: statusBorder },
          ]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {hoursToday ? `${statusLabel} · ${hoursToday}` : statusLabel}
            </Text>
          </View>
        )}

        {/* Phone */}
        {phone ? (
          <Pressable
            onPress={_openPhone}
            style={({ hovered, pressed }: any) => [
              styles.phoneRow,
              hovered && styles.phoneRowHovered,
              pressed && styles.phoneRowPressed,
              WEB_TRANSITION,
            ]}
            accessibilityRole="link"
            accessibilityLabel={`Call ${store.name}: ${phone}`}
            testID="materials-store-phone"
          >
            <Ionicons name="call-outline" size={10} color="rgba(255,255,255,0.55)" />
            <Text style={styles.phoneText}>{phone}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.stats}>
        <View style={styles.statTile}>
          <Text style={styles.statLabel}>Drive</Text>
          <View style={styles.statValueRow}>
            <Text style={styles.statValue}>{driveDisplay}</Text>
            {driveDisplay !== '—' && <Text style={styles.statUnit}>min</Text>}
          </View>
          {store.inTraffic && driveDisplay !== '—' && (
            <Text style={styles.statSub}>w/ traffic</Text>
          )}
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
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    ...(Platform.OS === 'web'
      ? (({ boxShadow: '0 1px 0 rgba(251,191,36,0.06) inset, 0 4px 12px rgba(0,0,0,0.18)' } as unknown) as ViewStyle)
      : {}),
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
    marginTop: 2,
  },
  info: {
    flex: 1,
    gap: 3,
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

  // Status chip
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    marginTop: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Phone
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  phoneRowHovered: {
    opacity: 0.75,
  },
  phoneRowPressed: {
    opacity: 0.6,
  },
  phoneText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    paddingTop: 2,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    lineHeight: 24,
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
