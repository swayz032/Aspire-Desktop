// components/call-room/CallRoomControls.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CallState } from './types';

export interface CallRoomControlsProps {
  state: CallState;
  onMute?: () => void;
  onHold?: () => void;
  onKeypad?: () => void;
  onTransfer?: () => void;
  onEnd?: () => void;
}

export function CallRoomControls(props: CallRoomControlsProps): React.ReactElement {
  const noop = () => {};
  return (
    <View style={styles.row} testID="call-room-controls">
      <ControlBtn icon="🎤" label="Mute" active={props.state.isMuted} onPress={props.onMute ?? noop} />
      <ControlBtn icon="⏸" label="Hold" active={props.state.isOnHold} onPress={props.onHold ?? noop} />
      <ControlBtn icon="⊞" label="Keypad" onPress={props.onKeypad ?? noop} />
      <ControlBtn icon="⇄" label="Transfer" onPress={props.onTransfer ?? noop} />
      <Pressable
        style={styles.endBtn}
        onPress={props.onEnd ?? noop}
        testID="end-call-btn"
        accessibilityRole="button"
        accessibilityLabel="End Call"
      >
        <Text style={styles.endBtnIcon}>☎</Text>
        <Text style={styles.endBtnLabel}>End Call</Text>
      </Pressable>
    </View>
  );
}

function ControlBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, active && styles.btnActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.btnIcon}>{icon}</Text>
      <Text style={styles.btnLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  // Subtle active state — only Aspire-blue tint when toggled, never loud
  btnActive: {
    backgroundColor: 'rgba(120,170,220,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(120,170,220,0.4)',
  },
  btnIcon: { fontSize: 14, color: '#fff', marginRight: 6 },
  btnLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 13 },
  // The ONE saturated button — End Call is the only loud thing on the screen
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#dc2626',
    borderRadius: 999,
    marginLeft: 4,
  },
  endBtnIcon: { fontSize: 13, color: '#fff', marginRight: 6 },
  endBtnLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
