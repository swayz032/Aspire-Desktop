import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { DesktopShell } from './DesktopShell';
import { AvaDeskPanel } from './AvaDeskPanel';
import { InteractionModePanel } from '@/components/InteractionModePanel';
import { OpsSnapshotTabs } from '@/components/OpsSnapshotTabs';
import { TodayPlanTabs } from '@/components/TodayPlanTabs';
import { CalendarCard } from '@/components/CalendarCard';
import { AuthorityQueueCard } from '@/components/AuthorityQueueCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/tokens';
import {
  mockInteractionModes,
  mockCashPosition,
  mockPipelineStages,
  mockAuthorityQueue,
  mockTodaysPlan,
  mockCalendarEvents,
  mockBusinessScore,
} from '@/data/mockData';
import { useDynamicAuthorityQueue } from '@/lib/authorityQueueStore';
import type { CashPosition } from '@/types';

const HEADER_HEIGHT = 72;

export function DesktopHome() {
  const router = useRouter();
  const [liveCashData, setLiveCashData] = useState<CashPosition>(mockCashPosition);
  const dynamicItems = useDynamicAuthorityQueue();
  const allAuthorityItems = useMemo(() => [...dynamicItems, ...mockAuthorityQueue], [dynamicItems]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ops-snapshot');
        if (res.ok) {
          const data = await res.json();
          const cp = data.cashPosition;
          if (cp && (data.providers?.plaid || data.providers?.stripe)) {
            setLiveCashData({
              availableCash: cp.availableCash || 0,
              upcomingOutflows7d: cp.upcomingOutflows7d || 0,
              expectedInflows7d: cp.expectedInflows7d || 0,
              accountsConnected: cp.accountsConnected || 0,
            });
          }
        }
      } catch (e) {
      }
    })();
  }, []);

  const desktopInteractionModes = mockInteractionModes.filter(
    (mode) => mode.id === 'conference' || mode.id === 'calls'
  );

  return (
    <DesktopShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          <View style={styles.threeColWrapper}>
            <View style={styles.leftCol}>
              <View style={styles.section}>
                <SectionHeader title="Interaction Mode" />
                <InteractionModePanel options={desktopInteractionModes} />
              </View>

              <View style={[styles.section, styles.flexSection]}>
                <SectionHeader
                  title="Today's Plan"
                  subtitle={`${mockTodaysPlan.length} tasks`}
                  actionLabel="See all"
                  onAction={() => router.push('/session/plan' as any)}
                />
                <TodayPlanTabs planItems={mockTodaysPlan} />
              </View>
            </View>

            <View style={styles.centerCol}>
              <AvaDeskPanel />
            </View>

            <View style={styles.rightCol}>
              <View style={styles.section}>
                <SectionHeader title="Ops Snapshot" />
                <OpsSnapshotTabs
                  cashData={liveCashData}
                  pipelineStages={mockPipelineStages}
                  businessScore={mockBusinessScore}
                />
              </View>

              <View style={[styles.section, styles.flexSection]}>
                <SectionHeader title="Calendar" />
                <CalendarCard events={mockCalendarEvents as any} />
              </View>
            </View>
          </View>

          <View style={styles.authoritySection}>
            <SectionHeader
              title="Authority Queue"
              actionLabel="View all"
              onAction={() => router.push('/inbox' as any)}
            />
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                overflowX: 'auto',
                overflowY: 'hidden',
                paddingVertical: 4,
                scrollbarWidth: 'thin',
                scrollbarColor: '#3B3B3D transparent',
                alignItems: 'stretch',
              } as any}
            >
              {allAuthorityItems.map((item) => (
                <View key={item.id} style={styles.authorityCardWrapper}>
                  <AuthorityQueueCard
                    item={item}
                    onAction={(action) => {
                      if (action === 'join') {
                        router.push('/session/conference-live' as any);
                      } else if (action === 'review' || action === 'approve') {
                        if (item.type === 'approval') {
                          router.push('/finance-hub/payroll' as any);
                        } else {
                          router.push('/inbox' as any);
                        }
                      }
                    }}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </DesktopShell>
  );
}

const styles = StyleSheet.create({
  scroll: { 
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    minHeight: Platform.OS === 'web' ? 'calc(100vh - 120px)' as any : undefined,
  },
  grid: {
    flexDirection: 'column',
    gap: 16,
  },
  threeColWrapper: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
  },
  leftCol: {
    width: 280,
    gap: 16,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  centerCol: {
    flex: 1,
    minWidth: 440,
    ...(Platform.OS === 'web' ? {
      position: 'relative',
    } : {}),
  } as any,
  rightCol: {
    width: 320,
    gap: 16,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    ...(Platform.OS === 'web' ? {
      backgroundColor: '#1C1C1E',
    } : {
      backgroundColor: '#1C1C1E',
    }),
  } as any,
  flexSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  authoritySection: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    ...(Platform.OS === 'web' ? {
      backgroundColor: '#1C1C1E',
    } : {
      backgroundColor: '#1C1C1E',
    }),
  } as any,
  authorityCardWrapper: {
    width: 300,
    flexShrink: 0,
    display: 'flex',
  },
});
