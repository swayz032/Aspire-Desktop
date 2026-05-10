import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { DesktopHeader } from './DesktopHeader';
import { DesktopSidebar } from './DesktopSidebar';
import { Colors } from '@/constants/tokens';
import { useSidebarState } from '@/lib/uiStore';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface DesktopShellProps {
  children: ReactNode;
  hideSidebar?: boolean;
  fullBleed?: boolean;
}

function DesktopShellInner({ children, hideSidebar = false, fullBleed = false }: DesktopShellProps) {
  const { sidebarExpanded } = useSidebarState();

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
            <View style={styles.contentInner}>
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
    maxWidth: 1280,
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
