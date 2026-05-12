/**
 * RouteMapModal — Google Maps embed of the route from the project address to
 * the closest Home Depot. Pass B renders a straight-line stub via Maps JS API.
 * Pass C replaces the polyline with a real Directions API route.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClosestStore } from '@/hooks/useMaterialsSearch';
import { loadGoogleMaps, resolveBrowserMapsKey } from '@/lib/googleMapsLoader';

interface Props {
  visible: boolean;
  onClose: () => void;
  projectAddress: string;
  store: ClosestStore | null;
}

export function RouteMapModal({ visible, onClose, projectAddress, store }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') {
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
          styles: DARK_MAP_STYLE,
        });

        new g.maps.Marker({
          map,
          position: origin,
          title: 'Job site',
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#fbbf24',
            fillOpacity: 1,
            strokeColor: '#0a0a0f',
            strokeWeight: 2,
          },
        });

        new g.maps.Marker({
          map,
          position: dest,
          title: store.name,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#34c759',
            fillOpacity: 1,
            strokeColor: '#0a0a0f',
            strokeWeight: 2,
          },
        });

        // Pass B stub: straight-line polyline. Pass C swaps for Directions API.
        new g.maps.Polyline({
          map,
          path: [origin, dest],
          strokeColor: '#fbbf24',
          strokeOpacity: 0.85,
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
        map.fitBounds(bounds, 60);

        setStatus('ready');
      } catch (err: any) {
        if (cancelled) return;
        setStatus('error');
        setErrMsg(err?.message ?? 'Failed to load map.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, projectAddress, store]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="route-map-backdrop">
        <Pressable
          style={styles.card}
          onPress={(e: any) => e.stopPropagation?.()}
          testID="route-map-modal"
        >
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>Route to Closest Supplier</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {store ? `${store.name} · ${store.driveMinutes} min` : ''}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }: any) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Close route map"
              testID="route-map-close"
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>

          <View style={styles.mapArea}>
            {Platform.OS === 'web' ? (
              <div
                ref={mapDivRef as any}
                style={{ width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden' } as any}
              />
            ) : (
              <View style={styles.nativeFallback}>
                <Ionicons name="map-outline" size={28} color="rgba(255,255,255,0.40)" />
                <Text style={styles.nativeFallbackText}>
                  Route map available on web build.
                </Text>
              </View>
            )}

            {status === 'loading' && (
              <View style={styles.overlay}>
                <ActivityIndicator color="#fbbf24" />
                <Text style={styles.overlayText}>Loading map…</Text>
              </View>
            )}
            {status === 'error' && (
              <View style={styles.overlay}>
                <Ionicons name="alert-circle-outline" size={20} color="#ff6b6b" />
                <Text style={styles.overlayText}>{errMsg ?? 'Map unavailable.'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.footer}>
            Straight-line preview. Live turn-by-turn lands in Pass C.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#101015' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0a8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#101015' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#202028' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c2c36' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c0c14' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const cardStyle: ViewStyle = {
  width: '100%',
  maxWidth: 720,
  backgroundColor: '#0c0c12',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
  overflow: 'hidden',
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: cardStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.1,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  mapArea: {
    width: '100%',
    height: 380,
    backgroundColor: '#08080c',
    position: 'relative',
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
    backgroundColor: 'rgba(8,8,12,0.65)',
  },
  overlayText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
