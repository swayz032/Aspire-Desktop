// components/call-room/CallRoomBackground.tsx
import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { layers } from './layers/manifest';

export function CallRoomBackground(): React.ReactElement {
  return (
    <View style={styles.root} testID="call-room-background">
      {layers.map((layer, i) => (
        <ImageBackground
          key={i}
          source={layer.src}
          resizeMode="cover"
          style={[
            StyleSheet.absoluteFill,
            { opacity: layer.opacity, zIndex: layer.zIndex, transform: [{ scale: layer.scale }] },
          ]}
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
