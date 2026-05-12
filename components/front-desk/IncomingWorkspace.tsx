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
 * IncomingWorkspace — list of inbound answered calls. MOCK only.
 */

type Inbound = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  duration: string;
  time: string;
  summary: string[];
  transcript: { side: 'them' | 'you'; text: string }[];
};

const MOCK: Inbound[] = [
  {
    id: 'i1',
    name: 'John Carter',
    initials: 'JC',
    avatarColor: '#3B82F6',
    phone: '(617) 555-0721',
    duration: '4:23',
    time: '34m',
    summary: [
      'Caller is interested in a kitchen remodel quote for a 12x14 space.',
      'Budget range mentioned: $35-45k. Timeline: late summer.',
      'Asked to email project portfolio and a sample SOW.',
    ],
    transcript: [
      { side: 'them', text: 'Hi, I got your number from a neighbor — saw the work you did on their kitchen.' },
      { side: 'you', text: 'Thanks for reaching out! What kind of project are you thinking about?' },
      { side: 'them', text: 'Kitchen remodel, about 12 by 14. Looking to update everything.' },
      { side: 'you', text: 'Got it. Any sense of timeline or budget?' },
      { side: 'them', text: 'Late summer, somewhere in the 35 to 45 range.' },
    ],
  },
  {
    id: 'i2',
    name: 'Peter Hwang',
    initials: 'PH',
    avatarColor: '#F97316',
    phone: '(617) 555-0299',
    duration: '6:08',
    time: '5h',
    summary: [
      'Existing client — calling about the deck project punch list.',
      'Reported a loose railing on the upper landing.',
      'Wants someone out by end of week.',
    ],
    transcript: [
      { side: 'them', text: 'Hey, quick punch list issue on the deck.' },
      { side: 'you', text: 'Sure, what is going on?' },
      { side: 'them', text: 'The railing on the top landing is a little loose.' },
    ],
  },
  {
    id: 'i3',
    name: 'Linda Park',
    initials: 'LP',
    avatarColor: '#10B981',
    phone: '(617) 555-0517',
    duration: '2:54',
    time: 'Yesterday',
    summary: [
      'New lead from Yelp. Wants window replacement quote, 9 windows.',
      'Asked about energy-efficient options.',
      'Will text address for site visit.',
    ],
    transcript: [
      { side: 'them', text: 'Hi, found you on Yelp. Need quotes on 9 windows.' },
    ],
  },
  {
    id: 'i4',
    name: 'Roy Atkins',
    initials: 'RA',
    avatarColor: '#A855F7',
    phone: '(617) 555-0388',
    duration: '1:12',
    time: 'Yesterday',
    summary: [
      'Asking about availability for a roof inspection.',
      'Insurance claim related — needs report by next Friday.',
    ],
    transcript: [
      { side: 'them', text: 'Need a roof inspection report for an insurance claim.' },
    ],
  },
  {
    id: 'i5',
    name: 'Tara Singh',
    initials: 'TS',
    avatarColor: '#EC4899',
    phone: '(617) 555-0203',
    duration: '8:42',
    time: '2 days',
    summary: [
      'Long-time client — bathroom remodel follow-up.',
      'Approved the change order verbally; wants it emailed for signature.',
      'Mentioned a future basement finish project for next year.',
    ],
    transcript: [
      { side: 'them', text: 'About that change order — looks good, send it over to sign.' },
    ],
  },
];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function IncomingWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return <InboundList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }
  const item = MOCK.find((m) => m.id === mode.id);
  if (!item) return <InboundList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  return <InboundDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function InboundList({ onBackToMenu, onPick }: { onBackToMenu?: () => void; onPick: (id: string) => void }) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="arrow-down-circle-outline" title="Incoming" onBackToMenu={onBackToMenu} />
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
                <span style={{ ...t.rowPreview, color: 'rgba(34,197,94,0.85)' }}>Inbound · {m.duration}</span>
              </div>
            </div>
            <div style={t.typeIconWrap}>
              <Ionicons name="arrow-down-circle-outline" size={14} color={TYPE_COLOR.incoming_call} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InboundDetail({ item, onBack }: { item: Inbound; onBack: () => void }) {
  return (
    <div style={t.detailWrap}>
      <DetailHeader onBack={onBack} initials={item.initials} avatarColor={item.avatarColor} name={item.name} phone={item.phone} />
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
          <ActionButton icon="call-outline" label="Call back" tint="#22C55E" />
          <ActionButton icon="chatbubble-outline" label="Send SMS" tint="#3B82F6" />
          <ActionButton icon="create-outline" label="Add note" />
        </div>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
