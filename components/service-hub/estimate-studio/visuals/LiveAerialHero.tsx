/**
 * LiveAerialHero — live 3D aerial view via Maps JS API (hybrid + tilt 45).
 *
 * Smooth tilt-in: starts tilt:0, animates to tilt:45 over ~600ms once the
 * map is ready. Premium reveal — never a hard pop.
 *
 * Aspire Law #7: pure render. Aspire Law #9: never logs coords.
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

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function LiveAerialHero({ coords, loading, onReturn }: Props) {
  const containerRef = useRef<any>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!coords || !containerRef.current) return;

    let cancelled = false;
    let map: any = null;
    setStatus('loading');

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const loaderMod = require('@/lib/googleMapsLoader');
        const loader = loaderMod.loadGoogleMaps ?? loaderMod.default ?? loaderMod;
        const google = await loader();
        if (cancelled || !containerRef.current) return;

        map = new google.maps.Map(containerRef.current, {
          center: coords,
          zoom: 19,
          mapTypeId: 'hybrid',
          tilt: 0,
          heading: 0,
          disableDefaultUI: true,
          zoomControl: true,
          rotateControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        new google.maps.Marker({ position: coords, map });

        // Tilt-in animation — eight 75ms steps from 0 → 45.
        const steps = [5, 12, 20, 28, 35, 40, 43, 45];
        steps.forEach((tilt, i) => {
          setTimeout(() => {
            if (!cancelled && map) map.setTilt(tilt);
          }, 60 + i * 70);
        });

        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coords]);

  if (loading || status === 'loading' || status === 'idle') {
    return (
      <View style={styles.shell} testID="live-aerial-hero-loading">
        <SheenBlock width="100%" height={400} radius={12} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.shell, styles.fallbackShell]} testID="live-aerial-hero-error">
        <View style={styles.fallbackIcon}>
          <Ionicons name="cloud-offline-outline" size={28} color="#ff6b6b" />
        </View>
        <Text style={styles.fallbackTitle}>Could not load aerial view</Text>
        <Text style={styles.fallbackSubtitle}>Try Street View instead — we&apos;ll keep retrying in the background.</Text>
      </View>
    );
  }

  return (
    <View style={styles.shell} testID="live-aerial-hero">
      {Platform.OS === 'web' ? (
        React.createElement('div', {
          ref: containerRef,
          style: { width: '100%', height: '100%', borderRadius: 12 },
        })
      ) : (
        <Text style={styles.fallbackSubtitle}>Aerial preview is web-only.</Text>
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
  fallbackIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.25)',
    backgroundColor: 'rgba(255,107,107,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
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
