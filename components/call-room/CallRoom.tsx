// components/call-room/CallRoom.tsx
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CallRoomBackground } from './CallRoomBackground';
import { CallRoomCard } from './CallRoomCard';
import { CallRoomNightLight } from './CallRoomNightLight';
import { useTimeOfDay } from './hooks/useTimeOfDay';
import type { CallState, TimeOfDayState } from './types';

export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
  /**
   * Reserved — currently unused. Kept for prop-shape stability.
   */
  parallaxIntensity?: number;
  /**
   * Dev override for time-of-day. When undefined, auto-classifies from local
   * hour and re-evaluates every 5 minutes.
   */
  forcedTimeOfDay?: TimeOfDayState;
}

export function CallRoom({
  visible,
  callState,
  forcedTimeOfDay,
}: CallRoomProps): React.ReactElement | null {
  const tod = useTimeOfDay(forcedTimeOfDay);
  const isWeb = Platform.OS === 'web';
  const isNight = tod.state === 'night';

  if (!visible) return null;
  return (
    <View testID="call-room-root" style={styles.root}>
      <CallRoomBackground forcedTimeOfDay={forcedTimeOfDay} />

      {/* NIGHT-ONLY: real WebGL volumetric SpotLight + bloom. Replaces
          the prior CSS-radial-gradient. Web-only — native returns null
          internally. The light source sits just above the card's top
          edge and casts a cool-blue-white beam upward into the dark
          virtual office, like a laptop screen lighting the room. */}
      {isWeb && <CallRoomNightLight active={isNight} />}

      <View style={styles.cardWrap} pointerEvents="box-none">
        <CallRoomCard callState={callState} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
  },
  cardWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
