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
  /** Optional hook for the bottom-right inset → switches parent into aerial mode. */
  onAerialPress?: () => void;
  /** Optional hook for the top-left inset → switches parent into Photorealistic 3D Tiles. */
  onEarthPress?: () => void;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'no-imagery' | 'error';

export function LiveStreetViewHero({ coords, loading, onAerialPress, onEarthPress }: Props) {
  const containerRef = useRef<any>(null);
  const insetRef = useRef<any>(null);
  const earthInsetRef = useRef<any>(null);
  // Keep a handle to the live panorama so we can fire google.maps.event
  // resize when the container size changes — without this the panorama
  // canvas stays at its init dimensions and gets upscaled (blurry) when
  // the parent heroSlot grows past the init size.
  const panoramaRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [earthAvailable, setEarthAvailable] = useState<boolean>(false);

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
        const apiKey = loaderMod.resolveBrowserMapsKey
          ? loaderMod.resolveBrowserMapsKey()
          : (process.env.EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '');
        // streetView + geometry libraries — geometry is required for
        // computeHeading() so we can point the camera AT the property.
        const google = await loader({ apiKey, libraries: ['streetView', 'geometry'] });
        if (cancelled) return;

        // Find the closest OUTDOOR Google-car panorama (filters out the
        // low-res user-uploaded indoor 360s that caused the blur). Wider
        // radius (100m) gives the SDK room to pick the best curb-side pano.
        const sv = new google.maps.StreetViewService();
        sv.getPanorama(
          {
            location: coords,
            radius: 100,
            source: google.maps.StreetViewSource.OUTDOOR,
            preference: google.maps.StreetViewPreference.NEAREST,
          },
          (panoData: any, svStatus: any) => {
            if (cancelled) return;
            if (svStatus !== google.maps.StreetViewStatus.OK) {
              setStatus('no-imagery');
              return;
            }
            if (!containerRef.current) return;
            // Camera position (on the road) → property coords gives the
            // heading needed to look AT the house instead of staring north.
            const panoLatLng = panoData?.location?.latLng;
            let heading = 0;
            if (panoLatLng && google.maps.geometry?.spherical?.computeHeading) {
              const target = new google.maps.LatLng(coords.lat, coords.lng);
              heading = google.maps.geometry.spherical.computeHeading(panoLatLng, target);
            }
            // Use `position` (not `pano`) so the SDK serves the highest-res
            // tile available at this location and the user can still click
            // arrows to walk down the street.
            //
            // zoom: 2 (was 1) — Google's Pano serves 832×832 tiles at zoom
            // 1 but 1664×1664 at zoom 2. Default zoom 1 framed the camera
            // back at the road, making the subject (the house) small and
            // soft. Zoom 2 frames the house tight + serves the higher-res
            // tile, so the house renders crisp without the user having to
            // pinch-in manually. They can still zoom out via the +/- ctrl.
            const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
              position: panoLatLng ?? coords,
              pov: { heading, pitch: 8 },
              zoom: 2,
              addressControl: false,
              fullscreenControl: false,
              motionTracking: false,
              motionTrackingControl: false,
              linksControl: true,
              zoomControl: true,
              panControl: true,
              enableCloseButton: false,
            });
            // Stash for the ResizeObserver below — fires resize on container
            // size change so the canvas re-renders at the new dimensions
            // (not upscaled / blurry from the init-time size).
            panoramaRef.current = panorama;
            googleRef.current = google;
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

            // Mount the top-left Earth View inset (Photorealistic 3D Tiles).
            // Older Maps JS versions don't ship maps3d → gracefully skip.
            (async () => {
              try {
                const maps3d: any = await (google as any).maps.importLibrary('maps3d');
                if (cancelled || !earthInsetRef.current || !maps3d?.Map3DElement) return;
                const map3d = new maps3d.Map3DElement({
                  center: { lat: coords.lat, lng: coords.lng, altitude: 100 },
                  range: 600,
                  tilt: 67.5,
                  heading: 0,
                });
                // Map3DElement is a Web Component → set styles, then append.
                map3d.style.width = '100%';
                map3d.style.height = '100%';
                map3d.style.borderRadius = '8px';
                earthInsetRef.current.appendChild(map3d);
                setEarthAvailable(true);
              } catch {
                // No maps3d on this account/version → hide the inset silently.
                if (!cancelled) setEarthAvailable(false);
              }
            })();

            setStatus('ready');
          },
        );
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // Key on the primitive lat/lng pair so the effect doesn't refire when the
    // parent passes a structurally-equal but reference-different coords obj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  // ResizeObserver — keeps the Panorama crisp when the parent heroSlot grows
  // or shrinks. Without this, the Maps JS Panorama caches the container
  // dimensions at init time and the browser upscales the cached canvas →
  // blurry pano. Firing `google.maps.event.trigger(pano, 'resize')` forces
  // the SDK to re-fetch tiles at the new container dimensions (matches the
  // canonical Maps JS pattern for size changes).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const el = containerRef.current;
    const observer = new ResizeObserver(() => {
      const pano = panoramaRef.current;
      const google = googleRef.current;
      if (!pano || !google?.maps?.event?.trigger) return;
      // Trigger Maps JS resize → re-renders at the new container size.
      // Cheap (no network) when the size hasn't actually changed.
      google.maps.event.trigger(pano, 'resize');
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- Render -------------------------------------------------------------
  // CRITICAL: the panorama mount <div> MUST be in the DOM before the effect's
  // sv.getPanorama callback fires, otherwise containerRef.current is null and
  // the panorama silently fails to mount (hero stays black forever). So we
  // render the mount divs unconditionally, then overlay loading/fallback
  // states on top via absolute positioning.
  const showLoadingOverlay = loading || status === 'loading' || status === 'idle';
  const showNoImageryOverlay = status === 'no-imagery';
  const showErrorOverlay = status === 'error';
  const showInset = Platform.OS === 'web' && status === 'ready';
  const showEarthInset = Platform.OS === 'web' && status === 'ready' && earthAvailable;

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.shell, styles.fallbackShell]}>
        <Text style={styles.fallbackSubtitle}>Street View preview is web-only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.shell} testID="live-street-view-hero">
      {/* ALWAYS-MOUNTED panorama target — Maps JS writes into this div */}
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

      {/* Loading overlay (fades the SheenBlock over the mount div) */}
      {showLoadingOverlay && (
        <View style={styles.overlayFill} pointerEvents="none" testID="live-street-view-hero-loading">
          <SheenBlock width="100%" height="100%" radius={12} />
        </View>
      )}

      {/* No-imagery overlay */}
      {showNoImageryOverlay && (
        <View
          style={[styles.overlayFill, styles.fallbackShell]}
          testID="live-street-view-hero-no-imagery"
        >
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
      )}

      {/* Error overlay */}
      {showErrorOverlay && (
        <View
          style={[styles.overlayFill, styles.fallbackShell]}
          testID="live-street-view-hero-error"
        >
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
      )}

      {/* Aerial inset overlay — bottom-right. Same chicken-and-egg as the
          panorama: inset div must be in the DOM BEFORE the Maps callback
          fires so insetRef.current is non-null. We always render the
          Pressable but hide it (opacity 0 + pointer-events none) until the
          panorama is ready, so the underlying div mounts immediately. */}
      {Platform.OS === 'web' && (
        <Pressable
          onPress={onAerialPress}
          accessibilityRole="button"
          accessibilityLabel="View aerial 3D"
          style={({ hovered }: any) => [
            styles.inset,
            hovered && styles.insetHover,
            !showInset && styles.insetHidden,
          ]}
          pointerEvents={showInset ? 'auto' : 'none'}
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
            <Ionicons name="cube-outline" size={11} color="#fbbf24" />
            <Text style={styles.insetCaptionText}>3D View</Text>
          </View>
        </Pressable>
      )}

      {/* Earth View inset overlay — top-left. Photorealistic 3D Tiles preview.
          Same chicken-and-egg: the Map3DElement parent div must be in the DOM
          before the Maps callback fires, so we always render the Pressable
          and toggle visibility via opacity + pointer-events. */}
      {Platform.OS === 'web' && (
        <Pressable
          onPress={onEarthPress}
          accessibilityRole="button"
          accessibilityLabel="Open Photorealistic 3D Earth view"
          style={({ hovered }: any) => [
            styles.earthInset,
            hovered && styles.insetHover,
            !showEarthInset && styles.insetHidden,
          ]}
          pointerEvents={showEarthInset ? 'auto' : 'none'}
        >
          {React.createElement('div', {
            ref: earthInsetRef,
            style: {
              width: '100%',
              height: '100%',
              borderRadius: 8,
              pointerEvents: 'none',
            } as any,
          })}
          <View style={styles.insetCaption}>
            <Ionicons name="globe-outline" size={11} color="#fbbf24" />
            <Text style={styles.insetCaptionText}>Earth View</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    // ╔══════════════════════════════════════════════════════════════╗
    // ║  LOCKED — DO NOT add aspectRatio here. DO NOT remove flex:1.  ║
    // ║                                                                ║
    // ║  Google Maps Street View serves tile resolution based on the  ║
    // ║  container's rendered size. A fixed aspectRatio (e.g. 12/5)   ║
    // ║  caps the container even when the heroSlot has more space —   ║
    // ║  Google then ships LOWER-resolution tiles and the pano looks  ║
    // ║  blurry. We hit this regression twice. Don't make it three.   ║
    // ║                                                                ║
    // ║  Invariants enforced by __tests__/visuals/regression-lock     ║
    // ║  Lock #13. CI fails if these drift.                            ║
    // ╚══════════════════════════════════════════════════════════════╝
    flex: 1,
    width: '100%',
    minHeight: 360,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  fallbackShell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
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
  earthInset: {
    position: 'absolute',
    left: 14,
    top: 14,
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
  insetHidden: {
    opacity: 0,
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
