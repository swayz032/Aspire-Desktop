// components/call-room/CallRoomBackground.tsx
//
// Renders the office background. On web (the primary Aspire-desktop target)
// we use a plain <img> element with object-fit: cover and object-position
// center so the whole scene fills the viewport, properly centered, at every
// size (desktop / laptop / tablet). On native we use <ImageBackground>.
//
// M2-T14: each layer is offset by a cursor-tracked parallax delta. With the
// current single-layer manifest (parallaxRange: 0) the room stays static —
// computeLayerOffset returns {0,0} when range is 0 — but the wiring is in
// place so future sliced layers move correctly.

import React from 'react';
import { ImageBackground, Platform, StyleSheet, View } from 'react-native';
import { layers } from './layers/manifest';
import { computeLayerOffset, useCursor } from './hooks/useParallax';

export interface CallRoomBackgroundProps {
  /**
   * Global parallax multiplier (0 = no parallax, 1 = full, 2 = exaggerated).
   * Defaults to 1. Wired to dev controls in CallRoom.demo.
   */
  intensity?: number;
}

// On web, Metro / Expo Webpack lets us require() the asset and get a URL string
// (or an object with `uri`). Resolve once at module load.
function resolveLayerUri(src: number | { uri?: string; default?: string } | string): string {
  if (typeof src === 'string') return src;
  if (src && typeof src === 'object') {
    // @ts-expect-error - shape varies by bundler
    return src.uri ?? src.default ?? '';
  }
  return '';
}

export function CallRoomBackground({ intensity = 1 }: CallRoomBackgroundProps = {}): React.ReactElement {
  const { cursor, viewport } = useCursor();

  return (
    <View style={styles.root} testID="call-room-background">
      {layers.map((layer, i) => {
        const offset = computeLayerOffset(cursor, viewport, layer.parallaxRange, intensity);

        if (Platform.OS === 'web') {
          // Use a real <img> tag so object-fit / object-position behave correctly
          // across every viewport size.
          const uri = resolveLayerUri(layer.src as never);
          return (
            <img
              key={i}
              data-testid={`call-room-bg-layer-${i}`}
              src={uri}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
                opacity: layer.opacity,
                zIndex: layer.zIndex,
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${layer.scale})`,
                transformOrigin: 'center center',
                transition: 'transform 120ms ease-out',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          );
        }

        // Native fallback (iOS/Android)
        return (
          <ImageBackground
            key={i}
            testID={`call-room-bg-layer-${i}`}
            source={layer.src as number}
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: layer.opacity,
                zIndex: layer.zIndex,
                transform: [
                  { translateX: offset.x },
                  { translateY: offset.y },
                  { scale: layer.scale },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a', // fallback while images load
    overflow: 'hidden',
  },
});
