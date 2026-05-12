/**
 * MaterialsRouteContextCard — Tim Rail Context-tab card. Premium tier:
 *
 *   ┌────────────────────────────────────────┐
 *   │ TODAY'S ROUTE                          │
 *   ├────────────────────────────────────────┤
 *   │   12  min        [ LIGHT TRAFFIC ]     │
 *   │   tabular-nums                         │
 *   │   Arrive by 9:42 AM                    │
 *   │   ───────────────────────────────────  │
 *   │   Home Depot                           │
 *   │   3030 N Cole Rd, Boise, ID            │
 *   │   ───────────────────────────────────  │
 *   │   [ View route on canvas ➜ ]           │
 *   └────────────────────────────────────────┘
 *
 * Single tap target. No duplicates. Tap → canvasView swaps to 'route'
 * (full-bleed LiveRouteHero takes over the canvas). Exit via the back
 * pill floating over the hero.
 *
 * Null-safe: returns null when not on the Materials route (provider
 * absent) so TimRailContextTab can mount it unconditionally.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMaterialsSearchContextOptional } from '../materials/MaterialsSearchContext';

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 180ms ease' } as unknown) as ViewStyle)
    : {};

function formatEta(driveMinutes: number, now: Date = new Date()): string {
  const arrive = new Date(now.getTime() + driveMinutes * 60_000);
  const h = arrive.getHours();
  const m = arrive.getMinutes();
  const hh12 = ((h + 11) % 12) + 1;
  const mm = m.toString().padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hh12}:${mm} ${ampm}`;
}

function trafficChip(inTraffic: boolean): {
  label: string;
  fg: string;
  bg: string;
  border: string;
} {
  // ClosestStore.inTraffic from the contract = "drive time reflects current
  // traffic"; we don't yet have raw duration_in_traffic vs duration, so a
  // binary chip is the honest signal until the server returns delta.
  if (inTraffic) {
    return {
      label: 'LIVE TRAFFIC',
      fg: '#fbbf24',
      bg: 'rgba(251,191,36,0.10)',
      border: 'rgba(251,191,36,0.32)',
    };
  }
  return {
    label: 'FREE FLOW',
    fg: 'rgba(140,220,160,0.95)',
    bg: 'rgba(120,200,140,0.08)',
    border: 'rgba(120,200,140,0.28)',
  };
}

export function MaterialsRouteContextCard() {
  const ctx = useMaterialsSearchContextOptional();

  // Tick the ETA every 30s so "Arrive by HH:MM" stays honest.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const eta = useMemo(() => {
    if (!ctx?.search.closestStore) return null;
    return formatEta(ctx.search.closestStore.driveMinutes);
    // nowTick intentionally in deps so the time re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.search.closestStore?.driveMinutes, nowTick]);

  if (!ctx) return null;

  const closest = ctx.search.closestStore;

  return (
    <View style={styles.section} testID="tim-context-materials-route">
      <View style={styles.header}>
        <Ionicons name="navigate-circle-outline" size={13} color="rgba(251,191,36,0.85)" />
        <Text style={styles.title}>TODAY&rsquo;S ROUTE</Text>
      </View>

      {closest ? (
        <Pressable
          onPress={() => ctx.setCanvasView('route')}
          accessibilityRole="button"
          accessibilityLabel={`View route to ${closest.name}, ${closest.driveMinutes} minute drive`}
          testID="tim-context-route-card"
          style={({ hovered, pressed }: any) => [
            styles.card,
            hovered && styles.cardHover,
            pressed && styles.cardPressed,
            WEB_TRANSITION,
          ]}
        >
          {/* Hero stat row: drive time + traffic chip */}
          <View style={styles.heroRow}>
            <View style={styles.driveStat}>
              <Text style={styles.driveValue}>{closest.driveMinutes}</Text>
              <Text style={styles.driveUnit}>min</Text>
            </View>
            <TrafficPill inTraffic={!!closest.inTraffic} />
          </View>

          {/* ETA */}
          {eta && (
            <Text style={styles.eta}>
              Arrive by <Text style={styles.etaTime}>{eta}</Text>
            </Text>
          )}

          <View style={styles.divider} />

          {/* Store identity */}
          <View style={styles.storeBlock}>
            <View style={styles.storeIconWrap}>
              <Ionicons name="storefront-outline" size={14} color="#fbbf24" />
            </View>
            <View style={styles.storeText}>
              <Text style={styles.storeName} numberOfLines={1}>
                {closest.name}
              </Text>
              <Text style={styles.storeAddress} numberOfLines={2}>
                {closest.address}
                {closest.city ? `, ${closest.city}` : ''}
                {closest.state ? `, ${closest.state}` : ''}
              </Text>
              {closest.phone && (
                <Text style={styles.storePhone} numberOfLines={1}>
                  {closest.phone}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Single CTA (the whole card is also tappable; this is the visible
              affordance) */}
          <View style={styles.cta}>
            <Ionicons name="map" size={13} color="#fbbf24" />
            <Text style={styles.ctaText}>View route on canvas</Text>
            <Ionicons name="arrow-forward" size={13} color="#fbbf24" />
          </View>
        </Pressable>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.45)" />
          <Text style={styles.emptyText}>
            Run a search to surface the closest depot + traffic-aware drive time.
          </Text>
        </View>
      )}
    </View>
  );
}

function TrafficPill({ inTraffic }: { inTraffic: boolean }) {
  const t = trafficChip(inTraffic);
  return (
    <View
      style={[
        styles.trafficPill,
        { backgroundColor: t.bg, borderColor: t.border },
      ]}
    >
      <View style={[styles.trafficDot, { backgroundColor: t.fg }]} />
      <Text style={[styles.trafficLabel, { color: t.fg }]}>{t.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },

  // The full card is a single tap target.
  card: {
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow:
            '0 1px 0 rgba(251,191,36,0.06) inset, 0 4px 14px rgba(0,0,0,0.20)',
        } as unknown) as ViewStyle)
      : {}),
  },
  cardHover: {
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderColor: 'rgba(251,191,36,0.36)',
  },
  cardPressed: {
    backgroundColor: 'rgba(251,191,36,0.10)',
  },

  // Hero stat row
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  driveStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  driveValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  driveUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.2,
  },

  // Traffic chip
  trafficPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  trafficDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  trafficLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
  },

  eta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  etaTime: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Store identity
  storeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  storeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  storeText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  storeName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.1,
  },
  storeAddress: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
    lineHeight: 14,
  },
  storePhone: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },

  // Single visible CTA
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Empty
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  emptyText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 15,
  },
});
