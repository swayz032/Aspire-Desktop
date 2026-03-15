import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { useAgentVoice } from '@/hooks/useAgentVoice';
import { useSupabase, useTenant } from '@/providers';
import { useDynamicAuthorityQueue } from '@/lib/authorityQueueStore';
import { AuthorityQueueCard } from '@/components/AuthorityQueueCard';
import { DocumentPreviewModal } from '@/components/DocumentPreviewModal';
import { getAuthorityQueue } from '@/lib/api';
import type { AuthorityItem } from '@/types';
import ExplainDrawer from '@/components/finance/ExplainDrawer';
import { FinnDeskOverlay } from '@/components/finance/FinnDeskOverlay';
import { FinnChatModal } from '@/components/finance/FinnChatModal';

import ReconcileCard from '@/components/finance/ReconcileCard';
import LifecycleChain from '@/components/finance/LifecycleChain';
import { StoryModeCarousel, STORY_MODES } from '@/components/finance/StoryModeCarousel';
import type { StoryModeId } from '@/components/finance/StoryModeCarousel';
import { GlowTrendCard } from '@/components/finance/GlowTrendCard';
import { SegmentRingCard } from '@/components/finance/SegmentRingCard';
import { QueueInstrumentCard } from '@/components/finance/QueueInstrumentCard';
import { InsightOverlayCard } from '@/components/finance/InsightOverlayCard';
import { GreetingCard } from '@/components/finance/GreetingCard';
import { HealthScoreRing } from '@/components/finance/HealthScoreRing';
import { FinnDailyBrief } from '@/components/finance/FinnDailyBrief';
import { getStoryDashboardConfig } from '@/components/finance/storyModeConfigs';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';

interface SnapshotData {
  chapters: {
    now: { cashAvailable: number; bankBalance: number; stripeAvailable: number; stripePending: number; lastUpdated: string | null };
    next: { expectedInflows7d: number; expectedOutflows7d: number; netCashFlow7d: number; items: any[] };
    month: { revenue: number; expenses: number; netIncome: number; period: string };
    reconcile: { mismatches: any[]; mismatchCount: number };
    actions: { proposals: any[]; proposalCount: number };
  };
  provenance: Record<string, any>;
  staleness: Record<string, any>;
  generatedAt: string | null;
  connected: boolean;
}

interface ConnectionStatus {
  connections: Array<{ id: string; provider: string; status: string; lastSyncAt: string | null; nextStep: string | null }>;
  summary: { total: number; connected: number; needsAttention: number };
}


const tintPositionMap: Record<string, string> = {
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'top-left': 'top left',
  'bottom-right': 'bottom right',
  'center': 'center',
};

let finnCssInjected = false;
function injectFinnCss() {
  if (finnCssInjected || Platform.OS !== 'web') return;
  finnCssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    video.finn-orb-video::-webkit-media-controls,
    video.finn-orb-video::-webkit-media-controls-enclosure,
    video.finn-orb-video::-webkit-media-controls-panel,
    video.finn-orb-video::-webkit-media-controls-start-playback-button,
    video.finn-orb-video::-webkit-media-controls-overlay-play-button {
      display: none !important;
      -webkit-appearance: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    video.finn-orb-video::-moz-media-controls { display: none !important; }

    @keyframes finnLedText {
      0%   { color: #A78BFA; }
      16%  { color: #60A5FA; }
      33%  { color: #34D399; }
      50%  { color: #818CF8; }
      66%  { color: #F472B6; }
      83%  { color: #C084FC; }
      100% { color: #A78BFA; }
    }
    @keyframes finnLedBorder {
      0%   { border-color: rgba(167,139,250,0.35); box-shadow: 0 0 8px rgba(167,139,250,0.15); }
      16%  { border-color: rgba(96,165,250,0.4); box-shadow: 0 0 8px rgba(96,165,250,0.18); }
      33%  { border-color: rgba(52,211,153,0.4); box-shadow: 0 0 8px rgba(52,211,153,0.18); }
      50%  { border-color: rgba(129,140,248,0.4); box-shadow: 0 0 8px rgba(129,140,248,0.18); }
      66%  { border-color: rgba(244,114,182,0.4); box-shadow: 0 0 8px rgba(244,114,182,0.18); }
      83%  { border-color: rgba(192,132,252,0.4); box-shadow: 0 0 8px rgba(192,132,252,0.18); }
      100% { border-color: rgba(167,139,250,0.35); box-shadow: 0 0 8px rgba(167,139,250,0.15); }
    }
    @keyframes finnLedBg {
      0%   { background: rgba(167,139,250,0.18); border-color: rgba(167,139,250,0.3); box-shadow: 0 0 12px rgba(167,139,250,0.12); }
      16%  { background: rgba(96,165,250,0.18); border-color: rgba(96,165,250,0.35); box-shadow: 0 0 12px rgba(96,165,250,0.15); }
      33%  { background: rgba(52,211,153,0.18); border-color: rgba(52,211,153,0.35); box-shadow: 0 0 12px rgba(52,211,153,0.15); }
      50%  { background: rgba(129,140,248,0.18); border-color: rgba(129,140,248,0.35); box-shadow: 0 0 12px rgba(129,140,248,0.15); }
      66%  { background: rgba(244,114,182,0.18); border-color: rgba(244,114,182,0.35); box-shadow: 0 0 12px rgba(244,114,182,0.15); }
      83%  { background: rgba(192,132,252,0.18); border-color: rgba(192,132,252,0.35); box-shadow: 0 0 12px rgba(192,132,252,0.15); }
      100% { background: rgba(167,139,250,0.18); border-color: rgba(167,139,250,0.3); box-shadow: 0 0 12px rgba(167,139,250,0.12); }
    }
    @keyframes finnLedIcon {
      0%   { color: #A78BFA; filter: drop-shadow(0 0 4px rgba(167,139,250,0.3)); }
      16%  { color: #60A5FA; filter: drop-shadow(0 0 4px rgba(96,165,250,0.3)); }
      33%  { color: #34D399; filter: drop-shadow(0 0 4px rgba(52,211,153,0.3)); }
      50%  { color: #818CF8; filter: drop-shadow(0 0 4px rgba(129,140,248,0.3)); }
      66%  { color: #F472B6; filter: drop-shadow(0 0 4px rgba(244,114,182,0.3)); }
      83%  { color: #C084FC; filter: drop-shadow(0 0 4px rgba(192,132,252,0.3)); }
      100% { color: #A78BFA; filter: drop-shadow(0 0 4px rgba(167,139,250,0.3)); }
    }
    .hero-led-icon {
      animation: finnLedIcon 3s ease-in-out infinite;
      display: inline-flex;
    }
    .hero-led-icon svg [stroke]:not([stroke="none"]) {
      stroke: currentColor !important;
    }
    .hero-led-icon svg [fill]:not([fill="none"]):not([fill=""]) {
      fill: currentColor !important;
    }
    .finn-led-title {
      animation: finnLedText 3s ease-in-out infinite;
    }
    .finn-led-subtitle {
      animation: finnLedText 3s ease-in-out infinite;
      animation-delay: -0.5s;
    }
    .finn-chat-icon {
      animation: finnLedBorder 3s ease-in-out infinite;
      animation-delay: -1s;
      transition: transform 0.15s ease;
    }
    .finn-chat-icon:hover {
      transform: scale(1.08);
    }
    .finn-chat-icon .icon-inner {
      animation: finnLedIcon 3s ease-in-out infinite;
      animation-delay: -1s;
    }
    .finn-session-btn {
      animation: finnLedBg 3s ease-in-out infinite !important;
      animation-delay: -1.5s;
      border: 1px solid rgba(167,139,250,0.3) !important;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .finn-session-btn:hover {
      transform: scale(1.04);
      filter: brightness(1.2);
    }
    .led-icon {
      animation: finnLedIcon 3s ease-in-out infinite;
      display: inline-flex;
    }
    .led-icon svg [stroke]:not([stroke="none"]) {
      stroke: currentColor !important;
    }
    .led-icon svg [fill]:not([fill="none"]):not([fill=""]) {
      fill: currentColor !important;
    }
    .led-icon-d1 { animation-delay: -0.4s; }
    .led-icon-d2 { animation-delay: -0.8s; }
    .led-icon-d3 { animation-delay: -1.2s; }
    .led-icon-d4 { animation-delay: -1.6s; }
    .led-icon-d5 { animation-delay: -2.0s; }
    .led-icon-d6 { animation-delay: -2.4s; }
    @keyframes finnPillGlow {
      0%   { border-color: rgba(167,139,250,0.4); box-shadow: 0 0 6px rgba(167,139,250,0.15); }
      16%  { border-color: rgba(96,165,250,0.45); box-shadow: 0 0 6px rgba(96,165,250,0.18); }
      33%  { border-color: rgba(52,211,153,0.45); box-shadow: 0 0 6px rgba(52,211,153,0.18); }
      50%  { border-color: rgba(129,140,248,0.45); box-shadow: 0 0 6px rgba(129,140,248,0.18); }
      66%  { border-color: rgba(244,114,182,0.45); box-shadow: 0 0 6px rgba(244,114,182,0.18); }
      83%  { border-color: rgba(192,132,252,0.45); box-shadow: 0 0 6px rgba(192,132,252,0.18); }
      100% { border-color: rgba(167,139,250,0.4); box-shadow: 0 0 6px rgba(167,139,250,0.15); }
    }
    .finn-pill {
      animation: finnPillGlow 3s ease-in-out infinite;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .finn-pill:hover {
      transform: scale(1.03);
      filter: brightness(1.1);
    }
  `;
  document.head.appendChild(style);
}

function FinnOrbVideo() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const vid = videoRef.current;
    if (vid) {
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.play().catch(() => {});
    }
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ width: 260, height: 260, borderRadius: 130, backgroundColor: '#111' }} />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <video
        ref={videoRef as any}
        src="/finn-3d-object.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        controls={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {/* Subtle ambient glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)',
      }} />
    </div>
  );
}

function GlassCard({ children, style, onPress, hovered, tint, ...rest }: any) {
  if (Platform.OS !== 'web') {
    const Comp = onPress ? Pressable : View;
    return <Comp style={[s.card, style]} onPress={onPress} {...rest}>{children}</Comp>;
  }
  const Comp = onPress ? Pressable : View;
  const gradPos = tint ? (tintPositionMap[tint.position || 'top-right'] || 'top right') : null;
  const bg = tint
    ? `radial-gradient(ellipse at ${gradPos}, ${tint.color}10 0%, transparent 45%), ${CARD_BG}`
    : CARD_BG;
  return (
    <Comp
      style={[s.card, style, hovered && s.cardHover, { background: bg, border: `1px solid ${CARD_BORDER}` } as any]}
      onPress={onPress}
      {...rest}
    >
      {children}
    </Comp>
  );
}


function EnterpriseIcon({ type, color, bgColor, size = 36 }: { type: string; color: string; bgColor: string; size?: number }) {
  if (Platform.OS !== 'web') {
    return (
      <View style={[s.enterpriseIconWrap, { width: size, height: size, backgroundColor: bgColor }]}>
        <Ionicons name="business" size={size * 0.44} color={color} />
      </View>
    );
  }

  const iconSize = size * 0.44;
  const svgIcons: Record<string, React.ReactNode> = {
    bank: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M3 21h18v-2H3v2zm0-4h2v-4H3v4zm4 0h2v-4H7v4zm4 0h2v-4h-2v4zm4 0h2v-4h-2v4zm4 0h2v-4h-2v4zM2 11l10-6 10 6H2z" fill={color} />
      </svg>
    ),
    ledger: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M8 7h8M8 11h6M8 15h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 6h2M4 10h2M4 14h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    team: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="17" cy="8" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
        <path d="M19 19c0-2.2-1.3-4-3-4.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
    wallet: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="15" rx="3" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M2 10h20" stroke={color} strokeWidth="1.5" />
        <circle cx="17" cy="15" r="1.5" fill={color} />
      </svg>
    ),
    chart: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="12" width="4" height="8" rx="1" fill={color} opacity="0.6" />
        <rect x="10" y="6" width="4" height="14" rx="1" fill={color} />
        <rect x="17" y="9" width="4" height="11" rx="1" fill={color} opacity="0.8" />
      </svg>
    ),
    shield: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 6v5c0 5.55 3.4 10.74 8 12 4.6-1.26 8-6.45 8-12V6l-8-4z" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    receipt: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2L4 2z" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M8 8h8M8 12h6M8 16h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    invoice: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M8 8h8M8 12h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="2" stroke={color} strokeWidth="1.5" fill="none" />
        <path d="M16 14v4M14 16h4" stroke={color} strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    subscription: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M3 10h18" stroke={color} strokeWidth="1.5" />
        <path d="M7 14h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    transfer: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M4 9h13l-3-3M20 15H7l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    pulse: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M3 12h4l3-8 4 16 3-8h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    flow: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    pie: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M12 3v9h9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    trend: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M3 17l6-6 4 4 8-8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 7h4v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    activity: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M7 9h10M7 13h7M7 17h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    book: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M8 7h8M8 11h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    'git-compare': (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="6" r="3" stroke={color} strokeWidth="1.8" fill="none" />
        <circle cx="18" cy="18" r="3" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M6 9v6c0 2 1 3 3 3h3M18 15V9c0-2-1-3-3-3h-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    'git-branch': (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="4" r="2.5" stroke={color} strokeWidth="1.8" fill="none" />
        <circle cx="6" cy="20" r="2.5" stroke={color} strokeWidth="1.8" fill="none" />
        <circle cx="18" cy="20" r="2.5" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M12 6.5v4.5c0 3-3 4.5-6 6.5M12 11c0 3 3 4.5 6 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      backgroundColor: bgColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      {svgIcons[type] || <Ionicons name="business" size={iconSize} color={color} />}
    </div>
  );
}

function SectionLabel({ icon, label, color = '#555', ledDelay }: { icon: string; label: string; color?: string; ledDelay?: number }) {
  return (
    <View style={s.sectionLabel}>
      {Platform.OS === 'web' ? (
        <span className={`led-icon ${ledDelay != null ? `led-icon-d${ledDelay}` : ''}`}>
          <EnterpriseIcon type={icon} color="currentColor" bgColor="transparent" size={16} />
        </span>
      ) : (
        <EnterpriseIcon type={icon} color={color} bgColor="transparent" size={16} />
      )}
      <Text style={[s.sectionLabelText, { color }]}>{label}</Text>
      <View style={s.sectionLabelLine} />
    </View>
  );
}


class FinanceHubErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error('FinanceHub crash:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0A0F', padding: 40, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Finance Hub Error</Text>
          <Text style={{ color: '#ccc', fontSize: 14 }}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/** Breakpoint: below this, KPI cards wrap 2x2 and chart rows stack vertically */
const COMPACT_BREAKPOINT = 1100;
/** Breakpoint: below this, KPI cards stack fully and Finn card stacks vertically */
function FinanceHubContent() {
  React.useEffect(() => { if (Platform.OS === 'web') injectFinnCss(); }, []);
  const { width: windowWidth } = useWindowDimensions();
  const isCompact = windowWidth < COMPACT_BREAKPOINT;
  const [, setHoveredButton] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [connections, setConnections] = useState<ConnectionStatus | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [lifecycleSteps, setLifecycleSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [explainMetric, setExplainMetric] = useState<string | null>(null);
  const [showFinnOverlay, setShowFinnOverlay] = useState(false);
  const [finnOverlayTab, setFinnOverlayTab] = useState<'voice' | 'video'>('voice');
  const [showFinnChat, setShowFinnChat] = useState(false);
  const [activeStoryMode, setActiveStoryMode] = useState<StoryModeId>('cash-truth');
  const [dashTransition, setDashTransition] = useState<'idle' | 'fading' | 'entering'>('idle');
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const activeModeCfg = STORY_MODES.find(m => m.id === activeStoryMode) ?? STORY_MODES[0];

  const dashConfig = useMemo(
    () => getStoryDashboardConfig(activeStoryMode, activeModeCfg.accent),
    [activeStoryMode, activeModeCfg.accent]
  );

  const trendData = useMemo(() => [
    { value: 42 }, { value: 45 }, { value: 40 }, { value: 48 },
    { value: 52 }, { value: 49 }, { value: 55 }, { value: 58 },
    { value: 54 }, { value: 60 }, { value: 63 }, { value: 67 },
  ], []);

  const sparkData = useMemo(() => [
    { value: 30 }, { value: 35 }, { value: 28 }, { value: 42 },
    { value: 38 }, { value: 45 }, { value: 50 }, { value: 48 },
  ], []);

  const transitionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleModeSwitch = useCallback((mode: StoryModeId) => {
    if (mode === activeStoryMode) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setDashTransition('fading');
    transitionTimerRef.current = setTimeout(() => {
      setActiveStoryMode(mode);
      setDashTransition('entering');
      transitionTimerRef.current = setTimeout(() => setDashTransition('idle'), 600);
    }, 150);
  }, [activeStoryMode]);
  React.useEffect(() => {
    return () => { if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current); };
  }, []);

  // Authority Queue state
  const dynamicItems = useDynamicAuthorityQueue();
  const [supabaseAuthority, setSupabaseAuthority] = useState<AuthorityItem[]>([]);
  const [reviewPreview, setReviewPreview] = useState<{ visible: boolean; type: 'invoice' | 'contract' | 'document'; documentName: string; pandadocDocumentId?: string }>({ visible: false, type: 'document', documentName: '' });

  // Finn voice — ElevenLabs TTS output, STT degrades gracefully if unavailable
  const { suiteId, session } = useSupabase();
  const { tenant } = useTenant();
  const finnVoice = useAgentVoice({
    agent: 'finn',
    suiteId: suiteId ?? undefined,
    accessToken: session?.access_token,
    userProfile: tenant ? {
      ownerName: tenant.ownerName,
      businessName: tenant.businessName,
      industry: tenant.industry ?? undefined,
      teamSize: tenant.teamSize ?? undefined,
    } : undefined,
    onResponse: (_text) => {},
    onError: (_err) => {},
  });
  const handleFinnVoiceToggle = useCallback(async () => {
    if (finnVoice.isActive) {
      finnVoice.endSession();
    } else {
      try { await finnVoice.startSession(); } catch {}
    }
  }, [finnVoice]);

  const isConnected = connections?.summary?.connected ? connections.summary.connected > 0 : false;
  const hasSnapshot = snapshot?.connected && snapshot?.generatedAt;


  const fetchData = useCallback(async () => {
    try {
      const [snapRes, connRes, timeRes, lcRes] = await Promise.all([
        fetch('/api/finance/snapshot').then(r => r.json()).catch(() => null),
        fetch('/api/connections/status').then(r => r.json()).catch(() => null),
        fetch('/api/finance/timeline?limit=10').then(r => r.json()).catch(() => null),
        fetch('/api/finance/lifecycle').then(r => r.json()).catch(() => null),
      ]);
      if (snapRes) setSnapshot(snapRes);
      if (connRes) setConnections(connRes);
      if (timeRes?.events) setTimeline(timeRes.events);
      if (lcRes?.steps) setLifecycleSteps(lcRes.steps);
    } catch (e) {
      console.warn('Failed to fetch finance data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch authority queue from Supabase
  useEffect(() => {
    async function fetchAuthorityQueue() {
      try {
        const items = await getAuthorityQueue();
        setSupabaseAuthority(items as AuthorityItem[]);
      } catch {
        // Silently fail — authority queue is non-critical
      }
    }
    fetchAuthorityQueue();
    const interval = setInterval(fetchAuthorityQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const allAuthorityItems = useMemo(() => {
    const financeAgents = ['finn', 'quinn', 'teressa'];
    const merged = [...dynamicItems, ...supabaseAuthority];
    return merged.filter(item =>
      financeAgents.includes(item.assignedAgent?.toLowerCase() || '') ||
      financeAgents.includes(item.staffRole?.toLowerCase() || '')
    );
  }, [dynamicItems, supabaseAuthority]);

  const webHover = (key: string) => Platform.OS === 'web' ? {
    onMouseEnter: () => setHoveredButton(key),
    onMouseLeave: () => setHoveredButton(null),
  } : {};

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const styleId = 'finance-hub-animations';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        @keyframes sparkGrowIn {
          0% { transform: scaleY(0); opacity: 0; }
          60% { transform: scaleY(1.1); opacity: 0.9; }
          100% { transform: scaleY(1); opacity: 0.85; }
        }
        @keyframes sparkPulse {
          0%, 100% { opacity: 0.7; transform: scaleY(0.95); }
          50% { opacity: 1; transform: scaleY(1.05); }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes barBounce {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.06); }
        }
        @keyframes pieBreathe {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.015) rotate(0.5deg); }
          50% { transform: scale(1.03) rotate(0deg); }
          75% { transform: scale(1.015) rotate(-0.5deg); }
        }
        .kpi-spark-bar {
          transform-origin: center bottom;
          animation: sparkPulse 2.5s ease-in-out infinite;
        }
        .bar-chart-container .recharts-layer.recharts-bar rect {
          transform-origin: center bottom;
          animation: barBounce 2.5s ease-in-out infinite;
        }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(1) { animation-delay: 0s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(2) { animation-delay: 0.15s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(3) { animation-delay: 0.3s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(4) { animation-delay: 0.45s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(5) { animation-delay: 0.6s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(6) { animation-delay: 0.75s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(7) { animation-delay: 0.9s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(1) { animation-delay: 0.1s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(2) { animation-delay: 0.25s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(3) { animation-delay: 0.4s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(4) { animation-delay: 0.55s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(5) { animation-delay: 0.7s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(6) { animation-delay: 0.85s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(7) { animation-delay: 1.0s; }
        .pie-chart-animated {
          animation: pieBreathe 3.5s ease-in-out infinite;
          transform-origin: center;
        }
        .pie-chart-animated .recharts-layer.recharts-pie-sector path {
          transition: transform 0.3s ease, filter 0.3s ease;
        }
        .pie-chart-animated .recharts-layer.recharts-pie-sector path:hover {
          filter: brightness(1.25);
          transform: scale(1.04);
        }
        @keyframes finnAmbientGlow {
          0%, 100% { box-shadow: 0 0 16px rgba(139,92,246,0.25), 0 0 32px rgba(139,92,246,0.1); }
          50% { box-shadow: 0 0 20px rgba(139,92,246,0.4), 0 0 44px rgba(139,92,246,0.15), 0 0 60px rgba(99,102,241,0.08); }
        }
        .finn-session-btn {
          animation: finnAmbientGlow 3s ease-in-out infinite;
          background: linear-gradient(135deg, rgba(139,92,246,0.35) 0%, rgba(99,102,241,0.3) 50%, rgba(139,92,246,0.35) 100%);
          border: 1px solid rgba(139,92,246,0.4);
          transition: all 0.2s ease;
        }
        .finn-session-btn:hover {
          background: linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(99,102,241,0.45) 50%, rgba(139,92,246,0.5) 100%);
          border-color: rgba(139,92,246,0.6);
        }
        @keyframes finnChatSlideIn {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .finn-chat-drawer {
          animation: finnChatSlideIn 0.25s ease-out both;
        }
        @keyframes dashFadeOut {
          0% { opacity: 1; filter: blur(0); }
          100% { opacity: 0; filter: blur(6px); }
        }
        @keyframes dashSlideUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .dash-card-fading {
          animation: dashFadeOut 150ms ease-in both;
        }
        .dash-card-entering-0 { animation: dashSlideUp 300ms ease-out both; }
        .dash-card-entering-1 { animation: dashSlideUp 300ms ease-out 80ms both; }
        .dash-card-entering-2 { animation: dashSlideUp 300ms ease-out 160ms both; }
        .dash-card-entering-3 { animation: dashSlideUp 300ms ease-out 240ms both; }
        .details-collapsible {
          overflow: hidden;
          transition: max-height 0.3s ease, opacity 0.3s ease;
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  const graphicRightRail = Platform.OS === 'web' ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <GreetingCard ownerName={tenant?.ownerName ? tenant.ownerName.split(' ').pop() ? `Mr. ${tenant.ownerName.split(' ').pop()}` : tenant.ownerName : 'Mr. Scott'} />
      <HealthScoreRing
        connectedCount={connections?.summary?.connected ?? 0}
        mismatchCount={snapshot?.chapters?.reconcile?.mismatchCount ?? 0}
        cashRunwayDays={60}
      />
      <FinnDailyBrief
        activeMode={activeStoryMode}
        accentColor={activeModeCfg.accent}
        onAskFinn={() => setShowFinnChat(true)}
      />
    </div>
  ) : null;

  const dashCardClass = (index: number) => {
    if (dashTransition === 'fading') return 'dash-card-fading';
    if (dashTransition === 'entering') return `dash-card-entering-${index}`;
    return '';
  };

  return (
    <>
    <FinanceHubShell rightRail={graphicRightRail}>
      {/* ═══ SELECTOR ROW ═══ */}
      {Platform.OS === 'web' ? (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
          <div style={{ flex: '0 0 35%', minWidth: 0 }}>
            <StoryModeCarousel
              activeMode={activeStoryMode}
              onSelectMode={(mode) => handleModeSwitch(mode.id)}
            />
          </div>
          <div style={{ flex: '1 1 40%', minWidth: 0 }}>
            <View style={[s.finnCardOuter, { minHeight: 280 } as any]}>
              <View style={s.finnFloatingPanel}>
                <View style={s.finnPanelInner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="analytics" size={16} color="#A78BFA" />
                    </View>
                    <View>
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Finn</Text>
                      <Text style={{ color: '#888', fontSize: 11 }}>Financial Intelligence</Text>
                    </View>
                  </View>
                  <Pressable
                    style={[s.finnPanelBtn, finnVoice.isActive && { borderColor: 'rgba(139,92,246,0.5)', backgroundColor: 'rgba(139,92,246,0.15)' }]}
                    onPress={handleFinnVoiceToggle}
                    {...webHover('finn-voice')}
                  >
                    <Ionicons name={finnVoice.isActive ? 'mic' : 'mic-outline'} size={16} color={finnVoice.isActive ? '#C4B5FD' : '#A78BFA'} />
                    <Text style={s.finnPanelBtnText}>{finnVoice.isActive ? 'Talking...' : 'Voice with Finn'}</Text>
                  </Pressable>
                  <Pressable
                    style={s.finnPanelBtn}
                    onPress={() => { setFinnOverlayTab('video'); setShowFinnOverlay(true); }}
                    {...webHover('finn-video')}
                  >
                    <Ionicons name="videocam-outline" size={16} color="#A78BFA" />
                    <Text style={s.finnPanelBtnText}>Video with Finn</Text>
                  </Pressable>
                  <Pressable
                    style={s.finnPanelBtn}
                    onPress={() => setShowFinnChat(true)}
                    {...webHover('finn-chat')}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#A78BFA" />
                    <Text style={s.finnPanelBtnText}>Chat with Finn</Text>
                  </Pressable>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 16 }}>
                    Finn&apos;s focus: {dashConfig.finnFocus}
                  </Text>
                </View>
              </View>
              <View style={s.finn3dContainer}>
                <FinnOrbVideo />
              </View>
            </View>
          </div>
        </div>
      ) : (
        <View style={{ marginBottom: 24 }}>
          <StoryModeCarousel
            activeMode={activeStoryMode}
            onSelectMode={(mode) => handleModeSwitch(mode.id)}
          />
        </View>
      )}

      {/* ═══ DASHBOARD ZONE ═══ */}
      {Platform.OS === 'web' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 24,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            inset: -20,
            background: `radial-gradient(ellipse at 50% 0%, ${activeModeCfg.accent}08 0%, transparent 60%)`,
            pointerEvents: 'none',
            transition: 'background 0.4s ease',
            borderRadius: 20,
          }} />
          <div className={dashCardClass(0)} style={{ position: 'relative', zIndex: 1 }}>
            <GlowTrendCard
              title={dashConfig.hero.title}
              value={dashConfig.hero.value}
              delta={dashConfig.hero.delta}
              deltaDirection={dashConfig.hero.deltaDirection}
              data={trendData}
              accentColor={activeModeCfg.accent}
              mode={activeStoryMode}
            />
          </div>
          <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: isCompact ? 'wrap' : 'nowrap' as const,
            position: 'relative',
            zIndex: 1,
          }}>
            <div className={dashCardClass(1)} style={{ flex: 1, minWidth: isCompact ? '100%' : 0 }}>
              <SegmentRingCard
                title={dashConfig.ring.title}
                centerValue={dashConfig.ring.centerValue}
                centerLabel={dashConfig.ring.centerLabel}
                segments={dashConfig.ring.segments}
                accentColor={activeModeCfg.accent}
                mode={activeStoryMode}
              />
            </div>
            <div className={dashCardClass(2)} style={{ flex: 1, minWidth: isCompact ? '100%' : 0 }}>
              <QueueInstrumentCard
                title={dashConfig.queue.title}
                items={dashConfig.queue.items}
                accentColor={activeModeCfg.accent}
                mode={activeStoryMode}
              />
            </div>
            <div className={dashCardClass(3)} style={{ flex: 1, minWidth: isCompact ? '100%' : 0 }}>
              <InsightOverlayCard
                quote={dashConfig.insight.quote}
                sparkData={sparkData}
                accentColor={activeModeCfg.accent}
                mode={activeStoryMode}
              />
            </div>
          </div>
        </div>
      ) : (
        <View style={{ marginBottom: 24, gap: 12 }}>
          <GlowTrendCard
            title={dashConfig.hero.title}
            value={dashConfig.hero.value}
            delta={dashConfig.hero.delta}
            deltaDirection={dashConfig.hero.deltaDirection}
            data={trendData}
            accentColor={activeModeCfg.accent}
            mode={activeStoryMode}
          />
        </View>
      )}

      {/* ═══ DETAILS SECTION (collapsible legacy) ═══ */}
      {Platform.OS === 'web' ? (
        <div style={{ marginBottom: 16 }}>
          <div
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '8px 0',
              userSelect: 'none',
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease',
              transform: detailsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.4)" />
            </div>
            <span style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase' as const,
            }}>
              DETAILS
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', marginLeft: 8 }} />
          </div>
          <div
            className="details-collapsible"
            style={{
              maxHeight: detailsExpanded ? 2000 : 0,
              opacity: detailsExpanded ? 1 : 0,
            }}
          >
            {hasSnapshot && snapshot.chapters.reconcile.mismatchCount > 0 && (
              <>
                <SectionLabel icon="git-compare" label="RECONCILIATION" color="#999" ledDelay={1} />
                <View style={{ gap: 10, marginBottom: 4 }}>
                  <View style={s.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="git-compare" size={14} color="#F59E0B" />
                      </View>
                      <Text style={s.sectionTitle}>Items to Reconcile</Text>
                    </View>
                    <View style={[s.proposalCount, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                      <Text style={[s.proposalCountText, { color: '#F59E0B' }]}>{snapshot.chapters.reconcile.mismatchCount}</Text>
                    </View>
                  </View>
                  {snapshot.chapters.reconcile.mismatches.map((m: any) => (
                    <ReconcileCard key={m.id} mismatch={m} onAction={() => {}} onDismiss={() => {}} />
                  ))}
                </View>
              </>
            )}

            {isConnected && lifecycleSteps.length > 0 && lifecycleSteps.some((st: any) => st.status !== 'pending') && (
              <>
                <SectionLabel icon="git-branch" label="MONEY LIFECYCLE" color="#999" ledDelay={2} />
                <LifecycleChain
                  steps={lifecycleSteps}
                  title="Revenue Flow"
                  onExplainStep={(step) => {
                    const stageToMetric: Record<string, string> = {
                      'Booked': 'expected_inflows',
                      'Invoiced': 'expected_inflows',
                      'Paid': 'monthly_revenue',
                      'Deposited': 'cash_available',
                      'Posted': 'net_income',
                    };
                    const metricId = stageToMetric[step.label];
                    if (metricId) setExplainMetric(metricId);
                  }}
                />
              </>
            )}

            <SectionLabel icon="shield" label="FINANCE AUTHORITY QUEUE" color="#999" ledDelay={3} />
            <View style={s.authoritySection}>
              {allAuthorityItems.length > 0 ? (
                <View style={s.authorityScrollRow}>
                  {allAuthorityItems.map((item) => (
                    <View key={item.id} style={s.authorityCardWrap}>
                      <AuthorityQueueCard
                        item={item}
                        onAction={async (action) => {
                          if (action === 'approve') {
                            try {
                              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                              if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                              const res = await fetch(`/api/authority-queue/${item.id}/approve`, { method: 'POST', headers });
                              if (res.ok) setSupabaseAuthority(prev => prev.filter(a => a.id !== item.id));
                            } catch { /* silent */ }
                          } else if (action === 'deny') {
                            try {
                              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                              if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                              await fetch(`/api/authority-queue/${item.id}/deny`, { method: 'POST', headers });
                              setSupabaseAuthority(prev => prev.filter(a => a.id !== item.id));
                            } catch { /* silent */ }
                          } else if (action === 'review') {
                            const docType = item.type === 'invoice' ? 'invoice' as const
                              : item.type === 'contract' ? 'contract' as const
                              : 'document' as const;
                            setReviewPreview({
                              visible: true,
                              type: docType,
                              documentName: item.title,
                              pandadocDocumentId: item.pandadocDocumentId,
                            });
                          }
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <GlassCard style={{ padding: 32, alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark-outline" size={32} color={Colors.accent.cyan} style={{ marginBottom: 12 }} />
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6 }}>No pending financial approvals</Text>
                  <Text style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
                    When Finn, Quinn, or Teressa need your sign-off, their requests appear here.
                  </Text>
                </GlassCard>
              )}
            </View>
          </div>
        </div>
      ) : (
        <View style={{ marginBottom: 16 }}>
          <SectionLabel icon="shield" label="FINANCE AUTHORITY QUEUE" color="#999" ledDelay={3} />
          <View style={s.authoritySection}>
            {allAuthorityItems.length > 0 ? (
              <View style={s.authorityScrollRow}>
                {allAuthorityItems.map((item) => (
                  <View key={item.id} style={s.authorityCardWrap}>
                    <AuthorityQueueCard
                      item={item}
                      onAction={async (action) => {
                        if (action === 'approve') {
                          try {
                            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                            const res = await fetch(`/api/authority-queue/${item.id}/approve`, { method: 'POST', headers });
                            if (res.ok) setSupabaseAuthority(prev => prev.filter(a => a.id !== item.id));
                          } catch { /* silent */ }
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <GlassCard style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="shield-checkmark-outline" size={32} color={Colors.accent.cyan} style={{ marginBottom: 12 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6 }}>No pending financial approvals</Text>
                <Text style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
                  When Finn, Quinn, or Teressa need your sign-off, their requests appear here.
                </Text>
              </GlassCard>
            )}
          </View>
        </View>
      )}

    </FinanceHubShell>
    {/* Finn Chat Modal — outside shell so position:absolute floats above scroll */}
    <FinnChatModal visible={showFinnChat} onClose={() => setShowFinnChat(false)} />
    {/* Finn Desk Overlay — video with Finn popup */}
    {showFinnOverlay && (
      <FinnDeskOverlay
        visible={showFinnOverlay}
        onClose={() => setShowFinnOverlay(false)}
        initialTab={finnOverlayTab}
      />
    )}
    <ExplainDrawer
      visible={!!explainMetric}
      onClose={() => setExplainMetric(null)}
      metricId={explainMetric || ''}
    />
    <DocumentPreviewModal
      visible={reviewPreview.visible}
      onClose={() => setReviewPreview(prev => ({ ...prev, visible: false }))}
      type={reviewPreview.type}
      documentName={reviewPreview.documentName}
      pandadocDocumentId={reviewPreview.pandadocDocumentId}
    />
    </>
  );
}

export default function FinanceHubIndex() {
  return (
    <FinanceHubErrorBoundary>
      <FinanceHubContent />
    </FinanceHubErrorBoundary>
  );
}

const s = StyleSheet.create({
  heroBanner: {
    height: 155,
    overflow: 'hidden',
    borderRadius: 16,
    marginBottom: 20,
  },
  heroBannerOverlay: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  heroBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBannerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { boxShadow: '0 0 20px rgba(59,130,246,0.4)' } }),
  } as any,
  heroBannerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroBannerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 8,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  rowStacked: {
    flexDirection: 'column',
  },

  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    overflow: 'hidden' as const,
  } as any,
  cardHover: {
    borderColor: 'rgba(255,255,255,0.10)',
  },

  enterpriseIconWrap: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceCard: {
    flex: 1,
    padding: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 4,
  },
  balanceChangeRow: {
    marginBottom: 16,
  },
  balanceChangeUp: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  balanceMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  balanceMeta: {},
  balanceMetaLabel: {
    color: '#999',
    fontSize: 11,
    fontWeight: '500',
  },
  balanceMetaValue: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },

  finnCard: {
    flex: 1,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  finnCardOuter: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 320,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
  } as any,
  finnCardOuterStacked: {
    flexDirection: 'column',
    minHeight: undefined,
  },
  finnFloatingPanel: {
    width: '38%',
    justifyContent: 'center',
    paddingLeft: 18,
    paddingVertical: 18,
    zIndex: 2,
  } as any,
  finnPanelInner: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 18,
  },
  finnPanelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  } as any,
  finnPanelBtnText: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '500',
  },
  finn3dContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as any,
  finnCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  finnTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  finnSubtitle: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  finnActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finnChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finnChatBtnHover: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor: 'rgba(139,92,246,0.4)',
  },
  finnSessionBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  finnSessionBtnHover: {
    opacity: 0.9,
  },
  finnSessionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  finnSessionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  finnVideoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  providerName: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '600',
  },
  providerConnected: {
    color: '#999',
    fontSize: 11,
    marginTop: 1,
  },
  providerAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  flowSmall: {
    fontSize: 12,
    fontWeight: '600',
  },

  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiRowWrap: {
    flexWrap: 'wrap',
  },
  kpiPressable: {
    flex: 1,
  },
  kpiPressableCompact: {
    flexBasis: '45%' as any,
    flex: undefined,
    flexGrow: 1,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 18,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  kpiChangeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  kpiChangeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
  },

  chartCard: {
    padding: 22,
    marginBottom: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '500',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },

  expenseLegend: {
    gap: 6,
    marginTop: 8,
  },
  expenseLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expenseLegendName: {
    color: '#bbb',
    fontSize: 12,
    flex: 1,
  },
  expenseLegendVal: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  viewAllText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '500',
  },
  proposalCount: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proposalCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  authoritySection: {
    marginBottom: 16,
  },
  authorityScrollRow: {
    flexDirection: 'row',
    gap: 12,
    ...Platform.select({ web: {
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'thin',
      scrollbarColor: '#3B3B3D transparent',
    } as any }),
    paddingVertical: 4,
    alignItems: 'stretch',
  } as any,
  authorityCardWrap: {
    width: 300,
    flexShrink: 0,
    display: 'flex',
  } as any,
});
