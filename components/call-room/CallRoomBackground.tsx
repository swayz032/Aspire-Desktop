// components/call-room/CallRoomBackground.tsx
//
// Renders the office background. On web (the primary Aspire-desktop target)
// we use a CSS background-image with explicit `cover` + `center center` so
// the image stays centered and properly fitted at every viewport size
// (desktop, laptop, tablet). On native we fall back to <ImageBackground>.

import React from 'react';
import { ImageBackground, Image, Platform, StyleSheet, View } from 'react-native';
import { layers } from './layers/manifest';

export function CallRoomBackground(): React.ReactElement {
  return (
    <View style={styles.root} testID="call-room-background">
      {layers.map((layer, i) => {
        const baseStyle = [
          StyleSheet.absoluteFill,
          { opacity: layer.opacity, zIndex: layer.zIndex },
        ];

        if (Platform.OS === 'web') {
          // Resolve the require()'d asset to a URL string for CSS background-image.
          const resolved = Image.resolveAssetSource(layer.src);
          const url = resolved?.uri ?? '';
          return (
            <View
              key={i}
              testID={`call-room-bg-layer-${i}`}
              style={[
                ...baseStyle,
                {
                  // Web-only style: keep the image fully centered + cover at every aspect ratio.
                  backgroundImage: `url("${url}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center center',
                  backgroundRepeat: 'no-repeat',
                  // Slight oversize so future parallax never exposes the edge.
                  transform: `scale(${layer.scale})`,
                  transformOrigin: 'center center',
                  willChange: 'transform',
                } as object,
              ]}
            />
          );
        }

        // Native fallback (iOS/Android)
        return (
          <ImageBackground
            key={i}
            source={layer.src}
            resizeMode="cover"
            style={[...baseStyle, { transform: [{ scale: layer.scale }] }]}
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
