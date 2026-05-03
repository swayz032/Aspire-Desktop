// components/call-room/CallRoomTint.tsx
//
// Time-of-day tint overlay. Sits BETWEEN <CallRoomBackground /> and
// <CallRoomCard /> — multiplies the background with the ambient color and
// adds a soft edge vignette (web only). pointerEvents="none" so it never
// intercepts clicks.
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTimeOfDay } from './hooks/useTimeOfDay';
import type { TimeOfDayState } from './types';

export interface CallRoomTintProps {
  forced?: TimeOfDayState;
}

export function CallRoomTint({ forced }: CallRoomTintProps): React.ReactElement {
  const tint = useTimeOfDay(forced);
  const isWeb = Platform.OS === 'web';

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
      testID="call-room-tint"
    >
      {/* Ambient color overlay (multiply on web tints highlights with the color) */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: tint.overlayColor,
            opacity: tint.overlayOpacity,
            ...(isWeb
              ? ({
                  mixBlendMode: 'multiply',
                  transition: 'opacity 600ms ease-out, background-color 600ms ease-out',
                } as object)
              : {}),
          },
        ]}
      />

      {/* Edge vignette — web only (RN can't do radial gradients without a lib) */}
      {isWeb && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              // @ts-expect-error - web-only
              background: `radial-gradient(ellipse at center, transparent 50%, ${tint.vignetteColor} 100%)`,
              transition: 'background 600ms ease-out',
            },
          ]}
        />
      )}
    </View>
  );
}
