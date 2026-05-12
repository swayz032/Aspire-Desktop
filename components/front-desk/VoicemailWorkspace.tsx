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
} from '@/components/front-desk/inboxShared';
import { callBack, sendSms, markVoicemailReviewed, deleteVoicemail } from '@/lib/actions/frontDeskActions';
import { useAction } from '@/hooks/useAction';
import type { VoicemailVM } from '@/components/front-desk/types';
import { MOCK_VOICEMAILS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';

/**
 * VoicemailWorkspace — list of voicemails with a mocked audio player.
 * Pass B: VM types + mock fixtures from @/lib/frontDeskMock.
 */

// Pre-computed waveform bar heights (24 bars, 18-36px)
const WAVE_HEIGHTS = [22, 28, 18, 30, 24, 34, 20, 26, 32, 22, 28, 36, 24, 18, 30, 26, 32, 20, 28, 24, 34, 22, 26, 18];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function VoicemailWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  const fetcher = useCallback(() => Promise.resolve(MOCK_VOICEMAILS), []);
  const { data, loading, error, refresh } = useFrontDeskSection<VoicemailVM>(fetcher, {
    mock: MOCK_VOICEMAILS,
  });

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return (
      <VmList
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
      <VmList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  return <VmDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function VmList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
}: {
  data: VoicemailVM[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="mic-outline" title="Voicemail" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {loading ? (
          <LoadingSkeleton variant="list" count={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="mic-off-outline"
            headline="No voicemails today"
            subtitle="When callers leave a message, you'll see it here."
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
                  <span
                    style={{
                      ...t.rowName,
                      fontWeight: m.unread ? 600 : 500,
                      color: m.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#fff',
                    }}
                  >
                    {m.kind === 'unknown' ? 'Unknown caller' : m.name}
                  </span>
                  <span style={t.rowTime}>{m.time}</span>
                </div>
                <div style={t.rowMidLine}>
                  <span
                    style={{
                      ...t.entityPill,
                      color: TYPE_COLOR.voicemail,
                      background: 'rgba(168,85,247,0.10)',
                      border: '1px solid rgba(168,85,247,0.28)',
                    }}
                  >
                    {m.duration}
                  </span>
                  <span style={{ ...t.rowPreview, color: m.unread ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.45)' }}>
                    {m.preview}
                  </span>
                </div>
              </div>
              <div style={t.typeIconWrap}>
                <Ionicons name="mic-outline" size={14} color={TYPE_COLOR.voicemail} />
              </div>
              {m.unread ? <div style={t.unreadDot} /> : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function VmDetail({ item, onBack }: { item: VoicemailVM; onBack: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [activeBar, setActiveBar] = useState(0);
  const displayName = item.kind === 'unknown' ? 'Unknown caller' : item.name;
  const [runCall, callPending] = useAction('Call back');
  const [runSms, smsPending] = useAction('SMS jump');
  const [runReviewed, reviewedPending] = useAction('Marked reviewed');
  const [runDelete, deletePending] = useAction('Voicemail deleted');

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setActiveBar((b) => (b + 1) % WAVE_HEIGHTS.length);
    }, 120);
    return () => clearInterval(iv);
  }, [playing]);

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
          <div style={t.sectionLabel}>Voicemail · {item.duration} · {item.time} ago</div>

          {/* Player bar */}
          <div style={playerBar}>
            <button
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => setPlaying((p) => !p)}
              style={playBtn}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={14} color="#ffffff" />
            </button>
            <div style={waveform}>
              {WAVE_HEIGHTS.map((h, i) => {
                const isActive = playing && i === activeBar;
                const opacity = i < (playing ? activeBar : 0) ? 0.9 : isActive ? 1 : 0.35;
                return (
                  <div
                    key={i}
                    style={{
                      width: 3,
                      height: h,
                      borderRadius: 2,
                      background: TYPE_COLOR.voicemail,
                      opacity,
                      transition: 'opacity 0.15s ease',
                    }}
                  />
                );
              })}
            </div>
            <span style={playerTime}>{item.duration}</span>
          </div>
        </div>

        <div style={t.detailSection}>
          <div style={t.sectionLabel}>Transcript</div>
          <div style={t.bodyText}>{item.transcript}</div>
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
            pending={smsPending}
            onClick={() => void runSms(() => sendSms(item.id, ''))}
          />
          <ActionButton
            icon="checkmark-done-outline"
            label="Mark reviewed"
            pending={reviewedPending}
            onClick={() => void runReviewed(() => markVoicemailReviewed(item.id))}
          />
          <ActionButton
            icon="trash-outline"
            label="Delete"
            tint="#EF4444"
            pending={deletePending}
            onClick={() => void runDelete(() => deleteVoicemail(item.id))}
          />
        </div>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

const playerBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  paddingTop: 8,
};
const playBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)',
  boxShadow: '0 2px 6px rgba(168,85,247,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const waveform: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  height: 36,
};
const playerTime: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.55)',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
};
