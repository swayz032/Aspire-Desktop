import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

const CARD_BG = '#1C1C1E';
const CARD_BORDER = 'rgba(255,255,255,0.07)';
const CARD_RADIUS = 14;

// Breakpoint above which we render the right rail next to the main column.
// Below this (tablet portrait / phone) we stack vertically and let internal
// flex ratios scale.
const BREAKPOINT_TWO_COL = 1100;

export function FrontDeskHubSkeleton() {
  const { width } = useWindowDimensions();
  const twoCol = width >= BREAKPOINT_TWO_COL;

  // Card flex ratios mirror the mockup proportions (stage:workstrip ~ 7:3,
  // messages:dialpad ~ 6:4) so all four cards fit a single viewport on any
  // screen ≥ ~720px tall (typical desktop / laptop / tablet).
  return (
    <View style={[styles.root, twoCol ? styles.rootRow : styles.rootStack]}>
      <View style={styles.mainCol}>
        <View style={[styles.card, { flex: 7 }]} />
        <View style={[styles.card, { flex: 3 }]} />
      </View>
      <View style={twoCol ? styles.railCol : styles.railColStacked}>
        <View style={[styles.card, { flex: 6 }]} />
        <View style={[styles.card, { flex: 4 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 16,
    padding: 16,
    minHeight: 0,
  },
  rootRow: {
    flexDirection: 'row',
  },
  rootStack: {
    flexDirection: 'column',
  },
  mainCol: {
    flex: 1,
    gap: 16,
    minWidth: 0,
    minHeight: 0,
  },
  railCol: {
    width: 380,
    gap: 16,
    minHeight: 0,
  },
  railColStacked: {
    width: '100%',
    gap: 16,
    minHeight: 0,
    flex: 1,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: CARD_RADIUS,
  },
});
