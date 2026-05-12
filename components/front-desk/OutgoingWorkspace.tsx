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
 * OutgoingWorkspace — list of outbound calls placed from the dial pad
 * or contact card. MOCK only.
 */

type Outbound = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  duration: string;
  time: string;
  transcript: { side: 'them' | 'you'; text: string }[];
};

const MOCK: Outbound[] = [
  {
    id: 'o1',
    name: 'Coastal Roofing Supply',
    initials: 'CS',
    avatarColor: '#06B6D4',
    phone: '(617) 555-0455',
    duration: '2:11',
    time: '1h',
    transcript: [
      { side: 'you', text: 'Hey, checking on the asphalt shingle order — PO #4421.' },
      { side: 'them', text: 'Yep, ready for pickup tomorrow after 10.' },
      { side: 'you', text: 'Perfect, we will swing by around 11.' },
    ],
  },
  {
    id: 'o2',
    name: 'Lisa Moreno',
    initials: 'LM',
    avatarColor: '#8B5CF6',
    phone: '(617) 555-0822',
    duration: '0:48',
    time: 'Yesterday',
    transcript: [
      { side: 'you', text: 'Hi Lisa, just confirming the walkthrough for tomorrow at 9.' },
      { side: 'them', text: 'Yes, see you then.' },
    ],
  },
  {
    id: 'o3',
    name: 'Brighton Office Build',
    initials: 'BO',
    avatarColor: '#22C55E',
    phone: '(617) 555-0188',
    duration: '5:36',
    time: '2 days',
    transcript: [
      { side: 'you', text: 'Following up on the punch list — got a few questions on item 7.' },
      { side: 'them', text: 'Sure, what is up?' },
    ],
  },
  {
    id: 'o4',
    name: 'Greg Patel',
    initials: 'GP',
    avatarColor: '#0EA5E9',
    phone: '(617) 555-0671',
    duration: '1:24',
    time: '3 days',
    transcript: [
      { side: 'you', text: 'Returning your call from earlier — what is the best time to come by?' },
      { side: 'them', text: 'Tomorrow morning works.' },
    ],
  },
];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function OutgoingWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return <OutboundList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }
  const item = MOCK.find((m) => m.id === mode.id);
  if (!item) return <OutboundList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  return <OutboundDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function OutboundList({ onBackToMenu, onPick }: { onBackToMenu?: () => void; onPick: (id: string) => void }) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="arrow-up-circle-outline" title="Outgoing" onBackToMenu={onBackToMenu} />
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
                <span style={t.rowName}>{m.name}</span>
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
        ))}
      </div>
    </div>
  );
}

function OutboundDetail({ item, onBack }: { item: Outbound; onBack: () => void }) {
  return (
    <div style={t.detailWrap}>
      <DetailHeader onBack={onBack} initials={item.initials} avatarColor={item.avatarColor} name={item.name} phone={item.phone} />
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
          <ActionButton icon="call-outline" label="Call again" tint="#06B6D4" />
          <ActionButton icon="chatbubble-outline" label="Send SMS" tint="#3B82F6" />
          <ActionButton icon="create-outline" label="Add note" />
        </div>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
