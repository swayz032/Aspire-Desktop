import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * InboxRail — unified Front Desk Inbox card (right rail, top).
 *
 * Pattern: ONE rail card for everything. Header has a section selector
 * trigger; tapping it opens a floating menu CENTERED inside the rail
 * with all inbox sections. Picking one closes the menu and swaps the
 * content area below the header to that section's workspace. Each
 * section will own its own filters/search/setup (skeleton only here).
 */

type Section =
  | 'all'
  | 'sms'
  | 'missed'
  | 'incoming'
  | 'outgoing'
  | 'voicemail'
  | 'contacts'
  | 'callback_queue';

const SECTIONS: { id: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'sms', label: 'SMS', icon: 'chatbubble-ellipses-outline' },
  { id: 'missed', label: 'Missed', icon: 'call-outline' },
  { id: 'incoming', label: 'Incoming', icon: 'arrow-down-circle-outline' },
  { id: 'outgoing', label: 'Outgoing', icon: 'arrow-up-circle-outline' },
  { id: 'voicemail', label: 'Voicemail', icon: 'mic-outline' },
  { id: 'contacts', label: 'Contacts', icon: 'people-outline' },
  { id: 'callback_queue', label: 'Callback Queue', icon: 'time-outline' },
];

export function InboxRail() {
  const [section, setSection] = useState<Section>('all');
  const [menuOpen, setMenuOpen] = useState(false);

  if (Platform.OS !== 'web') {
    return <View style={styles.card} />;
  }

  const activeMeta = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <View style={styles.card}>
      {/* Header */}
      <div style={header}>
        <span style={title}>Front Desk Inbox</span>
        <div style={iconRow}>
          <HeaderIcon name="search-outline" label="Search" />
          <HeaderIcon name="create-outline" label="Compose" />
        </div>
      </div>

      {/* Section selector pill — opens the floating menu */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        style={{ ...sectionPill, ...(menuOpen ? sectionPillActive : null) }}
        onMouseEnter={(e) => {
          if (!menuOpen) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
          }
        }}
        onMouseLeave={(e) => {
          if (!menuOpen) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
          }
        }}
      >
        <Ionicons name={activeMeta.icon} size={14} color="#ffffff" />
        <span style={sectionPillLabel}>{activeMeta.label}</span>
        <Ionicons
          name={menuOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="rgba(255,255,255,0.55)"
        />
      </button>

      {/* Divider */}
      <div style={divider} />

      {/* Content area + centered floating menu overlay */}
      <div style={contentWrap}>
        <div style={contentSlot} />

        {menuOpen ? (
          <>
            <button
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              style={backdrop}
            />
            <div style={floatingMenu}>
              <div style={menuHeader}>
                <span style={menuTitle}>Inbox sections</span>
                <button
                  aria-label="Close"
                  onClick={() => setMenuOpen(false)}
                  style={menuCloseBtn}
                >
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
                </button>
              </div>
              <div style={menuList}>
                {SECTIONS.map((s) => {
                  const isActive = s.id === section;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSection(s.id);
                        setMenuOpen(false);
                      }}
                      style={{ ...menuItem, ...(isActive ? menuItemActive : null) }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.background =
                            'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <Ionicons
                        name={s.icon}
                        size={16}
                        color={isActive ? '#3B82F6' : 'rgba(255,255,255,0.55)'}
                      />
                      <span
                        style={{
                          ...menuItemLabel,
                          color: isActive ? '#ffffff' : 'rgba(255,255,255,0.85)',
                          fontWeight: isActive ? 600 : 500,
                        }}
                      >
                        {s.label}
                      </span>
                      {isActive ? (
                        <Ionicons name="checkmark" size={16} color="#3B82F6" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
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

const sectionPill: React.CSSProperties = {
  alignSelf: 'flex-start',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: '#ffffff',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 999,
  paddingTop: 6,
  paddingBottom: 6,
  paddingLeft: 11,
  paddingRight: 9,
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.15s ease',
  flexShrink: 0,
};

const sectionPillActive: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  borderColor: 'rgba(255,255,255,0.15)',
};

const sectionPillLabel: React.CSSProperties = {
  letterSpacing: -0.1,
};

const divider: React.CSSProperties = {
  width: '100%',
  height: 1,
  flexShrink: 0,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, rgba(255,255,255,0) 100%)',
};

const contentWrap: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
};

const contentSlot: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const backdrop: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  padding: 0,
  zIndex: 10,
};

const floatingMenu: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(86%, 280px)',
  maxHeight: '92%',
  background:
    'linear-gradient(180deg, #1a1a1d 0%, #131316 100%)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14,
  boxShadow:
    '0 16px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  zIndex: 11,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const menuHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingTop: 10,
  paddingBottom: 10,
  paddingLeft: 14,
  paddingRight: 8,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const menuTitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.55)',
  letterSpacing: 0.4,
  textTransform: 'uppercase',
};

const menuCloseBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 26,
  height: 26,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const menuList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  padding: 6,
  overflowY: 'auto',
};

const menuItem: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingTop: 9,
  paddingBottom: 9,
  paddingLeft: 12,
  paddingRight: 12,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  background: 'transparent',
  borderRadius: 8,
  transition: 'background 0.12s ease',
  textAlign: 'left',
};

const menuItemActive: React.CSSProperties = {
  background: 'rgba(59,130,246,0.12)',
};

const menuItemLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  flex: 1,
  letterSpacing: -0.1,
};
