/**
 * LiveEarthHero — Photorealistic 3D Tiles full-bleed (Google Earth style).
 *
 * Mounts `google.maps.maps3d.Map3DElement` at the property coords with a
 * premium reveal:
 *   1. Mount at tilt:0 (top-down) and the SheenBlock skeleton overlaying.
 *   2. After ~120ms, hide the skeleton and animate tilt 0 → 67.5 over 800ms
 *      via `flyCameraTo`.
 *   3. Once the tilt-in lands, kick off `flyCameraAround` for one slow 30s
 *      orbit so the property sells itself the moment the user lands here.
 *
 * If `Map3DElement` (or `flyCameraAround`) is unavailable on the loaded Maps
 * JS version, we render the unavailable fallback — no crash.
 *
 * Aspire Law #7: pure render. Aspire Law #9: never logs `coords`.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheenBlock } from './InsightCardBase';

interface Props {
  coords?: { lat: number; lng: number };
  loading: boolean;
  onReturn?: () => void;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

const REVEAL_DELAY_MS = 120;
const TILT_DURATION_MS = 800;
const ORBIT_DURATION_MS = 30000;

export function LiveEarthHero({ coords, loading, onReturn }: Props) {
  const containerRef = useRef<any>(null);
  const map3dRef = useRef<any>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!coords || !containerRef.current) return;

    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | null = null;
    let orbitTimer: ReturnType<typeof setTimeout> | null = null;

    setStatus('loading');

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const loaderMod = require('@/lib/googleMapsLoader');
        const loader = loaderMod.loadGoogleMaps ?? loaderMod.default ?? loaderMod;
        const apiKey = loaderMod.resolveBrowserMapsKey
          ? loaderMod.resolveBrowserMapsKey()
          : (process.env.EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '');
        const google = await loader({ apiKey, libraries: ['maps3d'] });
        if (cancelled || !containerRef.current) return;

        const maps3d: any = await (google as any).maps.importLibrary('maps3d');
        if (cancelled || !maps3d?.Map3DElement) {
          setStatus('unavailable');
          return;
        }

        // 1. Mount top-down (tilt 0) so the reveal is dramatic.
        const map3d = new maps3d.Map3DElement({
          center: { lat: coords.lat, lng: coords.lng, altitude: 100 },
          range: 400,
          tilt: 0,
          heading: 0,
        });
        map3d.style.width = '100%';
        map3d.style.height = '100%';
        map3d.style.borderRadius = '12px';
        containerRef.current.appendChild(map3d);
        map3dRef.current = map3d;

        // 2. Animate tilt 0 → 67.5 after a short settle.
        revealTimer = setTimeout(() => {
          if (cancelled || !map3dRef.current) return;
          try {
            if (typeof map3dRef.current.flyCameraTo === 'function') {
              map3dRef.current.flyCameraTo({
                endCamera: {
                  center: { lat: coords.lat, lng: coords.lng, altitude: 100 },
                  range: 400,
                  tilt: 67.5,
                  heading: 0,
                },
                durationMillis: TILT_DURATION_MS,
              });
            } else {
              // Older API surface — set tilt directly, no animation.
              map3dRef.current.tilt = 67.5;
            }
          } catch {
            /* swallow — non-fatal animation failure */
          }
          setStatus('ready');

          // 3. After tilt lands, kick off one slow orbit.
          orbitTimer = setTimeout(() => {
            if (cancelled || !map3dRef.current) return;
            try {
              if (typeof map3dRef.current.flyCameraAround === 'function') {
                map3dRef.current.flyCameraAround({
                  camera: {
                    center: { lat: coords.lat, lng: coords.lng, altitude: 100 },
                    range: 400,
                    tilt: 67.5,
                    heading: 0,
                  },
                  durationMillis: ORBIT_DURATION_MS,
                  rounds: 1,
                });
              }
            } catch {
              /* swallow — orbit is purely decorative */
            }
          }, TILT_DURATION_MS + 80);
        }, REVEAL_DELAY_MS);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (revealTimer) clearTimeout(revealTimer);
      if (orbitTimer) clearTimeout(orbitTimer);
      // Detach the Map3DElement on unmount so we don't leak WebGL contexts.
      if (map3dRef.current && containerRef.current?.contains?.(map3dRef.current)) {
        try {
          containerRef.current.removeChild(map3dRef.current);
        } catch {
          /* swallow */
        }
      }
      map3dRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.shell, styles.fallbackShell]}>
        <Text style={styles.fallbackSubtitle}>Earth View is web-only.</Text>
      </View>
    );
  }

  const showSkeleton = loading || status === 'idle' || status === 'loading';
  const showUnavailable = status === 'unavailable';
  const showError = status === 'error';

  return (
    <View style={styles.shell} testID="live-earth-hero">
      {React.createElement('div', {
        ref: containerRef,
        style: {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          borderRadius: 12,
          backgroundColor: '#0F0F12',
        },
      })}

      {showSkeleton && (
        <View style={styles.overlayFill} pointerEvents="none" testID="live-earth-hero-loading">
          <SheenBlock width="100%" height="100%" radius={12} />
        </View>
      )}

      {showUnavailable && (
        <View
          style={[styles.overlayFill, styles.fallbackShell]}
          testID="live-earth-hero-unavailable"
        >
          <View style={styles.fallbackIcon}>
            <Ionicons name="globe-outline" size={28} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.fallbackTitle}>3D Earth view not available</Text>
          <Text style={styles.fallbackSubtitle}>
            Photorealistic 3D Tiles aren&apos;t enabled — try Aerial or Street View.
          </Text>
        </View>
      )}

      {showError && (
        <View style={[styles.overlayFill, styles.fallbackShell]} testID="live-earth-hero-error">
          <View style={[styles.fallbackIcon, styles.fallbackIconError]}>
            <Ionicons name="cloud-offline-outline" size={28} color="#ff6b6b" />
          </View>
          <Text style={styles.fallbackTitle}>Could not load 3D Earth view</Text>
          <Text style={styles.fallbackSubtitle}>
            Try Street View instead — we&apos;ll keep retrying in the background.
          </Text>
        </View>
      )}

      {/* Return-to-Street-View pill — top-right */}
      <Pressable
        onPress={onReturn}
        accessibilityRole="button"
        accessibilityLabel="Return to Street View"
        style={({ hovered }: any) => [styles.returnPill, hovered && styles.returnPillHover]}
      >
        <Ionicons name="walk-outline" size={12} color="#fbbf24" />
        <Text style={styles.returnPillText}>Return to Street View</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    aspectRatio: 12 / 5,
    minHeight: 360,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
    position: 'relative',
  },
  fallbackShell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  overlayFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
  },
  fallbackIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIconError: {
    borderColor: 'rgba(255,107,107,0.25)',
    backgroundColor: 'rgba(255,107,107,0.05)',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.2,
  },
  fallbackSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 420,
  },
  returnPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          transition: 'border-color 150ms ease-out, transform 150ms ease-out',
        } as unknown) as ViewStyle)
      : {}),
  },
  returnPillHover: {
    borderColor: 'rgba(251,191,36,0.65)',
    ...(Platform.OS === 'web'
      ? (({ transform: 'translateY(-1px)' } as unknown) as ViewStyle)
      : {}),
  },
  returnPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.1,
  },
});
