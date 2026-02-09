import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useConversation } from '@elevenlabs/react';

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

const MOCK_ACTIVITY_SEQUENCES: Record<string, { events: Omit<FinnActivityEvent, 'ts'>[]; response: string }> = {
  cashflow: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Pulling cash position data', icon: 'wallet' },
      { type: 'tool_call', message: 'Analyzing inflows and outflows', icon: 'swap-horizontal' },
      { type: 'step', message: 'Comparing against 30-day trend', icon: 'trending-up' },
      { type: 'tool_call', message: 'Forecasting next 14 days', icon: 'analytics' },
      { type: 'step', message: 'Building cash flow summary', icon: 'document-text' },
      { type: 'done', message: 'Analysis complete', icon: 'checkmark-circle' },
    ],
    response: 'Cash flow analysis complete. Net inflow is +$12,400 this week. I flagged a projected dip next Thursday — recommend holding $8K in reserve.',
  },
  payroll: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Loading payroll schedule', icon: 'calendar' },
      { type: 'tool_call', message: 'Calculating gross payroll for 24 employees', icon: 'people' },
      { type: 'step', message: 'Verifying tax withholdings', icon: 'shield-checkmark' },
      { type: 'tool_call', message: 'Checking account buffer', icon: 'wallet' },
      { type: 'step', message: 'Generating payroll summary', icon: 'document-text' },
      { type: 'done', message: 'Payroll review complete', icon: 'checkmark-circle' },
    ],
    response: 'Payroll review done. Total: $47,200 due Friday. Buffer is healthy at $62,400. No issues flagged.',
  },
  invoices: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Scanning accounts receivable', icon: 'search' },
      { type: 'tool_call', message: 'Aging 38 open invoices', icon: 'layers' },
      { type: 'step', message: 'Identifying overdue accounts', icon: 'warning' },
      { type: 'tool_call', message: 'Drafting collection notices', icon: 'create' },
      { type: 'done', message: 'Invoice review complete', icon: 'checkmark-circle' },
    ],
    response: 'Invoice review complete. 2 invoices overdue totaling $6,800. I drafted collection notices for Apex Corp and Delta Partners.',
  },
  budget: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Loading budget allocations', icon: 'pie-chart' },
      { type: 'tool_call', message: 'Comparing actuals vs. budget', icon: 'bar-chart' },
      { type: 'step', message: 'Identifying variance drivers', icon: 'git-compare' },
      { type: 'tool_call', message: 'Projecting Q4 landing', icon: 'trending-up' },
      { type: 'step', message: 'Building forecast report', icon: 'document-text' },
      { type: 'done', message: 'Budget forecast ready', icon: 'checkmark-circle' },
    ],
    response: 'Budget forecast complete. You\'re 4% under budget YTD. Marketing is 12% over — recommend reallocating $3,200 from operations.',
  },
  default: {
    events: [
      { type: 'thinking', message: 'Understanding request...', icon: 'sparkles' },
      { type: 'step', message: 'Analyzing your request', icon: 'search' },
      { type: 'tool_call', message: 'Gathering financial data', icon: 'cloud-download' },
      { type: 'step', message: 'Processing information', icon: 'cog' },
      { type: 'step', message: 'Preparing response', icon: 'document-text' },
      { type: 'done', message: 'Task complete', icon: 'checkmark-circle' },
    ],
    response: 'Got it. I will adjust based on that clarification.',
  },
};

function getActivitySequence(userText: string): { events: Omit<FinnActivityEvent, 'ts'>[]; response: string } {
  const lower = userText.toLowerCase();
  if (lower.includes('cash') || lower.includes('flow') || lower.includes('position') || lower.includes('balance'))
    return MOCK_ACTIVITY_SEQUENCES.cashflow;
  if (lower.includes('payroll') || lower.includes('salary') || lower.includes('employee') || lower.includes('wage'))
    return MOCK_ACTIVITY_SEQUENCES.payroll;
  if (lower.includes('invoice') || lower.includes('overdue') || lower.includes('receivable') || lower.includes('collection'))
    return MOCK_ACTIVITY_SEQUENCES.invoices;
  if (lower.includes('budget') || lower.includes('forecast') || lower.includes('variance') || lower.includes('spending'))
    return MOCK_ACTIVITY_SEQUENCES.budget;
  return MOCK_ACTIVITY_SEQUENCES.default;
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

const seedChat: ChatMsg[] = [
  { id: 'm1', from: 'finn', text: 'Good morning. Cash is up $4,200 today. Payroll is Friday — buffer looks healthy. Two invoices are overdue. Want me to draft collection notices?' },
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

export function FinnDeskPanel() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>(seedChat);
  const [input, setInput] = useState('');
  const [activeRuns, setActiveRuns] = useState<Record<string, ActiveRun>>({});
  const runTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const voiceLineAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const dotPulseAnim = useRef(new Animated.Value(1)).current;

  const conversation = useConversation({
    onConnect: () => {
      console.log('ElevenLabs Finn connected');
      setIsSessionActive(true);
    },
    onDisconnect: () => {
      console.log('ElevenLabs Finn disconnected');
      setIsSessionActive(false);
    },
    onMessage: (message) => {
      console.log('Finn message:', message);
    },
    onError: (error) => {
      console.error('ElevenLabs Finn error:', error);
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
            body: JSON.stringify({ agent: 'finn' }),
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
          const finnAgentId = process.env.EXPO_PUBLIC_ELEVENLABS_FINN_AGENT_ID || 'agent_0001kfvnjz5yfjkbt1w6pjfw65mw';
          await conversation.startSession({ agentId: finnAgentId });
        }
      } catch (error) {
        console.error('Failed to start ElevenLabs session:', error);
        Alert.alert('Connection Error', 'Unable to connect to Finn. Please try again.');
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
      { id: `m_${Date.now()}_finn`, from: 'finn', text: '', runId },
    ]);
    setInput('');
    setIsConversing(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    sequence.events.forEach((evt, idx) => {
      const delay = idx === 0 ? 400 : 400 + idx * 1100 + Math.random() * 400;
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
              msg.runId === runId ? { ...msg, text: sequence.response } : msg
            )
          );
        }
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }, delay);
      runTimers.current.push(timer);
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Finn Desk</Text>
      </View>

      <View style={styles.surfaceContainer}>
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
                {conversation.status === 'connected' ? 'Talking with Finn...' : 'Zenith Solutions'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.orbWrap}>
            {Platform.OS === 'web' ? (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <video
                  src="/ava-orb.mp4"
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
  surfaceContainer: {
    height: 360,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
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
