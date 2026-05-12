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
 * MissedWorkspace — list of missed calls. MOCK only.
 */

type Missed = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  attempted: string; // "rang 28s"
  time: string;
  transcript?: string; // AI capture if voicemail attempted
};

const MOCK: Missed[] = [
  { id: 'm1', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', phone: '(617) 555-0142', attempted: 'rang 28s', time: '8m', transcript: 'No voicemail left. Caller may try again later.' },
  { id: 'm2', name: 'Unknown', initials: '??', avatarColor: '#6B7280', phone: '(978) 555-0023', attempted: 'rang 12s', time: '2h' },
  { id: 'm3', name: 'Carlos Rivera', initials: 'CR', avatarColor: '#EF4444', phone: '(617) 555-0334', attempted: 'rang 18s', time: '4h', transcript: 'Hi, calling about the bathroom remodel quote — please call back.' },
  { id: 'm4', name: 'Jennifer Boyd', initials: 'JB', avatarColor: '#8B5CF6', phone: '(617) 555-0728', attempted: 'rang 32s', time: 'Yesterday' },
  { id: 'm5', name: 'Steel Bros Supply', initials: 'SB', avatarColor: '#06B6D4', phone: '(617) 555-0901', attempted: 'rang 22s', time: 'Yesterday', transcript: 'Quick question about your purchase order #4421.' },
  { id: 'm6', name: 'Diane Foster', initials: 'DF', avatarColor: '#EC4899', phone: '(617) 555-0612', attempted: 'rang 9s', time: '2 days' },
];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function MissedWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return <MissedList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }
  const item = MOCK.find((m) => m.id === mode.id);
  if (!item) return <MissedList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  return <MissedDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function MissedList({ onBackToMenu, onPick }: { onBackToMenu?: () => void; onPick: (id: string) => void }) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="call-outline" title="Missed" onBackToMenu={onBackToMenu} />
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
                <span style={{ ...t.rowPreview, color: 'rgba(239,68,68,0.85)' }}>Missed call · {m.attempted}</span>
              </div>
            </div>
            <div style={t.typeIconWrap}>
              <Ionicons name="call-outline" size={14} color={TYPE_COLOR.missed_call} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MissedDetail({ item, onBack }: { item: Missed; onBack: () => void }) {
  return (
    <div style={t.detailWrap}>
      <DetailHeader onBack={onBack} initials={item.initials} avatarColor={item.avatarColor} name={item.name} phone={item.phone} />
      <div className="aspire-invisible-scroll" style={t.detailScroll}>
        <div style={t.detailCallerCard}>
          <div style={t.sectionLabel}>Missed</div>
          <div style={t.bodyText}>Rang for {item.attempted.replace('rang ', '')} · {item.time} ago</div>
        </div>

        <div style={t.actionRow}>
          <ActionButton icon="call-outline" label="Call back" tint="#22C55E" />
          <ActionButton icon="chatbubble-outline" label="Send SMS" tint="#3B82F6" />
          <ActionButton icon="person-add-outline" label="Add to contacts" />
        </div>

        {item.transcript ? (
          <div style={t.detailSection}>
            <div style={t.sectionLabel}>AI Capture</div>
            <div style={t.bodyText}>{item.transcript}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
