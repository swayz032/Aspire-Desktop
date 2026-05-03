// components/call-room/CallRoomTint.tsx
//
// Time-of-day tint overlay. Sits BETWEEN <CallRoomBackground /> and
// <CallRoomCard /> — multiplies the background with the ambient color and
// adds a soft edge vignette (web only). At night, a warm "ceiling lamp"
// glow paints over the dark wash so the room reads as "Aspire turned on
// the overhead light because it's late" — not pitch-black, but clearly
// after-hours. pointerEvents="none" so it never intercepts clicks.
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
      {/* 1. Ambient color overlay (multiply tints highlights with the color) */}
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

      {/* 2. Edge vignette — web only (RN can't do radial gradients without a lib) */}
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

      {/* 3. Ceiling lamp pool — only at night. Warm tungsten glow centered
              over the card area so the room reads as "lights are on". Uses
              `screen` blend so it adds light (carves out the darkness rather
              than colorizing on top of it). */}
      {isWeb && tint.ceilingLamp && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              // @ts-expect-error - web-only
              background: `radial-gradient(circle at ${tint.ceilingLamp.cx}% ${tint.ceilingLamp.cy}%, ${tint.ceilingLamp.color} 0%, ${tint.ceilingLamp.color} 8%, ${tint.ceilingLamp.edgeColor} ${tint.ceilingLamp.radius}%)`,
              mixBlendMode: 'screen',
              transition: 'background 800ms ease-out',
            },
          ]}
        />
      )}
    </View>
  );
}
