import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Animated, Alert, ActivityIndicator, type ViewStyle } from 'react-native';
import { ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '@/constants/tokens';
import { ShimmeringText } from '@/components/ui/ShimmeringText';
import { useAgentVoice } from '@/hooks/useAgentVoice';
import { useSupabase, useTenant } from '@/providers';
import { connectFinnAvatar, clearFinnConversationHistory, type AnamClientInstance } from '@/lib/anam';
import { speakText } from '@/lib/elevenlabs';
import { FinnVideoChatOverlay } from './FinnVideoChatOverlay';

/* ── Web-only keyframe animations for immersive mode ─────── */
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'finn-immersive-keyframes';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      @keyframes finnBreathePulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 24px rgba(59,130,246,0.25), 0 0 48px rgba(59,130,246,0.1); }
        50% { transform: scale(1.06); box-shadow: 0 0 36px rgba(59,130,246,0.4), 0 0 72px rgba(59,130,246,0.15); }
      }
      @keyframes finnRingPulse {
        0% { transform: scale(1); opacity: 0.5; }
        100% { transform: scale(1.8); opacity: 0; }
      }
      @keyframes finnConnectGlow {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      @keyframes finnFloatBarEntry {
        0% { transform: translateY(32px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      @keyframes finnAmbientShift {
        0%, 100% { opacity: 0.06; }
        50% { opacity: 0.14; }
      }
      @keyframes finnStatusDotPulse {
        0%, 100% { box-shadow: 0 0 4px rgba(52,199,89,0.3); }
        50% { box-shadow: 0 0 10px rgba(52,199,89,0.6), 0 0 20px rgba(52,199,89,0.2); }
      }
      .finn-floating-pill {
        transition: background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
      }
      .finn-floating-pill:hover {
        background-color: rgba(255,255,255,0.2) !important;
        transform: scale(1.04);
        box-shadow: 0 2px 20px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.12);
      }
      .finn-floating-pill:active {
        transform: scale(0.96);
      }
      .finn-end-call-pill {
        transition: background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
      }
      .finn-end-call-pill:hover {
        background-color: rgba(220,38,38,0.95) !important;
        transform: scale(1.04);
        box-shadow: 0 4px 24px rgba(239,68,68,0.4), 0 0 48px rgba(239,68,68,0.15);
      }
      .finn-end-call-pill:active {
        transform: scale(0.92);
      }
      .finn-chat-pill-active {
        background-color: rgba(59,130,246,0.3) !important;
        box-shadow: 0 0 16px rgba(59,130,246,0.25), inset 0 1px 0 rgba(59,130,246,0.2) !important;
      }
      .finn-connect-btn {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        animation: finnConnectGlow 2.4s ease-in-out infinite;
      }
      .finn-connect-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 32px rgba(59,130,246,0.5), 0 0 64px rgba(59,130,246,0.2) !important;
      }
      .finn-connect-btn:active {
        transform: scale(0.96);
      }
      .finn-retry-btn {
        transition: background-color 0.2s ease, transform 0.15s ease, border-color 0.2s ease;
      }
      .finn-retry-btn:hover {
        background-color: rgba(255,255,255,0.12) !important;
        border-color: rgba(255,255,255,0.22) !important;
        transform: scale(1.03);
      }
      .finn-retry-btn:active {
        transform: scale(0.96);
      }
    `;
    document.head.appendChild(el);
  }
}

type FileAttachment = {
  id: string;
  name: string;
  kind: 'PDF' | 'DOCX' | 'XLSX' | 'PNG';
  url?: string;
};

type FinnActivityEvent = {
  type: 'thinking' | 'step' | 'tool_call' | 'done';
  message: string;
  ts: number;
  icon: keyof typeof Ionicons.glyphMap;
};

type ActiveRun = {
  id: string;
  events: FinnActivityEvent[];
  status: 'running' | 'completed';
  finalText: string;
};

type ChatMsg = {
  id: string;
  from: 'finn' | 'user';
  text: string;
  attachments?: FileAttachment[];
  runId?: string;
};

// Activity step definitions keyed by intent (steps are real, response is built from server data)
/**
 * Build activity events from orchestrator response for Finn's activity visualization.
 * Falls back to synthesized steps if orchestrator doesn't return explicit activity.
 */
function buildFinnActivity(data: {
  activity?: Array<{ type: string; message: string; icon?: string }>;
  route?: { skill_pack?: string };
  risk_tier?: string;
  action?: string;
}): Omit<FinnActivityEvent, 'ts'>[] {
  if (data.activity && Array.isArray(data.activity) && data.activity.length > 0) {
    return data.activity.map((step) => ({
      type: (step.type as FinnActivityEvent['type']) || 'step',
      message: step.message,
      icon: (step.icon as keyof typeof Ionicons.glyphMap) || 'cog',
    }));
  }

  // Synthesize from pipeline metadata
  const events: Omit<FinnActivityEvent, 'ts'>[] = [
    { type: 'thinking', message: 'Processing financial request...', icon: 'sparkles' },
  ];
  if (data.route?.skill_pack) {
    events.push({ type: 'step', message: `Routing to ${data.route.skill_pack}`, icon: 'git-network' });
  }
  if (data.action) {
    events.push({ type: 'tool_call', message: `Executing: ${data.action}`, icon: 'hammer' });
  }
  events.push({ type: 'done', message: 'Complete', icon: 'checkmark-circle' });
  return events;
}

type SnapshotData = {
  chapters: {
    now: { cashAvailable: number; bankBalance: number; stripeAvailable: number; stripePending: number; lastUpdated: string | null };
    next: { expectedInflows7d: number; expectedOutflows7d: number; netCashFlow7d: number; items: any[] };
    month: { revenue: number; expenses: number; netIncome: number; period: string };
    reconcile: { mismatches: any[]; mismatchCount: number };
    actions: { proposals: any[]; proposalCount: number };
  };
  connected: boolean;
  generatedAt: string | null;
};

type ExceptionData = {
  as_of: string;
  exceptions: Array<{ exception_id: string; lane: string; severity: string; summary: string }>;
};

async function fetchFinnContext(): Promise<{ snapshot: SnapshotData | null; exceptions: ExceptionData | null }> {
  try {
    const [snapResp, excResp] = await Promise.all([
      fetch('/api/finance/snapshot').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/finance/exceptions').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    return { snapshot: snapResp, exceptions: excResp };
  } catch {
    return { snapshot: null, exceptions: null };
  }
}

function buildResponse(intent: string, snapshot: SnapshotData | null, exceptions: ExceptionData | null): string {
  if (!snapshot || !snapshot.connected) {
    return 'No financial data available yet. Connect at least one provider (Plaid, Stripe, QuickBooks) to get started.';
  }

  const { chapters } = snapshot;
  const excList = exceptions?.exceptions || [];
  const excSummary = excList.length > 0
    ? ` I found ${excList.length} exception${excList.length > 1 ? 's' : ''}: ${excList.slice(0, 3).map(e => e.summary).join('; ')}.`
    : ' No exceptions flagged.';

  switch (intent) {
    case 'cashflow': {
      const cash = chapters.now.cashAvailable;
      const net7d = chapters.next.netCashFlow7d;
      const direction = net7d >= 0 ? '+' : '-';
      return `Cash position: $${cash.toLocaleString()} available. 7-day forecast: ${direction}$${Math.abs(net7d).toLocaleString()} net.${excSummary}`;
    }
    case 'payroll': {
      const outflows = chapters.next.expectedOutflows7d;
      const buffer = chapters.now.cashAvailable;
      const healthy = buffer > outflows * 1.5;
      return `Expected outflows: $${outflows.toLocaleString()} in next 7 days. Buffer: $${buffer.toLocaleString()} (${healthy ? 'healthy' : 'tight'}).${excSummary}`;
    }
    case 'invoices': {
      const inflows = chapters.next.expectedInflows7d;
      const mismatches = chapters.reconcile.mismatchCount;
      return `Expected inflows: $${inflows.toLocaleString()} in next 7 days. ${mismatches} reconciliation issue${mismatches !== 1 ? 's' : ''}.${excSummary}`;
    }
    case 'budget': {
      const { revenue, expenses, netIncome } = chapters.month;
      return `This month: $${revenue.toLocaleString()} revenue, $${expenses.toLocaleString()} expenses, $${netIncome.toLocaleString()} net.${excSummary}`;
    }
    default:
      return `Snapshot as of ${snapshot.generatedAt ? new Date(snapshot.generatedAt).toLocaleTimeString() : 'now'}. Cash: $${chapters.now.cashAvailable.toLocaleString()}.${excSummary}`;
  }
}

function buildSeedMessage(snapshot: SnapshotData | null, exceptions: ExceptionData | null): string {
  if (!snapshot || !snapshot.connected) {
    return 'Good morning. No providers connected yet — connect Plaid, Stripe, or QuickBooks to get started. I\'ll analyze your finances once data flows in.';
  }
  const cash = snapshot.chapters.now.cashAvailable;
  const excCount = exceptions?.exceptions?.length || 0;
  const net7d = snapshot.chapters.next.netCashFlow7d;
  const parts = [`Good morning. Cash is at $${cash.toLocaleString()}.`];
  if (net7d !== 0) {
    parts.push(`7-day forecast: ${net7d >= 0 ? '+' : '-'}$${Math.abs(net7d).toLocaleString()}.`);
  }
  if (excCount > 0) {
    parts.push(`${excCount} exception${excCount > 1 ? 's' : ''} need attention.`);
  } else {
    parts.push('No exceptions flagged.');
  }
  parts.push('What would you like to review?');
  return parts.join(' ');
}

function ThinkingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: false }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={actStyles.thinkingDotsRow}>
      <Animated.View style={[actStyles.thinkingDotAnim, { opacity: dot1 }]} />
      <Animated.View style={[actStyles.thinkingDotAnim, { opacity: dot2 }]} />
      <Animated.View style={[actStyles.thinkingDotAnim, { opacity: dot3 }]} />
    </View>
  );
}

function FinnActivityInline({ run }: { run: ActiveRun }) {
  const [expanded, setExpanded] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isRunning = run.status === 'running';
  const currentEvent = run.events[run.events.length - 1];
  const completedEvents = run.events.filter(e => e.type !== 'thinking');

  useEffect(() => {
    if (isRunning) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: false })
      ).start();
    }
  }, [isRunning]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, []);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isRunning && !expanded) {
    return (
      <Animated.View style={[actStyles.completedLine, { opacity: fadeAnim }]}>
        <View style={actStyles.completedDot} />
        <Text style={actStyles.completedText}>Completed</Text>
        <Text style={actStyles.completedSep}>·</Text>
        <Pressable onPress={() => setExpanded(true)}>
          <Text style={actStyles.detailsToggle}>View details</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[actStyles.activityContainer, { opacity: fadeAnim }]}>
      {isRunning && currentEvent && (
        <View style={actStyles.statusBar}>
          <View style={actStyles.statusLeft}>
            <Animated.View style={[actStyles.spinner, { transform: [{ rotate: spinInterpolate }] }]}>
              <View style={actStyles.spinnerInner} />
            </Animated.View>
            <Text style={actStyles.statusText} numberOfLines={1}>
              {currentEvent.message}
            </Text>
          </View>
          <Pressable onPress={() => setExpanded(!expanded)} style={actStyles.toggleBtn}>
            <Text style={actStyles.detailsToggle}>
              {expanded ? 'Hide details' : 'Show details'}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={Colors.accent.cyan}
            />
          </Pressable>
        </View>
      )}

      {!isRunning && expanded && (
        <View style={actStyles.statusBar}>
          <View style={actStyles.statusLeft}>
            <View style={actStyles.completedDot} />
            <Text style={actStyles.completedText}>Completed</Text>
          </View>
          <Pressable onPress={() => setExpanded(false)} style={actStyles.toggleBtn}>
            <Text style={actStyles.detailsToggle}>Hide details</Text>
            <Ionicons name="chevron-up" size={12} color={Colors.accent.cyan} />
          </Pressable>
        </View>
      )}

      {expanded && completedEvents.length > 0 && (
        <View style={actStyles.eventList}>
          {completedEvents.map((event, idx) => {
            const isDone = event.type === 'done';
            const isCurrent = isRunning && idx === completedEvents.length - 1 && !isDone;
            return (
              <View key={idx} style={actStyles.eventRow}>
                <View style={[
                  actStyles.eventIconWrap,
                  isDone && actStyles.eventIconDone,
                  isCurrent && actStyles.eventIconCurrent,
                ]}>
                  <Ionicons
                    name={event.icon}
                    size={12}
                    color={isDone ? Colors.semantic.success : isCurrent ? Colors.accent.cyan : Colors.text.tertiary}
                  />
                </View>
                <Text style={[
                  actStyles.eventText,
                  isDone && actStyles.eventTextDone,
                  isCurrent && actStyles.eventTextCurrent,
                ]} numberOfLines={1}>
                  {event.message}
                </Text>
                <Text style={actStyles.eventTime}>
                  {new Date(event.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const actStyles = StyleSheet.create({
  activityContainer: {
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#232325',
    overflow: 'hidden',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2C2C2E',
    borderTopColor: Colors.accent.cyan,
  },
  spinnerInner: {
    flex: 1,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    flex: 1,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  detailsToggle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.accent.cyan,
  },
  completedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  completedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.semantic.success,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  completedSep: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  eventList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 2,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  eventIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#1E1E20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIconDone: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  eventIconCurrent: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  eventText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
  eventTextDone: {
    color: Colors.semantic.success,
    fontWeight: '500',
  },
  eventTextCurrent: {
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  eventTime: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    minWidth: 44,
    textAlign: 'right',
  },
  thinkingDotsRow: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1E1E20',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  thinkingDotAnim: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
  },
});

const defaultSeedChat: ChatMsg[] = [
  { id: 'm1', from: 'finn', text: 'Loading financial data...' },
];

const playConnectionSound = () => {
  if (Platform.OS !== 'web') return;
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {}
};

const playSuccessSound = () => {
  if (Platform.OS !== 'web') return;
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (e) {}
};

type FinnDeskPanelProps = {
  initialTab?: 'voice' | 'video';
  templateContext?: { key: string; description: string } | null;
  isInOverlay?: boolean;
  /** When true, renders immersive video-only mode (no tabs, full-bleed video, floating controls). */
  videoOnly?: boolean;
  /** Callback to close the parent overlay. Used by the End Call floating button. */
  onEndCall?: () => void;
};

export function FinnDeskPanel({ initialTab, templateContext, isInOverlay, videoOnly, onEndCall }: FinnDeskPanelProps = {}) {
  const [activeTab, setActiveTab] = useState<'voice' | 'video'>(videoOnly ? 'video' : (initialTab || 'voice'));
  const [showChatOverlay, setShowChatOverlay] = useState(false);
  const [videoState, setVideoState] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const anamClientRef = useRef<AnamClientInstance | null>(null);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>(defaultSeedChat);
  const [input, setInput] = useState('');
  const [activeRuns, setActiveRuns] = useState<Record<string, ActiveRun>>({});
  const [finnContext, setFinnContext] = useState<{ snapshot: SnapshotData | null; exceptions: ExceptionData | null }>({ snapshot: null, exceptions: null });
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const voiceLineAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const dotPulseAnim = useRef(new Animated.Value(1)).current;
  const connectionTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearConnectionTimeouts = useCallback(() => {
    connectionTimeouts.current.forEach(clearTimeout);
    connectionTimeouts.current = [];
  }, []);

  /** Show a voice/video error banner that auto-clears after 5s */
  const showVoiceError = useCallback((msg: string) => {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(null), 5000);
  }, []);

  // Tenant context for voice requests (Law #6: Tenant Isolation)
  const { suiteId, session } = useSupabase();
  const { tenant } = useTenant();

  // Fetch real financial data on mount
  useEffect(() => {
    fetchFinnContext().then((ctx) => {
      setFinnContext(ctx);
      if (templateContext) {
        setChat([{ id: 'm1', from: 'finn', text: `I see you'd like to create a "${templateContext.description}" document. I'll work with Clara to get that ready. Let me ask you a few questions to fill in the details.` }]);
      } else {
        const greeting = buildSeedMessage(ctx.snapshot, ctx.exceptions);
        setChat([{ id: 'm1', from: 'finn', text: greeting }]);
      }
    });
  }, []);

  // Auto-connect video when templateContext is provided (user clicked "Create with Finn")
  const autoConnectAttempted = useRef(false);
  useEffect(() => {
    if (templateContext && activeTab === 'video' && videoState === 'idle' && !autoConnectAttempted.current) {
      autoConnectAttempted.current = true;
      const elementId = videoOnly ? 'finn-video-immersive' : 'finn-video-sidebar';
      const timer = setTimeout(() => {
        setVideoState('connecting');
        setConnectionStatus('Connecting to Finn...');
        connectFinnAvatar(elementId, session?.access_token)
          .then((client) => {
            anamClientRef.current = client;
            setVideoState('connected');
          })
          .catch((e) => {
            setVideoState('idle');
            const msg = e instanceof Error ? e.message : String(e);
            setConnectionStatus('');
            showVoiceError(`Auto-connect failed: ${msg}`);
          });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [templateContext, activeTab, videoState, videoOnly, session?.access_token, showVoiceError]);

  // Orchestrator-routed voice: STT → Orchestrator → TTS (Law #1: Single Brain)
  const finnVoice = useAgentVoice({
    agent: 'finn',
    suiteId: suiteId ?? undefined,
    accessToken: session?.access_token,
    onStatusChange: (voiceStatus) => {
      setIsSessionActive(voiceStatus !== 'idle' && voiceStatus !== 'error');
    },
    onTranscript: (text) => {
      // Voice transcript → chat (user message with voice indicator)
      setChat(prev => [...prev, {
        id: `voice_user_${Date.now()}`,
        from: 'user',
        text: `\uD83C\uDFA4 ${text}`,
      }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onResponse: (text, receiptId) => {
      // Voice response → chat (Finn message synced from voice)
      setChat(prev => [...prev, {
        id: `voice_finn_${Date.now()}`,
        from: 'finn',
        text: text,
      }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (error) => {
      console.error('Finn voice error:', error);
      setIsSessionActive(false);
      // Classify and surface the error to the user
      const msg = error.message || String(error);
      if (/autoplay|not allowed|play\(\)/i.test(msg)) {
        showVoiceError('Tap anywhere on the page, then try again.');
      } else if (/permission|denied|not found.*microphone|getUserMedia/i.test(msg)) {
        showVoiceError('Microphone access denied. Check browser permissions.');
      } else if (/tts|voice.*unavailable|synthesis|elevenlabs/i.test(msg)) {
        showVoiceError('Voice unavailable — responses shown in chat.');
      } else {
        showVoiceError(msg.length > 80 ? msg.slice(0, 80) + '...' : msg);
      }
    },
  });

  const handleCompanyPillPress = useCallback(async () => {
    if (finnVoice.isActive) {
      finnVoice.endSession();
    } else {
      try {
        await finnVoice.startSession();
      } catch (error) {
        console.error('Failed to start Finn voice session:', error);
        Alert.alert('Connection Error', 'Unable to connect to Finn. Please try again.');
      }
    }
  }, [finnVoice]);

  const handleConnectToFinn = useCallback(async () => {
    if (videoState !== 'idle') return;

    clearConnectionTimeouts();
    setVideoState('connecting');
    setVideoError(null);
    setConnectionStatus('Connecting to Finn...');
    playConnectionSound();

    const elementId = videoOnly ? 'finn-video-immersive' : 'finn-video-sidebar';

    const t1 = setTimeout(() => {
      setConnectionStatus('Establishing secure video...');
    }, 800);

    // 15s timeout fallback (Law #3: Fail Closed)
    const t2 = setTimeout(() => {
      setVideoState('idle');
      setConnectionStatus('');
      anamClientRef.current = null;
      setVideoError('Connection timed out after 15s. Check your network and try again.');
    }, 15000);

    connectionTimeouts.current = [t1, t2];

    // Wait for React to render the <video> element before streaming
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const client = await connectFinnAvatar(elementId, session?.access_token);
      anamClientRef.current = client;

      // SDK event listeners for reliable state tracking (mirrors Ava's pattern)
      try {
        client.addListener('CONNECTION_ESTABLISHED' as any, () => {
          console.log('[Anam/Finn] WebRTC connection established');
        });
        client.addListener('VIDEO_PLAY_STARTED' as any, () => {
          console.log('[Anam/Finn] Video stream playing');
          setVideoState('connected');
        });
        client.addListener('CONNECTION_CLOSED' as any, () => {
          console.log('[Anam/Finn] Connection closed');
          setVideoState('idle');
          setConnectionStatus('');
          anamClientRef.current = null;
        });
      } catch {
        // SDK version may not support all events — degrade gracefully
      }

      clearConnectionTimeouts();
      playSuccessSound();
      setVideoState('connected');
      setVideoError(null);
      setConnectionStatus('');
    } catch (e) {
      clearConnectionTimeouts();
      anamClientRef.current = null;
      setVideoState('idle');
      setConnectionStatus('');
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[FinnDeskPanel] Video connection failed:', msg);

      // Classify error with actionable message
      if (/not configured|503|AVATAR_NOT_CONFIGURED/i.test(msg)) {
        setVideoError('Finn video not configured for this environment. Voice mode is ready.');
      } else if (/not found in DOM/i.test(msg)) {
        setVideoError('Video element not ready. Please try again.');
      } else if (/401|auth|token/i.test(msg)) {
        setVideoError('Authentication failed. Please sign in again.');
      } else if (/network|fetch|ERR_/i.test(msg)) {
        setVideoError('Network error. Check your connection and try again.');
      } else {
        setVideoError(msg.length > 100 ? msg.slice(0, 100) + '...' : msg);
      }
    }
  }, [videoState, videoOnly, clearConnectionTimeouts, session?.access_token]);

  const handleEndFinnSession = useCallback(() => {
    clearConnectionTimeouts();
    if (anamClientRef.current) {
      try { anamClientRef.current.stopStreaming(); } catch (_e) { /* noop */ }
      anamClientRef.current = null;
    }
    clearFinnConversationHistory();
    setVideoState('idle');
    setConnectionStatus('');
    setVideoError(null);
  }, [clearConnectionTimeouts]);

  useEffect(() => {
    if (isSessionActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSessionActive]);

  useEffect(() => {
    if (isConversing) {
      const randomPulse = () => {
        const duration = 150 + Math.random() * 300;
        const toValue = 0.4 + Math.random() * 0.6;
        Animated.sequence([
          Animated.timing(voiceLineAnim, { toValue, duration, useNativeDriver: false }),
          Animated.timing(voiceLineAnim, { toValue: 1, duration: duration * 0.8, useNativeDriver: false }),
        ]).start(() => {
          if (isConversing) randomPulse();
        });
      };
      randomPulse();
    } else {
      voiceLineAnim.setValue(1);
    }
  }, [isConversing]);

  const isFinnSpeaking = finnVoice.status === 'speaking';

  useEffect(() => {
    if (isFinnSpeaking) {
      setIsConversing(true);
      const pulseAnimation = () => {
        Animated.sequence([
          Animated.timing(dotPulseAnim, { toValue: 1.8, duration: 200, useNativeDriver: false }),
          Animated.timing(dotPulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start(() => {
          if (isFinnSpeaking) pulseAnimation();
        });
      };
      pulseAnimation();
    } else {
      setIsConversing(false);
      dotPulseAnim.setValue(1);
    }
  }, [isFinnSpeaking]);

  useEffect(() => {
    return () => {
      runTimers.current.forEach(clearTimeout);
      connectionTimeouts.current.forEach(clearTimeout);
      connectionTimeouts.current = [];
      if (anamClientRef.current) {
        try { anamClientRef.current.stopStreaming(); } catch (_e) { /* noop */ }
      }
    };
  }, []);

  const onSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const runId = `run_${Date.now()}`;

    setActiveRuns((prev) => ({
      ...prev,
      [runId]: { id: runId, events: [], status: 'running', finalText: '' },
    }));

    setChat((prev) => [
      ...prev,
      { id: `m_${Date.now()}`, from: 'user', text: trimmed },
      { id: `m_${Date.now()}_finn`, from: 'finn', text: '', runId },
    ]);
    setInput('');
    setIsConversing(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // Show initial thinking
    setActiveRuns((prev) => {
      const run = prev[runId];
      if (!run) return prev;
      return {
        ...prev,
        [runId]: {
          ...run,
          events: [{ type: 'thinking', message: 'Processing financial request...', ts: Date.now(), icon: 'sparkles' }],
        },
      };
    });

    try {
      // Fetch fresh financial context AND route through orchestrator in parallel
      const [ctx, orchestratorResp] = await Promise.all([
        fetchFinnContext(),
        fetch('/api/orchestrator/intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(suiteId ? { 'X-Suite-Id': suiteId } : {}),
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            agent: 'finn',
            text: trimmed,
            channel: 'text',
          }),
        }),
      ]);

      setFinnContext(ctx);

      let responseText: string;
      let activityEvents: Omit<FinnActivityEvent, 'ts'>[];

      if (orchestratorResp.ok) {
        const data = await orchestratorResp.json();
        responseText = data.response || 'I processed your request.';
        activityEvents = buildFinnActivity(data);
      } else {
        // Orchestrator unavailable — fall back to local financial data
        const intent = trimmed.toLowerCase();
        const fallbackIntent = intent.includes('cash') || intent.includes('flow') ? 'cashflow'
          : intent.includes('payroll') ? 'payroll'
          : intent.includes('invoice') ? 'invoices'
          : 'default';
        responseText = buildResponse(fallbackIntent, ctx.snapshot, ctx.exceptions);
        activityEvents = [
          { type: 'step', message: 'Using local financial data', icon: 'cloud-offline' },
          { type: 'done', message: 'Complete', icon: 'checkmark-circle' },
        ];
      }

      // Animate real activity events
      activityEvents.forEach((evt, idx) => {
        const delay = idx === 0 ? 200 : 200 + idx * 600;
        const timer = setTimeout(() => {
          const event: FinnActivityEvent = { ...evt, ts: Date.now() };
          setActiveRuns((prev) => {
            const run = prev[runId];
            if (!run) return prev;
            const isDone = evt.type === 'done';
            return {
              ...prev,
              [runId]: {
                ...run,
                events: [...run.events, event],
                status: isDone ? 'completed' : 'running',
              },
            };
          });
          if (evt.type === 'done') {
            setIsConversing(false);
            setChat((prev) =>
              prev.map((msg) =>
                msg.runId === runId ? { ...msg, text: responseText } : msg
              )
            );
            // Speak response via ElevenLabs TTS when in voice tab
            if (activeTab === 'voice' && responseText) {
              speakText('finn', responseText, session?.access_token).catch((err) => {
                showVoiceError('Voice playback failed — response shown in chat.');
                console.error('[FinnDeskPanel] TTS error:', err);
              });
            }
          }
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        }, delay);
        runTimers.current.push(timer);
      });
    } catch (error) {
      // Fail closed — show error
      setIsConversing(false);
      setActiveRuns((prev) => {
        const run = prev[runId];
        if (!run) return prev;
        return {
          ...prev,
          [runId]: {
            ...run,
            events: [...run.events, { type: 'done', message: 'Connection failed', ts: Date.now(), icon: 'alert-circle' }],
            status: 'completed',
          },
        };
      });
      setChat((prev) =>
        prev.map((msg) =>
          msg.runId === runId ? { ...msg, text: 'Unable to reach the orchestrator. Please try again.' } : msg
        )
      );
    }
  };

  /* ── Immersive video-only layout (FaceTime-style) ────────── */

  // Breathing pulse animation for the pre-connect icon
  const breatheAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (videoOnly && videoState === 'idle' && !videoError) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, { toValue: 1.06, duration: 1400, useNativeDriver: false }),
          Animated.timing(breatheAnim, { toValue: 1, duration: 1400, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      breatheAnim.setValue(1);
    }
  }, [videoOnly, videoState, videoError, breatheAnim]);

  // Floating bar slide-in animation
  const floatBarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (videoOnly && videoState === 'connected') {
      floatBarAnim.setValue(0);
      Animated.spring(floatBarAnim, {
        toValue: 1,
        damping: 18,
        stiffness: 120,
        useNativeDriver: false,
      }).start();
    }
  }, [videoOnly, videoState, floatBarAnim]);

  // Connected status dot pulse
  const statusDotAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (videoOnly && videoState === 'connected') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(statusDotAnim, { toValue: 1.6, duration: 1000, useNativeDriver: false }),
          Animated.timing(statusDotAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [videoOnly, videoState, statusDotAnim]);

  if (videoOnly) {
    const handleEndCallImmersive = () => {
      handleEndFinnSession();
      onEndCall?.();
    };

    const floatBarTranslateY = floatBarAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [40, 0],
    });

    return (
      <View style={[styles.card, styles.cardOverlay, immersiveStyles.root]}>
        {/* Error banner for immersive mode */}
        {voiceError && (
          <Pressable
            onPress={() => setVoiceError(null)}
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              zIndex: 50,
              backgroundColor: 'rgba(239,68,68,0.85)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>{voiceError}</Text>
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}
        {/* Full-bleed video surface */}
        <View style={immersiveStyles.videoFill}>
          {(videoState === 'connecting' || videoState === 'connected') && Platform.OS === 'web' && (
            <div style={{ position: 'absolute', inset: '0', overflow: 'hidden', zIndex: 1, borderRadius: 'inherit' }}>
              <video
                id="finn-video-immersive"
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: videoState === 'connected' ? 1 : 0,
                  transition: 'opacity 0.3s ease-in-out',
                  backgroundColor: '#000',
                }}
              />
            </div>
          )}

          {/* Pre-connect states (idle / connecting / error) */}
          {videoState !== 'connected' && (
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=800' }}
              style={immersiveStyles.preConnectBg}
              imageStyle={{ opacity: 0.12 }}
            >
              {/* Animated ambient gradient overlay for visual life */}
              <View
                style={[
                  immersiveStyles.ambientOverlay,
                  Platform.OS === 'web' ? {
                    animation: 'finnAmbientShift 6s ease-in-out infinite',
                  } as unknown as ViewStyle : {},
                ]}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.2)', 'transparent']}
                locations={[0, 0.5, 1]}
                style={immersiveStyles.gradientTop}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                locations={[0, 0.5, 1]}
                style={immersiveStyles.gradientBottom}
              />

              {videoState === 'connecting' ? (
                <View style={immersiveStyles.centerContent}>
                  {/* Connecting spinner with status ring */}
                  <View style={immersiveStyles.connectingRing}>
                    <ActivityIndicator size="large" color={Colors.accent.cyan} />
                  </View>
                  {Platform.OS === 'web' ? (
                    <ShimmeringText
                      text={connectionStatus}
                      duration={2}
                      color={Colors.text.muted}
                      shimmerColor={Colors.accent.cyan}
                      style={{ fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}
                    />
                  ) : (
                    <Text style={immersiveStyles.statusText}>{connectionStatus}</Text>
                  )}
                  <Text style={immersiveStyles.statusSubtext}>Establishing secure connection</Text>
                </View>
              ) : videoError ? (
                <View style={immersiveStyles.centerContent}>
                  <View style={immersiveStyles.errorIcon}>
                    <Ionicons name="videocam-off-outline" size={28} color="#FF9500" />
                  </View>
                  <Text style={immersiveStyles.errorTitle}>Video Not Available</Text>
                  <Text style={immersiveStyles.errorDetail}>{videoError}</Text>
                  <View style={immersiveStyles.errorActions}>
                    <Pressable
                      style={[
                        immersiveStyles.retryBtn,
                        Platform.OS === 'web' ? { className: 'finn-retry-btn' } as unknown as ViewStyle : {},
                      ]}
                      onPress={() => { setVideoError(null); handleConnectToFinn(); }}
                      accessibilityLabel="Retry video connection"
                      accessibilityRole="button"
                    >
                      <Ionicons name="refresh" size={14} color={Colors.text.secondary} />
                      <Text style={immersiveStyles.retryBtnText}>Retry</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={immersiveStyles.centerContent}>
                  {/* Breathing icon with expanding ring pulse */}
                  <View style={immersiveStyles.connectIconOuter}>
                    {Platform.OS === 'web' && (
                      <View
                        style={[
                          immersiveStyles.connectIconRing,
                          { animation: 'finnRingPulse 2.4s ease-out infinite' } as unknown as ViewStyle,
                        ]}
                      />
                    )}
                    <Animated.View
                      style={[
                        immersiveStyles.connectIcon,
                        { transform: [{ scale: breatheAnim }] },
                        Platform.OS === 'web' ? {
                          animation: 'finnBreathePulse 2.8s ease-in-out infinite',
                        } as unknown as ViewStyle : {},
                      ]}
                    >
                      <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                    </Animated.View>
                  </View>
                  <View style={immersiveStyles.connectTextGroup}>
                    <Text style={immersiveStyles.connectTitle}>Video with Finn</Text>
                    <Text style={immersiveStyles.connectSubtitle}>Start a face-to-face financial session</Text>
                  </View>
                  <Pressable
                    style={[
                      immersiveStyles.connectBtn,
                      Platform.OS === 'web' ? {
                        className: 'finn-connect-btn',
                        boxShadow: '0 6px 24px rgba(59,130,246,0.35), 0 0 48px rgba(59,130,246,0.12)',
                      } as unknown as ViewStyle : {},
                    ]}
                    onPress={handleConnectToFinn}
                    accessibilityLabel="Connect to Finn video"
                    accessibilityRole="button"
                  >
                    <Ionicons name="videocam" size={18} color="#fff" />
                    <Text style={immersiveStyles.connectBtnText}>Connect to Finn</Text>
                  </Pressable>
                </View>
              )}
            </ImageBackground>
          )}

          {/* Bottom gradient scrim for readability over any video content */}
          {videoState === 'connected' && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']}
              locations={[0, 0.4, 1]}
              style={immersiveStyles.videoScrim}
              pointerEvents="none"
            />
          )}

          {/* Connected status indicator (top-left) */}
          {videoState === 'connected' && (
            <View style={immersiveStyles.connectedBadge}>
              <Animated.View
                style={[
                  immersiveStyles.connectedDot,
                  { transform: [{ scale: statusDotAnim }] },
                  Platform.OS === 'web' ? {
                    animation: 'finnStatusDotPulse 2s ease-in-out infinite',
                  } as unknown as ViewStyle : {},
                ]}
              />
              <Text style={immersiveStyles.connectedLabel}>Live</Text>
            </View>
          )}

          {/* Floating bottom bar -- visible when connected, animated entry */}
          {videoState === 'connected' && (
            <Animated.View
              style={[
                immersiveStyles.floatingBar,
                {
                  opacity: floatBarAnim,
                  transform: [{ translateY: floatBarTranslateY }],
                },
                Platform.OS === 'web' ? {
                  animation: 'finnFloatBarEntry 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
                } as unknown as ViewStyle : {},
              ]}
            >
              {/* Chat toggle (left) */}
              <Pressable
                style={[
                  immersiveStyles.floatingPill,
                  showChatOverlay && immersiveStyles.floatingPillActive,
                  Platform.OS === 'web' ? {
                    className: `finn-floating-pill${showChatOverlay ? ' finn-chat-pill-active' : ''}`,
                  } as unknown as ViewStyle : {},
                ]}
                onPress={() => setShowChatOverlay(!showChatOverlay)}
                accessibilityLabel={showChatOverlay ? 'Close chat' : 'Open chat'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={showChatOverlay ? 'chatbubble' : 'chatbubble-outline'}
                  size={18}
                  color={showChatOverlay ? Colors.accent.cyan : '#fff'}
                />
                <Text style={[
                  immersiveStyles.floatingPillText,
                  showChatOverlay && immersiveStyles.floatingPillTextActive,
                ]}>Chat</Text>
              </Pressable>

              {/* End Call (center) */}
              <Pressable
                style={[
                  immersiveStyles.endCallPill,
                  Platform.OS === 'web' ? {
                    className: 'finn-end-call-pill',
                    boxShadow: '0 4px 16px rgba(239,68,68,0.3), 0 0 32px rgba(239,68,68,0.1)',
                  } as unknown as ViewStyle : {},
                ]}
                onPress={handleEndCallImmersive}
                accessibilityLabel="End video call"
                accessibilityRole="button"
              >
                <Ionicons name="call" size={18} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={immersiveStyles.endCallText}>End Call</Text>
              </Pressable>

              {/* Spacer for symmetry (right) */}
              <View style={immersiveStyles.floatingPillSpacer} />
            </Animated.View>
          )}

          {/* Chat overlay -- slides up from bottom */}
          <FinnVideoChatOverlay
            visible={showChatOverlay}
            onClose={() => setShowChatOverlay(false)}
            chat={chat}
            input={input}
            onChangeInput={setInput}
            onSend={onSend}
            scrollRef={scrollRef}
          />
        </View>
      </View>
    );
  }

  /* ── Standard tabbed layout (unchanged) ────────────────── */
  return (
    <View style={[styles.card, isInOverlay && styles.cardOverlay]}>
      <View style={styles.header}>
        <Text style={styles.title}>Finn Desk</Text>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'voice' && styles.tabBtnActive]}
          onPress={() => setActiveTab('voice')}
        >
          <Ionicons name="mic" size={16} color={activeTab === 'voice' ? Colors.accent.cyan : Colors.text.tertiary} />
          <Text style={[styles.tabBtnText, activeTab === 'voice' && styles.tabBtnTextActive]}>Voice</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === 'video' && styles.tabBtnActive]}
          onPress={() => setActiveTab('video')}
        >
          <Ionicons name="videocam" size={16} color={activeTab === 'video' ? Colors.accent.cyan : Colors.text.tertiary} />
          <Text style={[styles.tabBtnText, activeTab === 'video' && styles.tabBtnTextActive]}>Video</Text>
        </Pressable>
      </View>

      <View style={[styles.surfaceContainer, isInOverlay && styles.surfaceContainerOverlay]}>
        {/* Voice/Video error banner — surfaces errors that were previously swallowed */}
        {voiceError && (
          <Pressable
            onPress={() => setVoiceError(null)}
            style={{
              backgroundColor: 'rgba(239,68,68,0.15)',
              borderLeftWidth: 3,
              borderLeftColor: '#EF4444',
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginHorizontal: 12,
              marginTop: 4,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={{ color: '#FCA5A5', fontSize: 12, flex: 1 }}>{voiceError}</Text>
            <Ionicons name="close" size={14} color="#FCA5A5" />
          </Pressable>
        )}
        {activeTab === 'voice' ? (
          <View style={styles.voiceSurface}>
            <View style={styles.voiceHeader}>
              <Pressable
                style={[
                  styles.companyPill,
                  isSessionActive && styles.companyPillActive,
                ]}
                onPress={handleCompanyPillPress}
              >
                <Animated.View
                  style={[
                    styles.onlineDot,
                    isSessionActive && styles.onlineDotActive,
                    {
                      transform: [{ scale: dotPulseAnim }],
                    },
                    isFinnSpeaking && Platform.OS === 'web' && {
                      boxShadow: '0 0 12px #3B82F6, 0 0 24px #3B82F6, 0 0 36px rgba(59,130,246,0.6)',
                    },
                  ]}
                />
                <Text style={styles.companyName}>
                  {finnVoice.isActive ? 'Talking with Finn...' : (tenant?.businessName || 'Your Business')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.orbWrap}>
              {Platform.OS === 'web' ? (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <video
                    src="/finn-3d-object.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ width: 260, height: 260, objectFit: 'contain', background: 'transparent' }}
                  />
                </Animated.View>
              ) : (
                <View style={styles.orbPlaceholderLarge}>
                  <Ionicons name="sparkles" size={80} color={Colors.accent.cyan} />
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.videoSurface}>
            {(videoState === 'connecting' || videoState === 'connected') && Platform.OS === 'web' && (
              <div style={{ position: 'absolute', inset: '0', overflow: 'hidden', zIndex: 1, borderRadius: 'inherit' }}>
                <video
                  id="finn-video-sidebar"
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: videoState === 'connected' ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    backgroundColor: '#000',
                  }}
                />
              </div>
            )}
            {videoState === 'connected' ? (
              <View style={{ flex: 1 }}>
                <Pressable
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    backgroundColor: 'rgba(239,68,68,0.9)',
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    zIndex: 2,
                  }}
                  onPress={handleEndFinnSession}
                >
                  <Ionicons name="close-circle" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>End Session</Text>
                </Pressable>
              </View>
            ) : (
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=800' }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}
                imageStyle={{ opacity: 0.2 }}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'transparent']}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }}
                />
                <LinearGradient
                  colors={['transparent', '#1C1C1E']}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
                />
                {videoState === 'connecting' ? (
                  <View style={{ alignItems: 'center', gap: 12 }}>
                    <ActivityIndicator size="large" color={Colors.accent.cyan} />
                    {Platform.OS === 'web' ? (
                      <ShimmeringText
                        text={connectionStatus}
                        duration={2}
                        color={Colors.text.muted}
                        shimmerColor={Colors.accent.cyan}
                        style={{ fontSize: 14, fontWeight: '500' }}
                      />
                    ) : (
                      <Text style={{ color: Colors.text.secondary, fontSize: 14 }}>{connectionStatus}</Text>
                    )}
                  </View>
                ) : videoError ? (
                  <View style={{ alignItems: 'center', gap: 14, paddingHorizontal: 32 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,149,0,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="videocam-off-outline" size={28} color="#FF9500" />
                    </View>
                    <Text style={{ color: Colors.text.secondary, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>Video Not Available</Text>
                    <Text style={{ color: Colors.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>{videoError}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' }}
                        onPress={() => { setVideoError(null); handleConnectToFinn(); }}
                      >
                        <Ionicons name="refresh" size={14} color={Colors.text.secondary} />
                        <Text style={{ color: Colors.text.secondary, fontSize: 13, fontWeight: '500' }}>Retry</Text>
                      </Pressable>
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: Colors.accent.cyan }}
                        onPress={() => setActiveTab('voice')}
                      >
                        <Ionicons name="mic" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Use Voice</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 16 }}>
                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(59,130,246,0.3)' }}>
                      <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Video with Finn</Text>
                    <Text style={{ color: Colors.text.tertiary, fontSize: 13 }}>Start a face-to-face financial session</Text>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.accent.cyan, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 24 }}
                      onPress={handleConnectToFinn}
                    >
                      <Ionicons name="videocam" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Connect to Finn</Text>
                    </Pressable>
                  </View>
                )}
              </ImageBackground>
            )}
          </View>
        )}
      </View>

      {isConversing && (
        <Animated.View
          style={[
            styles.divider,
            {
              backgroundColor: Colors.accent.cyan,
              height: 2,
              transform: [{ scaleY: voiceLineAnim }],
              ...(Platform.OS === 'web' ? {
                boxShadow: '0 0 10px #3B82F6, 0 0 20px #3B82F6, 0 0 30px rgba(59,130,246,0.6)',
              } : {}),
            }
          ]}
        />
      )}

      <View style={styles.chatDock}>
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {chat.map((msg) => {
            const run = msg.runId ? activeRuns[msg.runId] : null;
            const showActivity = run && run.events.length > 0;
            const showMessage = !msg.runId || (run && run.status === 'completed');

            return (
              <View key={msg.id}>
                {msg.from === 'user' ? (
                  <View style={[styles.msgBubble, styles.msgUser]}>
                    <View style={styles.msgContent}>
                      <Text style={styles.msgText}>{msg.text}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.msgBubble, styles.msgFinn]}>
                    <View style={styles.avatarSmall}>
                      <Ionicons name="sparkles" size={12} color={Colors.accent.cyan} />
                    </View>
                    <View style={styles.msgContent}>
                      {showActivity && (
                        <FinnActivityInline run={run} />
                      )}
                      {showMessage && msg.text ? (
                        <Text style={styles.msgText}>{msg.text}</Text>
                      ) : null}
                      {msg.runId && run && run.status === 'running' && !msg.text && (
                        Platform.OS === 'web' ? (
                          <View style={actStyles.thinkingDotsRow}>
                            <ShimmeringText
                              text="Thinking..."
                              duration={1.5}
                              color={Colors.text.muted}
                              shimmerColor={Colors.accent.cyan}
                              style={{ fontSize: 13, fontWeight: '500' }}
                            />
                          </View>
                        ) : (
                          <ThinkingDots />
                        )
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputRow}>
          <Pressable style={styles.attachBtn}>
            <Ionicons name="attach" size={20} color={Colors.text.secondary} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message Finn..."
            placeholderTextColor={Colors.text.tertiary}
            style={styles.input}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <Pressable style={styles.sendBtn} onPress={onSend}>
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1C1C1E',
    ...(Platform.OS === 'web' ? {
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
      height: 'calc(100vh - 40px)',
      margin: '20px auto',
    } : {
      flex: 1,
    }),
  } as any,
  cardOverlay: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      maxWidth: undefined,
      height: '100%',
      margin: 0,
    } : {}),
  } as any,
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    zIndex: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.tertiary,
  },
  tabBtnTextActive: {
    color: Colors.accent.cyan,
  },
  videoSurface: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  } as any,
  surfaceContainer: {
    height: 360,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  surfaceContainerOverlay: {
    height: undefined,
    flex: 1.2,
    flexShrink: 1,
  },
  voiceSurface: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  voiceHeader: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  companyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#242426',
    borderRadius: 20,
    cursor: 'pointer',
    ...(Platform.OS === 'web' ? {
      transition: 'all 0.2s ease',
    } : {}),
  } as any,
  companyPillActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 16px rgba(59,130,246,0.3)',
    } : {}),
  } as any,
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  onlineDotActive: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 8px #3B82F6',
    } : {}),
  } as any,
  companyName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  orbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  orbPlaceholderLarge: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 140,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
  },
  chatDock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  } as any,
  chatScroll: {
    flex: 1,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? {
      scrollbarWidth: 'none',
    } : {}),
  } as any,
  chatContent: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  msgBubble: {
    flexDirection: 'row',
    gap: 10,
    maxWidth: '85%',
  },
  msgFinn: {
    alignSelf: 'flex-start',
  },
  msgUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  msgContent: {
    flex: 1,
    gap: 8,
  },
  msgText: {
    color: Colors.text.primary,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: '#1E1E20',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background.tertiary,
    fontSize: 13,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyan,
  },
});

/* ── Immersive video-only styles ─────────────────────────── */

const FLOATING_PILL_BG = 'rgba(255, 255, 255, 0.14)';
const FLOATING_PILL_BORDER = 'rgba(255, 255, 255, 0.1)';
const END_CALL_BG = '#DC2626';
const END_CALL_BORDER = 'rgba(255, 255, 255, 0.08)';

const immersiveStyles = StyleSheet.create({
  root: {
    backgroundColor: '#000',
  },

  videoFill: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  } as Record<string, unknown>,

  /* Pre-connect background (idle / connecting / error) */
  preConnectBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  } as Record<string, unknown>,

  /* Animated ambient gradient overlay for subtle visual life over the bg image */
  ambientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    zIndex: 0,
  } as Record<string, unknown>,

  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 1,
  } as Record<string, unknown>,

  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 1,
  } as Record<string, unknown>,

  centerContent: {
    alignItems: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xxxl,
    zIndex: 2,
  },

  /* Connecting state */
  connectingRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusText: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  statusSubtext: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: -Spacing.sm,
  } as Record<string, unknown>,

  /* Error state -- elegant, not clinical */
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  errorDetail: {
    color: Colors.text.tertiary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },

  errorActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },

  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    minHeight: 44,
  },

  retryBtnText: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  /* Idle connect state -- invitation feel */
  connectIconOuter: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  } as Record<string, unknown>,

  connectIconRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  } as Record<string, unknown>,

  connectIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },

  connectTextGroup: {
    alignItems: 'center',
    gap: Spacing.xs,
  },

  connectTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },

  connectSubtitle: {
    color: Colors.text.tertiary,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.1,
  },

  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.xl + BorderRadius.sm,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minHeight: 48,
    marginTop: Spacing.sm,
  },

  connectBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  /* Bottom gradient scrim over video behind floating bar */
  videoScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 5,
  } as Record<string, unknown>,

  /* Connected status badge (top-left) */
  connectedBadge: {
    position: 'absolute',
    top: Spacing.xl,
    left: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }
      : {}),
  } as Record<string, unknown>,

  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.semantic.success,
  },

  connectedLabel: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as Record<string, unknown>,

  /* Floating bottom control bar (over video) */
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    paddingTop: Spacing.xl,
    zIndex: 10,
  } as Record<string, unknown>,

  /* Glass-morphism floating pill (Chat toggle) */
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: FLOATING_PILL_BG,
    borderWidth: 1,
    borderColor: FLOATING_PILL_BORDER,
    minHeight: 46,
    minWidth: 46,
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          cursor: 'pointer',
        }
      : {}),
  } as Record<string, unknown>,

  /* Active state for chat pill when overlay is open */
  floatingPillActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },

  floatingPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  floatingPillTextActive: {
    color: Colors.accent.cyan,
  },

  /* End Call pill -- deep red with depth */
  endCallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.full,
    backgroundColor: END_CALL_BG,
    borderWidth: 1,
    borderColor: END_CALL_BORDER,
    minHeight: 46,
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 4px 16px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
          cursor: 'pointer',
        }
      : {}),
  } as Record<string, unknown>,

  endCallText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  /* Invisible spacer to balance the floating bar layout */
  floatingPillSpacer: {
    width: 88,
  },
});
