// components/call-room/CallRoomBackground.tsx
//
// Renders the office background. The image swaps based on time of day —
// day, dusk, or night photo. All 3 are rendered in a stack and crossfaded
// via opacity so the transition is smooth (600ms) when the hour rolls over
// or the dev panel forces a different state.

import React from 'react';
import { ImageBackground, Platform, StyleSheet, View } from 'react-native';
import { layersByState } from './layers/manifest';
import { useTimeOfDay } from './hooks/useTimeOfDay';
import type { TimeOfDayState } from './types';

export interface CallRoomBackgroundProps {
  forcedTimeOfDay?: TimeOfDayState;
}

const ORDER: TimeOfDayState[] = ['day', 'dawn', 'dusk', 'night'];

function resolveLayerUri(src: number | { uri?: string; default?: string } | string): string {
  if (typeof src === 'string') return src;
  if (src && typeof src === 'object') {
    // @ts-expect-error - shape varies by bundler
    return src.uri ?? src.default ?? '';
  }
  return '';
}

export function CallRoomBackground({ forcedTimeOfDay }: CallRoomBackgroundProps = {}): React.ReactElement {
  const tint = useTimeOfDay(forcedTimeOfDay);
  const isWeb = Platform.OS === 'web';
  const activeState = tint.state;

  return (
    <View style={styles.root} testID="call-room-background">
      {ORDER.map((state) => {
        const layer = layersByState[state];
        const isActive = state === activeState;
        const opacity = isActive ? 1 : 0;

        if (isWeb) {
          const uri = resolveLayerUri(layer.src as never);
          return (
            <img
              key={state}
              data-testid={`call-room-bg-${state}`}
              src={uri}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
                opacity,
                transform: `scale(${layer.scale})`,
                transformOrigin: 'center center',
                transition: 'opacity 600ms ease-out',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          );
        }

        return (
          <ImageBackground
            key={state}
            testID={`call-room-bg-${state}`}
            source={layer.src as number}
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFill,
              { opacity, transform: [{ scale: layer.scale }] },
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
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
});
