import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FeedEventType, EventItemVM } from '@/components/front-desk/types';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';

/**
 * EventDetailModal — flat premium black glassy popup that opens when the user
 * taps a tile in the Today feed.
 *
 * Frame is identical for every event type (backdrop blur + centered glassy
 * card + sticky header + scrollable body + sticky footer). The BODY swaps
 * per type: missed call / voicemail / SMS / callback / incoming call.
 *
 * Pass B: types come from @/components/front-desk/types. EventItem is now an
 * alias of EventItemVM (which mirrors FeedItemVM structurally).
 */

// Re-export the canonical type aliases for backwards compatibility with
// existing import sites (TodayFeed imports `type EventItem`).
export type EventType = FeedEventType;
export type EventItem = EventItemVM;

const TYPE_META: Record<
  EventType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  missed_call: { label: 'Missed call', icon: 'call-outline', color: '#EF4444' },
  voicemail: { label: 'Voicemail', icon: 'mic-outline', color: '#A855F7' },
  sms: { label: 'SMS', icon: 'chatbubble-ellipses-outline', color: '#3B82F6' },
  callback: { label: 'Callback due', icon: 'time-outline', color: '#F59E0B' },
  incoming_call: { label: 'Incoming call', icon: 'arrow-down-circle-outline', color: '#22C55E' },
};

// Only the three "real" entity types render a colored pill; "Unknown" callers
// use UnknownAvatar instead of a pill and skip the entity badge entirely.
const ENTITY_PILL: Record<'Lead' | 'Client' | 'Vendor', { bg: string; fg: string }> = {
  Lead: { bg: 'rgba(59,130,246,0.18)', fg: '#60A5FA' },
  Client: { bg: 'rgba(34,211,238,0.18)', fg: '#22D3EE' },
  Vendor: { bg: 'rgba(168,162,158,0.18)', fg: '#D6D3D1' },
};

const GRADIENT =
  'linear-gradient(135deg, #EF4444 0%, #DC2626 30%, #7C3AED 50%, #3B82F6 70%, #2563EB 100%)';

const MODAL_SCROLL_STYLE_ID = 'aspire-modal-scroll-css';
function ensureModalScrollCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(MODAL_SCROLL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MODAL_SCROLL_STYLE_ID;
  style.textContent = `
    .aspire-modal-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.18) transparent;
    }
    .aspire-modal-scroll::-webkit-scrollbar { width: 6px; background: transparent; }
    .aspire-modal-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 999px; }
    .aspire-modal-scroll::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.10) 100%);
      border-radius: 999px;
    }
  `;
  document.head.appendChild(style);
}

export function EventDetailModal({
  item,
  onClose,
}: {
  item: EventItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    ensureModalScrollCss();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (Platform.OS !== 'web') return null;
  if (!item) return null;

  const meta = TYPE_META[item.type];

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={header}>
          <div style={headerLeft}>
            {item.kind === 'unknown' ? (
              <UnknownAvatar size={44} />
            ) : (
              <Avatar initials={item.initials} color={item.avatarColor} size={44} />
            )}
            <div style={headerText}>
              <div style={headerNameRow}>
                <span style={{ ...headerName, color: item.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#fff' }}>
                  {item.kind === 'unknown' ? 'Unknown caller' : item.name}
                </span>
                {item.entity && item.entity !== 'Unknown' ? (
                  <span
                    style={{
                      ...entityPill,
                      background: ENTITY_PILL[item.entity as 'Lead' | 'Client' | 'Vendor'].bg,
                      color: ENTITY_PILL[item.entity as 'Lead' | 'Client' | 'Vendor'].fg,
                    }}
                  >
                    {item.entity}
                  </span>
                ) : null}
              </div>
              <div style={headerMetaRow}>
                <Ionicons name={meta.icon} size={12} color={meta.color} />
                <span style={{ ...headerType, color: meta.color }}>{meta.label}</span>
                <span style={headerDot}>·</span>
                <span style={headerTime}>{item.time}</span>
              </div>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} style={closeBtn}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        <div style={divider} />

        {/* Body */}
        <div className="aspire-modal-scroll" style={body}>
          <Body item={item} />
        </div>

        <div style={divider} />

        {/* Footer */}
        <div style={footer}>
          <Footer item={item} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

function Body({ item }: { item: EventItem }) {
  if (item.type === 'missed_call') {
    return (
      <>
        <Section title="Summary">
          <p style={pText}>Rang 28s · no voicemail left.</p>
          <p style={pTextMuted}>{item.preview}</p>
        </Section>
        <Section title="Recent history">
          <CompactRow icon="call-outline" color="#22C55E" label="Inbound call · 4:23" sub="Yesterday 9:16 AM" />
          <CompactRow icon="chatbubble-ellipses-outline" color="#3B82F6" label="SMS thread" sub="3 days ago" />
        </Section>
      </>
    );
  }
  if (item.type === 'voicemail') {
    return (
      <>
        <Section title="Voicemail">
          <WaveformPlayer />
        </Section>
        <Section title="Transcript">
          <p style={pText}>
            Hi, this is {item.kind === 'unknown' ? 'an unknown caller' : item.name.split(' ')[0]}.{' '}
            {item.preview} Please give me a call back whenever you get a chance. Thanks!
          </p>
        </Section>
        <Section title="Recent history">
          <CompactRow icon="call-outline" color="#EF4444" label="Missed call" sub="Last week" />
        </Section>
      </>
    );
  }
  if (item.type === 'sms') {
    return (
      <>
        <Section title="Last messages">
          <Bubble side="them" text="Hi, can you confirm what time you'll be onsite tomorrow?" time="Yesterday 9:15 AM" />
          <Bubble side="you" text="Hi! Yes, our team will arrive around 10am." time="Yesterday 9:16 AM" />
          <Bubble side="them" text={item.preview} time={item.time} />
        </Section>
      </>
    );
  }
  if (item.type === 'callback') {
    return (
      <>
        <Section title="Callback promise">
          <p style={pText}>{item.preview}.</p>
          <p style={pTextMuted}>Captured by Sarah during inbound call · context: Needs exterior quote follow-up.</p>
        </Section>
        <Section title="Schedule">
          <div style={scheduleRow}>
            <div style={scheduleCell}>
              <div style={scheduleLabel}>Due</div>
              <div style={scheduleValue}>Today · 2:00 PM</div>
            </div>
            <div style={scheduleCell}>
              <div style={scheduleLabel}>Status</div>
              <div style={{ ...scheduleValue, color: '#F59E0B' }}>Due in 1h</div>
            </div>
          </div>
        </Section>
      </>
    );
  }
  // incoming_call
  return (
    <>
      <Section title="Summary">
        <p style={pText}>Inbound call · 4:23 · Sarah answered.</p>
        <ul style={bulletList}>
          <li style={bulletItem}>Caller asked about availability for interior painting estimate.</li>
          <li style={bulletItem}>Mentioned the kitchen and master bedroom.</li>
          <li style={bulletItem}>Open to a Friday or Monday morning slot.</li>
        </ul>
      </Section>
      <Section title="Transcript snippet">
        <p style={pTextMuted}>
          "...so we'd really like to get the kitchen done first if you have an opening this week.
          Could you swing by Friday morning to take a look?"
        </p>
      </Section>
    </>
  );
}

function Footer({ item, onClose }: { item: EventItem; onClose: () => void }) {
  const handle = (label: string) => () => {
    // Mock — no backend wiring.
    void label;
    onClose();
  };

  if (item.type === 'missed_call') {
    return (
      <>
        <SecondaryBtn icon="chatbubble-ellipses-outline" label="Send SMS" onClick={handle('sms')} />
        <SecondaryBtn icon="person-add-outline" label="Add contact" onClick={handle('add')} />
        <PrimaryBtn icon="call" label="Call back" onClick={handle('call')} />
      </>
    );
  }
  if (item.type === 'voicemail') {
    return (
      <>
        <SecondaryBtn icon="trash-outline" label="Delete" onClick={handle('delete')} />
        <SecondaryBtn icon="checkmark-circle-outline" label="Mark reviewed" onClick={handle('reviewed')} />
        <PrimaryBtn icon="call" label="Call back" onClick={handle('call')} />
      </>
    );
  }
  if (item.type === 'sms') {
    return (
      <>
        <SecondaryBtn icon="ban-outline" label="Block" onClick={handle('block')} />
        <PrimaryBtn icon="arrow-forward" label="Open in SMS" onClick={handle('open')} />
      </>
    );
  }
  if (item.type === 'callback') {
    return (
      <>
        <SecondaryBtn icon="checkmark-circle-outline" label="Mark complete" onClick={handle('complete')} />
        <SecondaryBtn icon="calendar-outline" label="Reschedule" onClick={handle('reschedule')} />
        <PrimaryBtn icon="call" label="Call now" onClick={handle('call')} />
      </>
    );
  }
  // incoming_call
  return (
    <>
      <SecondaryBtn icon="document-text-outline" label="Add note" onClick={handle('note')} />
      <SecondaryBtn icon="chatbubble-ellipses-outline" label="Send SMS" onClick={handle('sms')} />
      <PrimaryBtn icon="call" label="Call back" onClick={handle('call')} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={section}>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionBody}>{children}</div>
    </div>
  );
}

function CompactRow({
  icon,
  color,
  label,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  sub: string;
}) {
  return (
    <div style={compactRow}>
      <div style={{ ...compactRowIcon, background: `${color}22`, color }}>
        <Ionicons name={icon} size={13} color={color} />
      </div>
      <div style={compactRowText}>
        <div style={compactRowLabel}>{label}</div>
        <div style={compactRowSub}>{sub}</div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  text,
  time,
}: {
  side: 'them' | 'you';
  text: string;
  time: string;
}) {
  return (
    <div style={side === 'you' ? bubbleRowYou : bubbleRowThem}>
      <div style={side === 'you' ? bubbleYou : bubbleThem}>
        <span style={bubbleText}>{text}</span>
      </div>
      <div style={bubbleTime}>{time}</div>
    </div>
  );
}

function WaveformPlayer() {
  const bars = Array.from({ length: 28 }).map((_, i) => 4 + ((i * 17) % 18));
  return (
    <div style={player}>
      <button style={playBtn} aria-label="Play voicemail">
        <Ionicons name="play" size={16} color="#fff" />
      </button>
      <div style={waveformWrap}>
        <div style={waveformBars}>
          {bars.map((h, i) => (
            <span
              key={i}
              style={{
                ...waveformBar,
                height: h,
                background: i < 6 ? '#A855F7' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
        <div style={waveformTimes}>
          <span>0:12</span>
          <span>0:46</span>
        </div>
      </div>
    </div>
  );
}

function Avatar({ initials, color, size }: { initials: string; color: string; size: number }) {
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
          color: '#fff',
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

function PrimaryBtn({
  icon,
  label,
  onClick,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={primaryBtn}>
      <Ionicons name={icon} size={16} color="#fff" />
      <span style={primaryBtnLabel}>{label}</span>
    </button>
  );
}

function SecondaryBtn({
  icon,
  label,
  onClick,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={secondaryBtn}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    >
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.85)" />
      <span style={secondaryBtnLabel}>{label}</span>
    </button>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const modal: React.CSSProperties = {
  boxSizing: 'border-box',
  width: 'min(560px, 100%)',
  maxHeight: '80vh',
  background: '#000000',
  backgroundImage:
    'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #0a0a0d 0%, #000000 100%)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '16px 18px',
  flexShrink: 0,
};

const headerLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  flex: 1,
};

const headerText: React.CSSProperties = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const headerNameRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const headerName: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 16,
  fontWeight: 600,
  color: '#fff',
  letterSpacing: -0.2,
};

const entityPill: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  paddingTop: 1,
  paddingBottom: 1,
  paddingLeft: 6,
  paddingRight: 6,
  borderRadius: 999,
  letterSpacing: 0.2,
};

const headerMetaRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const headerType: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
};

const headerDot: React.CSSProperties = {
  color: 'rgba(255,255,255,0.30)',
  fontSize: 11,
};

const headerTime: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.45)',
};

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  width: 32,
  height: 32,
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

const body: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '14px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const section: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
};

const sectionBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const pText: React.CSSProperties = {
  margin: 0,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  color: 'rgba(255,255,255,0.85)',
  lineHeight: 1.4 as any,
};

const pTextMuted: React.CSSProperties = {
  margin: 0,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: 'rgba(255,255,255,0.55)',
  lineHeight: 1.4 as any,
};

const bulletList: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const bulletItem: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  color: 'rgba(255,255,255,0.85)',
  lineHeight: 1.4 as any,
};

const compactRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 8px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.03)',
};

const compactRowIcon: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const compactRowText: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
};

const compactRowLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: '#fff',
};

const compactRowSub: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.45)',
};

const scheduleRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const scheduleCell: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const scheduleLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  letterSpacing: 0.4,
  textTransform: 'uppercase',
};

const scheduleValue: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: '#fff',
};

const bubbleRowThem: React.CSSProperties = {
  alignSelf: 'flex-start',
  maxWidth: '82%',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const bubbleRowYou: React.CSSProperties = {
  alignSelf: 'flex-end',
  maxWidth: '82%',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  alignItems: 'flex-end',
};

const bubbleThem: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  borderBottomLeftRadius: 4,
  padding: '8px 12px',
};

const bubbleYou: React.CSSProperties = {
  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
  borderRadius: 14,
  borderBottomRightRadius: 4,
  padding: '8px 12px',
  boxShadow: '0 2px 6px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
};

const bubbleText: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  color: '#fff',
  lineHeight: 1.35 as any,
};

const bubbleTime: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.35)',
  paddingLeft: 4,
  paddingRight: 4,
};

const player: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 10,
  borderRadius: 12,
  background: 'rgba(168,85,247,0.06)',
  border: '1px solid rgba(168,85,247,0.18)',
};

const playBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
  boxShadow: '0 2px 6px rgba(124,58,237,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const waveformWrap: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const waveformBars: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  height: 24,
};

const waveformBar: React.CSSProperties = {
  flex: 1,
  borderRadius: 999,
  display: 'block',
};

const waveformTimes: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.45)',
  fontVariantNumeric: 'tabular-nums',
};

const footer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 18px',
  flexShrink: 0,
  flexWrap: 'wrap',
};

const primaryBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 38,
  padding: '0 16px',
  borderRadius: 19,
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  backgroundImage: GRADIENT,
  boxShadow: '0 6px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
};

const primaryBtnLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 700,
  color: '#fff',
  letterSpacing: 0.2,
};

const secondaryBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 36,
  padding: '0 12px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

const secondaryBtnLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.85)',
  letterSpacing: -0.1,
};
