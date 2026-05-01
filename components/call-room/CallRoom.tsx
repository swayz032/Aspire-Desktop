// components/call-room/CallRoom.tsx
import React from 'react';
import { View } from 'react-native';
import type { CallState } from './types';

export interface CallRoomProps {
  visible: boolean;
  callState: CallState;
}

export function CallRoom({ visible, callState }: CallRoomProps): React.ReactElement | null {
  if (!visible) return null;
  return (
    <View testID="call-room-root" style={{ flex: 1, backgroundColor: '#0a0a0a' }} />
  );
}
