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
import { useFrontDeskContext } from '@/lib/context/FrontDeskContext';
import type { MissedCallVM } from '@/components/front-desk/types';
import { MOCK_MISSED_CALLS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';
import { callBack, addToContacts } from '@/lib/actions/frontDeskActions';
import { useAction } from '@/hooks/useAction';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { fetchInboxWindow } from '@/lib/api/frontDesk';
import type { BackendInboxItem } from '@/lib/api/frontDeskAdapters';
import { formatPhoneNumber, extractInitials, hashStringToColor } from '@/lib/formatters';

/** Local mapper: unified inbox item (type='missed_call') → MissedCallVM.
 * Merged feed does not include call duration_seconds; `attempted` falls back
 * to the `meta` field (e.g. "rang 28s") if provided, otherwise empty. */
function inboxItemToMissed(b: BackendInboxItem): MissedCallVM {
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
    attempted: b.meta ?? '',
    time: b.time ?? '',
    transcript: b.preview || undefined,
  };
}

/**
 * MissedWorkspace — list of missed calls.
 *
 * Pass B: VM types + mock fixtures lifted to @/lib/frontDeskMock. Data flows
 * through useFrontDeskSection with a mock fetcher so the loading/empty/error
 * scaffolding is exercised even before a real backend lands in Pass F.
 */

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function MissedWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
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

  const fetcher = useCallback(async (): Promise<MissedCallVM[]> => {
    if (isMockMode) return MOCK_MISSED_CALLS;
    if (!officeId) return [];
    const resp = await fetchInboxWindow({ authenticatedFetch, officeId, sinceDays: 30 });
    return (resp.items ?? [])
      .filter((b) => b.type === 'missed_call')
      .map(inboxItemToMissed);
  }, [authenticatedFetch, officeId, isMockMode]);
  const { data, loading, error, refresh } = useFrontDeskSection<MissedCallVM>(fetcher, {
    mock: MOCK_MISSED_CALLS,
  });

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return (
      <MissedList
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
      <MissedList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  return <MissedDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function MissedList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
}: {
  data: MissedCallVM[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="call-outline" title="Missed" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {loading ? (
          <LoadingSkeleton variant="list" count={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            headline="You're all caught up"
            subtitle="No missed calls to follow up on."
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
                    {m.kind === 'unknown' ? `Unknown caller` : m.name}
                  </span>
                  <span style={t.rowTime}>{m.time}</span>
                </div>
                <div style={t.rowMidLine}>
                  <span style={{ ...t.rowPreview, color: 'rgba(239,68,68,0.85)' }}>
                    Missed call · {m.attempted}
                  </span>
                </div>
              </div>
              <div style={t.typeIconWrap}>
                <Ionicons name="call-outline" size={14} color={TYPE_COLOR.missed_call} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function MissedDetail({ item, onBack }: { item: MissedCallVM; onBack: () => void }) {
  const displayName = item.kind === 'unknown' ? 'Unknown caller' : item.name;
  const { crossLink } = useFrontDeskContext();
  // Pass I P0 #5: surface lastError inline.
  const [runCall, callPending, callError] = useAction('Call back');
  const [runAdd, addPending, addError] = useAction('Contact added');
  const anyError = callError || addError;
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
          <div style={t.sectionLabel}>Missed</div>
          <div style={t.bodyText}>Rang for {item.attempted.replace('rang ', '')} · {item.time} ago</div>
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
            // Pass I P0 #3: cross-link to SmsWorkspace NEW with phone pre-filled.
            onClick={() =>
              crossLink({
                section: 'sms',
                payload: { newMessage: { to: item.phone } },
              })
            }
          />
          <ActionButton
            icon="person-add-outline"
            label="Add to contacts"
            pending={addPending}
            onClick={() =>
              void runAdd(() =>
                addToContacts({
                  phone: item.phone,
                  name: item.kind === 'unknown' ? undefined : item.name,
                }),
              )
            }
          />
        </div>

        {item.transcript ? (
          <div style={t.detailSection}>
            <div style={t.sectionLabel}>AI Capture</div>
            <div style={t.bodyText}>{item.transcript}</div>
          </div>
        ) : null}
        <InlineActionError message={anyError} />
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
