// components/call-room/CallRoomBackground.tsx
//
// Renders the office background. Uses <ImageBackground> with explicit
// imageStyle so the image stays centered + cover-fitted at every viewport
// size (desktop, laptop, tablet). On web the imageStyle props translate to
// CSS object-fit/object-position; on native they're applied to the inner Image.

import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { layers } from './layers/manifest';

export function CallRoomBackground(): React.ReactElement {
  return (
    <View style={styles.root} testID="call-room-background">
      {layers.map((layer, i) => (
        <ImageBackground
          key={i}
          testID={`call-room-bg-layer-${i}`}
          source={layer.src}
          resizeMode="cover"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: layer.opacity,
              zIndex: layer.zIndex,
              transform: [{ scale: layer.scale }],
            },
          ]}
          imageStyle={{
            // Cross-platform: cover + center. On web these become
            // object-fit / object-position on the inner <img>.
            resizeMode: 'cover',
            // @ts-expect-error — web-only style props for proper centering at all sizes
            objectFit: 'cover',
            objectPosition: 'center center',
          }}
        />
      ))}
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
