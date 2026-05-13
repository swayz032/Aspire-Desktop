import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ensureInvisibleScrollCss,
  Avatar,
  ListHeader,
  DetailHeader,
  ActionButton,
  styleTokens as t,
  TYPE_COLOR,
  TYPE_ICON,
} from '@/components/front-desk/inboxShared';
import type { ActivityEventVM, EventType } from '@/components/front-desk/types';
import { MOCK_ACTIVITY_EVENTS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { fetchInboxWindow } from '@/lib/api/frontDesk';
import { mapToActivityEvent } from '@/lib/api/frontDeskAdapters';

/**
 * AllWorkspace — chronological mixed feed of every event type.
 * Pass B: VM types + mock fixtures from @/lib/frontDeskMock.
 */

const TYPE_LABEL: Record<EventType, string> = {
  missed_call: 'Missed call',
  voicemail: 'Voicemail',
  sms: 'SMS',
  callback: 'Callback',
  incoming_call: 'Inbound call',
  outgoing_call: 'Outbound call',
};

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function AllWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';

  const isMockMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mock') === '1';

  const fetcher = useCallback(async (): Promise<ActivityEventVM[]> => {
    if (isMockMode) return MOCK_ACTIVITY_EVENTS;
    if (!officeId) return [];
    const resp = await fetchInboxWindow({ authenticatedFetch, officeId, sinceDays: 7 });
    return (resp.items ?? []).map(mapToActivityEvent);
  }, [authenticatedFetch, officeId, isMockMode]);
  const { data, loading, error, refresh } = useFrontDeskSection<ActivityEventVM>(fetcher, {
    mock: MOCK_ACTIVITY_EVENTS,
  });

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return (
      <EventList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  }

  const ev = (data ?? []).find((e) => e.id === mode.id);
  if (!ev) {
    return (
      <EventList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  }
  return <EventDetail ev={ev} onBack={() => setMode({ kind: 'list' })} />;
}

function EventList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
}: {
  data: ActivityEventVM[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="apps-outline" title="All" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {loading ? (
          <LoadingSkeleton variant="list" count={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="apps-outline"
            headline="All quiet"
            subtitle="No activity yet — calls, voicemails, and texts will show here."
          />
        ) : (
          data.map((ev) => <ActivityRow key={ev.id} ev={ev} onClick={() => onPick(ev.id)} />)
        )}
      </div>
    </div>
  );
}

function ActivityRow({ ev, onClick }: { ev: ActivityEventVM; onClick: () => void }) {
  const color = TYPE_COLOR[ev.type];
  const icon = TYPE_ICON[ev.type];
  return (
    <button
      onClick={onClick}
      style={t.rowBtn}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      {ev.kind === 'unknown' ? (
        <UnknownAvatar size={36} />
      ) : (
        <Avatar initials={ev.initials} color={ev.avatarColor} />
      )}
      <div style={t.rowText}>
        <div style={t.rowTopLine}>
          <span style={{ ...t.rowName, color: ev.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#fff' }}>
            {ev.kind === 'unknown' ? 'Unknown caller' : ev.name}
          </span>
          <span style={t.rowTime}>{ev.time}</span>
        </div>
        <div style={t.rowMidLine}>
          {ev.entity ? <span style={t.entityPill}>{ev.entity}</span> : null}
          <span style={t.rowPreview}>{ev.preview}</span>
        </div>
      </div>
      <div style={t.typeIconWrap}>
        <Ionicons name={icon} size={14} color={color} />
      </div>
    </button>
  );
}

function EventDetail({ ev, onBack }: { ev: ActivityEventVM; onBack: () => void }) {
  const color = TYPE_COLOR[ev.type];
  const displayName = ev.kind === 'unknown' ? 'Unknown caller' : ev.name;
  return (
    <div style={t.detailWrap}>
      <DetailHeader
        onBack={onBack}
        initials={ev.initials}
        avatarColor={ev.avatarColor}
        name={displayName}
        phone={ev.phone}
      />
      <div className="aspire-invisible-scroll" style={t.detailScroll}>
        <div
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 8,
            paddingRight: 10,
            borderRadius: 999,
            background: `${color}1F`,
            color,
            border: `1px solid ${color}44`,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          <Ionicons name={TYPE_ICON[ev.type]} size={12} color={color} />
          <span>{TYPE_LABEL[ev.type]}</span>
        </div>
        <div style={t.detailCallerCard}>
          <div style={t.bodyText}>{ev.preview}</div>
          {ev.meta ? <div style={t.sectionLabel}>{ev.meta}</div> : null}
        </div>
        <div style={t.actionRow}>
          <ActionButton icon="call-outline" label="Call back" tint="#22C55E" />
          <ActionButton icon="chatbubble-outline" label="Send SMS" tint="#3B82F6" />
          <ActionButton icon="create-outline" label="Add note" />
        </div>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
