import React, { useState, useEffect } from 'react';
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

/**
 * VoicemailWorkspace — list of voicemails with a mocked audio player.
 * MOCK only.
 */

type Voicemail = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  duration: string;
  time: string;
  preview: string; // first line
  transcript: string;
  unread: boolean;
};

const MOCK: Voicemail[] = [
  {
    id: 'v1',
    name: 'David Reed',
    initials: 'DR',
    avatarColor: '#A855F7',
    phone: '(617) 555-0319',
    duration: '0:46',
    time: '21m',
    preview: 'Hi this is David, calling about the porch...',
    transcript:
      'Hi this is David, calling about the porch we discussed last week. I had a quick question about the railing height — the city inspector wants 42 inches but I thought we spoke about 36. Can you give me a ring back when you get a chance? Thanks.',
    unread: true,
  },
  {
    id: 'v2',
    name: 'Sarah Klein',
    initials: 'SK',
    avatarColor: '#10B981',
    phone: '(617) 555-0411',
    duration: '1:12',
    time: '3h',
    preview: 'Following up on the estimate you sent...',
    transcript:
      'Hey, following up on the estimate you sent over Friday. Everything looks great — we are ready to move forward. Can you send over the contract and let me know what kind of deposit you need? Talk soon.',
    unread: true,
  },
  {
    id: 'v3',
    name: 'Carlos Rivera',
    initials: 'CR',
    avatarColor: '#EF4444',
    phone: '(617) 555-0334',
    duration: '0:33',
    time: 'Yesterday',
    preview: 'Hi, calling about the bathroom remodel quote...',
    transcript:
      'Hi, calling about the bathroom remodel quote — please call me back when you can. Thanks.',
    unread: false,
  },
  {
    id: 'v4',
    name: 'Margaret Wu',
    initials: 'MW',
    avatarColor: '#F59E0B',
    phone: '(617) 555-0744',
    duration: '2:08',
    time: '2 days',
    preview: 'Wanted to ask about scheduling for next month...',
    transcript:
      'Wanted to ask about scheduling for next month. We are looking to start the kitchen project the week of the 18th if possible. Also a question about the cabinet finish samples you mentioned. Give me a call when you get a chance.',
    unread: false,
  },
  {
    id: 'v5',
    name: 'Unknown',
    initials: '??',
    avatarColor: '#6B7280',
    phone: '(978) 555-0501',
    duration: '0:18',
    time: '3 days',
    preview: 'Hi, I got your number from...',
    transcript: 'Hi, I got your number from a friend. Looking for a deck contractor. Please call me back.',
    unread: false,
  },
];

// Pre-computed waveform bar heights (24 bars, 18-36px)
const WAVE_HEIGHTS = [22, 28, 18, 30, 24, 34, 20, 26, 32, 22, 28, 36, 24, 18, 30, 26, 32, 20, 28, 24, 34, 22, 26, 18];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function VoicemailWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return <VmList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }
  const item = MOCK.find((m) => m.id === mode.id);
  if (!item) return <VmList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  return <VmDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function VmList({ onBackToMenu, onPick }: { onBackToMenu?: () => void; onPick: (id: string) => void }) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="mic-outline" title="Voicemail" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {MOCK.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            style={t.rowBtn}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <Avatar initials={m.initials} color={m.avatarColor} />
            <div style={t.rowText}>
              <div style={t.rowTopLine}>
                <span style={{ ...t.rowName, fontWeight: m.unread ? 600 : 500 }}>{m.name}</span>
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
        ))}
      </div>
    </div>
  );
}

function VmDetail({ item, onBack }: { item: Voicemail; onBack: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [activeBar, setActiveBar] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setActiveBar((b) => (b + 1) % WAVE_HEIGHTS.length);
    }, 120);
    return () => clearInterval(iv);
  }, [playing]);

  return (
    <div style={t.detailWrap}>
      <DetailHeader onBack={onBack} initials={item.initials} avatarColor={item.avatarColor} name={item.name} phone={item.phone} />
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
          <ActionButton icon="call-outline" label="Call back" tint="#22C55E" />
          <ActionButton icon="chatbubble-outline" label="Send SMS" tint="#3B82F6" />
          <ActionButton icon="checkmark-done-outline" label="Mark reviewed" />
          <ActionButton icon="trash-outline" label="Delete" tint="#EF4444" />
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
