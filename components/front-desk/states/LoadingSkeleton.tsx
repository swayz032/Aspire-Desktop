/**
 * LoadingSkeleton — shimmer placeholder matching Front Desk Hub row geometry.
 *
 * Variants:
 *   'list'   — rows with 36px avatar circle + name line + preview line
 *   'detail' — wider rows for detail-pane content cards
 *   'thread' — SMS bubble placeholder rows
 *
 * Uses a CSS keyframe animation injected once into the document. No external
 * shimmer libs — keeps the bundle lean and animation controllable.
 */

import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';

const SHIMMER_STYLE_ID = 'aspire-fd-shimmer-css';

function ensureShimmerCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes aspire-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    .aspire-shimmer {
      background: linear-gradient(
        90deg,
        rgba(255,255,255,0.04) 0%,
        rgba(255,255,255,0.10) 40%,
        rgba(255,255,255,0.04) 80%
      );
      background-size: 800px 100%;
      animation: aspire-shimmer 1.4s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Sub-components for each variant
// ---------------------------------------------------------------------------

function ListRow() {
  return (
    <div style={listRowWrap}>
      {/* Avatar circle — 36px matches inboxShared Avatar default */}
      <div className="aspire-shimmer" style={avatarCircle} />
      <div style={listRowText}>
        <div className="aspire-shimmer" style={nameLine} />
        <div className="aspire-shimmer" style={previewLine} />
      </div>
      {/* Type icon slot */}
      <div className="aspire-shimmer" style={iconSlot} />
    </div>
  );
}

function DetailRow() {
  return (
    <div className="aspire-shimmer" style={detailCard} />
  );
}

function ThreadRow({ side }: { side: 'left' | 'right' }) {
  return (
    <div style={{ ...threadRowWrap, justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
      <div className="aspire-shimmer" style={{ ...threadBubble, width: side === 'right' ? 160 : 200 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export interface LoadingSkeletonProps {
  variant?: 'list' | 'detail' | 'thread';
  count?: number;
}

export function LoadingSkeleton({ variant = 'list', count = 5 }: LoadingSkeletonProps) {
  useEffect(() => {
    ensureShimmerCss();
  }, []);

  if (Platform.OS !== 'web') {
    return <View style={styles.fill} />;
  }

  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'list') {
    return (
      <div style={listWrap}>
        {items.map((i) => <ListRow key={i} />)}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div style={detailWrap}>
        {items.map((i) => <DetailRow key={i} />)}
      </div>
    );
  }

  // thread
  return (
    <div style={threadWrap}>
      {items.map((i) => <ThreadRow key={i} side={i % 2 === 0 ? 'left' : 'right'} />)}
    </div>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const listWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingTop: 4,
};

const listRowWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  paddingTop: 9,
  paddingBottom: 9,
  paddingLeft: 8,
  paddingRight: 10,
};

const avatarCircle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  flexShrink: 0,
};

const listRowText: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
};

const nameLine: React.CSSProperties = {
  height: 12,
  borderRadius: 6,
  width: '55%',
};

const previewLine: React.CSSProperties = {
  height: 10,
  borderRadius: 5,
  width: '80%',
};

const iconSlot: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  flexShrink: 0,
};

const detailWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  paddingTop: 14,
};

const detailCard: React.CSSProperties = {
  height: 72,
  borderRadius: 12,
  width: '100%',
};

const threadWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 10,
  paddingLeft: 12,
  paddingRight: 12,
};

const threadRowWrap: React.CSSProperties = {
  display: 'flex',
  width: '100%',
};

const threadBubble: React.CSSProperties = {
  height: 36,
  borderRadius: 14,
};
