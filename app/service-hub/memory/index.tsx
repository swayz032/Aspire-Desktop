/**
 * /service-hub/memory — hero search landing page.
 *
 * Mirror of `/office-memory` (Pass 12) wrapped in ServiceHubShell. The single
 * ServiceMemoryHero fills the available content area. On submit, route to
 * /service-hub/memory/results?q=... with the query in the URL.
 */

import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ServiceHubShell } from '@/components/service-hub/ServiceHubShell';
import { ServiceMemoryHero } from '@/components/service-hub/ServiceMemoryHero';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function ServiceMemoryIndexInner() {
  const router = useRouter();

  const handleSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      router.push(
        `/service-hub/memory/results?q=${encodeURIComponent(trimmed)}` as never,
      );
    },
    [router],
  );

  return (
    <ServiceHubShell>
      <View style={styles.shell}>
        <ServiceMemoryHero onSearch={handleSearch} />
      </View>
    </ServiceHubShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground,
    // Negate ServiceHubShell content padding so the hero is true full-bleed.
    marginHorizontal: -16,
    marginVertical: -16,
    minHeight: 600,
  },
});

export default function ServiceMemoryIndex() {
  return (
    <PageErrorBoundary pageName="service-memory-index">
      <ServiceMemoryIndexInner />
    </PageErrorBoundary>
  );
}
