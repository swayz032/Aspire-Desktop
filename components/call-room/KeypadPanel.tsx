// components/call-room/KeypadPanel.tsx
//
// DTMF keypad — replaces AI Assist in the right column when the Keypad
// control is active. Each press appends a digit to the display strip and
// (in production) would emit the corresponding DTMF tone over the call.
// Tactile button physics match the control bar: rest -> hover lift ->
// press compress.
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';

export interface KeypadPanelProps {
  onBack: () => void;
  /** Optional hook for emitting a DTMF tone. */
  onDtmf?: (digit: string) => void;
  /** Swap to the Contacts panel (Add Call by saved contact). */
  onOpenContacts?: () => void;
  /** Add the typed number as a 3rd party on the line (Add Call by number). */
  onAddCall?: (digits: string) => void;
}

interface Key {
  digit: string;
  letters?: string;
}

// Phone keypad standard layout — letters per ITU E.161.
const KEYS: Key[][] = [
  [
    { digit: '1' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
  ],
  [
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
  ],
  [
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ],
  [
    { digit: '*' },
    { digit: '0', letters: '+' },
    { digit: '#' },
  ],
];

export function KeypadPanel({
  onBack,
  onDtmf,
  onOpenContacts,
  onAddCall,
}: KeypadPanelProps): React.ReactElement {
  const [pressed, setPressed] = useState<string>('');

  const press = (d: string) => {
    setPressed((p) => (p + d).slice(-24));
    onDtmf?.(d);
  };
  const backspace = () => setPressed((p) => p.slice(0, -1));
  const addCall = () => {
    if (pressed.length === 0) return;
    onAddCall?.(pressed);
  };
  const canAddCall = pressed.length > 0;

  return (
    <View style={styles.panel} testID="keypad-panel">
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>KEYPAD</Text>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to AI Assist"
          style={({ hovered }: { hovered?: boolean }) => [
            styles.backLink,
            hovered && styles.backLinkHover,
          ]}
        >
          <Ionicons name="arrow-back" size={12} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backLinkText}>AI Assist</Text>
        </Pressable>
      </View>

      {/* Action chips — iPhone-style "Add Call by contact" route. The
          number-based Add Call lives in the display strip below as a
          dedicated green call button. */}
      <View style={styles.chipRow}>
        <Pressable
          onPress={onOpenContacts}
          accessibilityRole="button"
          accessibilityLabel="Open Contacts"
          style={({ pressed: p, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.chip,
            hovered && styles.chipHover,
            p && styles.chipPressed,
          ]}
          testID="open-contacts"
        >
          <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.chipText}>Contacts</Text>
        </Pressable>
      </View>

      <View style={styles.display}>
        <Text style={styles.displayText} numberOfLines={1} testID="keypad-display">
          {pressed || ' '}
        </Text>
        <Pressable
          onPress={backspace}
          accessibilityRole="button"
          accessibilityLabel="Backspace"
          disabled={pressed.length === 0}
          style={({ pressed: p, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.displayBtn,
            hovered && styles.displayBtnHover,
            p && styles.displayBtnPressed,
            pressed.length === 0 && styles.displayBtnDisabled,
          ]}
        >
          <Ionicons name="backspace-outline" size={15} color="rgba(255,255,255,0.85)" />
        </Pressable>
        <Pressable
          onPress={addCall}
          accessibilityRole="button"
          accessibilityLabel="Add this number to the call"
          disabled={!canAddCall}
          testID="add-call-btn"
          style={({ pressed: p, hovered }: { pressed: boolean; hovered?: boolean }) => [
            styles.callBtn,
            hovered && canAddCall && styles.callBtnHover,
            p && canAddCall && styles.callBtnPressed,
            !canAddCall && styles.callBtnDisabled,
          ]}
        >
          <Ionicons name="call" size={14} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((key) => (
              <KeyBtn key={key.digit} k={key} onPress={() => press(key.digit)} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function KeyBtn({ k, onPress }: { k: Key; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Keypad ${k.digit}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.key,
        hovered && styles.keyHover,
        pressed && styles.keyPressed,
      ]}
    >
      <Text style={styles.keyDigit}>{k.digit}</Text>
      {k.letters ? <Text style={styles.keyLetters}>{k.letters}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Locked to 280 to match AI Assist's default render — section size never
  // shifts when toggling between AI Assist / Keypad / Transfer.
  panel: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    height: 280,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    ...(isWeb
      ? ({ transition: 'background-color 140ms ease-out' } as object)
      : {}),
  },
  backLinkHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  backLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 2 },

  // Action chips above the display — iPhone-style entry points
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(isWeb
      ? ({
          transition:
            'transform 140ms ease-out, background-color 140ms ease-out',
        } as object)
      : {}),
  },
  chipHover: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.15)',
    ...(isWeb ? ({ transform: 'translateY(-1px)' } as object) : {}),
  },
  chipPressed: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    ...(isWeb ? ({ transform: 'translateY(1px) scale(0.98)' } as object) : {}),
  },
  chipText: { color: 'rgba(255,255,255,0.88)', fontSize: 11, fontWeight: '500' },

  display: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 2px 5px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.04)',
        } as object)
      : {}),
  },
  displayText: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    minHeight: 18,
  },
  displayBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    ...(isWeb
      ? ({ transition: 'background-color 140ms ease-out, transform 140ms ease-out' } as object)
      : {}),
  },
  displayBtnHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
  displayBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    ...(isWeb ? ({ transform: 'scale(0.95)' } as object) : {}),
  },
  displayBtnDisabled: { opacity: 0.3 },

  // Green Add-Call button — pop-out raised key inside the display strip
  callBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.4)',
    ...(isWeb
      ? ({
          background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
          boxShadow:
            '0 0 14px rgba(34,197,94,0.4), ' +
            '0 2px 5px rgba(0,0,0,0.45), ' +
            'inset 0 1px 0 rgba(255,255,255,0.3), ' +
            'inset 0 -2px 3px rgba(0,0,0,0.4)',
          transition: 'transform 140ms ease-out, box-shadow 140ms ease-out',
        } as object)
      : {
          shadowColor: '#14532d',
          shadowOpacity: 0.55,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }),
  },
  callBtnHover: {
    ...(isWeb
      ? ({
          boxShadow:
            '0 0 20px rgba(34,197,94,0.55), ' +
            '0 4px 10px rgba(0,0,0,0.5), ' +
            'inset 0 1px 0 rgba(255,255,255,0.35), ' +
            'inset 0 -2px 3px rgba(0,0,0,0.4)',
          transform: 'translateY(-1px)',
        } as object)
      : {}),
  },
  callBtnPressed: {
    ...(isWeb
      ? ({
          background: 'linear-gradient(180deg, #15803d 0%, #166534 50%, #14532d 100%)',
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.5)',
          transform: 'translateY(1px) scale(0.96)',
        } as object)
      : {}),
  },
  callBtnDisabled: {
    opacity: 0.35,
    ...(isWeb
      ? ({
          background: 'linear-gradient(180deg, #4b5563 0%, #374151 50%, #1f2937 100%)',
          boxShadow: 'none',
        } as object)
      : {}),
  },

  grid: { flex: 1, gap: 4, justifyContent: 'space-between' },
  gridRow: { flex: 1, flexDirection: 'row', gap: 4 },

  // 3D key — convex top with chamfered light, sits on the panel
  key: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 4px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.3)',
          transition:
            'transform 120ms ease-out, background-color 120ms ease-out, box-shadow 120ms ease-out',
          userSelect: 'none',
        } as object)
      : {}),
  },
  keyHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -2px 4px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.4)',
          transform: 'translateY(-1px)',
        } as object)
      : {}),
  },
  keyPressed: {
    backgroundColor: 'rgba(120,170,220,0.18)',
    borderColor: 'rgba(120,170,220,0.45)',
    ...(isWeb
      ? ({
          boxShadow:
            'inset 0 2px 5px rgba(0,0,0,0.55), 0 0 12px rgba(120,170,220,0.35)',
          transform: 'translateY(1px) scale(0.97)',
        } as object)
      : {}),
  },
  keyDigit: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    lineHeight: 19,
  },
  keyLetters: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    letterSpacing: 1.2,
    marginTop: 1,
    fontWeight: '600',
  },
});
