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
import { getAuthorityQueue, getCalendarEvents, getCashPosition } from '@/lib/api';
import { useDynamicAuthorityQueue } from '@/lib/authorityQueueStore';
import type { CashPosition, AuthorityItem } from '@/types';

const INTERACTION_MODES = [
  { id: 'conference', icon: 'people', title: 'Conference Call', subtitle: 'Multi-party business calls', route: '/session/conference-lobby' },
  { id: 'calls', icon: 'call', title: 'Return Calls', subtitle: 'Creates receipt', route: '/session/calls' },
  { id: 'messages', icon: 'chatbubble-ellipses', title: 'Text Messages', subtitle: 'SMS conversations', route: '/session/messages' },
];

const EMPTY_CASH: CashPosition = { availableCash: 0, upcomingOutflows7d: 0, expectedInflows7d: 0, accountsConnected: 0 };

const HEADER_HEIGHT = 72;

export function DesktopHome() {
  const router = useRouter();
  const [liveCashData, setLiveCashData] = useState<CashPosition>(EMPTY_CASH);
  const [supabaseAuthority, setSupabaseAuthority] = useState<AuthorityItem[]>([]);
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [businessScore, setBusinessScore] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const dynamicItems = useDynamicAuthorityQueue();
  const allAuthorityItems = useMemo(
    () => [...dynamicItems, ...supabaseAuthority],
    [dynamicItems, supabaseAuthority],
  );

  useEffect(() => {
    // Fetch live cash position from ops-snapshot
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
      } catch (e) { /* ops-snapshot not available */ }
    })();

    // Fetch authority queue from Supabase
    (async () => {
      try {
        const rows = await getAuthorityQueue();
        if (rows.length > 0) {
          setSupabaseAuthority(
            rows.map((r: any) => ({
              id: r.id ?? r.request_id ?? '',
              title: r.title ?? r.action_type ?? 'Approval Request',
              subtitle: r.subtitle ?? `Suite ${r.suite_id ?? ''}`,
              type: r.type ?? 'approval',
              status: r.status ?? 'pending',
              priority: r.priority ?? 'medium',
              timestamp: r.created_at ?? new Date().toISOString(),
              actions: ['review', 'approve', 'deny'],
              staffRole: r.actor ?? r.staff_role ?? '',
            })),
          );
        }
      } catch (e) { /* authority queue not available */ }
    })();

    // Fetch calendar events from Supabase
    (async () => {
      try {
        const events = await getCalendarEvents();
        setCalendarEvents(events);
      } catch (e) { /* calendar not available */ }
    })();

    // Fetch Today's Plan from pending approvals + outbox jobs
    (async () => {
      try {
        const res = await fetch('/api/authority-queue');
        if (res.ok) {
          const data = await res.json();
          const pending = data.pendingApprovals || [];
          const items = pending.slice(0, 4).map((p: any, idx: number) => ({
            id: p.id || `plan-${idx}`,
            time: idx === 0 ? 'Next' : new Date(p.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `Review: ${p.title || p.type || 'Approval Request'}`,
            details: p.amount ? `$${p.amount.toLocaleString()} ${p.currency?.toUpperCase() || 'USD'} — ${p.requestedBy || 'System'}` : (p.requestedBy || 'Pending approval'),
            status: idx === 0 ? 'next' : 'upcoming',
            staffRole: p.requestedBy || '',
          }));
          setPlanItems(items);
        }
      } catch (e) { /* plan not available */ }
    })();
  }, []);

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
                <InteractionModePanel options={INTERACTION_MODES} />
              </View>

              <View style={[styles.section, styles.flexSection]}>
                <SectionHeader
                  title="Today's Plan"
                  subtitle={`${planItems.length} tasks`}
                  actionLabel="See all"
                  onAction={() => router.push('/session/plan' as any)}
                />
                <TodayPlanTabs planItems={planItems} />
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
                  pipelineStages={pipelineStages}
                  businessScore={businessScore}
                />
              </View>

              <View style={[styles.section, styles.flexSection]}>
                <SectionHeader title="Calendar" />
                <CalendarCard events={calendarEvents as any} />
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
