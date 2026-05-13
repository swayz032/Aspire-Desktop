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
import type { IncomingCallVM } from '@/components/front-desk/types';
import { MOCK_INCOMING_CALLS } from '@/lib/frontDeskMock';
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

/** Local mapper: unified inbox item (type='incoming_call') → IncomingCallVM.
 * Merged feed does not surface AI summary lines or transcript segments —
 * those VM fields default to empty arrays. The detail view degrades
 * gracefully (renders zero rows) until per-call detail endpoints land. */
function inboxItemToIncoming(b: BackendInboxItem): IncomingCallVM {
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
    summary: b.preview ? [b.preview] : [],
    transcript: [],
  };
}

/**
 * IncomingWorkspace — list of inbound answered calls.
 * Pass B: VM types + mock fixtures from @/lib/frontDeskMock.
 */

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function IncomingWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
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

  const fetcher = useCallback(async (): Promise<IncomingCallVM[]> => {
    if (isMockMode) return MOCK_INCOMING_CALLS;
    if (!officeId) return [];
    const resp = await fetchInboxWindow({ authenticatedFetch, officeId, sinceDays: 30 });
    return (resp.items ?? [])
      .filter((b) => b.type === 'incoming_call')
      .map(inboxItemToIncoming);
  }, [authenticatedFetch, officeId, isMockMode]);
  const { data, loading, error, refresh } = useFrontDeskSection<IncomingCallVM>(fetcher, {
    mock: MOCK_INCOMING_CALLS,
  });

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return (
      <InboundList
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
      <InboundList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  return <InboundDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function InboundList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
}: {
  data: IncomingCallVM[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="arrow-down-circle-outline" title="Incoming" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {loading ? (
          <LoadingSkeleton variant="list" count={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="arrow-down-circle-outline"
            headline="No incoming calls yet"
            subtitle="Answered inbound calls will land here."
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
                  <span style={{ ...t.rowPreview, color: 'rgba(34,197,94,0.85)' }}>Inbound · {m.duration}</span>
                </div>
              </div>
              <div style={t.typeIconWrap}>
                <Ionicons name="arrow-down-circle-outline" size={14} color={TYPE_COLOR.incoming_call} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function InboundDetail({ item, onBack }: { item: IncomingCallVM; onBack: () => void }) {
  const displayName = item.kind === 'unknown' ? 'Unknown caller' : item.name;
  const { crossLink } = useFrontDeskContext();
  // Pass I P0 #5: surface lastError inline.
  const [runCall, callPending, callError] = useAction('Call back');
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
          <div style={t.sectionLabel}>Inbound · {item.duration}</div>
          <div style={t.bodyText}>{item.time} ago</div>
        </div>

        <div style={t.detailSection}>
          <div style={t.sectionLabel}>AI Summary</div>
          {item.summary.map((s, i) => (
            <div key={i} style={{ ...t.bodyText, display: 'flex', gap: 8 }}>
              <span style={{ color: TYPE_COLOR.incoming_call, flexShrink: 0 }}>•</span>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <div style={t.detailSection}>
          <div style={t.sectionLabel}>Transcript</div>
          {item.transcript.map((line, i) => (
            <div key={i} style={{ ...t.bodyText, display: 'flex', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 11,
                  color: line.side === 'you' ? 'rgba(59,130,246,0.85)' : 'rgba(255,255,255,0.45)',
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
            label="Call back"
            tint="#22C55E"
            pending={callPending}
            onClick={() => void runCall(() => callBack(item.phone))}
          />
          <ActionButton
            icon="chatbubble-outline"
            label="Send SMS"
            tint="#3B82F6"
            // Pass I P0 #3: cross-link to SmsWorkspace NEW with recipient pre-filled.
            onClick={() =>
              crossLink({
                section: 'sms',
                payload: { newMessage: { to: item.phone } },
              })
            }
          />
          {/* Add note — Pass G will add the endpoint; placeholder for now */}
          <ActionButton icon="create-outline" label="Add note" />
        </div>
        <InlineActionError message={callError} />
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
