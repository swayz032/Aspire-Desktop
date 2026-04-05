import React from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { DesktopHome } from '@/components/desktop/DesktopHome';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useTenant } from '@/providers';
import { Colors } from '@/constants/tokens';

function HomeContent() {
  const { tenant, isLoading } = useTenant();

  // Gate: don't render dashboard until tenant data is available
  // If bootstrap cache provided initial data, tenant is non-null immediately
  if (isLoading && !tenant) {
    return (
      <View style={styles.loadingGate}>
        <ActivityIndicator size="large" color={Colors.accent.cyan} />
      </View>
    );
  }

  return <DesktopHome />;
}

export default function HomeScreen() {
  return (
    <PageErrorBoundary pageName="home">
      <HomeContent />
    </PageErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary,
  },
});
