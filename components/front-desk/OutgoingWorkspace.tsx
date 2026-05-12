import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ensureInvisibleScrollCss,
  Avatar,
  ListHeader,
  DetailHeader,
  ActionButton,
  InlineActionError,
  styleTokens as t,
  TYPE_COLOR,
} from '@/components/front-desk/inboxShared';
import { callBack } from '@/lib/actions/frontDeskActions';
import { useAction } from '@/hooks/useAction';
import { useFrontDeskContext } from '@/lib/context/FrontDeskContext';
import type { OutgoingCallVM } from '@/components/front-desk/types';
import { MOCK_OUTGOING_CALLS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { fetchInboxWindow } from '@/lib/api/frontDesk';
import type { BackendInboxItem } from '@/lib/api/frontDeskAdapters';
import { formatPhoneNumber, extractInitials, hashStringToColor } from '@/lib/formatters';

/** Local mapper: unified inbox item (type='outgoing_call') → OutgoingCallVM.
 * Merged feed does not surface transcript segments — defaults to []. */
function inboxItemToOutgoing(b: BackendInboxItem): OutgoingCallVM {
  const phone = b.phone ?? '';
  const hasName = !!b.name && b.name !== 'Unknown' && b.name.trim() !== '';
  const name = hasName ? (b.name as string) : 'Unknown';
  return {
    id: b.id,
    kind: hasName ? 'known' : 'unknown',
    name,
    initials: hasName ? extractInitials(name) : '??',
    avatarColor: hasName ? hashStringToColor(name) : '#6B7280',
    phone: phone ? formatPhoneNumber(phone) : '',
    duration: b.meta ?? '',
    time: b.time ?? '',
    transcript: [],
  };
}

/**
 * OutgoingWorkspace — list of outbound calls placed from the dial pad
 * or contact card. Pass B: VM types + mock fixtures from @/lib/frontDeskMock.
 */

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function OutgoingWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
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

  const fetcher = useCallback(async (): Promise<OutgoingCallVM[]> => {
    if (isMockMode || !officeId) return MOCK_OUTGOING_CALLS;
    const resp = await fetchInboxWindow({ authenticatedFetch, officeId, sinceDays: 30 });
    return (resp.items ?? [])
      .filter((b) => b.type === 'outgoing_call')
      .map(inboxItemToOutgoing);
  }, [authenticatedFetch, officeId, isMockMode]);
  const { data, loading, error, refresh } = useFrontDeskSection<OutgoingCallVM>(fetcher, {
    mock: MOCK_OUTGOING_CALLS,
  });

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return (
      <OutboundList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  }
  const item = (data ?? []).find((m) => m.id === mode.id);
  if (!item)
    return (
      <OutboundList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  return <OutboundDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function OutboundList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
}: {
  data: OutgoingCallVM[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="arrow-up-circle-outline" title="Outgoing" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {loading ? (
          <LoadingSkeleton variant="list" count={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="arrow-up-circle-outline"
            headline="No outgoing calls yet"
            subtitle="Calls you place from the dial pad will appear here."
          />
        ) : (
          data.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              style={t.rowBtn}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              {m.kind === 'unknown' ? (
                <UnknownAvatar size={36} />
              ) : (
                <Avatar initials={m.initials} color={m.avatarColor} />
              )}
              <div style={t.rowText}>
                <div style={t.rowTopLine}>
                  <span style={{ ...t.rowName, color: m.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#fff' }}>
                    {m.kind === 'unknown' ? 'Unknown caller' : m.name}
                  </span>
                  <span style={t.rowTime}>{m.time}</span>
                </div>
                <div style={t.rowMidLine}>
                  <span style={{ ...t.rowPreview, color: 'rgba(6,182,212,0.85)' }}>Outbound · {m.duration}</span>
                </div>
              </div>
              <div style={t.typeIconWrap}>
                <Ionicons name="arrow-up-circle-outline" size={14} color={TYPE_COLOR.outgoing_call} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function OutboundDetail({ item, onBack }: { item: OutgoingCallVM; onBack: () => void }) {
  const displayName = item.kind === 'unknown' ? 'Unknown caller' : item.name;
  const { crossLink } = useFrontDeskContext();
  // Pass I P0 #5: surface lastError inline.
  const [runCall, callPending, callError] = useAction('Call again');
  return (
    <div style={t.detailWrap}>
      <DetailHeader
        onBack={onBack}
        initials={item.initials}
        avatarColor={item.avatarColor}
        name={displayName}
        phone={item.phone}
      />
      <div className="aspire-invisible-scroll" style={t.detailScroll}>
        <div style={t.detailCallerCard}>
          <div style={t.sectionLabel}>Outbound · {item.duration}</div>
          <div style={t.bodyText}>Call placed by you · {item.time} ago</div>
        </div>

        <div style={t.detailSection}>
          <div style={t.sectionLabel}>Transcript</div>
          {item.transcript.map((line, i) => (
            <div key={i} style={{ ...t.bodyText, display: 'flex', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 11,
                  color: line.side === 'you' ? 'rgba(6,182,212,0.85)' : 'rgba(255,255,255,0.45)',
                  fontWeight: 600,
                  flexShrink: 0,
                  width: 38,
                }}
              >
                {line.side === 'you' ? 'You' : 'Them'}
              </span>
              <span>{line.text}</span>
            </div>
          ))}
        </div>

        <div style={t.actionRow}>
          <ActionButton
            icon="call-outline"
            label="Call again"
            tint="#06B6D4"
            pending={callPending}
            onClick={() => void runCall(() => callBack(item.phone))}
          />
          <ActionButton
            icon="chatbubble-outline"
            label="Send SMS"
            tint="#3B82F6"
            // Pass I P0 #3: cross-link to SmsWorkspace NEW with phone pre-filled.
            onClick={() =>
              crossLink({
                section: 'sms',
                payload: { newMessage: { to: item.phone } },
              })
            }
          />
          {/* Add note — Pass G endpoint */}
          <ActionButton icon="create-outline" label="Add note" />
        </div>
        <InlineActionError message={callError} />
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
