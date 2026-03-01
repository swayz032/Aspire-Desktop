/**
 * EliVoiceChatPanel -- Premium voice-chat panel for Eli inbox agent.
 *
 * Design: ElevenLabs voice-chat-01 inspired, adapted to Aspire dark glass aesthetic.
 * Card-based layout with header, scrollable message thread, and input footer.
 * Floats over inbox content (absolute positioning, bottom-right).
 *
 * Features:
 *   - Shared MessageBubble (agent-colored with avatar, copy, timestamp)
 *   - Shared ThinkingIndicator (ShimmeringText with Eli amber shimmer)
 *   - Shared ChatInputBar (text input + mic toggle + send)
 *   - Voice mic button with pulse animation
 *   - Entrance slide-up + fade animation
 *   - Glass card aesthetic with depth shadow
 */

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
  type ViewStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Canvas } from '@/constants/tokens';
import {
  MessageBubble,
  ThinkingIndicator,
  ChatInputBar,
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  type AgentActivityEvent,
  type AgentChatMessage,
} from '@/components/chat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 480;
const ELI_AMBER = Canvas.halo.desk.eli.hex; // #F59E0B
const ELI_AMBER_RING = Canvas.halo.desk.eli.ring;

const eliAvatar: ImageSourcePropType = require('@/assets/avatars/eli-avatar.png');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert EliMessage to AgentChatMessage for the shared MessageBubble. */
function toAgentMessage(msg: EliMessage): AgentChatMessage {
  return {
    id: msg.id,
    from: msg.from,
    text: msg.text,
    timestamp: msg.ts,
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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
}: EliVoiceChatPanelProps) {
  // micPulseAnim kept for backward compat -- ChatInputBar handles its own pulse internally.
  void _micPulseAnim;
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Entrance animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(24);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 260,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  // Auto-scroll to bottom when messages change
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

  // Memoize converted messages to avoid re-creating on every render
  const agentMessages = useMemo(
    () => messages.map(toAgentMessage),
    [messages],
  );

  if (!visible) return null;

  const isThinking = voiceActive && !transcript;

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityRole="none"
      accessibilityLabel="Eli voice chat panel"
    >
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarRing}>
            <Image
              source={eliAvatar}
              style={styles.headerAvatar}
              accessibilityLabel="Eli avatar"
            />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName}>Eli</Text>
              {voiceActive && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              {triagedCount} items triaged today
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Close Eli chat"
        >
          <Ionicons name="close" size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* ---- Divider ---- */}
      <View style={styles.divider} />

      {/* ---- Message Thread ---- */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageArea}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {agentMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} agent="eli" />
        ))}

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

        {/* Thinking indicator */}
        {isThinking && (
          <ThinkingIndicator agent="eli" text="Eli is thinking..." />
        )}

        {/* Live transcript */}
        {voiceActive && transcript ? (
          <View style={[styles.transcriptRow]}>
            <Image source={eliAvatar} style={styles.transcriptAvatar} />
            <View style={styles.transcriptBubble}>
              <Ionicons
                name="chatbubble-ellipses"
                size={13}
                color={ELI_AMBER}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.transcriptText} numberOfLines={4}>
                {transcript}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ---- Input Footer (shared ChatInputBar) ---- */}
      <ChatInputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        onMicToggle={onMicPress}
        isMicActive={voiceActive}
        placeholder="Ask Eli anything..."
        agent="eli"
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** Web-only glass card shadow. */
const webGlassShadow = Platform.OS === 'web'
  ? ({
      boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    } as unknown as ViewStyle)
  : {};

const styles = StyleSheet.create({
  // Panel container
  panel: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    backgroundColor: 'rgba(22,22,24,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    zIndex: 101,
    overflow: 'hidden',
    ...Shadows.lg,
    ...webGlassShadow,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ELI_AMBER_RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
  },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ELI_AMBER,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: ELI_AMBER,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.surface.cardBorder,
    marginHorizontal: Spacing.lg,
  },

  // Message area
  messageArea: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // Live transcript (preserved -- unique to Eli)
  transcriptRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '88%' as unknown as number,
    marginBottom: Spacing.md,
  },
  transcriptAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  transcriptBubble: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface.cardElevated,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },
  transcriptText: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
});
