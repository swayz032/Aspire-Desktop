// components/call-room/CallRoomBackground.tsx
//
// Renders the office background. On web (the primary Aspire-desktop target)
// we use a plain <img> element with object-fit: cover and object-position
// center so the whole scene fills the viewport, properly centered, at every
// size (desktop / laptop / tablet). On native we use <ImageBackground>.
//
// The room is intentionally STATIC — no parallax movement. Background motion
// during long calls can cause motion-sickness or headaches; depth is sold
// instead by the floating card's shadow, lighting, and subtle tilt response.

import React from 'react';
import { ImageBackground, Platform, StyleSheet, View } from 'react-native';
import { layers } from './layers/manifest';

export interface CallRoomBackgroundProps {
  /**
   * Reserved for future use. Kept for prop-shape stability with existing
   * tests and demo controls; currently has no effect because the room
   * is static by design.
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

export function CallRoomBackground(_props: CallRoomBackgroundProps = {}): React.ReactElement {
  return (
    <View style={styles.root} testID="call-room-background">
      {layers.map((layer, i) => {
        if (Platform.OS === 'web') {
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
                transform: `scale(${layer.scale})`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          );
        }

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
                transform: [{ scale: layer.scale }],
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
