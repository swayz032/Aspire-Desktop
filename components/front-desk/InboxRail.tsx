import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * InboxRail — unified Front Desk Inbox card (right rail, top).
 *
 * Per spec PDF §4 + §10: ONE rail card for everything. 6 filter pills
 * (All / Missed / Incoming / Outgoing / Voicemail / SMS) with All as the
 * default mixed-events feed. Selecting SMS swaps the content area into
 * thread + composer mode — that workspace lands in a later pass.
 *
 * This pass: skeleton only — glassy black card frame matching the dial
 * pad, header strip with title + 3 icon affordances, 6 filter pills,
 * empty content slot below.
 */

type Filter = 'all' | 'missed' | 'incoming' | 'outgoing' | 'voicemail' | 'sms';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'missed', label: 'Missed' },
  { id: 'incoming', label: 'Incoming' },
  { id: 'outgoing', label: 'Outgoing' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'sms', label: 'SMS' },
];

export function InboxRail() {
  const [active, setActive] = useState<Filter>('all');

  if (Platform.OS !== 'web') {
    return <View style={styles.card} />;
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <div style={header}>
        <span style={title}>Front Desk Inbox</span>
        <div style={iconRow}>
          <HeaderIcon name="funnel-outline" label="Filter" />
          <HeaderIcon name="search-outline" label="Search" />
          <HeaderIcon name="create-outline" label="Compose" />
        </div>
      </div>

      {/* Filter pills */}
      <div style={pillRow}>
        {FILTERS.map((f) => {
          const isActive = active === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              style={{ ...pillBtn, ...(isActive ? pillBtnActive : null) }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                }
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Empty content slot — rows / SMS workspace land in later passes */}
      <div style={contentSlot} />
    </View>
  );
}

function HeaderIcon({
  name,
  label,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      style={iconBtn}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.color = '#ffffff';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
      }}
    >
      <Ionicons name={name} size={16} color="currentColor" />
    </button>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 6,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
    padding: 14,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #050507 0%, #000000 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        } as any)
      : null),
  },
});

const header: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexShrink: 0,
};

const title: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
};

const iconRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
};

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.55)',
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s ease, color 0.15s ease',
};

const pillRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  flexShrink: 0,
};

const pillBtn: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 999,
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 11,
  paddingRight: 11,
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.15s ease',
  letterSpacing: -0.1,
};

const pillBtnActive: React.CSSProperties = {
  color: '#0a0a0a',
  background: 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)',
  borderColor: 'rgba(255,255,255,0.20)',
  fontWeight: 600,
  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
};

const contentSlot: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
};
