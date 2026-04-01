import React from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { FinanceTopNav } from './FinanceTopNav';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const RIGHT_RAIL_BREAKPOINT = 1100;
const BREAKPOINT_LAPTOP = 960;
const BREAKPOINT_TABLET = 768;

type Props = {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
};

function FinanceHubShellInner({ children, rightRail }: Props) {
  const { width } = useWindowDimensions();
  const showRailColumn = width >= RIGHT_RAIL_BREAKPOINT;
  const isTabletOrSmaller = width < BREAKPOINT_LAPTOP;

  return (
    <View style={styles.container}>
      <FinanceTopNav isTablet={isTabletOrSmaller} />
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
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
    overflow: 'hidden',
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

export function FinanceHubShell(props: any) {
  return (
    <PageErrorBoundary pageName="finance-hub-shell">
      <FinanceHubShellInner {...props} />
    </PageErrorBoundary>
  );
}
