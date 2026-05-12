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
  TYPE_ICON,
  type EventType,
} from '@/components/front-desk/inboxShared';

/**
 * AllWorkspace — chronological mixed feed of every event type.
 * MOCK ONLY. Tap a row to enter detail mode tailored to the event type.
 */

const TYPE_LABEL: Record<EventType, string> = {
  missed_call: 'Missed call',
  voicemail: 'Voicemail',
  sms: 'SMS',
  callback: 'Callback',
  incoming_call: 'Inbound call',
  outgoing_call: 'Outbound call',
};

type ActivityEvent = {
  id: string;
  type: EventType;
  name: string;
  initials: string;
  avatarColor: string;
  phone: string;
  entity?: string;
  preview: string;
  time: string;
  meta?: string;
};

const MOCK_EVENTS: ActivityEvent[] = [
  { id: 'e1', type: 'sms', name: 'Brighton Office Build', initials: 'BO', avatarColor: '#22C55E', phone: '(617) 555-0188', entity: 'Client', preview: "Thanks! We'll be there at 10am.", time: '2m' },
  { id: 'e2', type: 'missed_call', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', phone: '(617) 555-0142', entity: 'Lead', preview: 'Rang 28s, no voicemail', time: '8m', meta: 'rang 28s' },
  { id: 'e3', type: 'voicemail', name: 'David Reed', initials: 'DR', avatarColor: '#A855F7', phone: '(617) 555-0319', entity: 'Client', preview: 'Hi this is David, calling about the porch...', time: '21m', meta: '0:46' },
  { id: 'e4', type: 'incoming_call', name: 'John Carter', initials: 'JC', avatarColor: '#3B82F6', phone: '(617) 555-0721', entity: 'Lead', preview: 'Inbound · 4:23', time: '34m' },
  { id: 'e5', type: 'callback', name: 'Amanda Hill', initials: 'AH', avatarColor: '#EC4899', phone: '(617) 555-0892', entity: 'Client', preview: 'Callback promised at 2:00 PM', time: '47m' },
  { id: 'e6', type: 'outgoing_call', name: 'Coastal Roofing Supply', initials: 'CS', avatarColor: '#06B6D4', phone: '(617) 555-0455', entity: 'Vendor', preview: 'Outbound · 2:11', time: '1h' },
  { id: 'e7', type: 'sms', name: 'Michael Tan', initials: 'MT', avatarColor: '#EF4444', phone: '(617) 555-0608', entity: 'Lead', preview: 'Invoice received, thank you.', time: '1h' },
  { id: 'e8', type: 'missed_call', name: 'Unknown', initials: '??', avatarColor: '#6B7280', phone: '(978) 555-0023', entity: 'Unknown', preview: 'Rang 12s, no voicemail', time: '2h', meta: 'rang 12s' },
  { id: 'e9', type: 'voicemail', name: 'Sarah Klein', initials: 'SK', avatarColor: '#10B981', phone: '(617) 555-0411', entity: 'Client', preview: 'Following up on the estimate you sent...', time: '3h', meta: '1:12' },
  { id: 'e10', type: 'incoming_call', name: 'Peter Hwang', initials: 'PH', avatarColor: '#F97316', phone: '(617) 555-0299', entity: 'Lead', preview: 'Inbound · 6:08', time: '5h' },
  { id: 'e11', type: 'outgoing_call', name: 'Lisa Moreno', initials: 'LM', avatarColor: '#8B5CF6', phone: '(617) 555-0822', entity: 'Client', preview: 'Outbound · 0:48', time: 'Yesterday' },
  { id: 'e12', type: 'callback', name: 'Greg Patel', initials: 'GP', avatarColor: '#0EA5E9', phone: '(617) 555-0671', entity: 'Lead', preview: 'Callback scheduled for tomorrow 9 AM', time: 'Yesterday' },
];

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function AllWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return <EventList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }

  const ev = MOCK_EVENTS.find((e) => e.id === mode.id);
  if (!ev) {
    return <EventList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }
  return <EventDetail ev={ev} onBack={() => setMode({ kind: 'list' })} />;
}

function EventList({ onBackToMenu, onPick }: { onBackToMenu?: () => void; onPick: (id: string) => void }) {
  return (
    <div style={t.listWrap}>
      <ListHeader icon="apps-outline" title="All" onBackToMenu={onBackToMenu} />
      <div className="aspire-invisible-scroll" style={t.listScroll}>
        {MOCK_EVENTS.map((ev) => (
          <ActivityRow key={ev.id} ev={ev} onClick={() => onPick(ev.id)} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ ev, onClick }: { ev: ActivityEvent; onClick: () => void }) {
  const color = TYPE_COLOR[ev.type];
  const icon = TYPE_ICON[ev.type];
  return (
    <button
      onClick={onClick}
      style={t.rowBtn}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      <Avatar initials={ev.initials} color={ev.avatarColor} />
      <div style={t.rowText}>
        <div style={t.rowTopLine}>
          <span style={t.rowName}>{ev.name}</span>
          <span style={t.rowTime}>{ev.time}</span>
        </div>
        <div style={t.rowMidLine}>
          {ev.entity ? <span style={t.entityPill}>{ev.entity}</span> : null}
          <span style={t.rowPreview}>{ev.preview}</span>
        </div>
      </div>
      <div style={t.typeIconWrap}>
        <Ionicons name={icon} size={14} color={color} />
      </div>
    </button>
  );
}

function EventDetail({ ev, onBack }: { ev: ActivityEvent; onBack: () => void }) {
  const color = TYPE_COLOR[ev.type];
  return (
    <div style={t.detailWrap}>
      <DetailHeader
        onBack={onBack}
        initials={ev.initials}
        avatarColor={ev.avatarColor}
        name={ev.name}
        phone={ev.phone}
      />
      <div className="aspire-invisible-scroll" style={t.detailScroll}>
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
          <Ionicons name={TYPE_ICON[ev.type]} size={12} color={color} />
          <span>{TYPE_LABEL[ev.type]}</span>
        </div>
        <div style={t.detailCallerCard}>
          <div style={t.bodyText}>{ev.preview}</div>
          {ev.meta ? <div style={t.sectionLabel}>{ev.meta}</div> : null}
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
