// components/call-room/CallRoom.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CallRoomBackground } from './CallRoomBackground';
import { CallRoomCard } from './CallRoomCard';
import type { CallState } from './types';

export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
}

export function CallRoom({ visible, callState }: CallRoomProps): React.ReactElement | null {
  if (!visible) return null;
  return (
    <View testID="call-room-root" style={styles.root}>
      <CallRoomBackground />
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
