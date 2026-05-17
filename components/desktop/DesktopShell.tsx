import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { DesktopHeader } from './DesktopHeader';
import { DesktopSidebar } from './DesktopSidebar';
import { Colors, Canvas } from '@/constants/tokens';
import { useSidebarState } from '@/lib/uiStore';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface DesktopShellProps {
  children: ReactNode;
  hideSidebar?: boolean;
  fullBleed?: boolean;
}

function DesktopShellInner({ children, hideSidebar = false, fullBleed = false }: DesktopShellProps) {
  const { sidebarExpanded } = useSidebarState();
  const { width } = useWindowDimensions();

  // iPad-landscape no-man's-land: 1024 <= width < 1280. At this band the
  // default 1280 maxWidth lets pages span the full chrome inset (no outer
  // gutter), so columns sized for desktop end up clipped at the right edge.
  // Cap the shell at `tabletLandscapeMaxWidth` (1100) so non-fullBleed pages
  // center inside a polite gutter and right rails get breathing room.
  const isTabletLandscape =
    Platform.OS === 'web' &&
    width >= Canvas.layout.tabletLandscapeLower &&
    width < Canvas.layout.tabletLandscapeUpper;
  const innerMaxWidth = isTabletLandscape
    ? Canvas.layout.tabletLandscapeMaxWidth
    : 1280;

  return (
    <View style={styles.container}>
      {/* Sidebar on the left - full height from top to bottom */}
      {!hideSidebar && <DesktopSidebar expanded={sidebarExpanded} />}

      {/* Right side: Header on top, content below */}
      <View style={styles.rightSection}>
        <DesktopHeader />
        <View style={styles.content}>
          {fullBleed ? (
            children
          ) : (
            <View style={[styles.contentInner, { maxWidth: innerMaxWidth }]}>
              {children}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    ...(Platform.OS === 'web' ? {
      // dvh = dynamic viewport height — always matches the current visible
      // viewport. Replaces vh which was iOS Safari's "URL-bar-hidden"
      // height, causing the page to jump when the URL bar showed/hid on
      // scroll AND inflating to ~1700px on tablet width=1280 viewport.
      // Safari 16.4+ (Mar 2023) and all modern Chrome/FF support dvh —
      // covers every iPad/Android tablet we ship to.
      height: '100dvh',
      maxHeight: '100dvh',
      overflow: 'hidden',
      width: '100vw',
      maxWidth: '100vw',
      // Stop iOS Safari rubber-band bounce / pull-to-refresh that moves
      // the page around when the user just wants to tap or scroll a
      // child ScrollView.
      overscrollBehavior: 'none',
    } : {}),
  } as any,
  rightSection: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    overflow: 'hidden',
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
  },
  contentInner: {
    flex: 1,
    // maxWidth applied inline (1280 default, tablet-landscape cap from tokens).
    alignSelf: 'center',
    width: '100%',
    overflow: 'hidden',
    height: '100%',
    maxHeight: '100%',
    minHeight: 0,
  },
});

export function DesktopShell(props: any) {
  return (
    <PageErrorBoundary pageName="desktop-shell">
      <DesktopShellInner {...props} />
    </PageErrorBoundary>
  );
}
