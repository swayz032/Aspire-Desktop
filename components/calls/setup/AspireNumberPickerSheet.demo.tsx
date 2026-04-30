/**
 * AspireNumberPickerSheet.demo — interactive demo for the Twilio number picker.
 * Provides a button that opens the sheet with various initial states.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Colors } from '@/constants/tokens';
import {
  AspireNumberPickerSheet,
  type PurchasedNumberResult,
} from './AspireNumberPickerSheet';

export default function AspireNumberPickerSheetDemo() {
  const [openA, setOpenA] = useState(false);
  const [openB, setOpenB] = useState(false);
  const [openC, setOpenC] = useState(false);
  const [last, setLast] = useState<PurchasedNumberResult | null>(null);

  const handlePurchased = (r: PurchasedNumberResult) => {
    setLast(r);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        These triggers open the sheet with different initial state. The sheet
        will hit `/v1/twilio/available-numbers` and `/v1/twilio/purchase-number`
        when search and confirm are pressed — until those endpoints are mocked
        you will see the error state, which is expected for the demo.
      </Text>

      <DemoBtn label="Open empty (no defaults)" onPress={() => setOpenA(true)} />
      <DemoBtn label="Open with area code 212 prefilled" onPress={() => setOpenB(true)} />
      <DemoBtn label="Open with vanity 'PAINT'" onPress={() => setOpenC(true)} />

      {last ? (
        <View style={styles.lastBox} accessibilityRole="alert">
          <Text style={styles.lastLabel}>Last purchase result</Text>
          <Text style={styles.lastValue}>{last.friendlyName}</Text>
          <Text style={styles.lastSubtle}>{last.phoneNumber}</Text>
        </View>
      ) : null}

      <AspireNumberPickerSheet
        visible={openA}
        onClose={() => setOpenA(false)}
        onPurchased={(r) => {
          handlePurchased(r);
          setOpenA(false);
        }}
      />
      <AspireNumberPickerSheet
        visible={openB}
        onClose={() => setOpenB(false)}
        onPurchased={(r) => {
          handlePurchased(r);
          setOpenB(false);
        }}
        initialAreaCode="212"
      />
      <AspireNumberPickerSheet
        visible={openC}
        onClose={() => setOpenC(false)}
        onPurchased={(r) => {
          handlePurchased(r);
          setOpenC(false);
        }}
        initialAreaCode="404"
        initialContains="PAINT"
      />
    </ScrollView>
  );
}

function DemoBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.btn}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}),
  } as any,
  content: {
    padding: 32,
    gap: 14,
    maxWidth: 720,
  },
  intro: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 19,
    marginBottom: 8,
  },
  btn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent.cyan,
    letterSpacing: 0.1,
  },
  lastBox: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.34)',
    gap: 4,
    marginTop: 12,
  },
  lastLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.semantic.success,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  lastValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  lastSubtle: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
});
