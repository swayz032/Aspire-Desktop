import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Shared bits for front-desk inbox workspaces (All / Missed / Incoming /
 * Outgoing / Voicemail / Contacts / Callback Queue). All visual tokens
 * match SmsWorkspace.tsx so the rail feels identical between sections.
 */

const INVISIBLE_SCROLL_STYLE_ID = 'aspire-invisible-scroll-css';

export function ensureInvisibleScrollCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(INVISIBLE_SCROLL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = INVISIBLE_SCROLL_STYLE_ID;
  style.textContent = `
    .aspire-invisible-scroll {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .aspire-invisible-scroll::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
  `;
  document.head.appendChild(style);
}

// EventType is now defined canonically in @/components/front-desk/types.
// Re-exported here to keep the import surface stable for existing call sites.
export type { EventType } from '@/components/front-desk/types';
import type { EventType } from '@/components/front-desk/types';

export const TYPE_COLOR: Record<EventType, string> = {
  missed_call: '#EF4444',
  voicemail: '#A855F7',
  sms: '#3B82F6',
  callback: '#F59E0B',
  incoming_call: '#22C55E',
  outgoing_call: '#06B6D4',
};

export const TYPE_ICON: Record<EventType, keyof typeof Ionicons.glyphMap> = {
  missed_call: 'call-outline',
  voicemail: 'mic-outline',
  sms: 'chatbubble-ellipses-outline',
  callback: 'time-outline',
  incoming_call: 'arrow-down-circle-outline',
  outgoing_call: 'arrow-up-circle-outline',
};

export function Avatar({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.18)',
      }}
    >
      <span
        style={{
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: size * 0.38,
          fontWeight: 600,
          letterSpacing: 0.2,
        }}
      >
        {initials}
      </span>
    </div>
  );
}

export function ListHeader({
  icon,
  title,
  onBackToMenu,
  rightIcons,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onBackToMenu?: () => void;
  rightIcons?: { name: keyof typeof Ionicons.glyphMap; label: string; onClick?: () => void }[];
}) {
  return (
    <>
      <div style={listHeader}>
        <div style={listHeaderTitleRow}>
          {onBackToMenu ? (
            <button aria-label="Back to inbox menu" onClick={onBackToMenu} style={headerBtn}>
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
            </button>
          ) : null}
          <Ionicons name={icon} size={15} color="rgba(255,255,255,0.85)" />
          <span style={listHeaderTitle}>{title}</span>
        </div>
        <div style={listHeaderIcons}>
          {(rightIcons ?? [{ name: 'search-outline' as const, label: 'Search' }]).map((ri, i) => (
            <button key={i} aria-label={ri.label} onClick={ri.onClick} style={headerBtn}>
              <Ionicons name={ri.name} size={16} color="rgba(255,255,255,0.55)" />
            </button>
          ))}
        </div>
      </div>
      <div style={divider} />
    </>
  );
}

export function DetailHeader({
  onBack,
  initials,
  avatarColor,
  name,
  phone,
  rightIcons,
}: {
  onBack: () => void;
  initials: string;
  avatarColor: string;
  name: string;
  phone?: string;
  rightIcons?: { name: keyof typeof Ionicons.glyphMap; label: string; onClick?: () => void }[];
}) {
  return (
    <div style={detailHeader}>
      <button aria-label="Back to list" onClick={onBack} style={headerBtn}>
        <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
      </button>
      <Avatar initials={initials} color={avatarColor} size={32} />
      <div style={detailHeaderText}>
        <div style={detailHeaderName}>{name}</div>
        {phone ? <div style={detailHeaderPhone}>{phone}</div> : null}
      </div>
      {(rightIcons ?? [
        { name: 'call-outline' as const, label: 'Call' },
        { name: 'ellipsis-horizontal' as const, label: 'More' },
      ]).map((ri, i) => (
        <button key={i} aria-label={ri.label} onClick={ri.onClick} style={headerBtn}>
          <Ionicons name={ri.name} size={16} color="rgba(255,255,255,0.7)" />
        </button>
      ))}
    </div>
  );
}

export function ActionButton({
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
  /** When true, replaces the icon with a spinner and disables the button. */
  pending?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      style={{
        ...actionBtn,
        ...(tint
          ? { background: `${tint}1A`, border: `1px solid ${tint}44` }
          : {}),
        ...(pending ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
      }}
      onMouseEnter={(e) => {
        if (pending) return;
        const el = e.currentTarget as HTMLElement;
        el.style.background = tint ? `${tint}26` : 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = tint ? `${tint}1A` : 'rgba(255,255,255,0.04)';
      }}
    >
      {pending ? (
        <Ionicons name="reload-outline" size={16} color={tint ?? 'rgba(255,255,255,0.85)'} />
      ) : (
        <Ionicons name={icon} size={16} color={tint ?? 'rgba(255,255,255,0.85)'} />
      )}
      <span style={{ ...actionBtnLabel, color: tint ?? 'rgba(255,255,255,0.85)' }}>
        {pending ? '…' : label}
      </span>
    </button>
  );
}

/**
 * Inline error label rendered below an action button when useAction's lastError
 * is non-null. Pass I P0 #5 fix — errors are contextual (inline), not toasted.
 * Toasts are reserved for success receipts.
 */
export function InlineActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        color: '#EF4444',
        marginTop: 6,
        paddingLeft: 4,
        paddingRight: 4,
      }}
    >
      {message}
    </div>
  );
}

export const styleTokens = {
  listWrap: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  listScroll: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: 4,
    paddingBottom: 8,
  } as React.CSSProperties,
  detailWrap: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  } as React.CSSProperties,
  detailScroll: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: 14,
    paddingBottom: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 0,
  } as React.CSSProperties,
  rowBtn: {
    boxSizing: 'border-box',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 10,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s ease',
  } as React.CSSProperties,
  rowText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as React.CSSProperties,
  rowTopLine: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  } as React.CSSProperties,
  rowName: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: -0.1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  } as React.CSSProperties,
  rowTime: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
    flexShrink: 0,
  } as React.CSSProperties,
  rowMidLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  } as React.CSSProperties,
  entityPill: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 10,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.65)',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 6,
    paddingRight: 6,
    flexShrink: 0,
    letterSpacing: 0.2,
  } as React.CSSProperties,
  rowPreview: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  } as React.CSSProperties,
  typeIconWrap: {
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    background: '#3B82F6',
    flexShrink: 0,
    boxShadow: '0 0 8px rgba(59,130,246,0.6)',
  } as React.CSSProperties,
  detailCallerCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  detailSection: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } as React.CSSProperties,
  sectionLabel: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  bodyText: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.45 as any,
  } as React.CSSProperties,
  actionRow: {
    display: 'flex',
    gap: 8,
  } as React.CSSProperties,
};

const listHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  paddingBottom: 10,
  flexShrink: 0,
};
const listHeaderTitleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flex: 1,
};
const listHeaderTitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
};
const listHeaderIcons: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
};
export const headerBtn: React.CSSProperties = {
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
};
const divider: React.CSSProperties = {
  width: '100%',
  height: 1,
  flexShrink: 0,
  background:
    'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, rgba(255,255,255,0) 100%)',
};
const detailHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 4,
  paddingBottom: 10,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
};
const detailHeaderText: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};
const detailHeaderName: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const detailHeaderPhone: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
};
const actionBtn: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingTop: 12,
  paddingBottom: 12,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 0.12s ease',
  minHeight: 64,
};
const actionBtnLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.85)',
};
