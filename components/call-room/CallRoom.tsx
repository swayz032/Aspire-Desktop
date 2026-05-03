// components/call-room/CallRoom.tsx
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { CallRoomBackground } from './CallRoomBackground';
import { CallRoomCard } from './CallRoomCard';
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

      {/* NIGHT-ONLY: screen-glow rising from the card area into the dim
          room — like the user's laptop/monitor casting cool light upward
          into the dark virtual office. The brightest point sits just above
          the card's top edge; the glow falls off softly toward the
          ceiling and edges. mixBlendMode: screen so it ADDS light. */}
      {isWeb && (
        <View
          pointerEvents="none"
          testID="call-room-screen-glow"
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: isNight ? 1 : 0,
              // @ts-expect-error - web-only
              background: [
                // Tall narrow ellipse rising from card top — concentrated
                // bright zone right at the card's top edge fading upward.
                'radial-gradient(ellipse 36% 28% at 50% 28%, rgba(170, 195, 235, 0.30) 0%, rgba(150, 180, 225, 0.16) 28%, rgba(140, 170, 220, 0.05) 60%, transparent 80%)',
                // Wider softer halo so the room feels lit by the screen,
                // not a spotlight pinned to the card.
                'radial-gradient(ellipse 65% 45% at 50% 32%, rgba(180, 200, 235, 0.10) 0%, rgba(170, 190, 230, 0.04) 35%, transparent 70%)',
              ].join(', '),
              mixBlendMode: 'screen',
              transition: 'opacity 800ms ease-out',
            },
          ]}
        />
      )}

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
