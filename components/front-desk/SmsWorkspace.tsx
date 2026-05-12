import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ensureInvisibleScrollCss, Avatar } from '@/components/front-desk/inboxShared';
import { sendSms, sendNewSms, callBack } from '@/lib/actions/frontDeskActions';
import { useAction } from '@/hooks/useAction';
import type { SmsThreadVM } from '@/components/front-desk/types';
import { MOCK_SMS_THREADS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';

/**
 * SmsWorkspace — SMS section content for the Inbox Rail.
 *
 * Three view modes, all stacked inside the rail content slot:
 *   - LIST    (default) — scrollable list of thread rows
 *   - DETAIL  — open thread with bubble history + composer
 *   - NEW     — recipient field + composer for a fresh message
 *
 * Pass B: VM types + mock fixtures lifted to shared modules. Data flows
 * through useFrontDeskSection so loading/empty/error scaffolding is
 * exercised before a real backend lands in Pass F.
 */

type Mode =
  | { kind: 'list' }
  | { kind: 'detail'; threadId: string }
  | { kind: 'new' };

type Thread = SmsThreadVM;

export function SmsWorkspace({
  onBackToMenu,
  prefillTo,
  onPrefillConsumed,
}: {
  /** Called when the list-mode back arrow is tapped — returns to the inbox menu. */
  onBackToMenu?: () => void;
  /**
   * Pass I P0 #3: when set, open in NEW mode with `to` already filled. Used
   * by cross-links from voicemail/missed/incoming/outgoing/contacts/event
   * detail "Send SMS" buttons so the user doesn't have to retype the phone.
   */
  prefillTo?: string;
  /** Called once `prefillTo` has been consumed (so parent can clear it). */
  onPrefillConsumed?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(
    prefillTo ? { kind: 'new' } : { kind: 'list' },
  );
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  // If a new prefillTo arrives later, force NEW mode.
  useEffect(() => {
    if (prefillTo) {
      setMode({ kind: 'new' });
    }
  }, [prefillTo]);

  const fetcher = useCallback(() => Promise.resolve(MOCK_SMS_THREADS), []);
  const { data, loading, error, refresh } = useFrontDeskSection<Thread>(fetcher, {
    mock: MOCK_SMS_THREADS,
  });

  if (Platform.OS !== 'web') {
    return <View style={styles.fill} />;
  }

  if (mode.kind === 'list') {
    return (
      <ThreadList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', threadId: id })}
        onNew={() => setMode({ kind: 'new' })}
      />
    );
  }
  if (mode.kind === 'detail') {
    const thread = (data ?? []).find((t) => t.id === mode.threadId);
    if (!thread)
      return (
        <ThreadList
          data={data}
          loading={loading}
          error={error}
          onRetry={refresh}
          onBackToMenu={onBackToMenu}
          onPick={(id) => setMode({ kind: 'detail', threadId: id })}
          onNew={() => setMode({ kind: 'new' })}
        />
      );
    return <ThreadDetail thread={thread} onBack={() => setMode({ kind: 'list' })} />;
  }
  return (
    <NewMessage
      onBack={() => {
        setMode({ kind: 'list' });
        onPrefillConsumed?.();
      }}
      initialTo={prefillTo}
      onPrefillConsumed={onPrefillConsumed}
    />
  );
}

function ThreadList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
  onNew,
}: {
  data: Thread[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div style={listWrap}>
      {/* SMS section header — only rendered in list mode */}
      <div style={listHeader}>
        <div style={listHeaderTitleRow}>
          {onBackToMenu ? (
            <button aria-label="Back to inbox menu" onClick={onBackToMenu} style={listHeaderBackBtn}>
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
            </button>
          ) : null}
          <Ionicons name="chatbubble-ellipses-outline" size={15} color="rgba(255,255,255,0.85)" />
          <span style={listHeaderTitle}>SMS</span>
        </div>
        <div style={listHeaderIcons}>
          <button aria-label="Search" style={listHeaderIconBtn}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.55)" />
          </button>
          <button aria-label="New message" onClick={onNew} style={listHeaderIconBtn}>
            <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.55)" />
          </button>
        </div>
      </div>

      <div style={listDivider} />

      <div className="aspire-invisible-scroll" style={listScroll}>
        {loading ? (
          <LoadingSkeleton variant="list" count={7} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="chatbubble-ellipses-outline"
            headline="No conversations yet"
            subtitle="Threads will appear here when customers text in."
          />
        ) : (
          data.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              style={threadRow}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              {t.kind === 'unknown' ? (
                <UnknownAvatar size={36} />
              ) : (
                <Avatar initials={t.initials} color={t.avatarColor} />
              )}
              <div style={threadRowText}>
                <div style={threadRowTopLine}>
                  <span
                    style={{
                      ...threadName(t.unread),
                      color: t.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#ffffff',
                    }}
                  >
                    {t.kind === 'unknown' ? 'Unknown caller' : t.name}
                  </span>
                  <span style={threadTime}>{t.time}</span>
                </div>
                <div style={threadPreview(t.unread)}>{t.preview}</div>
              </div>
              {t.unread ? <div style={unreadDot} /> : null}
            </button>
          ))
        )}
      </div>
      <button
        aria-label="New message"
        onClick={onNew}
        style={fab}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px) scale(1.04)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0) scale(1)';
        }}
      >
        <Ionicons name="create-outline" size={18} color="#fff" />
      </button>
    </div>
  );
}

function ThreadDetail({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayName = thread.kind === 'unknown' ? 'Unknown caller' : thread.name;
  // Pass I P0 #5: surface lastError inline.
  const [runSend, sendPending, sendError] = useAction('SMS sent');
  const [runCall, callPending, callError] = useAction('Call back');
  const anyError = sendError || callError;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread.id]);

  return (
    <div style={detailWrap}>
      <div style={detailHeader}>
        <button aria-label="Back to threads" onClick={onBack} style={detailBackBtn}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
        </button>
        {thread.kind === 'unknown' ? (
          <UnknownAvatar size={32} />
        ) : (
          <Avatar initials={thread.initials} color={thread.avatarColor} size={32} />
        )}
        <div style={detailHeaderText}>
          <div style={{ ...detailHeaderName, color: thread.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#fff' }}>
            {displayName}
          </div>
          <div style={detailHeaderPhone}>{thread.phone}</div>
        </div>
        <button
          aria-label="Call"
          disabled={callPending}
          style={{ ...detailIconBtn, opacity: callPending ? 0.5 : 1 }}
          onClick={() => void runCall(() => callBack(thread.phone))}
        >
          <Ionicons name={callPending ? 'reload-outline' : 'call-outline'} size={16} color="rgba(255,255,255,0.7)" />
        </button>
        <button aria-label="Info" style={detailIconBtn}>
          <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.7)" />
        </button>
      </div>

      <div ref={scrollRef} className="aspire-invisible-scroll" style={bubbleScroll}>
        {thread.bubbles.map((b, i) => {
          const prev = thread.bubbles[i - 1];
          const showStamp = !prev || prev.time !== b.time;
          return (
            <React.Fragment key={b.id}>
              {showStamp ? <div style={dateStamp}>{b.time}</div> : null}
              <div style={b.side === 'you' ? bubbleRowYou : bubbleRowThem}>
                <div style={b.side === 'you' ? bubbleYou : bubbleThem}>
                  <span style={bubbleText}>{b.text}</span>
                </div>
                {b.side === 'you' && b.read ? (
                  <div style={readReceipt}>
                    Read {b.time} <Ionicons name="checkmark-done" size={11} color="#3B82F6" />
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div style={composer}>
        <button aria-label="Emoji" style={composerIconBtn}>
          <Ionicons name="happy-outline" size={18} color="rgba(255,255,255,0.55)" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          style={composerInput}
        />
        <button aria-label="Attach" style={composerIconBtn}>
          <Ionicons name="image-outline" size={18} color="rgba(255,255,255,0.55)" />
        </button>
        <button
          aria-label="Send"
          onClick={() => {
            if (draft.trim().length === 0 || sendPending) return;
            const body = draft;
            setDraft('');
            void runSend(() => sendSms(thread.id, body));
          }}
          disabled={draft.trim().length === 0 || sendPending}
          style={{
            ...sendBtn,
            opacity: draft.trim().length === 0 || sendPending ? 0.4 : 1,
            cursor: draft.trim().length === 0 || sendPending ? 'not-allowed' : 'pointer',
          }}
        >
          <Ionicons name={sendPending ? 'reload-outline' : 'arrow-up'} size={16} color="#fff" />
        </button>
      </div>
      {anyError ? (
        <div role="alert" style={smsInlineError}>
          {anyError}
        </div>
      ) : null}
    </div>
  );
}

function NewMessage({
  onBack,
  initialTo,
  onPrefillConsumed,
}: {
  onBack: () => void;
  initialTo?: string;
  onPrefillConsumed?: () => void;
}) {
  const [to, setTo] = useState(initialTo ?? '');
  const [draft, setDraft] = useState('');
  // Pass I P0 #5: surface lastError inline.
  const [runSend, sendPending, sendError] = useAction('SMS sent');

  // Once the prefill is rendered into local state, tell the parent it can
  // clear its prefillTo so a subsequent user edit isn't fought by re-prefill.
  useEffect(() => {
    if (initialTo) onPrefillConsumed?.();
  }, [initialTo, onPrefillConsumed]);
  return (
    <div style={detailWrap}>
      <div style={detailHeader}>
        <button aria-label="Back to threads" onClick={onBack} style={detailBackBtn}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
        </button>
        <div style={detailHeaderText}>
          <div style={detailHeaderName}>New Message</div>
        </div>
      </div>

      <div style={newToRow}>
        <span style={newToLabel}>To:</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Phone number or contact"
          style={newToInput}
        />
      </div>

      <div style={newBody} />

      <div style={composer}>
        <button aria-label="Emoji" style={composerIconBtn}>
          <Ionicons name="happy-outline" size={18} color="rgba(255,255,255,0.55)" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          style={composerInput}
        />
        <button aria-label="Attach" style={composerIconBtn}>
          <Ionicons name="image-outline" size={18} color="rgba(255,255,255,0.55)" />
        </button>
        <button
          aria-label="Send"
          onClick={() => {
            if (draft.trim().length === 0 || to.trim().length === 0 || sendPending) return;
            const body = draft;
            const phone = to;
            setDraft('');
            setTo('');
            void runSend(() => sendNewSms(phone, body));
          }}
          disabled={draft.trim().length === 0 || to.trim().length === 0 || sendPending}
          style={{
            ...sendBtn,
            opacity: draft.trim().length === 0 || to.trim().length === 0 || sendPending ? 0.4 : 1,
            cursor: draft.trim().length === 0 || to.trim().length === 0 || sendPending ? 'not-allowed' : 'pointer',
          }}
        >
          <Ionicons name={sendPending ? 'reload-outline' : 'arrow-up'} size={16} color="#fff" />
        </button>
      </div>
      {sendError ? (
        <div role="alert" style={smsInlineError}>
          {sendError}
        </div>
      ) : null}
    </div>
  );
}

const smsInlineError: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: '#EF4444',
  marginTop: 6,
  paddingLeft: 4,
  paddingRight: 4,
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

const listWrap: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const listHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  paddingBottom: 10,
  flexShrink: 0,
};

const listHeaderTitleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flex: 1,
};

const listHeaderBackBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: -6,
  flexShrink: 0,
};

const listHeaderTitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
};

const listHeaderIcons: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
};

const listHeaderIconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const listDivider: React.CSSProperties = {
  width: '100%',
  height: 1,
  flexShrink: 0,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, rgba(255,255,255,0) 100%)',
};

const listScroll: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  paddingTop: 4,
  paddingBottom: 8,
};

const threadRow: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  paddingTop: 9,
  paddingBottom: 9,
  paddingLeft: 8,
  paddingRight: 10,
  borderRadius: 10,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.12s ease',
};

const threadRowText: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const threadRowTopLine: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
};

function threadName(unread: boolean): React.CSSProperties {
  return {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    fontWeight: unread ? 600 : 500,
    color: '#ffffff',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  };
}

const threadTime: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.40)',
  flexShrink: 0,
};

function threadPreview(unread: boolean): React.CSSProperties {
  return {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,
    color: unread ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

const unreadDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 4,
  background: '#3B82F6',
  flexShrink: 0,
  boxShadow: '0 0 8px rgba(59,130,246,0.6)',
};

const fab: React.CSSProperties = {
  position: 'absolute',
  bottom: 8,
  right: 8,
  width: 44,
  height: 44,
  borderRadius: 22,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  backgroundImage:
    'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)',
  boxShadow: '0 6px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 0.12s ease',
};

const detailWrap: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const detailHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 4,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
};

const detailBackBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: -6,
};

const detailHeaderText: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};

const detailHeaderName: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const detailHeaderPhone: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
};

const detailIconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const bubbleScroll: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  paddingTop: 10,
  paddingBottom: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minHeight: 0,
};

const dateStamp: React.CSSProperties = {
  alignSelf: 'center',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.35)',
  marginTop: 8,
  marginBottom: 6,
  letterSpacing: 0.3,
};

const bubbleRowThem: React.CSSProperties = {
  alignSelf: 'flex-start',
  maxWidth: '82%',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const bubbleRowYou: React.CSSProperties = {
  alignSelf: 'flex-end',
  maxWidth: '82%',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  alignItems: 'flex-end',
};

const bubbleThem: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  borderBottomLeftRadius: 4,
  paddingTop: 8,
  paddingBottom: 8,
  paddingLeft: 12,
  paddingRight: 12,
};

const bubbleYou: React.CSSProperties = {
  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  borderRadius: 14,
  borderBottomRightRadius: 4,
  paddingTop: 8,
  paddingBottom: 8,
  paddingLeft: 12,
  paddingRight: 12,
  boxShadow: '0 2px 6px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
};

const bubbleText: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  color: '#ffffff',
  lineHeight: 1.35 as any,
};

const readReceipt: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.4)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  paddingRight: 4,
};

const composer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: 6,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 22,
  flexShrink: 0,
};

const composerIconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 28,
  height: 28,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const composerInput: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  paddingLeft: 4,
  paddingRight: 4,
  minWidth: 0,
};

const sendBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 16,
  border: 'none',
  outline: 'none',
  backgroundImage:
    'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  boxShadow: '0 2px 6px rgba(37,99,235,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'opacity 0.15s ease',
};

const newToRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 10,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const newToLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: 'rgba(255,255,255,0.45)',
};

const newToInput: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
};

const newBody: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
};
