/**
 * /office-memory/[memoryId] — full memory detail page.
 *
 * Layout (per plan §8.2):
 *   - DesktopShell chrome
 *   - Page padding 32 horizontal, 24 vertical
 *   - MemoryDetailHeader (full width)
 *   - 2-column grid (web) / stack (native):
 *       Left col:  MemorySummaryCard, MemoryKeyDecisionsCard
 *       Right col: MemoryDetailsCard, MemoryLinkedFactsGrid
 *   - MemoryActivityReceiptsRow (full width, bottom)
 *
 * Background = Colors.memory.pageBackground (#0a0a0c).
 *
 * Loading + error states: subtle inline messages (no skeleton stage in V1
 * since the placeholder hook is synchronous). When backend lands the hook
 * returns loading/error and this page upgrades to skeleton states.
 */

import React, { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { MemoryDetailHeader } from '@/components/office-memory/MemoryDetailHeader';
import { MemorySummaryCard } from '@/components/office-memory/MemorySummaryCard';
import { MemoryKeyDecisionsCard } from '@/components/office-memory/MemoryKeyDecisionsCard';
import { MemoryDetailsCard } from '@/components/office-memory/MemoryDetailsCard';
import { MemoryLinkedFactsGrid } from '@/components/office-memory/MemoryLinkedFactsGrid';
import { MemoryActivityReceiptsRow } from '@/components/office-memory/MemoryActivityReceiptsRow';
import { useMemoryDetail } from '@/lib/memory/useMemoryDetail';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function OfficeMemoryDetailInner() {
  const router = useRouter();
  const { memoryId } = useLocalSearchParams<{ memoryId: string }>();
  const { memory, loading, error } = useMemoryDetail(memoryId);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.push('/office-memory' as any);
  }, [router]);

  const handleAction = useCallback(
    (action: string) => {
      // V1: log only — backend wire-in happens in Pass 8 (Lane B agent tools).
      console.log(`[memory ${memoryId}] action:`, action);
    },
    [memoryId],
  );

  // ───── Empty / loading / error states ─────
  if (loading) {
    return (
      <DesktopShell>
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>Loading memory…</Text>
        </View>
      </DesktopShell>
    );
  }

  if (error || !memory) {
    return (
      <DesktopShell>
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>Memory not found.</Text>
        </View>
      </DesktopShell>
    );
  }

  return (
    <DesktopShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <MemoryDetailHeader
          memory={memory}
          onBack={handleBack}
          onAction={handleAction}
        />

        {/* 2-column grid (web) / stack (native) */}
        <View style={styles.grid}>
          <View style={styles.colLeft}>
            <MemorySummaryCard summary={memory.summary} />
            <MemoryKeyDecisionsCard items={memory.keyDecisions} />
          </View>

          <View style={styles.colRight}>
            <MemoryDetailsCard
              details={{
                participants: memory.participants,
                location: memory.location,
                createdBy: memory.createdBy,
                tags: memory.tags,
              }}
            />
            <MemoryLinkedFactsGrid
              facts={memory.linkedFacts}
              onFactPress={(f) => console.log('linked fact:', f.id)}
              onAddLink={() => console.log('add link')}
            />
          </View>
        </View>

        {/* Bottom row */}
        <View style={styles.bottomSpacer} />
        <MemoryActivityReceiptsRow
          files={memory.activityFiles}
          onFilePress={(f) => console.log('open file:', f.id)}
        />
      </ScrollView>
    </DesktopShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground,
    margin: -16, // negate DesktopShell content padding
  },
  container: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    paddingBottom: 64,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%' as unknown as number,
  },
  grid: {
    // Web: side-by-side 2-col; native: stacked
    ...(Platform.OS === 'web'
      ? ({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 } as unknown as ViewStyle)
      : { gap: 24 }),
  },
  colLeft: {
    gap: 24,
    minWidth: 0,
  },
  colRight: {
    gap: 24,
    minWidth: 0,
  },
  bottomSpacer: {
    height: 24,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 96,
    backgroundColor: Colors.memory.pageBackground,
    margin: -16,
  },
  stateText: {
    fontSize: 16,
    color: Colors.text.tertiary,
    fontWeight: '400',
  },
});

export default function OfficeMemoryDetail() {
  return (
    <PageErrorBoundary pageName="office-memory-detail">
      <OfficeMemoryDetailInner />
    </PageErrorBoundary>
  );
}
