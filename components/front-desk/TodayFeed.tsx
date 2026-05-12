import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EventDetailModal, type EventItem } from '@/components/front-desk/EventDetailModal';
import type { FeedItemVM, FeedEventType } from '@/components/front-desk/types';
import { MOCK_FEED_ITEMS } from '@/lib/frontDeskMock';
import { useFrontDeskSection } from '@/hooks/useFrontDeskSection';
import { LoadingSkeleton } from '@/components/front-desk/states/LoadingSkeleton';
import { EmptyState } from '@/components/front-desk/states/EmptyState';
import { ErrorState } from '@/components/front-desk/states/ErrorState';
import { UnknownAvatar } from '@/components/front-desk/states/UnknownAvatar';

const GLASSY_SCROLL_STYLE_ID = 'aspire-glassy-hscroll-css';

function ensureGlassyHorizontalScrollCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(GLASSY_SCROLL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GLASSY_SCROLL_STYLE_ID;
  style.textContent = `
    .aspire-glassy-hscroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.18) transparent;
    }
    .aspire-glassy-hscroll::-webkit-scrollbar {
      height: 6px;
      background: transparent;
    }
    .aspire-glassy-hscroll::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.03);
      border-radius: 999px;
      margin-left: 16px;
      margin-right: 16px;
    }
    .aspire-glassy-hscroll::-webkit-scrollbar-thumb {
      background: linear-gradient(90deg,
        rgba(255,255,255,0.10) 0%,
        rgba(255,255,255,0.22) 50%,
        rgba(255,255,255,0.10) 100%);
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .aspire-glassy-hscroll::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(90deg,
        rgba(255,255,255,0.15) 0%,
        rgba(255,255,255,0.32) 50%,
        rgba(255,255,255,0.15) 100%);
    }
  `;
  document.head.appendChild(style);
}

// Local aliases — types live in @/components/front-desk/types
type EventType = FeedEventType;
type FeedItem = FeedItemVM;

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
// use UnknownAvatar instead and skip the entity badge entirely.
const ENTITY_PILL: Record<'Lead' | 'Client' | 'Vendor', { bg: string; fg: string }> = {
  Lead: { bg: 'rgba(59,130,246,0.18)', fg: '#60A5FA' },
  Client: { bg: 'rgba(34,211,238,0.18)', fg: '#22D3EE' },
  Vendor: { bg: 'rgba(168,162,158,0.18)', fg: '#D6D3D1' },
};

// Mock fixtures live in @/lib/frontDeskMock (MOCK_FEED_ITEMS).

export function TodayFeed() {
  const [openItem, setOpenItem] = useState<FeedItem | null>(null);
  useEffect(() => {
    ensureGlassyHorizontalScrollCss();
  }, []);

  const fetcher = useCallback(() => Promise.resolve(MOCK_FEED_ITEMS), []);
  const { data, loading, error, refresh } = useFrontDeskSection<FeedItem>(fetcher, {
    mock: MOCK_FEED_ITEMS,
  });

  if (Platform.OS !== 'web') {
    return <View style={styles.cardNative} />;
  }

  const count = data?.length ?? 0;

  return (
    <View style={styles.fill}>
      {/* Title strip */}
      <div style={header}>
        <div style={titleRow}>
          <span style={title}>Today</span>
          <span style={countPill}>{count}</span>
        </div>
        <span style={subtitle}>Live activity across all channels</span>
      </div>

      {/* Horizontal scroller / states */}
      {loading ? (
        <div style={scroller}>
          <div aria-hidden style={edgeSpacer} />
          <LoadingSkeleton variant="list" count={4} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="hourglass-outline"
          headline="Nothing's happened today yet"
          subtitle="Call activity from across all channels will surface here."
        />
      ) : (
        <div className="aspire-glassy-hscroll" style={scroller}>
          <div aria-hidden style={edgeSpacer} />
          {data.map((item) => (
            <FeedTile key={item.id} item={item} onOpen={setOpenItem} />
          ))}
          <div aria-hidden style={edgeSpacer} />
        </div>
      )}

      <EventDetailModal item={openItem as EventItem | null} onClose={() => setOpenItem(null)} />
    </View>
  );
}

function FeedTile({ item, onOpen }: { item: FeedItem; onOpen: (i: FeedItem) => void }) {
  const meta = TYPE_META[item.type];
  return (
    <button
      onClick={() => onOpen(item)}
      style={tile}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={tileTop}>
        {item.kind === 'unknown' ? (
          <UnknownAvatar size={32} />
        ) : (
          <div style={tileAvatar(item.avatarColor)}>
            <span style={tileAvatarText}>{item.initials}</span>
          </div>
        )}
        <div style={tileNameCol}>
          <div style={{ ...tileName, color: item.kind === 'unknown' ? 'rgba(255,255,255,0.75)' : '#ffffff' }}>
            {item.kind === 'unknown' ? 'Unknown caller' : item.name}
          </div>
          <div style={tileMetaRow}>
            {item.entity && item.entity !== 'Unknown' ? (
              <span
                style={{
                  ...tilePill,
                  background: ENTITY_PILL[item.entity as 'Lead' | 'Client' | 'Vendor'].bg,
                  color: ENTITY_PILL[item.entity as 'Lead' | 'Client' | 'Vendor'].fg,
                }}
              >
                {item.entity}
              </span>
            ) : null}
            <span style={tileTime}>{item.time}</span>
          </div>
        </div>
      </div>

      <div style={tilePreview}>{item.preview}</div>

      <div style={tileFooter}>
        <Ionicons name={meta.icon} size={12} color={meta.color} />
        <span style={{ ...tileTypeLabel, color: meta.color }}>{meta.label}</span>
      </div>
    </button>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  cardNative: { flex: 1 },
});

const header: React.CSSProperties = {
  paddingTop: 12,
  paddingLeft: 16,
  paddingRight: 16,
  paddingBottom: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flexShrink: 0,
};

const titleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const title: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
};

const countPill: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 999,
  paddingTop: 1,
  paddingBottom: 1,
  paddingLeft: 7,
  paddingRight: 7,
};

const subtitle: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  color: 'rgba(255,255,255,0.40)',
};

const scroller: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'row',
  gap: 10,
  overflowX: 'auto',
  overflowY: 'hidden',
  // No horizontal padding — leading/trailing edge spacers handle the
  // 16px insets symmetrically, so the scrollbar can't strip them.
  paddingTop: 4,    // breathing room so hover-lift isn't clipped at top
  paddingBottom: 8, // small — premium glassy scrollbar lives in this gap
};

const edgeSpacer: React.CSSProperties = {
  flex: '0 0 auto',
  width: 6,  // gap (10) + spacer (6) = 16 inset, matches the header's 16
  height: 1,
};

const tile: React.CSSProperties = {
  boxSizing: 'border-box',
  flex: '0 0 auto',
  width: 240,
  height: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 12,
  cursor: 'pointer',
  outline: 'none',
  // Suppress browser focus ring/box — getting clipped by the section
  // card's overflow:hidden when a tile is clicked. We already paint our
  // own hover state.
  WebkitTapHighlightColor: 'transparent',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.12s ease',
};

const tileTop: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
};

function tileAvatar(color: string): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.18)',
  };
}

const tileAvatarText: React.CSSProperties = {
  color: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.2,
};

const tileNameCol: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const tileName: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  color: '#ffffff',
  letterSpacing: -0.1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const tileMetaRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const tilePill: React.CSSProperties = {
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

const tileTime: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  color: 'rgba(255,255,255,0.45)',
};

const tilePreview: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  color: 'rgba(255,255,255,0.65)',
  flex: 1,
  minHeight: 0,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  lineHeight: 1.35 as any,
};

const tileFooter: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  marginTop: 'auto',
};

const tileTypeLabel: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.3,
};
