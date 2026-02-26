import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { DesktopShell } from './DesktopShell';
import { AvaDeskPanel } from './AvaDeskPanel';
import { InteractionModePanel } from '@/components/InteractionModePanel';
import { OpsSnapshotTabs } from '@/components/OpsSnapshotTabs';
import { TodayPlanTabs } from '@/components/TodayPlanTabs';
import { CalendarCard } from '@/components/CalendarCard';
import { AuthorityQueueCard } from '@/components/AuthorityQueueCard';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';
import { getAuthorityQueue, getCalendarEvents, getCashPosition } from '@/lib/api';
import { useDynamicAuthorityQueue } from '@/lib/authorityQueueStore';
import { useTenant, useSupabase } from '@/providers';
import type { CashPosition, AuthorityItem } from '@/types';

const INTERACTION_MODES = [
  { id: 'conference', icon: 'people', title: 'Conference Call', subtitle: 'Multi-party business calls', route: '/session/conference-lobby' },
  { id: 'calls', icon: 'call', title: 'Return Calls', subtitle: 'Creates receipt', route: '/session/calls' },
  { id: 'messages', icon: 'chatbubble-ellipses', title: 'Text Messages', subtitle: 'SMS conversations', route: '/session/messages' },
];

const EMPTY_CASH: CashPosition = { availableCash: 0, upcomingOutflows7d: 0, expectedInflows7d: 0, accountsConnected: 0 };

const HEADER_HEIGHT = 72;

// Time-of-day greeting (aligned with genesis-gate spec)
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

// Formal name: Mr./Ms. LastName, or first name if gender unknown
function getFormalName(ownerName: string | null | undefined, gender: string | null | undefined): string {
  if (!ownerName?.trim()) return '';
  const parts = ownerName.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const firstName = parts[0];
  if (gender === 'male') return `Mr. ${lastName}`;
  if (gender === 'female') return `Ms. ${lastName}`;
  return firstName;
}

// Banner dismiss key with 7-day expiry
const BANNER_DISMISS_KEY = 'aspire_profile_banner_dismissed';
function isBannerDismissed(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const val = localStorage.getItem(BANNER_DISMISS_KEY);
    if (!val) return false;
    const dismissedAt = parseInt(val, 10);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < sevenDays;
  } catch { return false; }
}

export function DesktopHome() {
  const router = useRouter();
  const { tenant } = useTenant();
  const { session } = useSupabase();
  const [liveCashData, setLiveCashData] = useState<CashPosition>(EMPTY_CASH);
  const [supabaseAuthority, setSupabaseAuthority] = useState<AuthorityItem[]>([]);
  const [planItems, setPlanItems] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  const [businessScore, setBusinessScore] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(isBannerDismissed);
  const [reviewPreview, setReviewPreview] = useState<{
    visible: boolean;
    type: 'invoice' | 'contract' | 'report' | 'email' | 'document' | 'recording';
    documentName?: string;
    pandadocDocumentId?: string;
  }>({ visible: false, type: 'document' });
  const dynamicItems = useDynamicAuthorityQueue();
  const allAuthorityItems = useMemo(
    () => [...dynamicItems, ...supabaseAuthority],
    [dynamicItems, supabaseAuthority],
  );

  // Personalized greeting from intake data — formal name (Mr./Ms.) per genesis-gate spec
  const greeting = useMemo(() => {
    const base = getGreeting();
    const formalName = getFormalName(tenant?.ownerName, tenant?.gender);
    if (formalName) {
      return `${base}, ${formalName}.`;
    }
    return `${base}.`;
  }, [tenant?.ownerName, tenant?.gender]);

  // Show "Complete Your Profile" banner for users who haven't completed full intake
  const showProfileBanner = tenant && tenant.onboardingCompleted && !tenant.industry && !bannerDismissed;

  const dismissBanner = () => {
    setBannerDismissed(true);
    if (Platform.OS === 'web') {
      try { localStorage.setItem(BANNER_DISMISS_KEY, Date.now().toString()); } catch {}
    }
  };

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
              pandadocDocumentId: r.execution_payload?.document_id ?? undefined,
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

    // Fetch Today's Plan: merge calendar events + pending approvals
    (async () => {
      try {
        const [calRes, authRes] = await Promise.all([
          fetch('/api/calendar/today', {
            headers: { 'Content-Type': 'application/json' },
          }).catch(() => null),
          fetch('/api/authority-queue').catch(() => null),
        ]);

        const calItems: any[] = [];
        if (calRes?.ok) {
          const calData = await calRes.json();
          (calData.events || []).forEach((evt: any, idx: number) => {
            const startDate = new Date(evt.start_time);
            calItems.push({
              id: evt.id || `cal-${idx}`,
              time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              action: evt.title || 'Calendar Event',
              details: evt.location || (evt.participants?.length ? evt.participants.join(', ') : evt.event_type || ''),
              status: 'upcoming',
              staffRole: evt._source === 'booking' ? 'booking' : (evt.source || 'calendar'),
              _sortTime: startDate.getTime(),
              _type: 'calendar',
            });
          });
        }

        const authItems: any[] = [];
        if (authRes?.ok) {
          const authData = await authRes.json();
          const pending = authData.pendingApprovals || [];
          pending.slice(0, 4).forEach((p: any, idx: number) => {
            authItems.push({
              id: p.id || `plan-${idx}`,
              time: new Date(p.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              action: `Review: ${p.title || p.type || 'Approval Request'}`,
              details: p.amount ? `$${p.amount.toLocaleString()} ${p.currency?.toUpperCase() || 'USD'} — ${p.requestedBy || 'System'}` : (p.requestedBy || 'Pending approval'),
              status: 'upcoming',
              staffRole: p.requestedBy || '',
              _sortTime: new Date(p.createdAt || Date.now()).getTime(),
              _type: 'approval',
            });
          });
        }

        // Merge and sort by time, mark first as "next"
        const merged = [...calItems, ...authItems]
          .sort((a, b) => (a._sortTime || 0) - (b._sortTime || 0))
          .slice(0, 4);
        if (merged.length > 0) merged[0].status = 'next';

        setPlanItems(merged);
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
          {/* Personalized greeting */}
          <Text style={styles.greeting}>{greeting}</Text>

          {/* "Complete Your Profile" banner for users missing intake fields */}
          {showProfileBanner && (
            <View style={styles.profileBanner}>
              <View style={styles.profileBannerContent}>
                <Ionicons name="sparkles" size={20} color="#00BCD4" />
                <View style={styles.profileBannerText}>
                  <Text style={styles.profileBannerTitle}>Complete your profile</Text>
                  <Text style={styles.profileBannerBody}>
                    Unlock personalized industry insights, curated resources, and smarter Ava conversations.
                  </Text>
                </View>
              </View>
              <View style={styles.profileBannerActions}>
                <Pressable
                  style={styles.profileBannerButton}
                  onPress={() => router.push('/(auth)/onboarding' as any)}
                >
                  <Text style={styles.profileBannerButtonText}>Complete Profile</Text>
                </Pressable>
                <Pressable onPress={dismissBanner}>
                  <Ionicons name="close" size={18} color="#888" />
                </Pressable>
              </View>
            </View>
          )}

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
            {allAuthorityItems.length > 0 ? (
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
                      onAction={async (action) => {
                        if (action === 'join') {
                          router.push('/session/conference-live' as any);
                        } else if (action === 'approve') {
                          // W6: Approve chains into orchestrator resume via Desktop server
                          try {
                            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                            const res = await fetch(`/api/authority-queue/${item.id}/approve`, { method: 'POST', headers });
                            if (res.ok) {
                              // Remove from local state — approval is done
                              setSupabaseAuthority((prev) => prev.filter((a) => a.id !== item.id));
                            }
                          } catch (e) { /* approve failed — user can retry */ }
                        } else if (action === 'deny') {
                          try {
                            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                            await fetch(`/api/authority-queue/${item.id}/deny`, { method: 'POST', headers });
                            setSupabaseAuthority((prev) => prev.filter((a) => a.id !== item.id));
                          } catch (e) { /* deny failed */ }
                        } else if (action === 'review') {
                          // Open real PandaDoc preview for contracts, static preview for others
                          const docType = item.type === 'invoice' ? 'invoice' as const
                            : item.type === 'contract' ? 'contract' as const
                            : 'document' as const;
                          setReviewPreview({
                            visible: true,
                            type: docType,
                            documentName: item.title,
                            pandadocDocumentId: item.pandadocDocumentId,
                          });
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.authorityEmpty}>
                <Ionicons name="shield-checkmark-outline" size={24} color={Colors.accent.cyan} style={styles.authorityEmptyIcon} />
                <Text style={styles.authorityEmptyHeadline}>Your approval queue is clear</Text>
                <Text style={styles.authorityEmptyBody}>
                  When agents need your sign-off — invoices over $500, contracts, payments — they land here. Every action leaves a receipt.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <DocumentPreviewModal
        visible={reviewPreview.visible}
        onClose={() => setReviewPreview(prev => ({ ...prev, visible: false }))}
        type={reviewPreview.type}
        documentName={reviewPreview.documentName}
        pandadocDocumentId={reviewPreview.pandadocDocumentId}
      />
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
    minHeight: 400,
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
  authorityEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 340,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  authorityEmptyIcon: {
    marginBottom: 8,
  },
  authorityEmptyHeadline: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  authorityEmptyBody: {
    color: Colors.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 480,
  },
  greeting: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 188, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 188, 212, 0.20)',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  profileBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  profileBannerText: {
    flex: 1,
  },
  profileBannerTitle: {
    color: '#00BCD4',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileBannerBody: {
    color: Colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  profileBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileBannerButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  profileBannerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
