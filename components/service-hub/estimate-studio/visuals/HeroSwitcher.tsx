/**
 * HeroSwitcher — hero zone state machine container.
 *
 * Renders ONE of 5 hero variants based on `mode`, with a 200ms cross-fade on
 * mode transitions. All variants are pre-mounted at zero opacity so switching
 * costs no remount + no flash of empty content (CLS = 0).
 *
 * Photo lane folding rule:
 *   - Server-side: Adam-uncategorized photos already merged into `exterior`.
 *   - Client-side: streetView lane is the live Maps panorama, NOT a fold of
 *     the streetView photo lane (which only carries the static fallback URL).
 *
 * Aspire Law #7: pure render. Mode state lives in `useHeroMode`.
 */
import React, { Suspense, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LiveStreetViewHero } from './LiveStreetViewHero';
import { PhotoGalleryHero } from './PhotoGalleryHero';
import { SheenBlock } from './InsightCardBase';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';
import type { HeroMode } from '@/hooks/useHeroMode';

// Wave 18n: lazy-load Cesium-backed hero so the ~3MB Cesium bundle is NOT
// downloaded on every Visuals visit. Boots only after the user clicks the
// Aerial 3D / Earth thumbnail. Combined with conditional mounting below,
// this ends the auto-boot OOM on the default Street View hero.
const LiveHouseInspectorHero = React.lazy(() =>
  import('./LiveHouseInspectorHero').then((m) => ({ default: m.LiveHouseInspectorHero })),
);

interface Props {
  mode: HeroMode;
  onModeChange: (mode: HeroMode) => void;
  data?: PropertyData;
  loading: boolean;
}

const FADE_MS = 200;

// Wave 18n: Cesium fallback while bundle loads. Matches hero skeleton.
function CesiumLazyFallback() {
  return (
    <View style={styles.lazyFallback} testID="hero-switcher-cesium-loading">
      <SheenBlock width="100%" height="100%" radius={12} />
    </View>
  );
}

export function HeroSwitcher({ mode, onModeChange, data, loading }: Props) {
  // Wave 18n: only mount Cesium-backed heroes when they're the active mode.
  // Pre-mounting at opacity:0 still ran the useEffect that booted Cesium —
  // causing a WebGL context to allocate on every Visuals page load even
  // when the user never clicked Aerial 3D. Conditional mount = robust.
  const isAerialActive = mode === 'aerial';
  const isEarthActive = mode === 'earth';
  // One opacity value per layer so we can cross-fade between them.
  const opacities = useRef<Record<HeroMode, Animated.Value>>({
    streetview: new Animated.Value(mode === 'streetview' ? 1 : 0),
    aerial: new Animated.Value(mode === 'aerial' ? 1 : 0),
    earth: new Animated.Value(mode === 'earth' ? 1 : 0),
    interior: new Animated.Value(mode === 'interior' ? 1 : 0),
    exterior: new Animated.Value(mode === 'exterior' ? 1 : 0),
    roof: new Animated.Value(mode === 'roof' ? 1 : 0),
  }).current;

  useEffect(() => {
    const animations = (Object.keys(opacities) as HeroMode[]).map((key) =>
      Animated.timing(opacities[key], {
        toValue: key === mode ? 1 : 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    );
    Animated.parallel(animations).start();
  }, [mode, opacities]);

  return (
    <View style={styles.container} testID="hero-switcher">
      <Animated.View
        pointerEvents={mode === 'streetview' ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.streetview }]}
      >
        <LiveStreetViewHero
          coords={data?.coords}
          loading={loading}
          onAerialPress={() => onModeChange('aerial')}
          onEarthPress={() => onModeChange('earth')}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={isAerialActive ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.aerial }]}
      >
        {/* Aerial 3D mode renders the CesiumJS House Inspector — Google
            Photorealistic 3D Tiles. Wave 18n: lazy-mounted ONLY when active
            so Cesium doesn't auto-boot on every Visuals page load. */}
        {isAerialActive && (
          <Suspense fallback={<CesiumLazyFallback />}>
            <LiveHouseInspectorHero
              coords={data?.coords}
              address={data?.address?.formatted}
              loading={loading}
              onReturn={() => onModeChange('streetview')}
            />
          </Suspense>
        )}
      </Animated.View>

      <Animated.View
        pointerEvents={isEarthActive ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.earth }]}
      >
        {isEarthActive && (
          <Suspense fallback={<CesiumLazyFallback />}>
            <LiveHouseInspectorHero
              coords={data?.coords}
              address={data?.address?.formatted}
              loading={loading}
              onReturn={() => onModeChange('streetview')}
            />
          </Suspense>
        )}
      </Animated.View>

      <Animated.View
        pointerEvents={mode === 'interior' ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.interior }]}
      >
        <PhotoGalleryHero
          photos={data?.photos.interior.photos}
          title="Interior"
          loading={loading}
          onClose={() => onModeChange('streetview')}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={mode === 'exterior' ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.exterior }]}
      >
        <PhotoGalleryHero
          photos={data?.photos.exterior.photos}
          title="Exterior"
          loading={loading}
          onClose={() => onModeChange('streetview')}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={mode === 'roof' ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.roof }]}
      >
        {/* Roof canvas picks its renderer based on Solar coverage:
            - 'solar'      → Solar 4K aerial via PhotoGalleryHero
            - 'streetview' → interactive Street View Pano (4K, same as
                             the Street View card) because Solar API has
                             no imagery for ~20% of US addresses. */}
        {data?.roofImagery === 'streetview' ? (
          <LiveStreetViewHero
            coords={data?.coords}
            loading={loading}
            onAerialPress={() => onModeChange('aerial')}
            onEarthPress={() => onModeChange('earth')}
          />
        ) : (
          <PhotoGalleryHero
            photos={data?.photos.roof.photos}
            title="Roof"
            loading={loading}
            onClose={() => onModeChange('streetview')}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // flex:1 fills the parent heroSlot vertically. The fixed 12:5
    // aspectRatio was locking the hero to a short band and leaving a
    // huge black gap between the photo bottom and the photo lane cards
    // on laptop viewports — the heroSlot's flex:1 + minHeight:520 was
    // wasted because aspectRatio forced height = width * 5/12.
    flex: 1,
    width: '100%',
    minHeight: 360,
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  lazyFallback: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
  },
});
