import React from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { FinanceTopNav } from './FinanceTopNav';
import { Colors } from '@/constants/tokens';

const RIGHT_RAIL_BREAKPOINT = 1100;

type Props = {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
};

export function FinanceHubShell({ children, rightRail }: Props) {
  const { width } = useWindowDimensions();
  const showRailColumn = width >= RIGHT_RAIL_BREAKPOINT;

  return (
    <View style={styles.container}>
      <FinanceTopNav />
      <View style={[styles.content, !showRailColumn && styles.contentStacked]}>
        <View style={styles.mainArea}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
            {rightRail && !showRailColumn && (
              <View style={styles.rightRailInline}>
                {rightRail}
              </View>
            )}
          </ScrollView>
        </View>
        {rightRail && showRailColumn && (
          <View style={styles.rightRail}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {rightRail}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: Colors.background.primary,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  contentStacked: {
    flexDirection: 'column',
  },
  mainArea: {
    flex: 1,
  },
  rightRail: {
    width: 260,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rightRailInline: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.background.tertiary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 64,
  },
});
