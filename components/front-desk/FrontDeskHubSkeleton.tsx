import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

const CARD_BG = '#1C1C1E';
const CARD_BORDER = 'rgba(255,255,255,0.07)';
const CARD_RADIUS = 14;

const BREAKPOINT_TWO_COL = 1100;

export function FrontDeskHubSkeleton() {
  const { width } = useWindowDimensions();
  const twoCol = width >= BREAKPOINT_TWO_COL;

  return (
    <View style={[styles.root, twoCol ? styles.rootRow : styles.rootStack]}>
      <View style={styles.mainCol}>
        <View style={[styles.card, styles.stageCard]} />
        <View style={[styles.card, styles.workstripCard]} />
      </View>
      <View style={twoCol ? styles.railCol : styles.railColStacked}>
        <View style={[styles.card, styles.messagesCard]} />
        <View style={[styles.card, styles.dialPadCard]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 16,
    padding: 16,
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
  },
  railCol: {
    width: 380,
    gap: 16,
  },
  railColStacked: {
    width: '100%',
    gap: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: CARD_RADIUS,
  },
  stageCard: {
    flex: 1,
    minHeight: 560,
  },
  workstripCard: {
    height: 220,
  },
  messagesCard: {
    flex: 1,
    minHeight: 560,
  },
  dialPadCard: {
    height: 360,
  },
});
