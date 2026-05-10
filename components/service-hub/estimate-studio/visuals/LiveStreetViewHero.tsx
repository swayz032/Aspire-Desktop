/**
 * LiveStreetViewHero — live Google Street View Panorama via Maps JS API.
 *
 * Web-only path: mounts a <div> ref and instantiates
 *   new google.maps.StreetViewPanorama(...)
 * on the singleton loader from `@/lib/googleMapsLoader`. If imagery is missing
 * for the address, we fall back to a soft "no street view" upload prompt.
 *
 * Aspire Law #7: pure render. No fetches, no state mutations beyond local
 * panorama instance lifecycle.
 *
 * Aspire Law #9: never logs `coords` (PII proxy for property address).
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
  /** Optional hook for the inset to switch the parent into aerial mode. */
  onAerialPress?: () => void;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'no-imagery' | 'error';

export function LiveStreetViewHero({ coords, loading, onAerialPress }: Props) {
  const containerRef = useRef<any>(null);
  const insetRef = useRef<any>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!coords || !containerRef.current) return;

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const loaderMod = require('@/lib/googleMapsLoader');
        const loader = loaderMod.loadGoogleMaps ?? loaderMod.default ?? loaderMod;
        const google = await loader();
        if (cancelled) return;

        // Verify Street View imagery exists at coords before mounting.
        const sv = new google.maps.StreetViewService();
        sv.getPanorama({ location: coords, radius: 80 }, (_data: any, svStatus: any) => {
          if (cancelled) return;
          if (svStatus !== google.maps.StreetViewStatus.OK) {
            setStatus('no-imagery');
            return;
          }
          if (!containerRef.current) return;
          new google.maps.StreetViewPanorama(containerRef.current, {
            position: coords,
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            addressControl: false,
            fullscreenControl: false,
            motionTracking: false,
            motionTrackingControl: false,
            linksControl: false,
            zoomControl: true,
            panControl: true,
            enableCloseButton: false,
          });
          // Mount a small inset map (top-down satellite) for an aerial preview.
          if (insetRef.current) {
            const insetMap = new google.maps.Map(insetRef.current, {
              center: coords,
              zoom: 18,
              mapTypeId: 'hybrid',
              disableDefaultUI: true,
              gestureHandling: 'none',
              clickableIcons: false,
            });
            new google.maps.Marker({ position: coords, map: insetMap });
          }
          setStatus('ready');
        });
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [coords]);

  // ---- Render -------------------------------------------------------------
  if (loading || status === 'loading' || status === 'idle') {
    return (
      <View style={styles.shell} testID="live-street-view-hero-loading">
        <SheenBlock width="100%" height={400} radius={12} />
      </View>
    );
  }

  if (status === 'no-imagery') {
    return (
      <View style={[styles.shell, styles.fallbackShell]} testID="live-street-view-hero-no-imagery">
        <View style={styles.fallbackInner}>
          <View style={styles.fallbackIcon}>
            <Ionicons name="cloud-upload-outline" size={28} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.fallbackTitle}>No Street View available</Text>
          <Text style={styles.fallbackSubtitle}>
            Drop in exterior photos to continue — Tim can use them as the hero.
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.shell, styles.fallbackShell]} testID="live-street-view-hero-error">
        <View style={styles.fallbackInner}>
          <View style={[styles.fallbackIcon, { borderColor: 'rgba(255,107,107,0.25)' }]}>
            <Ionicons name="alert-circle-outline" size={28} color="#ff6b6b" />
          </View>
          <Text style={styles.fallbackTitle}>Could not load Street View</Text>
          <Text style={styles.fallbackSubtitle}>
            Check your network — we'll retry automatically when you reload.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell} testID="live-street-view-hero">
      {/* Live Maps JS panorama mount */}
      {Platform.OS === 'web' ? (
        // The Maps SDK mutates the DOM directly. We render a div via React DOM
        // by reaching into createElement on web. Wrap in a View for layout.
        React.createElement('div', {
          ref: containerRef,
          style: { width: '100%', height: '100%', borderRadius: 12 },
        })
      ) : (
        <View style={styles.shell}>
          <Text style={styles.fallbackSubtitle}>Street View preview is web-only.</Text>
        </View>
      )}

      {/* Aerial inset overlay — bottom-right */}
      {Platform.OS === 'web' && (
        <Pressable
          onPress={onAerialPress}
          accessibilityRole="button"
          accessibilityLabel="View aerial 3D"
          style={({ hovered }: any) => [
            styles.inset,
            hovered && styles.insetHover,
          ]}
        >
          {React.createElement('div', {
            ref: insetRef,
            style: {
              width: '100%',
              height: '100%',
              borderRadius: 8,
              pointerEvents: 'none',
            } as any,
          })}
          <View style={styles.insetCaption}>
            <Ionicons name="map-outline" size={11} color="#fbbf24" />
            <Text style={styles.insetCaptionText}>View Aerial</Text>
          </View>
        </Pressable>
      )}
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  fallbackInner: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 420,
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
    marginBottom: 4,
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
  inset: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 240,
    height: 152,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#0F0F12',
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
          transition: 'transform 150ms ease-out, border-color 150ms ease-out',
        } as unknown) as ViewStyle)
      : {}),
  },
  insetHover: {
    borderColor: 'rgba(251,191,36,0.55)',
    ...(Platform.OS === 'web'
      ? (({ transform: 'translateY(-2px)' } as unknown) as ViewStyle)
      : {}),
  },
  insetCaption: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  insetCaptionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
