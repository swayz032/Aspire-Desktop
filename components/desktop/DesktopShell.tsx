import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { DesktopHeader } from './DesktopHeader';
import { DesktopSidebar } from './DesktopSidebar';
import { Colors } from '@/constants/tokens';
import { useSidebarState } from '@/lib/uiStore';

interface DesktopShellProps {
  children: ReactNode;
  hideSidebar?: boolean;
  fullBleed?: boolean;
}

export function DesktopShell({ children, hideSidebar = false, fullBleed = false }: DesktopShellProps) {
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
  },
  rightSection: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    overflow: 'hidden',
  },
  contentInner: {
    flex: 1,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    overflow: 'hidden',
  },
});
