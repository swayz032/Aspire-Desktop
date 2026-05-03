// components/call-room/CallRoom.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CallRoomBackground } from './CallRoomBackground';
import { CallRoomCard } from './CallRoomCard';
import type { CallState, TimeOfDayState } from './types';

export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
  /**
   * Reserved — currently unused. Kept for prop-shape stability with existing
   * tests / demo controls. Background is static; depth is sold by the card.
   */
  parallaxIntensity?: number;
  /**
   * Dev override for time-of-day. When undefined, the background auto-
   * selects from local hour (re-evaluates every 5 minutes).
   */
  forcedTimeOfDay?: TimeOfDayState;
}

export function CallRoom({
  visible,
  callState,
  forcedTimeOfDay,
}: CallRoomProps): React.ReactElement | null {
  if (!visible) return null;
  return (
    <View testID="call-room-root" style={styles.root}>
      <CallRoomBackground forcedTimeOfDay={forcedTimeOfDay} />
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
