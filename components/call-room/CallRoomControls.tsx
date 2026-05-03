// components/call-room/CallRoomControls.tsx
//
// 3D control bar — tactile glass pill with recessed inner cavity. Each
// button reads as a physical key that:
//   • rests with a subtle top-edge highlight (chamfered face)
//   • lifts (translateY -1px) on hover with a brighter highlight + soft drop shadow
//   • compresses (translateY +1px, scale 0.98) on press with a deep inset shadow
// End Call is the lone convex raised key — vertical red gradient, halo, drop shadow.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CallState } from './types';

const isWeb = Platform.OS === 'web';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface CallRoomControlsProps {
  state: CallState;
  onMute?: () => void;
  onHold?: () => void;
  onKeypad?: () => void;
  onTransfer?: () => void;
  onEnd?: () => void;
  /** True when the right column is currently showing the keypad panel. */
  keypadActive?: boolean;
  /** True when the right column is currently showing the transfer panel. */
  transferActive?: boolean;
}

export function CallRoomControls(props: CallRoomControlsProps): React.ReactElement {
  const noop = () => {};
  return (
    <View style={styles.row} testID="call-room-controls">
      <ControlBtn
        icon={props.state.isMuted ? 'mic-off-outline' : 'mic-outline'}
        label="Mute"
        active={props.state.isMuted}
        onPress={props.onMute ?? noop}
      />
      <ControlBtn
        icon="pause-outline"
        label="Hold"
        active={props.state.isOnHold}
        onPress={props.onHold ?? noop}
      />
      <ControlBtn
        icon="keypad-outline"
        label="Keypad"
        active={props.keypadActive}
        onPress={props.onKeypad ?? noop}
      />
      <ControlBtn
        icon="swap-horizontal-outline"
        label="Transfer"
        active={props.transferActive}
        onPress={props.onTransfer ?? noop}
      />
      <EndCallBtn onPress={props.onEnd ?? noop} />
    </View>
  );
}

function ControlBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.btn,
        hovered && styles.btnHover,
        pressed && styles.btnPressed,
        active && styles.btnActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? 'rgba(150,195,235,1)' : 'rgba(255,255,255,0.92)'}
        style={styles.btnIcon}
      />
      <Text style={styles.btnLabel}>{label}</Text>
    </Pressable>
  );
}

function EndCallBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      testID="end-call-btn"
      accessibilityRole="button"
      accessibilityLabel="End Call"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.endBtn,
        hovered && styles.endBtnHover,
        pressed && styles.endBtnPressed,
      ]}
    >
      {/* Phone glyph rotated 135° = universal "end call" hangup icon. */}
      <Ionicons name="call" size={15} color="#fff" style={styles.endBtnIcon} />
      <Text style={styles.endBtnLabel}>End Call</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Floating glass pill — recessed bowl with chamfered top rim.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 12, 22, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...(isWeb
      ? ({
          backdropFilter: 'blur(14px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.3)',
          boxShadow:
            // soft outer halo (aspire blue, low intensity)
            '0 0 32px rgba(120,170,220,0.10), ' +
            // sit-above shadow grounds the pill
            '0 10px 28px rgba(0,0,0,0.55), ' +
            // top-edge chamfer highlight (light catching the rim)
            'inset 0 1px 0 rgba(255,255,255,0.10), ' +
            // bottom inner shadow (recessed bowl floor)
            'inset 0 -2px 6px rgba(0,0,0,0.5)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }),
  },

  // Default key — flat-ish on the bowl floor with a subtle top highlight.
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.08), ' +
            'inset 0 -1px 2px rgba(0,0,0,0.3)',
          transition:
            'transform 140ms ease-out, background-color 140ms ease-out, box-shadow 140ms ease-out',
        } as object)
      : {}),
  },
  // Hover — key lifts and catches more light.
  btnHover: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderColor: 'rgba(255,255,255,0.12)',
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.16), ' +
            'inset 0 -1px 2px rgba(0,0,0,0.3), ' +
            '0 3px 8px rgba(0,0,0,0.35)',
          transform: 'translateY(-1px)',
        } as object)
      : {}),
  },
  // Pressed — key compresses into the bar floor.
  btnPressed: {
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderColor: 'rgba(0,0,0,0.5)',
    ...(isWeb
      ? ({
          boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.55)',
          transform: 'translateY(1px) scale(0.98)',
        } as object)
      : {}),
  },
  // Toggled-on (mute/hold) — aspire-blue tinted with a small glow halo.
  btnActive: {
    backgroundColor: 'rgba(120,170,220,0.22)',
    borderColor: 'rgba(120,170,220,0.55)',
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.18), ' +
            'inset 0 -1px 2px rgba(0,0,0,0.3), ' +
            '0 0 14px rgba(120,170,220,0.4)',
        } as object)
      : {}),
  },
  btnIcon: { marginRight: 7 },
  btnLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 13, letterSpacing: 0.1 },

  // End Call — convex raised key with vertical red gradient face.
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    marginLeft: 4,
    backgroundColor: '#dc2626',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.5)',
    ...(isWeb
      ? ({
          // gradient face: bright top -> base red -> dark bottom = convex bevel
          background:
            'linear-gradient(180deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
          boxShadow:
            '0 0 18px rgba(220,38,38,0.45), ' +
            '0 4px 10px rgba(0,0,0,0.55), ' +
            'inset 0 1px 0 rgba(255,255,255,0.35), ' +
            'inset 0 -2px 4px rgba(0,0,0,0.45)',
          transition: 'transform 140ms ease-out, box-shadow 140ms ease-out',
        } as object)
      : {
          shadowColor: '#7f1d1d',
          shadowOpacity: 0.6,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }),
  },
  endBtnHover: {
    ...(isWeb
      ? ({
          boxShadow:
            '0 0 26px rgba(220,38,38,0.6), ' +
            '0 6px 14px rgba(0,0,0,0.6), ' +
            'inset 0 1px 0 rgba(255,255,255,0.4), ' +
            'inset 0 -2px 4px rgba(0,0,0,0.45)',
          transform: 'translateY(-1px)',
        } as object)
      : {}),
  },
  endBtnPressed: {
    ...(isWeb
      ? ({
          background:
            'linear-gradient(180deg, #b91c1c 0%, #991b1b 50%, #7f1d1d 100%)',
          boxShadow:
            '0 0 10px rgba(220,38,38,0.3), ' +
            '0 1px 3px rgba(0,0,0,0.5), ' +
            'inset 0 2px 5px rgba(0,0,0,0.55)',
          transform: 'translateY(1px) scale(0.98)',
        } as object)
      : {}),
  },
  // 135° rotation = universal "hung up" phone glyph (iOS/Android convention).
  endBtnIcon: { marginRight: 7, transform: [{ rotate: '135deg' }] },
  endBtnLabel: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
});
