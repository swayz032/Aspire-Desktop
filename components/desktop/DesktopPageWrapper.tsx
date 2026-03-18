import React, { ReactNode } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { DesktopShell } from './DesktopShell';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface DesktopPageWrapperProps {
  children: ReactNode;
  scrollable?: boolean;
  fullWidth?: boolean;
  fullBleed?: boolean;
}

function DesktopPageWrapperInner({ 
  children, 
  scrollable = true,
  fullWidth = false,
  fullBleed = false 
}: DesktopPageWrapperProps) {
  return (
    <DesktopShell fullBleed={fullBleed}>
      {scrollable ? (
        <ScrollView 
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            fullWidth && styles.fullWidth
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.container, styles.content, fullWidth && styles.fullWidth]}>
          {children}
        </View>
      )}
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    overflow: 'hidden',
  },
  content: {
    padding: 24,
  },
  fullWidth: {
    padding: 0,
  },
});

export function DesktopPageWrapper(props: any) {
  return (
    <PageErrorBoundary pageName="desktop-page-wrapper">
      <DesktopPageWrapperInner {...props} />
    </PageErrorBoundary>
  );
}
