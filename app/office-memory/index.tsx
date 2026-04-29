/**
 * /office-memory — hero search landing page.
 *
 * Plain composition: DesktopShell chrome wraps a single MemoryEngineHero
 * which fills the available content area. On submit, route to /results
 * with the query in the URL.
 */

import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { MemoryEngineHero } from '@/components/office-memory/MemoryEngineHero';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function OfficeMemoryIndexInner() {
  const router = useRouter();

  const handleSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      router.push(`/office-memory/results?q=${encodeURIComponent(trimmed)}` as any);
    },
    [router],
  );

  return (
    <DesktopShell>
      <View style={styles.shell}>
        <MemoryEngineHero onSearch={handleSearch} />
      </View>
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground,
    // Negate DesktopShell's content padding so the hero is true-bleed
    margin: -16,
  },
});

export default function OfficeMemoryIndex() {
  return (
    <PageErrorBoundary pageName="office-memory-index">
      <OfficeMemoryIndexInner />
    </PageErrorBoundary>
  );
}
