import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ensureInvisibleScrollCss,
  Avatar,
  ListHeader,
  styleTokens as t,
  headerBtn,
} from '@/components/front-desk/inboxShared';

/**
 * ContactsWorkspace — searchable list of people grouped by entity type.
 * MOCK only.
 */

type Entity = 'Lead' | 'Client' | 'Vendor' | 'Unknown';
const FILTERS: ('All' | Entity)[] = ['All', 'Lead', 'Client', 'Vendor', 'Unknown'];

type Interaction = { type: 'call' | 'sms' | 'voicemail'; preview: string; time: string };

type Contact = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  entity: Entity;
  phone: string;
  email?: string;
  address?: string;
  lastInteractionSnippet: string;
  history: Interaction[];
};

const MOCK: Contact[] = [
  { id: 'c1', name: 'Brighton Office Build', initials: 'BO', avatarColor: '#22C55E', entity: 'Client', phone: '(617) 555-0188', email: 'pm@brightonoffice.com', address: '120 Federal St, Boston, MA', lastInteractionSnippet: 'SMS · "Thanks! We will be there at 10am."', history: [
    { type: 'sms', preview: 'Thanks! We will be there at 10am.', time: '2m' },
    { type: 'call', preview: 'Outbound · 5:36', time: '2d' },
  ]},
  { id: 'c2', name: 'Maria Lewis', initials: 'ML', avatarColor: '#F59E0B', entity: 'Lead', phone: '(617) 555-0142', email: 'maria.lewis@email.com', lastInteractionSnippet: 'Missed call · rang 28s', history: [
    { type: 'call', preview: 'Missed · rang 28s', time: '8m' },
  ]},
  { id: 'c3', name: 'David Reed', initials: 'DR', avatarColor: '#A855F7', entity: 'Client', phone: '(617) 555-0319', email: 'd.reed@email.com', address: '88 Oak Ave, Cambridge, MA', lastInteractionSnippet: 'Voicemail · 0:46', history: [
    { type: 'voicemail', preview: 'Calling about the porch...', time: '21m' },
  ]},
  { id: 'c4', name: 'John Carter', initials: 'JC', avatarColor: '#3B82F6', entity: 'Lead', phone: '(617) 555-0721', lastInteractionSnippet: 'Inbound · 4:23', history: [
    { type: 'call', preview: 'Inbound · 4:23', time: '34m' },
  ]},
  { id: 'c5', name: 'Amanda Hill', initials: 'AH', avatarColor: '#EC4899', entity: 'Client', phone: '(617) 555-0892', email: 'amanda@hillco.com', address: '14 Beacon St, Boston, MA', lastInteractionSnippet: 'SMS · "Thanks again!"', history: [
    { type: 'sms', preview: 'Thanks again!', time: '2d' },
  ]},
  { id: 'c6', name: 'Coastal Roofing Supply', initials: 'CS', avatarColor: '#06B6D4', entity: 'Vendor', phone: '(617) 555-0455', email: 'orders@coastalroofing.com', lastInteractionSnippet: 'Outbound · 2:11', history: [
    { type: 'call', preview: 'Outbound · 2:11', time: '1h' },
  ]},
  { id: 'c7', name: 'Michael Tan', initials: 'MT', avatarColor: '#EF4444', entity: 'Lead', phone: '(617) 555-0608', email: 'mtan@email.com', lastInteractionSnippet: 'SMS · "Invoice received, thank you."', history: [
    { type: 'sms', preview: 'Invoice received, thank you.', time: '1h' },
  ]},
  { id: 'c8', name: 'Unknown', initials: '??', avatarColor: '#6B7280', entity: 'Unknown', phone: '(978) 555-0023', lastInteractionSnippet: 'Missed call · rang 12s', history: [
    { type: 'call', preview: 'Missed · rang 12s', time: '2h' },
  ]},
  { id: 'c9', name: 'Steel Bros Supply', initials: 'SB', avatarColor: '#0EA5E9', entity: 'Vendor', phone: '(617) 555-0901', email: 'sales@steelbros.com', lastInteractionSnippet: 'Missed call · rang 22s', history: [
    { type: 'call', preview: 'Missed · rang 22s', time: '1d' },
  ]},
  { id: 'c10', name: 'Lisa Moreno', initials: 'LM', avatarColor: '#8B5CF6', entity: 'Client', phone: '(617) 555-0822', email: 'lisa.m@email.com', address: '32 Maple Dr, Somerville, MA', lastInteractionSnippet: 'Outbound · 0:48', history: [
    { type: 'call', preview: 'Outbound · 0:48', time: '1d' },
  ]},
  { id: 'c11', name: 'Greg Patel', initials: 'GP', avatarColor: '#10B981', entity: 'Lead', phone: '(617) 555-0671', lastInteractionSnippet: 'Callback scheduled', history: [
    { type: 'call', preview: 'Outbound · 1:24', time: '3d' },
  ]},
  { id: 'c12', name: 'Westwood Lumber Co', initials: 'WL', avatarColor: '#F97316', entity: 'Vendor', phone: '(617) 555-0510', email: 'pickup@westwoodlumber.com', lastInteractionSnippet: 'SMS · "Order ready for pickup."', history: [
    { type: 'sms', preview: 'Order ready for pickup.', time: '5d' },
  ]},
];

const ENTITY_COLOR: Record<Entity, string> = {
  Lead: '#F59E0B',
  Client: '#22C55E',
  Vendor: '#06B6D4',
  Unknown: '#6B7280',
};

type Mode = { kind: 'list' } | { kind: 'detail'; id: string };

export function ContactsWorkspace({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  useEffect(() => {
    ensureInvisibleScrollCss();
  }, []);

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return <ContactList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  }
  const item = MOCK.find((c) => c.id === mode.id);
  if (!item) return <ContactList onBackToMenu={onBackToMenu} onPick={(id) => setMode({ kind: 'detail', id })} />;
  return <ContactDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function ContactList({ onBackToMenu, onPick }: { onBackToMenu?: () => void; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | Entity>('All');

  const filtered = useMemo(() => {
    return MOCK.filter((c) => {
      if (filter !== 'All' && c.entity !== filter) return false;
      if (query.trim() && !c.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [query, filter]);

  return (
    <div style={t.listWrap}>
      <ListHeader icon="people-outline" title="Contacts" onBackToMenu={onBackToMenu} rightIcons={[{ name: 'person-add-outline', label: 'Add contact' }]} />

      {/* Search */}
      <div style={searchWrap}>
        <Ionicons name="search-outline" size={14} color="rgba(255,255,255,0.45)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts"
          style={searchInput}
        />
      </div>

      {/* Filter pills */}
      <div style={filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...filterPill,
                background: active ? 'rgba(59,130,246,0.16)' : 'rgba(255,255,255,0.04)',
                border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.7)',
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div className="aspire-invisible-scroll" style={{ ...t.listScroll, paddingTop: 8 }}>
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={t.rowBtn}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <Avatar initials={c.initials} color={c.avatarColor} />
            <div style={t.rowText}>
              <div style={t.rowTopLine}>
                <span style={t.rowName}>{c.name}</span>
              </div>
              <div style={t.rowMidLine}>
                <span
                  style={{
                    ...t.entityPill,
                    color: ENTITY_COLOR[c.entity],
                    background: `${ENTITY_COLOR[c.entity]}1A`,
                    border: `1px solid ${ENTITY_COLOR[c.entity]}44`,
                  }}
                >
                  {c.entity}
                </span>
                <span style={t.rowPreview}>{c.lastInteractionSnippet}</span>
              </div>
            </div>
            <div style={t.typeIconWrap}>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.35)" />
            </div>
          </button>
        ))}
        {filtered.length === 0 ? (
          <div style={emptyState}>
            <Ionicons name="search-outline" size={20} color="rgba(255,255,255,0.35)" />
            <span style={emptyText}>No contacts match</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ContactDetail({ item, onBack }: { item: Contact; onBack: () => void }) {
  return (
    <div style={t.detailWrap}>
      <div style={contactDetailHeader}>
        <button aria-label="Back to contacts" onClick={onBack} style={headerBtn}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
        </button>
        <span style={contactDetailHeaderTitle}>Contact</span>
        <button aria-label="Edit" style={headerBtn}>
          <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.7)" />
        </button>
      </div>

      <div className="aspire-invisible-scroll" style={t.detailScroll}>
        {/* Big avatar header */}
        <div style={bigHeader}>
          <Avatar initials={item.initials} color={item.avatarColor} size={64} />
          <div style={bigName}>{item.name}</div>
          <span
            style={{
              ...t.entityPill,
              color: ENTITY_COLOR[item.entity],
              background: `${ENTITY_COLOR[item.entity]}1A`,
              border: `1px solid ${ENTITY_COLOR[item.entity]}44`,
              fontSize: 11,
              padding: '2px 8px',
            }}
          >
            {item.entity}
          </span>
        </div>

        {/* Contact fields */}
        <div style={t.detailSection}>
          <FieldRow icon="call-outline" label="Phone" value={item.phone} />
          {item.email ? <FieldRow icon="mail-outline" label="Email" value={item.email} /> : null}
          {item.address ? <FieldRow icon="location-outline" label="Address" value={item.address} /> : null}
        </div>

        {/* History */}
        <div style={t.detailSection}>
          <div style={t.sectionLabel}>Recent Activity</div>
          {item.history.map((h, i) => (
            <div key={i} style={historyRow}>
              <Ionicons
                name={h.type === 'sms' ? 'chatbubble-outline' : h.type === 'voicemail' ? 'mic-outline' : 'call-outline'}
                size={13}
                color={h.type === 'sms' ? '#3B82F6' : h.type === 'voicemail' ? '#A855F7' : 'rgba(255,255,255,0.65)'}
              />
              <span style={historyPreview}>{h.preview}</span>
              <span style={historyTime}>{h.time}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={t.actionRow}>
          <ActionContactBtn icon="call-outline" label="Call" tint="#22C55E" />
          <ActionContactBtn icon="chatbubble-outline" label="SMS" tint="#3B82F6" />
          <ActionContactBtn icon="create-outline" label="Edit" />
        </div>
      </div>
    </div>
  );
}

function FieldRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <div style={fieldRow}>
      <div style={fieldIconWrap}>
        <Ionicons name={icon} size={14} color="rgba(255,255,255,0.55)" />
      </div>
      <div style={fieldText}>
        <div style={fieldLabel}>{label}</div>
        <div style={fieldValue}>{value}</div>
      </div>
    </div>
  );
}

function ActionContactBtn({ icon, label, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; tint?: string }) {
  return (
    <button
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingTop: 12,
        paddingBottom: 12,
        background: tint ? `${tint}1A` : 'rgba(255,255,255,0.04)',
        border: tint ? `1px solid ${tint}44` : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 0.12s ease',
        minHeight: 64,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = tint ? `${tint}26` : 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = tint ? `${tint}1A` : 'rgba(255,255,255,0.04)';
      }}
    >
      <Ionicons name={icon} size={16} color={tint ?? 'rgba(255,255,255,0.85)'} />
      <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, fontWeight: 500, color: tint ?? 'rgba(255,255,255,0.85)' }}>
        {label}
      </span>
    </button>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

const searchWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingLeft: 10,
  paddingRight: 10,
  paddingTop: 8,
  paddingBottom: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  marginTop: 8,
  flexShrink: 0,
};
const searchInput: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
};
const filterRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  paddingTop: 8,
  flexShrink: 0,
};
const filterPill: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 10,
  paddingRight: 10,
  borderRadius: 999,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: 0.2,
  transition: 'background 0.12s ease, border-color 0.12s ease',
};
const emptyState: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingTop: 32,
};
const emptyText: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: 'rgba(255,255,255,0.45)',
};

const contactDetailHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 4,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
};
const contactDetailHeaderTitle: React.CSSProperties = {
  flex: 1,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: '#ffffff',
};
const bigHeader: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  paddingTop: 4,
  paddingBottom: 4,
};
const bigName: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 16,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.2,
};
const fieldRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};
const fieldIconWrap: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const fieldText: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
};
const fieldLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.45)',
  letterSpacing: 0.4,
  textTransform: 'uppercase',
};
const fieldValue: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  color: '#ffffff',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const historyRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
const historyPreview: React.CSSProperties = {
  flex: 1,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: 'rgba(255,255,255,0.78)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const historyTime: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.40)',
  flexShrink: 0,
};
