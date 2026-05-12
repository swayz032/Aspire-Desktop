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
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LiveStreetViewHero } from './LiveStreetViewHero';
import { LiveHouseInspectorHero } from './LiveHouseInspectorHero';
import { PhotoGalleryHero } from './PhotoGalleryHero';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';
import type { HeroMode } from '@/hooks/useHeroMode';

interface Props {
  mode: HeroMode;
  onModeChange: (mode: HeroMode) => void;
  data?: PropertyData;
  loading: boolean;
}

const FADE_MS = 200;

export function HeroSwitcher({ mode, onModeChange, data, loading }: Props) {
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
        pointerEvents={mode === 'aerial' ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.aerial }]}
      >
        {/* Aerial 3D mode renders the CesiumJS House Inspector — Google
            Photorealistic 3D Tiles + INVERSE clipping polygon so only the
            house mesh is visible on a dark stage. Replaces the old broken
            Aerial Video API and the Map3DElement Earth view. The bottom
            card label stays "Aerial 3D" as the user-facing name. */}
        <LiveHouseInspectorHero
          coords={data?.coords}
          address={data?.address?.formatted}
          loading={loading}
          onReturn={() => onModeChange('streetview')}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={mode === 'earth' ? 'auto' : 'none'}
        style={[styles.layer, { opacity: opacities.earth }]}
      >
        <LiveHouseInspectorHero
          coords={data?.coords}
          address={data?.address?.formatted}
          loading={loading}
          onReturn={() => onModeChange('streetview')}
        />
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
    width: '100%',
    minHeight: 360,
    aspectRatio: 12 / 5,
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
