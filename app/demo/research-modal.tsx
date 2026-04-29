/**
 * ResearchModal Demo — Mounts the Ava Presents 3D carousel with mock records.
 *
 * Used by the Playwright spec `e2e/research-modal-carousel.spec.ts` to verify
 * the perspective-transformed carousel renders the correct cards as side peeks
 * and that activeIndex navigation (click / arrow keys / dot pager) works.
 *
 * URL params:
 *   - ?count=N   number of records to mount (default: 3)
 *   - ?type=...  artifact_type (default: 'HotelShortlist')
 *
 * Access: http://127.0.0.1:4173/demo/research-modal
 *         http://127.0.0.1:4173/demo/research-modal?count=1
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ResearchModal } from '@/components/cards/ResearchModal';
import { useAvaPresents } from '@/hooks/useAvaPresents';
import { Colors } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

function buildMockRecords(count: number): Record<string, unknown>[] {
  const cities = ['Tallahassee, FL', 'Atlanta, GA', 'Orlando, FL', 'Tampa, FL', 'Miami, FL'];
  return Array.from({ length: count }, (_, i) => ({
    name: `Demo Hotel ${i + 1}`,
    address: `${100 + i * 100} Demo Street, ${cities[i % cities.length]}`,
    rating: 4.0 + (i % 5) * 0.2,
    review_count: 100 + i * 50,
    safety_score: 7 + (i % 3),
    price_per_night: 120 + i * 20,
    photo_url: 'https://placehold.co/640x360/0a0a0a/3B82F6?text=Hotel',
  }));
}

function ResearchModalDemoContent() {
  const params = useLocalSearchParams<{ count?: string; type?: string }>();
  const count = Math.max(1, Number(params.count ?? '3') || 3);
  const artifactType = (params.type as string) || 'HotelShortlist';

  const presents = useAvaPresents();

  useEffect(() => {
    presents.showCards({
      artifactType,
      records: buildMockRecords(count),
      summary: `Found ${count} demo records`,
      confidence: { status: 'verified', score: 0.95 },
    });
    // Run once on mount with the params for this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, artifactType]);

  return (
    <View style={styles.root} testID="research-modal-demo-root">
      <ResearchModal {...presents} />
    </View>
  );
}

export default function ResearchModalDemo() {
  return (
    <PageErrorBoundary pageName="research-modal-demo">
      <ResearchModalDemoContent />
    </PageErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as unknown as number } : {}),
  },
});
