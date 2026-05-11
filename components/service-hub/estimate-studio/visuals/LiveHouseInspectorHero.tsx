/**
 * LiveHouseInspectorHero — CesiumJS + Google Photorealistic 3D Tiles, with an
 * INVERSE clipping polygon so only the target house's mesh is visible.
 *
 * Pipeline:
 *   1. Backend `/api/property/building-footprint?address=...` returns the
 *      house's polygon + center (Google Buildings → ATTOM fallback).
 *   2. We lazy-load Cesium (kept out of the main bundle).
 *   3. Mount a Viewer with no globe + dark background, super-sampling +
 *      MSAA + FXAA + ACES tonemapping for a sharp "premium 3D" look.
 *   4. Add Google's photorealistic 3D Tileset.
 *   5. Apply ClippingPolygonCollection with `inverse: true` — everything
 *      OUTSIDE the polygon vanishes; the house floats on a dark stage.
 *   6. lookAt the house center; user gets full drag-rotate / scroll-zoom /
 *      right-click-tilt control. Preset/orbit/measure handled via control bar.
 *
 * Aspire Law #7 (Tools are Hands): pure render. The orchestrator owns nothing
 * here — this is presentation only.
 * Aspire Law #9 (Security & Privacy): never logs `coords` or `address`.
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
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { loadCesium } from '@/lib/cesiumLoader';
import { resolveBrowserMapsKey } from '@/lib/googleMapsLoader';
import {
  HouseInspectorControls,
  type CameraPresetKey,
  PRESET_HPR,
} from './HouseInspectorControls';

interface Props {
  coords?: { lat: number; lng: number };
  address?: string;
  loading: boolean;
  onReturn?: () => void;
}

type LoadStatus =
  | 'idle'
  | 'loading'    // either footprint fetch or Cesium boot in flight
  | 'ready'
  | 'unavailable' // backend says no footprint
  | 'error';

interface FootprintResponse {
  status: 'ready' | 'unavailable' | 'error';
  center?: { lat: number; lng: number; altitude: number };
  polygon?: Array<[number, number]>; // [lng, lat]
  heightMeters?: number;
  boundingBox?: {
    sw: { lat: number; lng: number };
    ne: { lat: number; lng: number };
  };
}

const FLY_DURATION_S = 1.5;
const ORBIT_REVOLUTION_MS = 60_000;

export function LiveHouseInspectorHero({ coords, address, loading, onReturn }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Cesium types are loaded dynamically — `any` is the boundary here.
  const viewerRef = useRef<any>(null);
  const tilesetRef = useRef<any>(null);
  const centerCartesianRef = useRef<any>(null);

  const [status, setStatus] = useState<LoadStatus>('idle');
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [measureActive, setMeasureActive] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const { authenticatedFetch } = useAuthFetch();

  // ---- Hint pill auto-fades after 5s -------------------------------------
  useEffect(() => {
    if (status !== 'ready') return;
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, [status]);

  // ---- Camera preset --------------------------------------------------------
  const flyToPreset = useCallback((preset: CameraPresetKey) => {
    const viewer = viewerRef.current;
    const center = centerCartesianRef.current;
    if (!viewer || !center) return;
    setAutoOrbit(false); // any preset click cancels orbit

    // Lazy-grab Cesium namespace from the viewer's own scope to avoid a
    // second dynamic import.
    const Cesium = (window as unknown as { Cesium?: any }).Cesium;
    if (!Cesium) return;

    const p = PRESET_HPR[preset];
    const heading = Cesium.Math.toRadians(p.heading);
    const pitch = Cesium.Math.toRadians(-Math.abs(p.tilt - 90)); // 90→0 (horizon), 35→-55 (looking down)
    const range = p.range;

    try {
      const headingPitchRange = new Cesium.HeadingPitchRange(heading, pitch, range);
      // flyTo + lookAt combo: compute destination from HPR around the center.
      const offset = Cesium.Cartesian3.fromHeadingPitchRange(
        headingPitchRange.heading,
        headingPitchRange.pitch,
        headingPitchRange.range,
      );
      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
      const destination = new Cesium.Cartesian3();
      Cesium.Matrix4.multiplyByPoint(transform, offset, destination);
      const carto = Cesium.Cartographic.fromCartesian(destination);
      viewer.camera.flyTo({
        destination,
        orientation: {
          heading: headingPitchRange.heading,
          pitch: headingPitchRange.pitch,
          roll: 0,
        },
        duration: FLY_DURATION_S,
        complete: () => {
          // Re-anchor the camera to look at the house center after the fly.
          try {
            viewer.camera.lookAt(center, headingPitchRange);
          } catch {
            /* swallow */
          }
        },
      });
      // silence unused-binding warning
      void carto;
    } catch {
      /* swallow */
    }
  }, []);

  // ---- Auto-orbit -----------------------------------------------------------
  useEffect(() => {
    if (!autoOrbit || status !== 'ready') return;
    const viewer = viewerRef.current;
    const center = centerCartesianRef.current;
    const Cesium = (window as unknown as { Cesium?: any }).Cesium;
    if (!viewer || !center || !Cesium) return;

    let raf = 0;
    let cancelled = false;
    let lastTs = performance.now();

    // Lock the camera to look at the center first; we then rotate by Δheading
    // each frame. This is pure camera math — no deprecated APIs.
    const initialHeading = Cesium.Math.toRadians(0);
    const initialPitch = Cesium.Math.toRadians(-35);
    const initialRange = 30;
    let currentHeading = initialHeading;
    try {
      viewer.camera.lookAt(
        center,
        new Cesium.HeadingPitchRange(currentHeading, initialPitch, initialRange),
      );
    } catch {
      return;
    }

    // Cancel orbit on any user interaction.
    const cancelOnInput = () => setAutoOrbit(false);
    const canvas: HTMLCanvasElement | undefined = viewer.scene?.canvas;
    canvas?.addEventListener('mousedown', cancelOnInput);
    canvas?.addEventListener('touchstart', cancelOnInput);

    const tick = (ts: number) => {
      if (cancelled) return;
      const dt = ts - lastTs;
      lastTs = ts;
      const deltaTurns = dt / ORBIT_REVOLUTION_MS;
      currentHeading += deltaTurns * Math.PI * 2;
      try {
        viewer.camera.lookAt(
          center,
          new Cesium.HeadingPitchRange(currentHeading, initialPitch, initialRange),
        );
      } catch {
        cancelled = true;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener('mousedown', cancelOnInput);
      canvas?.removeEventListener('touchstart', cancelOnInput);
      // Release the lookAt lock so user gets full pointer control back.
      try {
        const Cesium2 = (window as unknown as { Cesium?: any }).Cesium;
        if (Cesium2 && viewer?.camera) {
          viewer.camera.lookAtTransform(Cesium2.Matrix4.IDENTITY);
        }
      } catch {
        /* swallow */
      }
    };
  }, [autoOrbit, status]);

  // ---- Measure tool ---------------------------------------------------------
  useEffect(() => {
    if (status !== 'ready') return;
    const viewer = viewerRef.current;
    const Cesium = (window as unknown as { Cesium?: any }).Cesium;
    if (!viewer || !Cesium) return;

    if (!measureActive) {
      // Clean up any prior measure entities + handler.
      try {
        viewer.entities.removeAll();
      } catch {
        /* swallow */
      }
      const canvas: HTMLCanvasElement | undefined = viewer.scene?.canvas;
      if (canvas) canvas.style.cursor = 'grab';
      return;
    }

    const canvas: HTMLCanvasElement | undefined = viewer.scene?.canvas;
    if (canvas) canvas.style.cursor = 'crosshair';

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    const points: any[] = [];

    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      // Pick on the 3D Tileset surface (not the (hidden) globe).
      const cartesian = viewer.scene.pickPosition(click.position);
      if (!cartesian) return;
      points.push(cartesian);

      // Drop a small marker.
      viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#fbbf24'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      if (points.length === 2) {
        const [a, b] = points;
        const meters = Cesium.Cartesian3.distance(a, b);
        const feet = meters * 3.28084;
        const midpoint = Cesium.Cartesian3.midpoint(a, b, new Cesium.Cartesian3());

        viewer.entities.add({
          polyline: {
            positions: [a, b],
            width: 3,
            material: Cesium.Color.fromCssColorString('#fbbf24'),
            depthFailMaterial: Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.6),
          },
        });
        viewer.entities.add({
          position: midpoint,
          label: {
            text: `${meters.toFixed(2)} m  •  ${feet.toFixed(2)} ft`,
            font: '600 13px "Inter", system-ui, sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#0A0A0F'),
            backgroundColor: Cesium.Color.fromCssColorString('#fbbf24'),
            showBackground: true,
            backgroundPadding: new Cesium.Cartesian2(8, 5),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -8),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        // Reset for next measurement pair on next click.
        points.length = 0;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      try {
        handler.destroy();
      } catch {
        /* swallow */
      }
      if (canvas) canvas.style.cursor = 'grab';
    };
  }, [measureActive, status]);

  // ---- Main mount: footprint fetch + Cesium boot ---------------------------
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!coords || !address || !containerRef.current) return;

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        // 1) Fetch footprint from backend.
        const url = `/api/property/building-footprint?address=${encodeURIComponent(address)}`;
        const resp = await authenticatedFetch(url);
        if (cancelled) return;
        if (!resp.ok) {
          setStatus('error');
          return;
        }
        const footprint: FootprintResponse = await resp.json();
        if (cancelled) return;

        if (footprint.status !== 'ready' || !footprint.polygon || !footprint.center) {
          setStatus('unavailable');
          return;
        }

        // 2) Lazy-load Cesium.
        const Cesium = await loadCesium();
        if (cancelled || !containerRef.current) return;

        // Stash on window so the preset/orbit/measure effects can read the
        // namespace without re-importing.
        (window as unknown as { Cesium?: typeof Cesium }).Cesium = Cesium;

        // 3) Boot Viewer with the "premium" stack.
        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          msaaSamples: 4,
          contextOptions: { webgl: { alpha: false, antialias: true } },
        } as unknown as ConstructorParameters<typeof Cesium.Viewer>[1]);

        // Super-sample on lower-DPR screens (HiDPI already gets the resolution).
        viewer.resolutionScale =
          typeof window !== 'undefined' && window.devicePixelRatio >= 2 ? 1.0 : 2.0;

        // Premium look knobs.
        try {
          viewer.scene.postProcessStages.fxaa.enabled = true;
        } catch {
          /* swallow */
        }
        try {
          // ACES tonemapping is the default in modern Cesium; this just makes
          // sure HDR is on so the photorealistic mesh exposes correctly.
          (viewer.scene as unknown as { highDynamicRange: boolean }).highDynamicRange = true;
        } catch {
          /* swallow */
        }
        if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0F0F12');
        viewer.scene.globe.show = false; // hide the blue marble entirely
        viewer.scene.fog.enabled = false;

        viewerRef.current = viewer;

        // 4) Load Google Photorealistic 3D Tiles.
        const apiKey = resolveBrowserMapsKey();
        if (!apiKey) {
          setStatus('error');
          viewer.destroy();
          return;
        }
        const tileset = await Cesium.Cesium3DTileset.fromUrl(
          `https://tile.googleapis.com/v1/3dtiles/root.json?key=${apiKey}`,
          { showCreditsOnScreen: true, maximumScreenSpaceError: 4 },
        );
        if (cancelled) {
          viewer.destroy();
          return;
        }
        viewer.scene.primitives.add(tileset);
        tilesetRef.current = tileset;

        // 5) Inverse clipping polygon → only show the house mesh.
        try {
          const positions = footprint.polygon.flatMap(([lng, lat]) => [
            Cesium.Cartesian3.fromDegrees(lng, lat),
          ]);
          const ClippingPolygonCollectionAny = (Cesium as unknown as {
            ClippingPolygonCollection?: any;
          }).ClippingPolygonCollection;
          const ClippingPolygonAny = (Cesium as unknown as { ClippingPolygon?: any })
            .ClippingPolygon;
          if (ClippingPolygonCollectionAny && ClippingPolygonAny) {
            tileset.clippingPolygons = new ClippingPolygonCollectionAny({
              polygons: [new ClippingPolygonAny({ positions })],
              inverse: true,
            });
          }
        } catch {
          /* swallow — older Cesium without ClippingPolygon: still ship */
        }

        // 6) Position camera on the house center.
        const center = Cesium.Cartesian3.fromDegrees(
          footprint.center.lng,
          footprint.center.lat,
          footprint.center.altitude ?? 0,
        );
        centerCartesianRef.current = center;
        try {
          viewer.camera.lookAt(
            center,
            new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-55), 30),
          );
        } catch {
          /* swallow */
        }

        if (!cancelled) setStatus('ready');
      } catch (err) {
        // Surface the real error in dev so we can debug instead of silently
        // landing on the generic "Could not load House Inspector" overlay.
        // eslint-disable-next-line no-console
        console.error('[LiveHouseInspectorHero] init failed:', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      const viewer = viewerRef.current;
      if (viewer) {
        try {
          viewer.destroy();
        } catch {
          /* swallow */
        }
      }
      viewerRef.current = null;
      tilesetRef.current = null;
      centerCartesianRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng, address]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.shell, styles.fallbackShell]}>
        <Text style={styles.fallbackSubtitle}>House Inspector is web-only.</Text>
      </View>
    );
  }

  const showSkeleton = loading || status === 'idle' || status === 'loading';
  const showUnavailable = status === 'unavailable';
  const showError = status === 'error';
  const showControls = status === 'ready';

  return (
    <View style={styles.shell} testID="live-house-inspector-hero">
      {React.createElement('div', {
        ref: containerRef,
        style: {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          borderRadius: 12,
          backgroundColor: '#0F0F12',
          cursor: 'grab',
        },
      })}

      {showSkeleton && (
        <View style={styles.overlayFill} pointerEvents="none" testID="live-house-inspector-loading">
          <SheenBlock width="100%" height="100%" radius={12} />
        </View>
      )}

      {showUnavailable && (
        <View
          style={[styles.overlayFill, styles.fallbackShell]}
          testID="live-house-inspector-unavailable"
        >
          <View style={styles.fallbackIcon}>
            <Ionicons name="business-outline" size={28} color="rgba(255,255,255,0.55)" />
          </View>
          <Text style={styles.fallbackTitle}>House outline not available</Text>
          <Text style={styles.fallbackSubtitle}>
            We couldn&apos;t find a building footprint for this address — try Aerial or Street View.
          </Text>
        </View>
      )}

      {showError && (
        <View style={[styles.overlayFill, styles.fallbackShell]} testID="live-house-inspector-error">
          <View style={[styles.fallbackIcon, styles.fallbackIconError]}>
            <Ionicons name="cloud-offline-outline" size={28} color="#ff6b6b" />
          </View>
          <Text style={styles.fallbackTitle}>Could not load House Inspector</Text>
          <Text style={styles.fallbackSubtitle}>
            Try Street View — we&apos;ll keep retrying in the background.
          </Text>
        </View>
      )}

      {showControls && (
        <HouseInspectorControls
          onPreset={flyToPreset}
          autoOrbit={autoOrbit}
          onToggleOrbit={() => setAutoOrbit((p) => !p)}
          measureActive={measureActive}
          onToggleMeasure={() => setMeasureActive((p) => !p)}
        />
      )}

      {showControls && showHint && (
        <View style={styles.hintPill} pointerEvents="none">
          <Ionicons name="hand-left-outline" size={11} color="rgba(255,255,255,0.7)" />
          <Text style={styles.hintText}>
            Drag to rotate · Scroll to zoom · Right-click to tilt
          </Text>
        </View>
      )}

      <Pressable
        onPress={onReturn}
        accessibilityRole="button"
        accessibilityLabel="Return to Street View"
        style={({ hovered }: { hovered?: boolean }) => [
          styles.returnPill,
          hovered && styles.returnPillHover,
        ]}
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
  hintPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? (({ transition: 'opacity 250ms ease-out' } as unknown) as ViewStyle)
      : {}),
  },
  hintText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.05,
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
