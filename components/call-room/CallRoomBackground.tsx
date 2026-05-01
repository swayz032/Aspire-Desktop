// components/call-room/CallRoomBackground.tsx
//
// Renders the office background. Uses `contain` so the WHOLE scene is
// visible at every viewport size (matching the original artwork). Any
// area not filled by the image is dark (background-color), giving a
// cinema-letterbox feel rather than a cropped/zoomed view.

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
          resizeMode="contain"
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: layer.opacity,
              zIndex: layer.zIndex,
            },
          ]}
          imageStyle={{
            resizeMode: 'contain',
            // @ts-expect-error — web-only style props for proper centering
            objectFit: 'contain',
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
    backgroundColor: '#0a0a0a', // letterbox color when aspect ratios don't match
    overflow: 'hidden',
  },
});
