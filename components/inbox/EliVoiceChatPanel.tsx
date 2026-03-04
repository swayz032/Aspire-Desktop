import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Platform,
  TextInput,
  type ViewStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Canvas } from '@/constants/tokens';
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  type AgentActivityEvent,
  type AgentChatMessage,
} from '@/components/chat';

export interface EliMessage {
  id: string;
  from: 'user' | 'eli';
  text: string;
  ts: number;
}

interface EliVoiceChatPanelProps {
  visible: boolean;
  onClose: () => void;
  voiceActive: boolean;
  transcript: string;
  triagedCount: number;
  onMicPress: () => void;
  onSendMessage: (text: string) => void;
  micPulseAnim: Animated.Value;
  messages: EliMessage[];
  activeRun?: { events: AgentActivityEvent[]; status: 'running' | 'completed' } | null;
  embedded?: boolean;
}

const isWeb = Platform.OS === 'web';
const ELI_AMBER = Canvas.halo.desk.eli.hex;
const ELI_AMBER_RING = Canvas.halo.desk.eli.ring;
const eliAvatar: ImageSourcePropType = require('@/assets/avatars/eli-avatar.png');
const ELI_ORB_VIDEO = '/eli-orb.mp4';

function ShimmeringText({ text }: { text: string }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <Animated.Text style={[styles.shimmerText, { opacity }]}>
      {text}
    </Animated.Text>
  );
}

function EliOrb({ voiceActive, size = 40 }: { voiceActive: boolean; size?: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (voiceActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 0.8, duration: 600, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 600, useNativeDriver: false }),
        ])
      );
      pulse.start();
      glow.start();
      return () => { pulse.stop(); glow.stop(); };
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
    }
  }, [voiceActive, pulseAnim, glowAnim]);

  useEffect(() => {
    if (!isWeb || !videoRef.current) return;
    videoRef.current.muted = true;
    videoRef.current.loop = true;
    videoRef.current.playsInline = true;
    videoRef.current.play().catch(() => {});
  }, []);

  return (
    <Animated.View style={[
      styles.orb,
      { width: size, height: size, borderRadius: size / 2 },
      { transform: [{ scale: pulseAnim }] },
    ]}>
      <Animated.View style={[
        styles.orbInner,
        { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 },
        { opacity: glowAnim },
      ]} />
      {isWeb ? (
        <div
          style={{
            width: size - 8,
            height: size - 8,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            border: `1px solid ${ELI_AMBER_RING}`,
          }}
        >
          <video
            ref={videoRef as any}
            src={ELI_ORB_VIDEO}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      ) : (
        <View style={[styles.orbCore, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }]}>
          <Image source={eliAvatar} style={{ width: size - 12, height: size - 12, borderRadius: (size - 12) / 2 }} />
        </View>
      )}
    </Animated.View>
  );
}

function MessageBubbleEli({ message, onCopy }: { message: EliMessage; onCopy: (text: string) => void }) {
  const isUser = message.from === 'user';
  const [hovered, setHovered] = useState(false);

  const timeStr = new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowUser]}
      {...(isWeb ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as any : {})}
    >
      {!isUser && (
        <Image source={eliAvatar} style={styles.msgAvatar} />
      )}
      <View style={[styles.messageBubble, isUser ? styles.messageBubbleUser : styles.messageBubbleAgent]}>
        <Text style={[styles.messageText, isUser && styles.messageTextUser]}>{message.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>{timeStr}</Text>
          {hovered && isWeb && (
            <TouchableOpacity onPress={() => onCopy(message.text)} activeOpacity={0.7} style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={12} color={Colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export function EliVoiceChatPanel({
  visible,
  onClose,
  voiceActive,
  transcript,
  triagedCount,
  onMicPress,
  onSendMessage,
  micPulseAnim: _micPulseAnim,
  messages,
  activeRun,
  embedded = false,
}: EliVoiceChatPanelProps) {
  void _micPulseAnim;
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(24);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 260, mass: 0.9, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
  }, [inputText, onSendMessage]);

  const handleCopy = useCallback((text: string) => {
    if (isWeb && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }, []);

  if (!visible) return null;

  const isThinking = voiceActive && !transcript;
  const isConnected = voiceActive;

  return (
    <Animated.View
      style={[
        embedded ? styles.panelEmbedded : styles.panel,
        !embedded && { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <EliOrb voiceActive={voiceActive} size={40} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>Eli</Text>
            <View style={styles.headerStatusRow}>
              {isConnected ? (
                <Text style={styles.statusConnected}>Connected</Text>
              ) : isThinking ? (
                <ShimmeringText text="Thinking..." />
              ) : (
                <Text style={styles.statusMuted}>{triagedCount > 0 ? `${triagedCount} items triaged` : 'Inbox AI Assistant'}</Text>
              )}
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[
            styles.statusDot,
            isConnected && styles.statusDotConnected,
            isThinking && styles.statusDotThinking,
          ]} />
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 12 }}>
            <Ionicons name="close" size={18} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.heroOrbSection}>
        <EliOrb voiceActive={voiceActive} size={112} />
        <Text style={styles.heroOrbLabel}>
          {isConnected ? 'Eli is listening' : 'Eli ready'}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messageArea}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <EliOrb voiceActive={false} size={48} />
            <Text style={styles.emptyTitle}>Start a conversation</Text>
            <Text style={styles.emptySubtitle}>Ask Eli to help triage, draft replies, or organize your inbox</Text>
          </View>
        ) : (
          messages.map((msg) => (
            <MessageBubbleEli key={msg.id} message={msg} onCopy={handleCopy} />
          ))
        )}

        {activeRun && activeRun.events.length > 0 && (
          <ChainOfThought
            agent="eli"
            isStreaming={activeRun.status === 'running'}
            defaultOpen={activeRun.status === 'running'}
            style={{ marginBottom: 8 }}
          >
            <ChainOfThoughtHeader stepCount={activeRun.events.length}>
              {activeRun.status === 'running' ? 'Thinking...' : 'Chain of Thought'}
            </ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              {activeRun.events.map((event, idx) => (
                <ChainOfThoughtStep
                  key={event.id}
                  label={event.label}
                  icon={event.icon as any}
                  status={
                    event.status === 'completed' || event.type === 'done'
                      ? 'complete'
                      : event.status === 'active'
                      ? 'active'
                      : 'pending'
                  }
                  isLast={idx === activeRun.events.length - 1}
                />
              ))}
            </ChainOfThoughtContent>
          </ChainOfThought>
        )}

        {isThinking && (
          <View style={styles.thinkingRow}>
            <Image source={eliAvatar} style={styles.msgAvatar} />
            <View style={styles.thinkingBubble}>
              <ShimmeringText text="Eli is thinking..." />
            </View>
          </View>
        )}

        {voiceActive && transcript ? (
          <View style={styles.transcriptRow}>
            <Image source={eliAvatar} style={styles.msgAvatar} />
            <View style={styles.transcriptBubble}>
              <Ionicons name="chatbubble-ellipses" size={13} color={ELI_AMBER} style={{ marginRight: 6 }} />
              <Text style={styles.transcriptText} numberOfLines={4}>{transcript}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={Colors.text.disabled}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isThinking}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.3 }]}
            onPress={handleSend}
            activeOpacity={0.7}
            disabled={!inputText.trim() || isThinking}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
          {!isConnected ? (
            <TouchableOpacity style={styles.micBtn} onPress={onMicPress} activeOpacity={0.7}>
              <Ionicons name="mic" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.micBtn, styles.micBtnActive]} onPress={onMicPress} activeOpacity={0.7}>
              <Ionicons name="call" size={16} color={Colors.semantic.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const webGlassShadow = Platform.OS === 'web'
  ? ({
      boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    } as unknown as ViewStyle)
  : {};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: 380,
    height: 480,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 101,
    overflow: 'hidden',
    ...Shadows.lg,
    ...webGlassShadow,
  },
  panelEmbedded: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusConnected: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  statusMuted: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    ...(isWeb ? { transition: 'all 0.3s ease' } : {}),
  } as any,
  statusDotConnected: {
    backgroundColor: '#22C55E',
    ...(isWeb ? { boxShadow: '0 0 8px rgba(34,197,94,0.5)' } : {}),
  } as any,
  statusDotThinking: {
    backgroundColor: ELI_AMBER,
  },

  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  orbInner: {
    position: 'absolute',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  orbCore: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  shimmerText: {
    fontSize: 12,
    color: ELI_AMBER,
    fontWeight: '500',
  },

  messageArea: {
    flex: 1,
  },
  heroOrbSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  heroOrbLabel: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  messageContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    maxWidth: '88%' as unknown as number,
  },
  messageBubbleRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  msgAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 2,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%' as unknown as number,
  },
  messageBubbleAgent: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.12)',
  },
  messageBubbleUser: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
  },
  messageText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  messageTextUser: {
    color: Colors.text.primary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.text.disabled,
  },
  copyBtn: {
    padding: 2,
    ...(isWeb ? { cursor: 'pointer' } : {}),
  } as any,

  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    maxWidth: '88%' as unknown as number,
  },
  thinkingBubble: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.1)',
  },

  transcriptRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '88%' as unknown as number,
    marginBottom: 8,
  },
  transcriptBubble: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.12)',
  },
  transcriptText: {
    fontSize: 13,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(isWeb ? { outlineStyle: 'none' } : {}),
  } as any,
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb ? { cursor: 'pointer', transition: 'opacity 0.2s ease' } : {}),
  } as any,
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb ? { cursor: 'pointer', transition: 'all 0.2s ease' } : {}),
  } as any,
  micBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
});
