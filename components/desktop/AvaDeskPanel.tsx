import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Animated, Linking, Alert, Image, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/tokens';
import { useConversation } from '@elevenlabs/react';

type AvaMode = 'voice' | 'video';
type VideoConnectionState = 'idle' | 'connecting' | 'connected';

type FileAttachment = {
  id: string;
  name: string;
  kind: 'PDF' | 'DOCX' | 'XLSX' | 'PNG';
  url?: string;
};

type AvaActivityEvent = {
  type: 'thinking' | 'step' | 'tool_call' | 'done';
  message: string;
  ts: number;
  icon: keyof typeof Ionicons.glyphMap;
};

type ActiveRun = {
  id: string;
  events: AvaActivityEvent[];
  status: 'running' | 'completed';
  finalText: string;
};

type ChatMsg = {
  id: string;
  from: 'ava' | 'user';
  text: string;
  attachments?: FileAttachment[];
  runId?: string;
};

const MOCK_ACTIVITY_SEQUENCES: Record<string, { events: Omit<AvaActivityEvent, 'ts'>[]; response: string }> = {
  contracts: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Scanning vendor contracts database', icon: 'search' },
      { type: 'tool_call', message: 'Analyzing 12 active contracts', icon: 'document-text' },
      { type: 'step', message: 'Cross-referencing renewal dates', icon: 'calendar' },
      { type: 'tool_call', message: 'Evaluating risk clauses', icon: 'shield-checkmark' },
      { type: 'step', message: 'Generating risk summary report', icon: 'analytics' },
      { type: 'done', message: 'Analysis complete', icon: 'checkmark-circle' },
    ],
    response: 'Done. I have drafted a summary and flagged high-risk items for your approval.',
  },
  financial: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Pulling financial records', icon: 'wallet' },
      { type: 'tool_call', message: 'Reconciling Q4 transactions', icon: 'swap-horizontal' },
      { type: 'step', message: 'Comparing against budget forecasts', icon: 'trending-up' },
      { type: 'tool_call', message: 'Identifying anomalies', icon: 'warning' },
      { type: 'step', message: 'Building executive summary', icon: 'document-text' },
      { type: 'done', message: 'Report ready', icon: 'checkmark-circle' },
    ],
    response: 'Financial review complete. I found 3 anomalies worth reviewing — all flagged in the attached report.',
  },
  email: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Scanning inbox for priority items', icon: 'mail' },
      { type: 'tool_call', message: 'Categorizing 24 unread messages', icon: 'layers' },
      { type: 'step', message: 'Drafting suggested responses', icon: 'create' },
      { type: 'done', message: 'Inbox organized', icon: 'checkmark-circle' },
    ],
    response: 'Your inbox is organized. 5 messages need your direct attention — I drafted replies for the other 19.',
  },
  schedule: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Reviewing your calendar', icon: 'calendar' },
      { type: 'tool_call', message: 'Checking team availability', icon: 'people' },
      { type: 'step', message: 'Optimizing meeting blocks', icon: 'time' },
      { type: 'step', message: 'Resolving 2 scheduling conflicts', icon: 'git-compare' },
      { type: 'done', message: 'Schedule optimized', icon: 'checkmark-circle' },
    ],
    response: 'Schedule optimized. I moved 2 overlapping meetings and blocked focus time from 2-4 PM.',
  },
  default: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Analyzing your request', icon: 'search' },
      { type: 'tool_call', message: 'Gathering relevant data', icon: 'cloud-download' },
      { type: 'step', message: 'Processing information', icon: 'cog' },
      { type: 'step', message: 'Preparing response', icon: 'document-text' },
      { type: 'done', message: 'Task complete', icon: 'checkmark-circle' },
    ],
    response: 'Got it. I will adjust based on that clarification.',
  },
};

function getActivitySequence(userText: string): { events: Omit<AvaActivityEvent, 'ts'>[]; response: string } {
  const lower = userText.toLowerCase();
  if (lower.includes('contract') || lower.includes('vendor') || lower.includes('risk'))
    return MOCK_ACTIVITY_SEQUENCES.contracts;
  if (lower.includes('financ') || lower.includes('budget') || lower.includes('revenue') || lower.includes('cash'))
    return MOCK_ACTIVITY_SEQUENCES.financial;
  if (lower.includes('email') || lower.includes('inbox') || lower.includes('mail') || lower.includes('message'))
    return MOCK_ACTIVITY_SEQUENCES.email;
  if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('meeting') || lower.includes('book'))
    return MOCK_ACTIVITY_SEQUENCES.schedule;
  return MOCK_ACTIVITY_SEQUENCES.default;
}

function AvaOrbVideoInline({ size = 320 }: { size?: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        video.ava-orb-video::-webkit-media-controls,
        video.ava-orb-video::-webkit-media-controls-enclosure,
        video.ava-orb-video::-webkit-media-controls-panel,
        video.ava-orb-video::-webkit-media-controls-start-playback-button,
        video.ava-orb-video::-webkit-media-controls-overlay-play-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        video.ava-orb-video::-moz-media-controls { display: none !important; }
        video.ava-orb-video { object-fit: contain; }
      `;
      document.head.appendChild(style);

      const vid = videoRef.current;
      if (vid) {
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.play().catch(() => {});
      }

      return () => { document.head.removeChild(style); };
    }
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <video
      ref={videoRef as any}
      className="ava-orb-video"
      src="/ava-orb.mp4"
      autoPlay
      loop
      muted
      playsInline
      controls={false}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    />
  );
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

function AvaActivityInline({ run }: { run: ActiveRun }) {
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

const seedChat: ChatMsg[] = [
  { id: 'm1', from: 'ava', text: 'Good morning. What would you like me to do?' },
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

export function AvaDeskPanel() {
  const [mode, setMode] = useState<AvaMode>('voice');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [videoState, setVideoState] = useState<VideoConnectionState>('idle');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [chat, setChat] = useState<ChatMsg[]>(seedChat);
  const [input, setInput] = useState('');
  const [activeRuns, setActiveRuns] = useState<Record<string, ActiveRun>>({});
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const connectingAnim = useRef(new Animated.Value(0)).current;
  const voiceLineAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const connectionTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dotPulseAnim = useRef(new Animated.Value(1)).current;

  const conversation = useConversation({
    onConnect: () => {
      console.log('ElevenLabs connected');
      setIsSessionActive(true);
    },
    onDisconnect: () => {
      console.log('ElevenLabs disconnected');
      setIsSessionActive(false);
    },
    onMessage: (message) => {
      console.log('Ava message:', message);
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      setIsSessionActive(false);
    },
  });

  const handleCompanyPillPress = useCallback(async () => {
    if (conversation.status === 'connected') {
      await conversation.endSession();
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        let signedUrl: string | null = null;
        try {
          const resp = await fetch('/api/elevenlabs/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent: 'ava' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            signedUrl = data.signedUrl || null;
          }
        } catch (e) {
          console.warn('Signed URL fetch failed, using fallback:', e);
        }
        if (signedUrl) {
          await conversation.startSession({ signedUrl });
        } else {
          const avaAgentId = process.env.EXPO_PUBLIC_ELEVENLABS_AVA_AGENT_ID || 'agent_0001kfvnjz5yfjkbt1w6pjfw65mw';
          await conversation.startSession({ agentId: avaAgentId });
        }
      } catch (error) {
        console.error('Failed to start ElevenLabs session:', error);
        Alert.alert('Connection Error', 'Unable to connect to Ava. Please try again.');
      }
    }
  }, [conversation]);

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
    if (videoState === 'connecting') {
      Animated.loop(
        Animated.timing(connectingAnim, { toValue: 1, duration: 1500, useNativeDriver: false })
      ).start();
    } else {
      connectingAnim.setValue(0);
    }
  }, [videoState]);

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

  useEffect(() => {
    return () => {
      connectionTimeouts.current.forEach(clearTimeout);
      connectionTimeouts.current = [];
    };
  }, []);

  useEffect(() => {
    if (conversation.isSpeaking) {
      setIsConversing(true);
      const pulseAnimation = () => {
        Animated.sequence([
          Animated.timing(dotPulseAnim, { toValue: 1.8, duration: 200, useNativeDriver: false }),
          Animated.timing(dotPulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start(() => {
          if (conversation.isSpeaking) pulseAnimation();
        });
      };
      pulseAnimation();
    } else {
      setIsConversing(false);
      dotPulseAnim.setValue(1);
    }
  }, [conversation.isSpeaking]);

  const clearConnectionTimeouts = useCallback(() => {
    connectionTimeouts.current.forEach(clearTimeout);
    connectionTimeouts.current = [];
  }, []);

  const handleConnectToAva = useCallback(() => {
    if (videoState !== 'idle') return;
    
    clearConnectionTimeouts();
    setVideoState('connecting');
    setConnectionStatus('Connecting to Ava...');
    playConnectionSound();
    
    const t1 = setTimeout(() => {
      setConnectionStatus('Establishing secure video...');
    }, 800);
    
    const t2 = setTimeout(() => {
      setConnectionStatus('Initializing session...');
    }, 1600);
    
    const t3 = setTimeout(() => {
      playSuccessSound();
      setVideoState('connected');
      setConnectionStatus('');
    }, 2400);
    
    connectionTimeouts.current = [t1, t2, t3];
  }, [videoState, clearConnectionTimeouts]);

  const handleEndSession = useCallback(() => {
    clearConnectionTimeouts();
    setVideoState('idle');
    setConnectionStatus('');
  }, [clearConnectionTimeouts]);

  const voiceStatusLabel = useMemo(() => {
    return isSessionActive ? 'Listening...' : 'Listening...';
  }, [isSessionActive]);

  useEffect(() => {
    return () => {
      runTimers.current.forEach(clearTimeout);
    };
  }, []);

  const onSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const runId = `run_${Date.now()}`;
    const sequence = getActivitySequence(trimmed);

    setActiveRuns((prev) => ({
      ...prev,
      [runId]: { id: runId, events: [], status: 'running', finalText: sequence.response },
    }));

    setChat((prev) => [
      ...prev,
      { id: `m_${Date.now()}`, from: 'user', text: trimmed },
      { id: `m_${Date.now()}_ava`, from: 'ava', text: '', runId },
    ]);
    setInput('');
    setIsConversing(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    sequence.events.forEach((evt, idx) => {
      const delay = idx === 0 ? 400 : 400 + idx * 1100 + Math.random() * 400;
      const timer = setTimeout(() => {
        const event: AvaActivityEvent = { ...evt, ts: Date.now() };
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
              msg.runId === runId ? { ...msg, text: sequence.response } : msg
            )
          );
        }
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }, delay);
      runTimers.current.push(timer);
    });
  };

  const handleStartSession = () => setIsSessionActive(!isSessionActive);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Ava Desk</Text>
        </View>
        <View style={styles.tabs}>
          <TabButton label="Voice with Ava" icon="mic" active={mode === 'voice'} onPress={() => setMode('voice')} />
          <TabButton label="Video with Ava" icon="videocam" active={mode === 'video'} onPress={() => setMode('video')} />
        </View>
      </View>

      <View style={styles.surfaceContainer}>
        {mode === 'voice' ? (
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
                    conversation.isSpeaking && Platform.OS === 'web' && {
                      boxShadow: '0 0 12px #3B82F6, 0 0 24px #3B82F6, 0 0 36px rgba(59,130,246,0.6)',
                    },
                  ]} 
                />
                <Text style={styles.companyName}>
                  {conversation.status === 'connected' ? 'Talking with Ava...' : 'Zenith Solutions'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.orbWrap}>
              {Platform.OS === 'web' ? (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <AvaOrbVideoInline size={320} />
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
            {videoState === 'connected' ? (
              <View style={styles.anamContainer}>
                {Platform.OS === 'web' && (
                  <iframe
                    src="https://lab.anam.ai/frame/a1em9A5J3l2W6tmBIFMmr"
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      border: 'none',
                      borderRadius: 0,
                      display: 'block',
                      backgroundColor: '#000',
                    }}
                    allow="microphone"
                  />
                )}
              </View>
            ) : (
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800' }}
                style={styles.videoIdleContainer}
                imageStyle={{ opacity: 0.25 }}
              >
                {/* Top vignette */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'transparent']}
                  style={styles.videoIdleVignetteTop}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
                {/* Bottom gradient fade */}
                <LinearGradient
                  colors={['transparent', Colors.background.primary]}
                  style={styles.videoIdleVignetteBottom}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
                <View style={styles.videoIdleCenter}>
                  {videoState === 'connecting' ? (
                    <>
                      <Animated.View style={[styles.connectingRing, { transform: [{ rotate: connectingAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
                        <View style={styles.connectingRingInner} />
                      </Animated.View>
                      <View style={styles.avaAvatarIdle}>
                        <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                      </View>
                      <Text style={styles.connectionStatusText}>{connectionStatus}</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.avaAvatarIdleGlow}>
                        <View style={styles.avaAvatarIdle}>
                          <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
                        </View>
                      </View>
                      <Text style={styles.videoIdleTitle}>Video with Ava</Text>
                      <Text style={styles.videoIdleSubtitle}>Start a face-to-face session</Text>
                      <Pressable style={styles.connectBtn} onPress={handleConnectToAva}>
                        <Ionicons name="videocam" size={18} color="#fff" />
                        <Text style={styles.connectBtnText}>Connect to Ava</Text>
                      </Pressable>
                    </>
                  )}
                </View>
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
          {chat.map((msg, idx) => {
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
                  <View style={[styles.msgBubble, styles.msgAva]}>
                    <View style={styles.avatarSmall}>
                      <Ionicons name="sparkles" size={12} color={Colors.accent.cyan} />
                    </View>
                    <View style={styles.msgContent}>
                      {showActivity && (
                        <AvaActivityInline run={run} />
                      )}
                      {showMessage && msg.text ? (
                        <Text style={styles.msgText}>{msg.text}</Text>
                      ) : null}
                      {msg.runId && run && run.status === 'running' && !msg.text && (
                        <ThinkingDots />
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
            placeholder="Message Ava..."
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

function TabButton({ label, icon, active, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Ionicons name={icon} size={14} color={active ? Colors.accent.cyan : Colors.text.tertiary} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    } : {
      flex: 1,
    }),
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
  headerLeft: {},
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#242426',
  },
  tabText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text.primary,
  },
  surfaceContainer: {
    height: 360,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  surfaceContainerExpanded: {
    flex: 1,
    height: 'auto',
  } as any,
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
  orbPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  orbPlaceholderLarge: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 140,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  listeningText: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  listeningTextClose: {
    fontSize: 16,
    color: '#A1A1AA',
    fontWeight: '500',
    marginTop: 12,
  },
  voiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startCallBtn: {
    backgroundColor: '#22c55e',
  },
  floatingMicOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.15)',
    } : {}),
  } as any,
  floatingMicOrbActive: {
    backgroundColor: Colors.accent.cyan,
    borderColor: Colors.accent.cyan,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 20px rgba(59,130,246,0.6), 0 0 40px rgba(59,130,246,0.4)',
    } : {}),
  } as any,
  videoSurface: {
    flex: 1,
    position: 'relative',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  videoHeader: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  sessionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(59,130,246,0.3)',
    borderRadius: 4,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  liveIndicators: {
    flexDirection: 'row',
    gap: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  avaAvatarWrap: {
    alignItems: 'center',
    gap: 8,
  },
  avaAvatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  avaAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaAvatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3B82F6',
  },
  avaName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  avaStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  videoCompanyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoCompanyText: {
    fontSize: 13,
    color: '#D4D4D8',
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#343436',
    alignItems: 'center',
    justifyContent: 'center',
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
  msgAva: { 
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
  attachmentList: {
    gap: 6,
    paddingLeft: 4,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
  },
  attachmentName: {
    flex: 1,
    fontSize: 12,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  attachmentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#242426',
    borderRadius: 4,
  },
  attachmentKind: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.tertiary,
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
  anamContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  endSessionBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 20,
  },
  endSessionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  videoIdleContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  } as any,
  videoIdleVignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  videoIdleVignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  videoIdleCenter: {
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  avaAvatarIdle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  avaAvatarIdleGlow: {
    padding: 8,
    borderRadius: 48,
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  videoIdleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 8,
  },
  videoIdleSubtitle: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.accent.cyan,
    borderRadius: 24,
    marginTop: 8,
  },
  connectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  connectingRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: Colors.accent.cyan,
    borderRightColor: 'rgba(59,130,246,0.3)',
  },
  connectingRingInner: {
    width: '100%',
    height: '100%',
  },
  connectionStatusText: {
    fontSize: 14,
    color: Colors.accent.cyan,
    fontWeight: '500',
    marginTop: 16,
  },
});
