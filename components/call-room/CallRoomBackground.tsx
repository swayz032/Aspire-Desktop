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
  const isNight = activeState === 'night';

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

      {/* Night-only directional lamp glow from the top-right corner. Reads as
          a 3D light source — like a desk lamp or window glow at night casting
          warm light across the virtual office. Web-only (RN can't do radial
          gradients without a lib). Crossfades with the night image so it
          appears smoothly when night state activates. */}
      {isWeb && (
        <View
          pointerEvents="none"
          testID="call-room-night-lamp"
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: isNight ? 1 : 0,
              transition: 'opacity 800ms ease-out',
              // Outer atmospheric warm wash from top-right
              // @ts-expect-error - web-only
              background: [
                // Soft atmospheric warmth blanketing the upper-right quadrant
                'radial-gradient(circle at 92% 8%, rgba(255, 200, 140, 0.45) 0%, rgba(255, 180, 110, 0.25) 18%, rgba(255, 170, 90, 0.10) 35%, rgba(255, 160, 80, 0) 65%)',
                // Tighter hot spot — the lamp itself
                'radial-gradient(circle at 95% 5%, rgba(255, 230, 190, 0.55) 0%, rgba(255, 210, 160, 0.18) 8%, rgba(255, 200, 140, 0) 18%)',
              ].join(', '),
              mixBlendMode: 'screen',
            },
          ]}
        />
      )}
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
