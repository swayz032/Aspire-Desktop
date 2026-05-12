import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SmsWorkspace } from '@/components/front-desk/SmsWorkspace';

/**
 * InboxRail — unified Front Desk Inbox card (right rail, top).
 *
 * Two modes inside the same card:
 *  - MENU (default): floating list of section pills centered in the card.
 *    Each pill is a section option (All / SMS / Missed / ...). Tap one to
 *    enter that section. No dropdown, no backdrop — the menu IS the
 *    default content.
 *  - SECTION: rail shows the picked section's workspace, with a back
 *    arrow at top-left to return to MENU. Section-specific filters /
 *    search / setup live inside their own section (skeleton-only here).
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
  const [section, setSection] = useState<Section | null>(null);

  if (Platform.OS !== 'web') {
    return <View style={styles.card} />;
  }

  return (
    <View style={styles.card}>
      {section === null ? (
        <MenuMode onPick={setSection} />
      ) : (
        <SectionMode
          section={section}
          onBack={() => setSection(null)}
        />
      )}
    </View>
  );
}

function MenuMode({ onPick }: { onPick: (s: Section) => void }) {
  return (
    <>
      {/* Header */}
      <div style={header}>
        <span style={title}>Front Desk Inbox</span>
        <div style={iconRow}>
          <HeaderIcon name="search-outline" label="Search" />
          <HeaderIcon name="create-outline" label="Compose" />
        </div>
      </div>

      {/* Divider */}
      <div style={divider} />

      {/* Compact centered cloud of section pills */}
      <div style={menuWrap}>
        <div style={menuList}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              style={menuPill}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,255,255,0.08)';
                el.style.borderColor = 'rgba(255,255,255,0.14)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,255,255,0.04)';
                el.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              <Ionicons name={s.icon} size={13} color="rgba(255,255,255,0.85)" />
              <span style={menuPillLabel}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function SectionMode({
  section,
  onBack,
}: {
  section: Section;
  onBack: () => void;
}) {
  // SMS owns its whole content area — header swaps per inner mode
  // (list / thread detail / new message), so the rail's generic
  // section header is hidden for SMS.
  if (section === 'sms') {
    return <SmsWorkspace onBackToMenu={onBack} />;
  }

  const meta = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  return (
    <>
      {/* Section header with back arrow */}
      <div style={header}>
        <div style={sectionTitleRow}>
          <button aria-label="Back to inbox menu" onClick={onBack} style={backBtn}>
            <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
          </button>
          <Ionicons name={meta.icon} size={16} color="rgba(255,255,255,0.85)" />
          <span style={title}>{meta.label}</span>
        </div>
        <div style={iconRow}>
          <HeaderIcon name="search-outline" label="Search" />
          <HeaderIcon name="create-outline" label="Compose" />
        </div>
      </div>

      {/* Divider */}
      <div style={divider} />

      {/* Section workspace */}
      <div style={sectionSlot} />
    </>
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

const sectionTitleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flex: 1,
};

const title: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const iconRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
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

const backBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginLeft: -6,
};

const divider: React.CSSProperties = {
  width: '100%',
  height: 1,
  flexShrink: 0,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, rgba(255,255,255,0) 100%)',
};

const menuWrap: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 8,
};

const menuList: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  maxWidth: '100%',
};

const menuPill: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  paddingTop: 6,
  paddingBottom: 6,
  paddingLeft: 10,
  paddingRight: 10,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.08s ease',
  whiteSpace: 'nowrap',
};

const menuPillLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: '#ffffff',
  letterSpacing: -0.1,
};

const sectionSlot: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
};
