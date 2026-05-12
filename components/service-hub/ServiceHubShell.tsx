import React from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { ServiceHubTopNav } from './ServiceHubTopNav';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const RIGHT_RAIL_BREAKPOINT = 1100;
const BREAKPOINT_LAPTOP = 960;

type Props = {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
};

function ServiceHubShellInner({ children, rightRail }: Props) {
  const { width } = useWindowDimensions();
  const showRailColumn = width >= RIGHT_RAIL_BREAKPOINT;
  const isTabletOrSmaller = width < BREAKPOINT_LAPTOP;

  return (
    <View style={styles.container}>
      <ServiceHubTopNav isTablet={isTabletOrSmaller} />
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
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    // Truly immersive — 4px breathing edge between TopNav and canvas
    // top, and 4px on the sides so the canvas's amber inner glow has
    // room to read without bleeding into the TopNav. Zero would clip
    // the rounded corners against the viewport edge on web.
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  contentStacked: {
    flexDirection: 'column',
  },
  mainArea: {
    flex: 1,
    overflow: 'hidden',
  },
  rightRail: {
    width: 320,
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
    // flexGrow:1 lets the canvas inherit the full ScrollView height so
    // it renders the SAME size whether the content is the empty state
    // or the heavy 3D Aerial hero. Without this, RNW shrinks the
    // contentContainer to its children's natural height.
    flexGrow: 1,
    padding: 0,
    paddingBottom: 0,
  },
});

export function ServiceHubShell(props: Props) {
  return (
    <PageErrorBoundary pageName="service-hub-shell">
      <ServiceHubShellInner {...props} />
    </PageErrorBoundary>
  );
}
