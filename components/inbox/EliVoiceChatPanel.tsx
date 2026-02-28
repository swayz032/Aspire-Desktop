/**
 * EliVoiceChatPanel -- Premium voice-chat panel for Eli inbox agent.
 *
 * Design: ElevenLabs voice-chat-01 inspired, adapted to Aspire dark glass aesthetic.
 * Card-based layout with header, scrollable message thread, and input footer.
 * Floats over inbox content (absolute positioning, bottom-right).
 *
 * Features:
 *   - Message bubbles (user = blue right-aligned, Eli = dark left-aligned with avatar)
 *   - Copy button on Eli messages (web clipboard)
 *   - Voice mic button with pulse animation
 *   - ShimmeringText for processing status
 *   - Entrance slide-up + fade animation
 *   - Glass card aesthetic with depth shadow
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Animated,
  Platform,
  type ViewStyle,
  type TextStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Canvas } from '@/constants/tokens';
import { ShimmeringText } from '@/components/ui/ShimmeringText';

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

/** Copy text to clipboard (web only). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_e) {
    // Silent fail -- clipboard may not be available
  }
  return false;
}

/** Format a timestamp to HH:MM. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single message bubble. */
const MessageBubble = React.memo(function MessageBubble({
  message,
}: {
  message: EliMessage;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.from === 'user';

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [message.text]);

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowEli,
      ]}
    >
      {/* Eli avatar (left side) */}
      {!isUser && (
        <Image
          source={eliAvatar}
          style={styles.bubbleAvatar}
          accessibilityLabel="Eli avatar"
        />
      )}

      <View style={styles.bubbleContentWrapper}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleEli,
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextEli,
            ]}
            selectable
          >
            {message.text}
          </Text>
        </View>

        {/* Meta row: timestamp + copy */}
        <View
          style={[
            styles.bubbleMeta,
            isUser ? styles.bubbleMetaUser : styles.bubbleMetaEli,
          ]}
        >
          <Text style={styles.bubbleTimestamp}>{formatTime(message.ts)}</Text>
          {!isUser && (
            <TouchableOpacity
              onPress={handleCopy}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Copied' : 'Copy message'}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={13}
                color={copied ? Colors.semantic.success : Colors.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

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
  micPulseAnim,
  messages,
}: EliVoiceChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

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

  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === 'Enter') {
        handleSend();
      }
    },
    [handleSend],
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
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Thinking indicator */}
        {isThinking && (
          <View style={[styles.bubbleRow, styles.bubbleRowEli]}>
            <Image source={eliAvatar} style={styles.bubbleAvatar} />
            <View style={styles.bubbleContentWrapper}>
              <View style={[styles.bubble, styles.bubbleEli, styles.bubbleThinking]}>
                {Platform.OS === 'web' ? (
                  <ShimmeringText
                    text="Eli is thinking..."
                    duration={1.8}
                    color={Colors.text.muted}
                    shimmerColor={ELI_AMBER}
                    style={{ fontSize: 13, fontWeight: '500' }}
                  />
                ) : (
                  <Text style={styles.thinkingFallback}>Eli is thinking...</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Live transcript */}
        {voiceActive && transcript ? (
          <View style={[styles.bubbleRow, styles.bubbleRowEli]}>
            <Image source={eliAvatar} style={styles.bubbleAvatar} />
            <View style={styles.bubbleContentWrapper}>
              <View style={[styles.bubble, styles.bubbleEli, styles.bubbleTranscript]}>
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
          </View>
        ) : null}
      </ScrollView>

      {/* ---- Input Footer ---- */}
      <View style={styles.footer}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask Eli anything..."
            placeholderTextColor={Colors.text.muted}
            value={inputText}
            onChangeText={setInputText}
            onKeyPress={handleKeyPress}
            returnKeyType="send"
            editable
            accessibilityLabel="Message input"
            accessibilityHint="Type a message to Eli and press Enter to send"
          />
          {inputText.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleSend}
              style={styles.sendButton}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Ionicons name="arrow-up" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
          <TouchableOpacity
            onPress={onMicPress}
            style={[styles.micButton, voiceActive && styles.micButtonActive]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={voiceActive ? 'End voice session' : 'Start voice session'}
          >
            <Ionicons
              name={voiceActive ? 'mic' : 'mic-outline'}
              size={20}
              color={voiceActive ? '#fff' : ELI_AMBER}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
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

  // Bubble layout
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    maxWidth: '88%' as unknown as number,
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  bubbleRowEli: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  bubbleContentWrapper: {
    flex: 1,
  },

  // Bubble
  bubble: {
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  bubbleUser: {
    backgroundColor: Colors.accent.cyan,
    borderBottomRightRadius: 4,
  },
  bubbleEli: {
    backgroundColor: Colors.surface.cardElevated,
    borderBottomLeftRadius: 4,
  },
  bubbleThinking: {
    paddingVertical: Spacing.md,
  },
  bubbleTranscript: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },

  // Bubble text
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#ffffff',
    fontWeight: '400',
  },
  bubbleTextEli: {
    color: Colors.text.secondary,
    fontWeight: '400',
  },

  // Meta row (timestamp + copy)
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  bubbleMetaUser: {
    justifyContent: 'flex-end',
  },
  bubbleMetaEli: {
    justifyContent: 'flex-start',
  },
  bubbleTimestamp: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '400',
  },

  // Thinking fallback (native)
  thinkingFallback: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  // Live transcript
  transcriptText: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },

  // Input footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surface.cardBorder,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.input,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'web' ? 8 : Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none' } as unknown as TextStyle)
      : {}),
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },

  // Mic button
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surface.input,
    borderWidth: 1.5,
    borderColor: ELI_AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: ELI_AMBER,
    borderColor: ELI_AMBER,
  },
});
