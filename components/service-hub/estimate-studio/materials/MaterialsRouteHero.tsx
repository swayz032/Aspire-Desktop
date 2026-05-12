/**
 * MaterialsRouteHero — full-bleed canvas view for the route from the project
 * address to the closest Home Depot. Premium peer of Visuals tab's
 * LiveStreetViewHero / LiveHouseInspectorHero.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [← Back to results]              [ 12 min · 3.4 mi · 9:42 AM ]│   <- floating glass chrome
 *   │                                                                │
 *   │                                                                │
 *   │                                                                │
 *   │             [ full-bleed Google Maps, dark theme ]             │
 *   │                                                                │
 *   │                                                                │
 *   │                                                                │
 *   │                                       [ Open in Google Maps ↗ ]│   <- bottom-right
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Aspire Law #7: pure render. Map state lifecycle owned here (mount/unmount
 * markers + polyline). Closest store + project address come from context.
 *
 * Pass B parity note: directions polyline uses a straight-line stub until the
 * server returns a Directions API polyline. Stub kept on a dashed style so
 * it's obvious it's not turn-by-turn yet.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Linking,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMaterialsSearchContext } from './MaterialsSearchContext';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { loadGoogleMaps, resolveBrowserMapsKey } from '@/lib/googleMapsLoader';

function formatEta(driveMinutes: number, now: Date = new Date()): string {
  const arrive = new Date(now.getTime() + driveMinutes * 60_000);
  const h = arrive.getHours();
  const m = arrive.getMinutes();
  const hh12 = ((h + 11) % 12) + 1;
  const mm = m.toString().padStart(2, '0');
  return `${hh12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

export function MaterialsRouteHero() {
  const { search, setCanvasView } = useMaterialsSearchContext();
  const { address: projectAddress } = useProjectAddress();
  const store = search.closestStore;

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [bgReady, setBgReady] = useState(false);

  // ESC exits back to results — feels native on web.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCanvasView('results');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setCanvasView]);

  // Mount Google Maps once.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      setStatus('idle');
      return;
    }
    if (!store) return;

    let cancelled = false;
    setStatus('loading');
    setErrMsg(null);

    (async () => {
      try {
        const apiKey = resolveBrowserMapsKey();
        const g: any = await loadGoogleMaps({ apiKey, libraries: ['geometry'] });
        if (cancelled) return;

        const el = mapDivRef.current;
        if (!el) return;

        const geocoder = new g.maps.Geocoder();
        const [originRes, destRes] = await Promise.all([
          geocoder.geocode({ address: projectAddress || store.city || 'Austin, TX' }),
          geocoder.geocode({ address: store.address }),
        ]);
        if (cancelled) return;

        const origin = originRes.results[0]?.geometry.location;
        const dest = destRes.results[0]?.geometry.location;
        if (!origin || !dest) {
          setStatus('error');
          setErrMsg('Could not resolve coordinates.');
          return;
        }

        const map = new g.maps.Map(el, {
          center: dest,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: g.maps.ControlPosition.RIGHT_CENTER,
          },
          styles: DARK_MAP_STYLE,
          backgroundColor: '#08080c',
          gestureHandling: 'greedy',
        });
        mapRef.current = map;

        // Project pin — gold
        const originMarker = new g.maps.Marker({
          map,
          position: origin,
          title: 'Job site',
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#fbbf24',
            fillOpacity: 1,
            strokeColor: '#0a0a0f',
            strokeWeight: 3,
          },
        });

        // Store pin — green (in-stock semantics)
        const destMarker = new g.maps.Marker({
          map,
          position: dest,
          title: store.name,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#34c759',
            fillOpacity: 1,
            strokeColor: '#0a0a0f',
            strokeWeight: 3,
          },
        });
        markersRef.current = [originMarker, destMarker];

        // Straight-line stub polyline. Server-side Directions API swap is a
        // single-line replacement here.
        polylineRef.current = new g.maps.Polyline({
          map,
          path: [origin, dest],
          strokeColor: '#fbbf24',
          strokeOpacity: 0.9,
          strokeWeight: 3,
          icons: [
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
              offset: '0',
              repeat: '14px',
            },
          ],
        });

        const bounds = new g.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(dest);
        map.fitBounds(bounds, 80);

        setStatus('ready');
        // 200ms cross-fade in — per premium-seamless rule.
        requestAnimationFrame(() => setBgReady(true));
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus('error');
        setErrMsg(err instanceof Error ? err.message : 'Failed to load map.');
      }
    })();

    return () => {
      cancelled = true;
      for (const m of markersRef.current) {
        try {
          m?.setMap?.(null);
        } catch {
          /* swallow */
        }
      }
      markersRef.current = [];
      try {
        polylineRef.current?.setMap?.(null);
      } catch {
        /* swallow */
      }
      polylineRef.current = null;
      mapRef.current = null;
    };
  }, [projectAddress, store]);

  const openExternal = () => {
    if (!store) return;
    const origin = encodeURIComponent(projectAddress || '');
    const dest = encodeURIComponent(store.address);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url);
    }
  };

  if (!store) {
    // Defensive — provider effect should already have flipped us back.
    return null;
  }

  return (
    <View style={styles.hero} testID="materials-route-hero">
      {/* Full-bleed map surface */}
      {Platform.OS === 'web' ? (
        <div
          ref={mapDivRef as any}
          style={
            {
              width: '100%',
              height: '100%',
              opacity: bgReady ? 1 : 0,
              transition: 'opacity 200ms ease',
            } as any
          }
        />
      ) : (
        <View style={styles.nativeFallback}>
          <Ionicons name="map-outline" size={32} color="rgba(255,255,255,0.40)" />
          <Text style={styles.nativeFallbackText}>
            Route map available on web build.
          </Text>
        </View>
      )}

      {/* Loading / error overlay */}
      {(status === 'loading' || status === 'error') && (
        <View style={styles.overlay} pointerEvents="none">
          {status === 'loading' ? (
            <>
              <ActivityIndicator color="#fbbf24" />
              <Text style={styles.overlayText}>Loading route…</Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={22} color="#ff6b6b" />
              <Text style={styles.overlayText}>{errMsg ?? 'Map unavailable.'}</Text>
            </>
          )}
        </View>
      )}

      {/* Floating top-left: back pill */}
      <View style={styles.topLeft} pointerEvents="box-none">
        <Pressable
          onPress={() => setCanvasView('results')}
          accessibilityRole="button"
          accessibilityLabel="Back to materials results"
          testID="materials-route-back"
          style={({ hovered, pressed }: any) => [
            styles.backPill,
            hovered && styles.backPillHover,
            pressed && styles.backPillPressed,
            WEB_TRANSITION,
          ]}
        >
          <Ionicons name="arrow-back" size={14} color="rgba(255,255,255,0.92)" />
          <Text style={styles.backPillText}>Back to results</Text>
        </Pressable>
      </View>

      {/* Floating top-right: glass stats panel */}
      <View style={styles.topRight} pointerEvents="box-none">
        <View style={styles.statsGlass}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>DRIVE</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{store.driveMinutes}</Text>
              <Text style={styles.statUnit}>min</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValueSmall}>{formatEta(store.driveMinutes)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>TRAFFIC</Text>
            <Text
              style={[
                styles.statValueSmall,
                {
                  color: store.inTraffic ? '#fbbf24' : 'rgba(140,220,160,0.95)',
                },
              ]}
            >
              {store.inTraffic ? 'Live' : 'Free'}
            </Text>
          </View>
        </View>
      </View>

      {/* Floating bottom-right: open native maps */}
      <View style={styles.bottomRight} pointerEvents="box-none">
        <Pressable
          onPress={openExternal}
          accessibilityRole="button"
          accessibilityLabel="Open route in Google Maps"
          testID="materials-route-open-external"
          style={({ hovered, pressed }: any) => [
            styles.externalBtn,
            hovered && styles.externalBtnHover,
            pressed && styles.externalBtnPressed,
            WEB_TRANSITION,
          ]}
        >
          <Ionicons name="navigate-outline" size={13} color="#0a0a0f" />
          <Text style={styles.externalBtnText}>Open in Google Maps</Text>
          <Ionicons name="open-outline" size={12} color="#0a0a0f" />
        </Pressable>
      </View>
    </View>
  );
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'all 180ms ease' } as unknown) as ViewStyle)
    : {};

const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#0d0d12' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9c9ca8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0d12' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1e26' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c2c36' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#08080c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    backgroundColor: '#08080c',
    position: 'relative',
    overflow: 'hidden',
  },
  nativeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nativeFallbackText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },

  // Top-left back pill
  topLeft: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(12,12,18,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? (({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.30)',
        } as unknown) as ViewStyle)
      : {}),
  },
  backPillHover: {
    backgroundColor: 'rgba(20,20,28,0.86)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  backPillPressed: {
    backgroundColor: 'rgba(28,28,38,0.92)',
  },
  backPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },

  // Top-right glass stats panel
  topRight: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  statsGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(12,12,18,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? (({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.32)',
        } as unknown) as ViewStyle)
      : {}),
  },
  statTile: {
    alignItems: 'flex-start',
    gap: 2,
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
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
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  statValueSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  statUnit: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  // Bottom-right external open
  bottomRight: {
    position: 'absolute',
    bottom: 14,
    right: 14,
  },
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 6px 18px rgba(251,191,36,0.28)',
        } as unknown) as ViewStyle)
      : {}),
  },
  externalBtnHover: {
    backgroundColor: '#fbc83d',
  },
  externalBtnPressed: {
    backgroundColor: '#e6ac1f',
  },
  externalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a0a0f',
    letterSpacing: -0.1,
  },
});
