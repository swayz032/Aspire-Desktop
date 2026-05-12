import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ensureInvisibleScrollCss,
  Avatar,
  ListHeader,
  InlineActionError,
  styleTokens as t,
  headerBtn,
} from '@/components/front-desk/inboxShared';
import { callBack } from '@/lib/actions/frontDeskActions';
import { useAction } from '@/hooks/useAction';
import { useFrontDeskContext } from '@/lib/context/FrontDeskContext';
import type { ContactVM, EntityType } from '@/components/front-desk/types';
import { MOCK_CONTACTS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';

/**
 * ContactsWorkspace — searchable list of people grouped by entity type.
 * Pass B: VM types + mock fixtures from @/lib/frontDeskMock.
 */

const FILTERS: ('All' | EntityType)[] = ['All', 'Lead', 'Client', 'Vendor', 'Unknown'];

const ENTITY_COLOR: Record<EntityType, string> = {
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

  const fetcher = useCallback(() => Promise.resolve(MOCK_CONTACTS), []);
  const { data, loading, error, refresh } = useFrontDeskSection<ContactVM>(fetcher, {
    mock: MOCK_CONTACTS,
  });

  if (Platform.OS !== 'web') return <View style={styles.fill} />;

  if (mode.kind === 'list') {
    return (
      <ContactList
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
      <ContactList
        data={data}
        loading={loading}
        error={error}
        onRetry={refresh}
        onBackToMenu={onBackToMenu}
        onPick={(id) => setMode({ kind: 'detail', id })}
      />
    );
  return <ContactDetail item={item} onBack={() => setMode({ kind: 'list' })} />;
}

function ContactList({
  data,
  loading,
  error,
  onRetry,
  onBackToMenu,
  onPick,
}: {
  data: ContactVM[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackToMenu?: () => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | EntityType>('All');

  const filtered = useMemo(() => {
    const all = data ?? [];
    return all.filter((c) => {
      if (filter !== 'All' && c.entity !== filter) return false;
      if (query.trim() && !c.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, query, filter]);

  return (
    <div style={t.listWrap}>
      <ListHeader
        icon="people-outline"
        title="Contacts"
        onBackToMenu={onBackToMenu}
        rightIcons={[{ name: 'person-add-outline', label: 'Add contact' }]}
      />

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
        {loading ? (
          <LoadingSkeleton variant="list" count={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="people-outline"
            headline="No contacts yet"
            subtitle="People you talk to will collect here automatically."
          />
        ) : filtered.length === 0 ? (
          <div style={emptyState}>
            <Ionicons name="search-outline" size={20} color="rgba(255,255,255,0.35)" />
            <span style={emptyText}>No contacts match</span>
          </div>
        ) : (
          filtered.map((c) => {
            const isUnknown = c.entity === 'Unknown';
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                style={t.rowBtn}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                {isUnknown ? (
                  <UnknownAvatar size={36} />
                ) : (
                  <Avatar initials={c.initials} color={c.avatarColor} />
                )}
                <div style={t.rowText}>
                  <div style={t.rowTopLine}>
                    <span style={{ ...t.rowName, color: isUnknown ? 'rgba(255,255,255,0.75)' : '#fff' }}>
                      {isUnknown ? 'Unknown caller' : c.name}
                    </span>
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
            );
          })
        )}
      </div>
    </div>
  );
}

function ContactDetail({ item, onBack }: { item: ContactVM; onBack: () => void }) {
  const isUnknown = item.entity === 'Unknown';
  // Pass I P0 #5: surface lastError inline.
  const [runCall, callPending, callError] = useAction('Calling');
  const { crossLink } = useFrontDeskContext();
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
          {isUnknown ? (
            <UnknownAvatar size={64} />
          ) : (
            <Avatar initials={item.initials} color={item.avatarColor} size={64} />
          )}
          <div style={{ ...bigName, color: isUnknown ? 'rgba(255,255,255,0.75)' : '#fff' }}>
            {isUnknown ? 'Unknown caller' : item.name}
          </div>
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
          <ActionContactBtn
            icon="call-outline"
            label="Call"
            tint="#22C55E"
            pending={callPending}
            onClick={() => void runCall(() => callBack(item.phone))}
          />
          <ActionContactBtn
            icon="chatbubble-outline"
            label="SMS"
            tint="#3B82F6"
            // Pass I P0 #3: cross-link to SmsWorkspace NEW with phone pre-filled.
            onClick={() =>
              crossLink({
                section: 'sms',
                payload: { newMessage: { to: item.phone } },
              })
            }
          />
          <ActionContactBtn icon="create-outline" label="Edit" />
        </div>
        <InlineActionError message={callError} />
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

function ActionContactBtn({
  icon,
  label,
  tint,
  onClick,
  pending,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  onClick?: () => void;
  pending?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
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
        cursor: pending ? 'not-allowed' : 'pointer',
        outline: 'none',
        transition: 'background 0.12s ease',
        minHeight: 64,
        opacity: pending ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (pending) return;
        (e.currentTarget as HTMLElement).style.background = tint ? `${tint}26` : 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = tint ? `${tint}1A` : 'rgba(255,255,255,0.04)';
      }}
    >
      {pending ? (
        <Ionicons name="reload-outline" size={16} color={tint ?? 'rgba(255,255,255,0.85)'} />
      ) : (
        <Ionicons name={icon} size={16} color={tint ?? 'rgba(255,255,255,0.85)'} />
      )}
      <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, fontWeight: 500, color: tint ?? 'rgba(255,255,255,0.85)' }}>
        {pending ? '…' : label}
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
