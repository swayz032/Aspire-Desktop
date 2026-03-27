/**
 * AgentWidget — Immersive agent modal with real orb videos + chat
 *
 * VIEW 1: Voice — real orb video floating, mic controls, pure black bg
 * VIEW 2: Chat — gradient bubbles, compose bar
 *
 * Ava  → /ava-orb.mp4 (blue/purple)
 * Eli  → /eli-orb.mp4 (amber/green)
 * Finn → /finn-orb.mp4 (cyan/indigo)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { VoiceStatus } from '@/hooks/useVoice';
import {
  playClickSound,
  playMicActivateSound,
  playMessageSentSound,
} from '@/lib/sounds';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

type ViewMode = 'voice' | 'chat';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  ts: Date;
}

interface ChatMessageExternal {
  id: string;
  role: 'user' | 'agent';
  text: string;
  ts: Date;
}

interface AgentWidgetProps {
  agentId: string;
  suiteId: string;
  officeId: string;
  voiceStatus?: VoiceStatus;
  onPrimaryAction?: () => void;
  /** Called when user sends a text message in chat view. If provided, the widget
   *  delegates message handling to the parent (real orchestrator call).
   *  If omitted, the widget uses a local stub (demo mode). */
  onSendText?: (text: string) => void;
  /** External messages to display (from parent state, e.g. eliMessages). */
  externalMessages?: ChatMessageExternal[];
  /** Whether the agent is currently thinking/processing. */
  isThinking?: boolean;
}

const AGENT_META: Record<string, {
  name: string;
  subtitle: string;
  videoSrc: string;
  glow: string;
  micGrad: [string, string];
  chatGrad: [string, string];
  bubbleGrad: [string, string];
}> = {
  ava: {
    name: 'Ava',
    subtitle: 'Executive AI Assistant',
    videoSrc: '/ava-orb.mp4',
    glow: 'rgba(96,165,250,0.22)',
    micGrad: ['#60A5FA', '#8B5CF6'],
    chatGrad: ['#60A5FA', '#8B5CF6'],
    bubbleGrad: ['#3B82F6', '#8B5CF6'],
  },
  eli: {
    name: 'Eli',
    subtitle: 'Communications & Inbox',
    videoSrc: '/eli-orb.mp4',
    glow: 'rgba(217,119,6,0.22)',
    micGrad: ['#D97706', '#B45309'],
    chatGrad: ['#D97706', '#F59E0B'],
    bubbleGrad: ['#B45309', '#F59E0B'],
  },
  finn: {
    name: 'Finn',
    subtitle: 'Finance & Accounting',
    videoSrc: '/finn-orb.mp4',
    glow: 'rgba(56,189,248,0.22)',
    micGrad: ['#38BDF8', '#6366F1'],
    chatGrad: ['#38BDF8', '#6366F1'],
    bubbleGrad: ['#0EA5E9', '#6366F1'],
  },
};

function statusLabel(status?: VoiceStatus): string {
  if (status === 'listening') return 'Listening…';
  if (status === 'thinking') return 'Thinking…';
  if (status === 'speaking') return 'Speaking…';
  if (status === 'error') return 'Reconnect needed';
  return 'Tap the mic to start…';
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Real Video Orb — plays actual orb .mp4 in a circular mask
// ---------------------------------------------------------------------------

function OrbVideo({
  src,
  size,
  glow,
  voiceStatus,
}: {
  src: string;
  size: number;
  glow: string;
  voiceStatus?: VoiceStatus;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -16,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  useEffect(() => {
    const active =
      voiceStatus === 'listening' ||
      voiceStatus === 'speaking' ||
      voiceStatus === 'thinking';

    const pulseTgt = active ? 1.07 : 1.0;
    const glowTgt = active ? 1.0 : 0.5;

    const pLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: pulseTgt,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    const gLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: glowTgt,
          duration: 900,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: active ? 0.55 : 0.3,
          duration: 900,
          useNativeDriver: false,
        }),
      ])
    );

    pLoop.start();
    gLoop.start();
    return () => {
      pLoop.stop();
      gLoop.stop();
    };
  }, [voiceStatus, pulseAnim, glowAnim]);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => {});
    }
  }, [src]);

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: floatAnim }],
      }}
    >

      {/* Orb */}
      {Platform.OS === 'web' ? (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <video
            ref={videoRef as any}
            src={src}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: '#111',
          }}
        >
          <LinearGradient
            colors={['#60A5FA', '#8B5CF6']}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Mini orb thumbnail — used in chat header + bubbles
// ---------------------------------------------------------------------------

function MiniOrbThumb({
  src,
  size = 28,
}: {
  src: string;
  size?: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => {});
    }
  }, [src]);

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#333',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <video
        ref={videoRef as any}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function AgentWidgetInner({
  agentId,
  voiceStatus = 'idle',
  onPrimaryAction,
  onSendText,
  externalMessages,
  isThinking,
}: AgentWidgetProps) {
  const meta = AGENT_META[agentId] || AGENT_META.ava;
  const [view, setView] = useState<ViewMode>('voice');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const chatRef = useRef<FlatList<ChatMessage>>(null);

  // When parent provides external messages, convert and use them
  const messages: ChatMessage[] = externalMessages
    ? externalMessages.map(m => ({
        id: m.id,
        role: m.role === 'user' ? 'user' as const : 'agent' as const,
        text: m.text,
        ts: m.ts,
      }))
    : localMessages;

  const switchToChat = useCallback(() => {
    playClickSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setView('chat');
  }, []);

  const switchToVoice = useCallback(() => {
    playClickSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setView('voice');
  }, []);

  const handleMic = useCallback(() => {
    playMicActivateSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPrimaryAction?.();
  }, [onPrimaryAction]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    playMessageSentSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInputText('');

    if (onSendText) {
      // Real mode: parent handles orchestrator call
      onSendText(text);
    } else {
      // Demo/stub mode: local-only canned response
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text,
        ts: new Date(),
      };
      setLocalMessages(prev => [...prev, userMsg]);
      setTimeout(() => {
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          text: `I'm processing your request. Give me a moment to help you with that.`,
          ts: new Date(),
        };
        setLocalMessages(prev => [...prev, agentMsg]);
      }, 900);
    }
  }, [inputText, onSendText]);

  const isActive =
    voiceStatus === 'listening' ||
    voiceStatus === 'speaking' ||
    voiceStatus === 'thinking';

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isUser = item.role === 'user';
      const prevMsg = messages[index - 1];
      const isFirstInGroup = !prevMsg || prevMsg.role !== item.role;
      const showTime =
        !prevMsg ||
        item.ts.getTime() - prevMsg.ts.getTime() > 3 * 60000;

      return (
        <View>
          {showTime && (
            <Text style={s.tsLabel}>{formatTime(item.ts)}</Text>
          )}
          <View
            style={[
              s.bubbleRow,
              isUser ? s.bubbleRowRight : s.bubbleRowLeft,
            ]}
          >
            {!isUser && isFirstInGroup && (
              <MiniOrbThumb src={meta.videoSrc} size={26} />
            )}
            {!isUser && !isFirstInGroup && (
              <View style={{ width: 26 }} />
            )}

            {isUser ? (
              <LinearGradient
                colors={meta.bubbleGrad}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={[s.bubble, s.bubbleUser]}
              >
                <Text style={s.bubbleText}>{item.text}</Text>
              </LinearGradient>
            ) : (
              <View style={[s.bubble, s.bubbleAgent]}>
                <Text style={s.bubbleText}>{item.text}</Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [messages, meta]
  );

  // -------------------------------------------------------------------------
  // VOICE VIEW
  // -------------------------------------------------------------------------
  if (view === 'voice') {
    return (
      <View style={s.voiceRoot}>
        {/* Ambient glow spot */}
        <View
          style={[
            s.ambientGlow,
            { backgroundColor: meta.glow },
            Platform.OS === 'web'
              ? ({ filter: 'blur(90px)' } as any)
              : {},
          ]}
        />

        {/* Agent header */}
        <View style={s.voiceHeader}>
          <Text style={s.agentName}>{meta.name}</Text>
          <Text style={s.agentSub}>{meta.subtitle}</Text>
        </View>

        {/* Real video orb — 280px, centered, video already has built-in glow */}
        <View style={s.orbContainer}>
          <OrbVideo
            src={meta.videoSrc}
            size={280}
            glow={meta.glow}
            voiceStatus={voiceStatus}
          />
        </View>

        {/* Status */}
        <Text style={s.statusText}>{statusLabel(voiceStatus)}</Text>

        {/* Controls row */}
        <View style={s.controls}>
          {/* Reset */}
          <Pressable
            style={({ pressed }) => [s.sideBtn, pressed && s.pressed]}
            onPress={() => {
              playClickSound();
              Haptics.impactAsync(
                Haptics.ImpactFeedbackStyle.Light
              ).catch(() => {});
            }}
          >
            <Ionicons
              name="refresh"
              size={22}
              color="rgba(255,255,255,0.65)"
            />
          </Pressable>

          {/* Mic */}
          <Pressable
            style={({ pressed }) => [s.micBtn, pressed && s.pressed]}
            onPress={handleMic}
          >
            <LinearGradient
              colors={meta.micGrad}
              start={{ x: 0.15, y: 0.1 }}
              end={{ x: 0.85, y: 0.9 }}
              style={s.micGrad}
            >
              <Ionicons
                name={isActive ? 'stop' : 'mic'}
                size={28}
                color="#FFF"
              />
            </LinearGradient>
            {isActive && (
              <View
                style={[
                  s.micRing,
                  {
                    borderColor: meta.micGrad[0],
                    ...(Platform.OS === 'web'
                      ? ({
                          boxShadow: `0 0 20px ${meta.micGrad[0]}66`,
                        } as any)
                      : {}),
                  },
                ]}
              />
            )}
          </Pressable>

          {/* Chat */}
          <Pressable
            style={({ pressed }) => [s.sideBtn, pressed && s.pressed]}
            onPress={switchToChat}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={22}
              color="rgba(255,255,255,0.65)"
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // CHAT VIEW
  // -------------------------------------------------------------------------
  return (
    <View style={s.chatRoot}>
      {/* Subtle ambient glow */}
      <View
        style={[
          s.chatAmbient,
          { backgroundColor: meta.glow },
          Platform.OS === 'web'
            ? ({ filter: 'blur(60px)' } as any)
            : {},
        ]}
      />

      {/* Header */}
      <View style={s.chatHeader}>
        <Pressable onPress={switchToVoice} style={s.backBtn}>
          <Ionicons
            name="chevron-back"
            size={20}
            color="rgba(255,255,255,0.75)"
          />
        </Pressable>
        <MiniOrbThumb src={meta.videoSrc} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={s.chatName}>{meta.name}</Text>
          <Text style={s.chatSub}>AI Chat</Text>
        </View>
      </View>

      <View style={s.chatDivider} />

      {/* Messages */}
      <FlatList<ChatMessage>
        ref={chatRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={s.msgList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          chatRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <OrbVideo
              src={meta.videoSrc}
              size={72}
              glow={meta.glow}
            />
            <Text style={s.emptyTitle}>Chat with {meta.name}</Text>
            <Text style={s.emptySub}>
              {meta.subtitle} — ask me anything
            </Text>
          </View>
        }
      />

      {/* Thinking indicator — shown while agent processes */}
      {isThinking && (
        <View style={s.thinkingRow}>
          <MiniOrbThumb src={meta.videoSrc} size={24} />
          <Text style={s.thinkingText}>{meta.name} is thinking…</Text>
        </View>
      )}

      {/* Compose */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.composeBar}>
          <TextInput
            style={s.composeInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Message ${meta.name}…`}
            placeholderTextColor="rgba(255,255,255,0.28)"
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          {inputText.trim().length > 0 && (
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [s.sendBtn, pressed && s.pressed]}
            >
              <LinearGradient
                colors={meta.chatGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.sendGrad}
              >
                <Ionicons name="arrow-up" size={18} color="#FFF" />
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  // ---- VOICE ----
  voiceRoot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },

  ambientGlow: {
    position: 'absolute',
    top: -60,
    width: 400,
    height: 400,
    borderRadius: 200,
    zIndex: 0,
    opacity: 0,
  },

  voiceHeader: {
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 1,
  },

  agentName: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  agentSub: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  orbContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  statusText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    marginTop: 24,
    marginBottom: 32,
    letterSpacing: 0.2,
    zIndex: 1,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    zIndex: 1,
  },

  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  micGrad: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  micRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 41,
    borderWidth: 2,
  },

  pressed: {
    transform: [{ scale: 0.93 }],
    opacity: 0.85,
  },

  // ---- CHAT ----
  chatRoot: {
    flex: 1,
    backgroundColor: '#000',
  },

  chatAmbient: {
    position: 'absolute',
    top: 0,
    left: '30%',
    width: 240,
    height: 240,
    borderRadius: 120,
    zIndex: 0,
    opacity: 0.5,
  },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 1,
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  chatName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  chatSub: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
  },

  chatDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  msgList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 14,
  },

  emptyTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 17,
    fontWeight: '600',
  },

  emptySub: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  thinkingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontStyle: 'italic',
  },

  tsLabel: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
    marginVertical: 10,
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 5,
    gap: 8,
  },

  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },

  bubbleRowRight: {
    justifyContent: 'flex-end',
  },

  bubble: {
    maxWidth: '76%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  bubbleUser: {
    borderBottomRightRadius: 5,
  },

  bubbleAgent: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderBottomLeftRadius: 5,
  },

  bubbleText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
  },

  composeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    zIndex: 1,
  },

  composeInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    color: '#FFF',
    fontSize: 14,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  sendGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export function AgentWidget(props: any) {
  return (
    <PageErrorBoundary pageName="agent-widget">
      <AgentWidgetInner {...props} />
    </PageErrorBoundary>
  );
}
