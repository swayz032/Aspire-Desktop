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
} from '@/components/front-desk/inboxShared';
import { callBack, rescheduleCallback, completeCallback } from '@/lib/actions/frontDeskActions';
import { useAction } from '@/hooks/useAction';
import type { CallbackVM, CallbackBucket } from '@/components/front-desk/types';
import { MOCK_CALLBACKS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';

/**
 * CallbackQueueWorkspace — bucket-grouped callback list (Due Today /
 * Overdue / Scheduled). Pass B: VM types + mock fixtures from
 * @/lib/frontDeskMock.
 */

const BUCKET_LABEL: Record<CallbackBucket, string> = {
  due_today: 'Due Today',
  overdue: 'Overdue',
  scheduled: 'Scheduled',
};

const BUCKET_COLOR: Record<CallbackBucket, string> = {
  due_today: '#F59E0B',
  overdue: '#EF4444',
  scheduled: '#3B82F6',
};

const BUCKET_ORDER: CallbackBucket[] = ['due_today', 'overdue', 'scheduled'];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function CallbackQueueWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  const fetcher = useCallback(() => Promise.resolve(MOCK_CALLBACKS), []);
  const { data, loading, error, refresh } = useFrontDeskSection<CallbackVM>(fetcher, {
    mock: MOCK_CALLBACKS,
  });

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return (
      <QueueList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  }
  const item = (data ?? []).find((c) => c.id === mode.id);
  if (!item)
    return (
      <QueueList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  return <QueueDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function QueueList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
}: {
  data: CallbackVM[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState<Record<CallbackBucket, boolean>>({
    due_today: true,
    overdue: true,
    scheduled: true,
  });

  return (
    <div style={t.listWrap}>
      <ListHeader icon="time-outline" title="Callback Queue" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {loading ? (
          <LoadingSkeleton variant="list" count={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="calendar-clear-outline"
            headline="No callbacks scheduled"
            subtitle="Promised callbacks will queue up here."
          />
        ) : (
          BUCKET_ORDER.map((b) => {
            const items = data.filter((m) => m.bucket === b);
            const color = BUCKET_COLOR[b];
            const isOpen = open[b];
            return (
              <div key={b} style={{ marginBottom: 6 }}>
                <button
                  onClick={() => setOpen((o) => ({ ...o, [b]: !o[b] }))}
                  style={bucketHeader}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: color,
                      boxShadow: `0 0 8px ${color}80`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={bucketTitle}>{BUCKET_LABEL[b]}</span>
                  <span style={bucketCount}>{items.length}</span>
                  <div style={{ flex: 1 }} />
                  <div style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.55)" />
                  </div>
                </button>

                {isOpen
                  ? items.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onPick(c.id)}
                        style={t.rowBtn}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                      >
                        {c.kind === 'unknown' ? (
                          <UnknownAvatar size={36} />
                        ) : (
                          <Avatar initials={c.initials} color={c.avatarColor} />
                        )}
                        <div style={t.rowText}>
                          <div style={t.rowTopLine}>
                            <span style={{ ...t.rowName, color: c.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#fff' }}>
                              {c.kind === 'unknown' ? 'Unknown caller' : c.name}
                            </span>
                            <span
                              style={{
                                ...t.entityPill,
                                color,
                                background: `${color}1A`,
                                border: `1px solid ${color}44`,
                                fontSize: 10,
                              }}
                            >
                              {c.dueLabel}
                            </span>
                          </div>
                          <div style={t.rowMidLine}>
                            <span style={t.rowPreview}>Callback promised at {c.promiseTime}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function QueueDetail({ item, onBack }: { item: CallbackVM; onBack: () => void }) {
  const color = BUCKET_COLOR[item.bucket];
  const displayName = item.kind === 'unknown' ? 'Unknown caller' : item.name;
  // Pass I P0 #5: surface lastError inline.
  const [runCall, callPending, callError] = useAction('Calling now');
  const [runReschedule, reschedulePending, rescheduleError] = useAction('Rescheduled');
  const [runComplete, completePending, completeError] = useAction('Marked complete');
  const anyError = callError || rescheduleError || completeError;

  // Pass I P0 #8: reschedule now requires explicit user-picked datetime —
  // no more silent "1h from now" auto-pick with "Verified ✓" toast.
  const [showRescheduleInput, setShowRescheduleInput] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState<string>('');
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
            <Ionicons name="time-outline" size={12} color={color} />
            <span>{item.dueLabel}</span>
          </div>
          <div style={{ ...t.bodyText, marginTop: 8 }}>Callback promised at {item.promiseTime}</div>
        </div>

        <div style={t.detailSection}>
          <div style={t.sectionLabel}>Context</div>
          <div style={t.bodyText}>{item.context}</div>
        </div>

        <div style={t.actionRow}>
          <ActionButton
            icon="call-outline"
            label="Call now"
            tint="#22C55E"
            pending={callPending}
            onClick={() => void runCall(() => callBack(item.phone))}
          />
          {showRescheduleInput ? (
            <div style={rescheduleInputWrap}>
              <input
                type="datetime-local"
                value={rescheduleAt}
                onChange={(e) => setRescheduleAt(e.target.value)}
                aria-label="New due date and time"
                style={rescheduleInputStyle}
              />
              <button
                disabled={!rescheduleAt || reschedulePending}
                style={{
                  ...rescheduleConfirmBtn,
                  opacity: !rescheduleAt || reschedulePending ? 0.5 : 1,
                  cursor: !rescheduleAt || reschedulePending ? 'not-allowed' : 'pointer',
                }}
                onClick={() => {
                  const dueAt = new Date(rescheduleAt).toISOString();
                  void runReschedule(() => rescheduleCallback(item.id, dueAt));
                  setShowRescheduleInput(false);
                  setRescheduleAt('');
                }}
              >
                Confirm
              </button>
              <button
                style={rescheduleCancelBtn}
                aria-label="Cancel reschedule"
                onClick={() => {
                  setShowRescheduleInput(false);
                  setRescheduleAt('');
                }}
              >
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          ) : (
            <ActionButton
              icon="calendar-outline"
              label="Reschedule"
              tint="#F59E0B"
              pending={reschedulePending}
              onClick={() => setShowRescheduleInput(true)}
            />
          )}
          <ActionButton
            icon="checkmark-done-outline"
            label="Mark complete"
            tint="#3B82F6"
            pending={completePending}
            onClick={() => void runComplete(() => completeCallback(item.id))}
          />
        </div>
        <InlineActionError message={anyError} />
      </div>
    </div>
  );
}

const rescheduleInputWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 36,
  paddingLeft: 8,
  paddingRight: 4,
  borderRadius: 18,
  background: 'rgba(245,158,11,0.10)',
  border: '1px solid rgba(245,158,11,0.30)',
};

const rescheduleInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#fff',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  colorScheme: 'dark',
};

const rescheduleConfirmBtn: React.CSSProperties = {
  height: 28,
  paddingLeft: 10,
  paddingRight: 10,
  borderRadius: 14,
  border: 'none',
  outline: 'none',
  background: 'rgba(245,158,11,0.25)',
  color: '#F59E0B',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 600,
};

const rescheduleCancelBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 14,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const styles = StyleSheet.create({ fill: { flex: 1 } });

const bucketHeader: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 8,
  paddingBottom: 8,
  paddingLeft: 8,
  paddingRight: 8,
  borderRadius: 8,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.12s ease',
};
const bucketTitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.85)',
  letterSpacing: 0.2,
  textTransform: 'uppercase',
};
const bucketCount: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 999,
  paddingTop: 1,
  paddingBottom: 1,
  paddingLeft: 6,
  paddingRight: 6,
};
