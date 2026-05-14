/**
 * Calls & Messages — Wave 7 unified inbox.
 *
 * Three tabs at the top: Voicemails (N unread) / Recent calls / Contacts.
 * Tab pattern modeled after `app/founder-hub/notes.tsx` (`activeTab` state +
 * pill row). Page chrome reuses `HubPageShell`, matching the rest of the
 * founder-hub.
 *
 * Data flows through `services/calls-store.ts`. In mock mode the screen
 * renders without any backend; flip `setUseMockData(false)` once migration
 * 114 + the proxy routes ship.
 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { CallLogRow } from '@/components/calls/CallLogRow';
import { ContactRow } from '@/components/calls/ContactRow';
import { VoicemailCard } from '@/components/calls/VoicemailCard';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import { useTenant } from '@/providers';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import {
  archiveVoicemail,
  dialContact,
  markVoicemailRead,
  selectContactById,
  selectUnreadVoicemailCount,
  updateContact,
  useCallsStore,
  useMockData,
} from '@/services/calls-store';
import type {
  ContactPatch,
  FrontdeskCallSession,
  FrontdeskContact,
  FrontdeskVoicemail,
} from '@/types/calls-messages';

type TabKey = 'voicemails' | 'calls' | 'contacts';

function CallsMessagesContent(): React.ReactElement {
  const router = useRouter();
  const { tenant } = useTenant();
  const { authenticatedFetch } = useAuthFetch();
  const snap = useCallsStore(tenant?.suiteId);
  const [activeTab, setActiveTab] = useState<TabKey>('voicemails');
  const [error, setError] = useState<string | null>(null);

  const unread = selectUnreadVoicemailCount(snap);
  const visibleVoicemails = useMemo(
    () => snap.voicemails.filter((v) => !v.archived_at),
    [snap.voicemails],
  );

  const handleDial = async (phoneE164: string) => {
    setError(null);
    if (useMockData()) {
      setError(
        'Mock mode is on — calls are disabled. Real calls will route through the existing /call-room flow.',
      );
      return;
    }
    if (!tenant?.officeId) {
      setError('Your office is still loading.');
      return;
    }
    try {
      const params = await dialContact({
        phoneE164,
        officeId: tenant.officeId,
        authenticatedFetch,
      });
      router.push({ pathname: '/call-room', params } as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the call.');
    }
  };

  const onVoicemailCallBack = (vm: FrontdeskVoicemail) => {
    if (vm.callback_number) void handleDial(vm.callback_number);
  };
  const onCallLogCallBack = (call: FrontdeskCallSession) => {
    const num = call.direction === 'inbound' ? call.from_number : call.to_number;
    if (num) void handleDial(num);
  };
  const onContactCallBack = (c: FrontdeskContact) => {
    void handleDial(c.phone_e164);
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Calls & messages</Text>
        <Text style={styles.subtitle}>
          Voicemails, recent calls, and contacts captured by your receptionist.
        </Text>
      </View>

      <View style={styles.tabsRow}>
        <TabPill
          label="Voicemails"
          count={unread}
          active={activeTab === 'voicemails'}
          onPress={() => setActiveTab('voicemails')}
        />
        <TabPill
          label="Recent calls"
          active={activeTab === 'calls'}
          onPress={() => setActiveTab('calls')}
        />
        <TabPill
          label="Contacts"
          active={activeTab === 'contacts'}
          onPress={() => setActiveTab('contacts')}
        />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={Colors.semantic.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {snap.loading ? (
        <SkeletonList />
      ) : activeTab === 'voicemails' ? (
        visibleVoicemails.length === 0 ? (
          <EmptyState
            icon="mail-open-outline"
            title="No voicemails"
            copy="When someone leaves a message with your receptionist, it shows up here."
            ctaLabel="See recent calls"
            onCta={() => setActiveTab('calls')}
          />
        ) : (
          <View style={styles.listColumn}>
            {visibleVoicemails.map((vm) => (
              <VoicemailCard
                key={vm.voicemail_id}
                voicemail={vm}
                onCallBack={onVoicemailCallBack}
                onMarkRead={(v) => void markVoicemailRead(v.voicemail_id)}
                onArchive={(v) => void archiveVoicemail(v.voicemail_id)}
              />
            ))}
          </View>
        )
      ) : activeTab === 'calls' ? (
        snap.callSessions.length === 0 ? (
          <EmptyState
            icon="call-outline"
            title="No calls yet"
            copy="Inbound and outbound calls will appear here as they happen."
            ctaLabel="Set up your line"
            onCta={() => router.push('/session/calls/setup' as never)}
          />
        ) : (
          <View style={styles.tableShell}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.directionCol]} />
              <Text style={[styles.tableHeader, styles.identityCol]}>Caller</Text>
              <Text style={[styles.tableHeader, styles.summaryCol]}>Summary</Text>
              <Text style={[styles.tableHeader, styles.metaCol, styles.metaHeader]}>
                Duration · time
              </Text>
              <View style={styles.callBtnSpacer} />
            </View>
            {snap.callSessions.map((call) => (
              <CallLogRow
                key={call.call_session_id}
                call={call}
                contact={selectContactById(snap, call.contact_id)}
                onCallBack={onCallLogCallBack}
              />
            ))}
          </View>
        )
      ) : (
        snap.contacts.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No contacts yet"
            copy="Your receptionist saves everyone who calls so you can reach them again later."
            ctaLabel="See recent calls"
            onCta={() => setActiveTab('calls')}
          />
        ) : (
          <View style={styles.tableShell}>
            {snap.contacts.map((c) => (
              <ContactRow
                key={c.contact_id}
                contact={c}
                onCallBack={onContactCallBack}
                onSave={(id, patch: ContactPatch) => void updateContact(id, patch)}
              />
            ))}
          </View>
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.tabPressed,
      ]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {typeof count === 'number' && count > 0 && (
        <View style={[styles.tabCount, active && styles.tabCountActive]}>
          <Text
            style={[styles.tabCountText, active && styles.tabCountTextActive]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function EmptyState({
  icon,
  title,
  copy,
  ctaLabel,
  onCta,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  ctaLabel?: string;
  onCta?: () => void;
}): React.ReactElement {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={Colors.text.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
      {ctaLabel && onCta && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          onPress={onCta}
          style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.emptyCtaText}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function SkeletonList(): React.ReactElement {
  return (
    <View style={styles.listColumn}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={[styles.skelLine, { width: '40%' }]} />
          <View style={[styles.skelLine, { width: '70%', marginTop: 12 }]} />
          <View style={[styles.skelLine, { width: '90%', marginTop: 8 }]} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.title.fontSize,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: 'transparent',
    minHeight: 36,
  },
  tabActive: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabLabel: {
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#0a0a0a',
    fontWeight: '600',
  },
  tabCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.background.tertiary,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: '#0a0a0a',
  },
  tabCountText: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  tabCountTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.semantic.warning,
    backgroundColor: Colors.semantic.warningLight,
  },
  errorText: {
    color: Colors.text.primary,
    fontSize: Typography.caption.fontSize,
    flex: 1,
  },
  listColumn: {
    gap: 0,
  },
  tableShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    backgroundColor: Colors.background.secondary,
  },
  tableHeader: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaHeader: {
    textAlign: 'right',
  },
  directionCol: {
    width: 24,
  },
  identityCol: {
    width: 200,
  },
  summaryCol: {
    flex: 1,
  },
  metaCol: {
    width: 96,
  },
  callBtnSpacer: {
    width: 44,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
  },
  emptyCopy: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
    textAlign: 'center',
    maxWidth: 360,
  },
  emptyCta: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.text.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  emptyCtaText: {
    color: '#0a0a0a',
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
  },
  skeletonCard: {
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    backgroundColor: Colors.surface.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  skelLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.background.tertiary,
  },
});

export default function CallsMessagesScreen(): React.ReactElement {
  return (
    <PageErrorBoundary pageName="calls-messages">
      <HubPageShell>
        <CallsMessagesContent />
      </HubPageShell>
    </PageErrorBoundary>
  );
}
