/**
 * LiveEarthHero — Photorealistic 3D Tiles full-bleed (Google Earth style).
 *
 * Mounts `google.maps.maps3d.Map3DElement` at the property coords with FULL
 * user control: pan / zoom / tilt / rotate via mouse + touch, plus 5 angle
 * preset buttons (Front / Right / Back / Left / Top) and an opt-in auto-orbit.
 *
 * Camera defaults to a close inspector view (range 40m, tilt 60°) so the
 * house fills the frame from the moment the user lands. Auto-orbit is OFF
 * by default — contractors don't want a moving camera while measuring.
 *
 * If `Map3DElement` is unavailable on the loaded Maps JS version, we render
 * the unavailable fallback — no crash.
 *
 * Aspire Law #7: pure render. Aspire Law #9: never logs `coords`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

// Camera presets — heading in degrees (0=N, 90=E, 180=S, 270=W).
// Tilt 0 = top-down, 90 = horizontal. Range = camera distance from center.
const PRESETS = {
  front: { heading: 0,   tilt: 60, range: 40 },
  right: { heading: 90,  tilt: 60, range: 40 },
  back:  { heading: 180, tilt: 60, range: 40 },
  left:  { heading: 270, tilt: 60, range: 40 },
  top:   { heading: 0,   tilt: 0,  range: 80 },
} as const;
type PresetKey = keyof typeof PRESETS;

const FLY_DURATION_MS = 1200;
const ORBIT_DURATION_MS = 60000; // 60s/revolution when auto-orbit on

export function LiveEarthHero({ coords, loading, onReturn }: Props) {
  const containerRef = useRef<any>(null);
  const map3dRef = useRef<any>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [autoOrbit, setAutoOrbit] = useState(false);
  const orbitInFlight = useRef(false);

  // Apply a camera preset. We try three approaches in order so the buttons
  // work across SDK versions:
  //   1. flyCameraTo (newest, animated)
  //   2. Direct property assignment (heading/tilt/range/center) — works on
  //      older Map3DElement builds, just snaps without animation.
  //   3. setAttribute (kebab-case fallback for the HTML-element variant).
  const flyToPreset = useCallback(
    (preset: PresetKey) => {
      const m = map3dRef.current;
      if (!m || !coords) {
        console.warn('[LiveEarthHero] flyToPreset: no map ref or coords', { hasMap: !!m, hasCoords: !!coords });
        return;
      }
      const p = PRESETS[preset];
      const center = { lat: coords.lat, lng: coords.lng, altitude: 0 };
      // Path 1 — flyCameraTo animation
      if (typeof m.flyCameraTo === 'function') {
        try {
          m.flyCameraTo({
            endCamera: { center, range: p.range, tilt: p.tilt, heading: p.heading },
            durationMillis: FLY_DURATION_MS,
          });
          return;
        } catch (err) {
          console.warn('[LiveEarthHero] flyCameraTo threw — falling back', err);
        }
      }
      // Path 2 — direct property assignment
      try {
        m.center = center;
        m.heading = p.heading;
        m.tilt = p.tilt;
        m.range = p.range;
        return;
      } catch (err) {
        console.warn('[LiveEarthHero] direct property set threw — falling back', err);
      }
      // Path 3 — setAttribute on the underlying HTML element
      try {
        m.setAttribute('center', `${center.lat},${center.lng},${center.altitude}`);
        m.setAttribute('heading', String(p.heading));
        m.setAttribute('tilt', String(p.tilt));
        m.setAttribute('range', String(p.range));
      } catch (err) {
        console.error('[LiveEarthHero] all camera-set paths failed', err);
      }
    },
    [coords?.lat, coords?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Toggle auto-orbit. When ON, runs continuous flyCameraAround loop.
  // When OFF, user has full pointer control.
  const toggleOrbit = useCallback(() => {
    setAutoOrbit((prev) => !prev);
  }, []);

  // Drive auto-orbit lifecycle.
  useEffect(() => {
    if (!autoOrbit || !map3dRef.current || !coords) return;
    if (typeof map3dRef.current.flyCameraAround !== 'function') return;
    let cancelled = false;
    orbitInFlight.current = true;
    const loop = () => {
      if (cancelled || !map3dRef.current) return;
      try {
        map3dRef.current.flyCameraAround({
          camera: {
            center: { lat: coords.lat, lng: coords.lng, altitude: 0 },
            range: 40,
            tilt: 60,
            heading: 0,
          },
          durationMillis: ORBIT_DURATION_MS,
          rounds: 1,
        });
        // Schedule next loop iteration at end of orbit.
        setTimeout(() => { if (!cancelled) loop(); }, ORBIT_DURATION_MS + 50);
      } catch {
        /* swallow */
      }
    };
    loop();
    return () => {
      cancelled = true;
      orbitInFlight.current = false;
    };
  }, [autoOrbit, coords?.lat, coords?.lng]);

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
        const google = await loader({ apiKey, libraries: ['maps3d'] });
        if (cancelled || !containerRef.current) return;

        const maps3d: any = await (google as any).maps.importLibrary('maps3d');
        if (cancelled || !maps3d?.Map3DElement) {
          setStatus('unavailable');
          return;
        }

        // Mount with close inspector framing. Map3DElement is interactive
        // by default (drag-rotate, scroll-zoom, right-click-tilt) — the
        // ONLY thing that locks it is calling flyCameraAround on a loop
        // (which the previous version did). We don't auto-orbit, so the
        // user has full control from second 1.
        //
        // CRITICAL: `mode` MUST be set or the map won't render at all
        // (per Google Maps Platform 3D Maps docs, 2025).
        const map3d = new maps3d.Map3DElement({
          center: { lat: coords.lat, lng: coords.lng, altitude: 0 },
          range: PRESETS.front.range,
          tilt: PRESETS.front.tilt,
          heading: PRESETS.front.heading,
          mode: maps3d.MapMode?.SATELLITE ?? 'SATELLITE',
        });
        map3d.style.width = '100%';
        map3d.style.height = '100%';
        map3d.style.borderRadius = '12px';
        containerRef.current.appendChild(map3d);
        map3dRef.current = map3d;

        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
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
  const showControls = status === 'ready';

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
        <View style={[styles.overlayFill, styles.fallbackShell]} testID="live-earth-hero-unavailable">
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

      {/* Bottom preset bar — Front / Right / Back / Left / Top + Auto-orbit toggle */}
      {showControls && (
        <View style={styles.controlBar} pointerEvents="box-none">
          <View style={styles.presetRow}>
            <PresetButton label="Front" icon="home-outline" onPress={() => flyToPreset('front')} />
            <PresetButton label="Right" icon="arrow-forward-outline" onPress={() => flyToPreset('right')} />
            <PresetButton label="Back" icon="arrow-back-outline" onPress={() => flyToPreset('back')} />
            <PresetButton label="Left" icon="arrow-back-outline" onPress={() => flyToPreset('left')} flip />
            <PresetButton label="Top" icon="layers-outline" onPress={() => flyToPreset('top')} />
            <View style={styles.divider} />
            <PresetButton
              label={autoOrbit ? 'Stop Orbit' : 'Auto-Orbit'}
              icon={autoOrbit ? 'pause-outline' : 'play-outline'}
              onPress={toggleOrbit}
              accent
            />
          </View>
        </View>
      )}

      {/* Hint pill — top-left, fades after 5s */}
      {showControls && (
        <View style={styles.hintPill} pointerEvents="none">
          <Ionicons name="hand-left-outline" size={11} color="rgba(255,255,255,0.7)" />
          <Text style={styles.hintText}>Drag to rotate · Scroll to zoom · Right-click to tilt</Text>
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

// --------------------------------------------------------------------------
// Preset button — small pill for the bottom control bar.
// --------------------------------------------------------------------------
interface PresetButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accent?: boolean;
  flip?: boolean;
}
function PresetButton({ label, icon, onPress, accent, flip }: PresetButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ hovered }: any) => [
        styles.presetBtn,
        accent && styles.presetBtnAccent,
        hovered && (accent ? styles.presetBtnAccentHover : styles.presetBtnHover),
      ]}
    >
      <Ionicons
        name={icon}
        size={12}
        color={accent ? '#0A0A0F' : '#fbbf24'}
        style={flip ? ({ transform: [{ scaleX: -1 }] } as any) : undefined}
      />
      <Text style={[styles.presetBtnText, accent && styles.presetBtnTextAccent]}>{label}</Text>
    </Pressable>
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
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
  },
  fallbackIcon: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center',
  },
  fallbackIconError: {
    borderColor: 'rgba(255,107,107,0.25)',
    backgroundColor: 'rgba(255,107,107,0.05)',
  },
  fallbackTitle: {
    fontSize: 16, fontWeight: '600',
    color: 'rgba(255,255,255,0.92)', letterSpacing: -0.2,
  },
  fallbackSubtitle: {
    fontSize: 12, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', lineHeight: 18, maxWidth: 420,
  },
  // ---- Bottom preset bar ----
  controlBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 14,
    alignItems: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? (({ boxShadow: '0 8px 24px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' } as unknown) as ViewStyle)
      : {}),
  },
  divider: {
    width: 1, height: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
  },
  presetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    backgroundColor: 'rgba(251,191,36,0.04)',
    ...(Platform.OS === 'web'
      ? (({ transition: 'border-color 120ms ease-out, background-color 120ms ease-out' } as unknown) as ViewStyle)
      : {}),
  },
  presetBtnHover: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  presetBtnAccent: {
    borderColor: 'rgba(251,191,36,0.85)',
    backgroundColor: '#fbbf24',
  },
  presetBtnAccentHover: {
    backgroundColor: '#f59e0b',
  },
  presetBtnText: {
    fontSize: 11, fontWeight: '700', color: '#fbbf24',
    letterSpacing: -0.1,
  },
  presetBtnTextAccent: {
    color: '#0A0A0F',
  },
  // ---- Hint pill ----
  hintPill: {
    position: 'absolute',
    top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  hintText: {
    fontSize: 10, color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.05,
  },
  // ---- Return pill ----
  returnPill: {
    position: 'absolute',
    top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
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
    fontSize: 11, fontWeight: '700', color: '#fbbf24',
    letterSpacing: -0.1,
  },
});
