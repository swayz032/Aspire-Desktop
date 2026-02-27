import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/tokens';

/* ── Types ─────────────────────────────────────── */

type ChatMsg = {
  id: string;
  from: 'finn' | 'user';
  text: string;
  attachments?: Array<{ id: string; name: string; kind: string; url?: string }>;
  runId?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  chat: ChatMsg[];
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  scrollRef: React.RefObject<ScrollView>;
};

/* ── Constants ─────────────────────────────────── */

const SLIDE_DURATION = 340;
const GLASS_BG = 'rgba(14, 14, 18, 0.82)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.07)';
const GLASS_BORDER_LUMINOUS = 'rgba(255, 255, 255, 0.12)';
const DRAG_HANDLE_WIDTH = 36;
const DRAG_HANDLE_HEIGHT = 4;
const CHAT_HEIGHT_PERCENT = '45%';

const FINN_CYAN = '#3B82F6';
const FINN_CYAN_DIM = 'rgba(59, 130, 246, 0.12)';
const FINN_CYAN_MED = 'rgba(59, 130, 246, 0.22)';
const FINN_CYAN_BRIGHT = 'rgba(59, 130, 246, 0.55)';
const USER_BUBBLE_BG = 'rgba(59, 130, 246, 0.18)';
const USER_BUBBLE_BORDER = 'rgba(59, 130, 246, 0.28)';
const FINN_BUBBLE_BG = 'rgba(255, 255, 255, 0.04)';
const FINN_BUBBLE_BORDER = 'rgba(255, 255, 255, 0.06)';

const STYLE_ID = 'finn-video-chat-overlay-css';

/* ── Web-only CSS class helper ─────────────────── */

const WEB_EMPTY = {} as ViewStyle;

function wc(className: string): ViewStyle {
  if (Platform.OS !== 'web') return WEB_EMPTY;
  return { className } as unknown as ViewStyle;
}

/* ── Web CSS keyframes (injected once) ──────────── */

function injectWebStyles(): void {
  if (Platform.OS !== 'web') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes finnChatHandlePulse {
      0%, 100% { opacity: 0.3; width: 36px; }
      50% { opacity: 0.55; width: 40px; }
    }
    @keyframes finnChatBadgeGlow {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(59,130,246,0),
                    0 0 4px rgba(59,130,246,0.15);
      }
      50% {
        box-shadow: 0 0 0 3px rgba(59,130,246,0.12),
                    0 0 8px rgba(59,130,246,0.25);
      }
    }
    @keyframes finnChatMsgFadeIn {
      0% { opacity: 0; transform: translateY(8px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes finnChatSendPulse {
      0% { transform: scale(1); }
      50% { transform: scale(0.92); }
      100% { transform: scale(1); }
    }
    @keyframes finnChatInputFocus {
      0% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 2px rgba(59,130,246,0.2), 0 0 12px rgba(59,130,246,0.08); }
    }
    @keyframes finnChatEmptyPulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.65; }
    }
    .finn-chat-handle {
      animation: finnChatHandlePulse 3s ease-in-out infinite;
    }
    .finn-chat-badge {
      animation: finnChatBadgeGlow 2.4s ease-in-out infinite;
    }
    .finn-chat-msg-row {
      animation: finnChatMsgFadeIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .finn-chat-msg-row:nth-child(1)  { animation-delay: 0s; }
    .finn-chat-msg-row:nth-child(2)  { animation-delay: 0.04s; }
    .finn-chat-msg-row:nth-child(3)  { animation-delay: 0.04s; }
    .finn-chat-msg-row:nth-child(4)  { animation-delay: 0.08s; }
    .finn-chat-msg-row:nth-child(5)  { animation-delay: 0.12s; }
    .finn-chat-msg-row:nth-child(6)  { animation-delay: 0.16s; }
    .finn-chat-msg-row:nth-child(7)  { animation-delay: 0.2s; }
    .finn-chat-msg-row:nth-child(8)  { animation-delay: 0.24s; }
    .finn-chat-msg-row:nth-child(9)  { animation-delay: 0.28s; }
    .finn-chat-msg-row:nth-child(10) { animation-delay: 0.32s; }
    .finn-chat-send-btn:active {
      animation: finnChatSendPulse 0.18s ease-out;
    }
    .finn-chat-input:focus {
      animation: finnChatInputFocus 0.2s ease-out forwards;
      border-color: rgba(59,130,246,0.35) !important;
      background: rgba(255,255,255,0.08) !important;
    }
    .finn-chat-close-btn {
      transition: background-color 0.15s ease, transform 0.15s ease;
    }
    .finn-chat-close-btn:hover {
      background-color: rgba(255,255,255,0.1) !important;
      transform: scale(1.08);
    }
    .finn-chat-send-btn {
      transition: background-color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
    }
    .finn-chat-send-btn:hover {
      transform: scale(1.06);
    }
    .finn-chat-empty-icon {
      animation: finnChatEmptyPulse 3s ease-in-out infinite;
    }
    .finn-chat-bubble-user {
      transition: transform 0.12s ease;
    }
    .finn-chat-bubble-user:hover {
      transform: translateX(-2px);
    }
    .finn-chat-bubble-finn {
      transition: transform 0.12s ease;
    }
    .finn-chat-bubble-finn:hover {
      transform: translateX(2px);
    }
  `;
  document.head.appendChild(style);
}

function removeWebStyles(): void {
  if (Platform.OS !== 'web') return;
  const el = document.getElementById(STYLE_ID);
  if (el) el.remove();
}

/* ── Component ─────────────────────────────────── */

export function FinnVideoChatOverlay({
  visible,
  onClose,
  chat,
  input,
  onChangeInput,
  onSend,
  scrollRef,
}: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [sendPressed, setSendPressed] = useState(false);

  /* Inject / clean up web CSS */
  useEffect(() => {
    injectWebStyles();
    return () => removeWebStyles();
  }, []);

  /* Slide animation -- spring in, timing out */
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        damping: 22,
        stiffness: 260,
        mass: 0.9,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    setSendPressed(true);
    setTimeout(() => setSendPressed(false), 180);
    onSend();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [onSend, scrollRef, input]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), SLIDE_DURATION + 50);
    }
  }, [visible, scrollRef]);

  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const hasInput = input.trim().length > 0;

  return (
    <View style={styles.root}>
      {/* Dimming backdrop -- tapping dismisses chat */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={styles.backdropPress}
          onPress={onClose}
          accessibilityLabel="Close chat overlay"
          accessibilityRole="button"
        />
      </Animated.View>

      {/* Slide-up chat panel */}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateY }] },
        ]}
      >
        {/* Top luminous edge -- gradient glow line */}
        <View style={styles.panelTopEdge} />

        {/* Noise texture overlay for depth (web only) */}
        {Platform.OS === 'web' && <View style={styles.noiseOverlay} />}

        {/* Drag handle */}
        <Pressable
          style={styles.handleArea}
          onPress={onClose}
          accessibilityLabel="Drag to close chat"
          accessibilityRole="button"
        >
          <View style={[styles.handle, wc('finn-chat-handle')]} />
        </Pressable>

        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.finnBadge, wc('finn-chat-badge')]}>
              <View style={styles.finnBadgeInner}>
                <Ionicons name="sparkles" size={11} color={FINN_CYAN} />
              </View>
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>Finn</Text>
              <Text style={styles.headerSubtitle}>Finance AI</Text>
            </View>
          </View>
          <Pressable
            style={[styles.closeBtn, wc('finn-chat-close-btn')]}
            onPress={onClose}
            accessibilityLabel="Close chat"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={15} color={Colors.text.tertiary} />
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageArea}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {chat.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, wc('finn-chat-empty-icon')]}>
                <Ionicons name="chatbubbles-outline" size={22} color={Colors.text.disabled} />
              </View>
              <Text style={styles.emptyTitle}>
                Start a conversation
              </Text>
              <Text style={styles.emptyText}>
                Message Finn while on your video call for financial insights, quick lookups, or task requests.
              </Text>
            </View>
          ) : (
            chat.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.msgRow,
                  msg.from === 'user' && styles.msgRowUser,
                  wc('finn-chat-msg-row'),
                ]}
              >
                {msg.from === 'finn' && (
                  <View style={styles.finnAvatar}>
                    <Ionicons name="sparkles" size={9} color={FINN_CYAN} />
                  </View>
                )}
                <View
                  style={[
                    styles.msgBubble,
                    msg.from === 'user'
                      ? styles.msgBubbleUser
                      : styles.msgBubbleFinn,
                    wc(msg.from === 'user' ? 'finn-chat-bubble-user' : 'finn-chat-bubble-finn'),
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      msg.from === 'user' && styles.msgTextUser,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Separator glow between messages and input */}
        <View style={styles.inputSeparator} />

        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={onChangeInput}
            placeholder="Message Finn..."
            placeholderTextColor={Colors.text.muted}
            style={[styles.input, wc('finn-chat-input')]}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            accessibilityLabel="Chat message input"
          />
          <Pressable
            style={[
              styles.sendBtn,
              hasInput && styles.sendBtnActive,
              sendPressed && styles.sendBtnPressed,
              wc('finn-chat-send-btn'),
            ]}
            onPress={handleSend}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Ionicons
              name="arrow-up"
              size={15}
              color={hasInput ? '#fff' : Colors.text.muted}
            />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* ── Styles ────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    justifyContent: 'flex-end',
  } as Record<string, unknown>,

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  } as Record<string, unknown>,

  backdropPress: {
    flex: 1,
  },

  panel: {
    height: CHAT_HEIGHT_PERCENT,
    minHeight: 260,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: GLASS_BG,
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: GLASS_BORDER,
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(40px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
          boxShadow: [
            '0 -12px 48px rgba(0,0,0,0.6)',
            '0 -2px 16px rgba(0,0,0,0.4)',
            'inset 0 1px 0 rgba(255,255,255,0.06)',
          ].join(', '),
        }
      : {}),
  } as Record<string, unknown>,

  panelTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 2,
    ...(Platform.OS === 'web'
      ? {
          background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.25) 20%, rgba(255,255,255,0.15) 50%, rgba(59,130,246,0.25) 80%, transparent 100%)',
        }
      : {
          backgroundColor: GLASS_BORDER_LUMINOUS,
        }),
  } as Record<string, unknown>,

  noiseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.025,
    zIndex: 1,
    ...(Platform.OS === 'web'
      ? {
          pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }
      : {}),
  } as Record<string, unknown>,

  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: Spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'grab' } : {}),
  } as Record<string, unknown>,

  handle: {
    width: DRAG_HANDLE_WIDTH,
    height: DRAG_HANDLE_HEIGHT,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: 2,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerTextCol: {
    flexDirection: 'column',
    gap: 1,
  },

  finnBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: FINN_CYAN_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },

  finnBadgeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    ...(Platform.OS === 'web' ? { letterSpacing: '-0.01em' } : {}),
  } as Record<string, unknown>,

  headerSubtitle: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '500',
    ...(Platform.OS === 'web' ? { letterSpacing: '0.04em' } : {}),
  } as Record<string, unknown>,

  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  } as Record<string, unknown>,

  messageArea: {
    flex: 1,
  },

  messageContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 6,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
  },

  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  emptyTitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    ...(Platform.OS === 'web' ? { letterSpacing: '-0.01em' } : {}),
  } as Record<string, unknown>,

  emptyText: {
    color: Colors.text.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },

  msgRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-end',
    paddingVertical: 2,
  },

  msgRowUser: {
    flexDirection: 'row-reverse',
  },

  finnAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: FINN_CYAN_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },

  msgBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  } as Record<string, unknown>,

  msgBubbleUser: {
    backgroundColor: USER_BUBBLE_BG,
    borderWidth: 1,
    borderColor: USER_BUBBLE_BORDER,
    borderBottomRightRadius: 4,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: 'inset 0 1px 0 rgba(59,130,246,0.08), 0 1px 3px rgba(0,0,0,0.15)',
        }
      : {}),
  } as Record<string, unknown>,

  msgBubbleFinn: {
    backgroundColor: FINN_BUBBLE_BG,
    borderWidth: 1,
    borderColor: FINN_BUBBLE_BORDER,
    borderBottomLeftRadius: 4,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 3px rgba(0,0,0,0.12)',
        }
      : {}),
  } as Record<string, unknown>,

  msgText: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
    ...(Platform.OS === 'web' ? { letterSpacing: '0.005em' } : {}),
  } as Record<string, unknown>,

  msgTextUser: {
    color: '#A5C8FD',
  },

  inputSeparator: {
    height: 1,
    marginHorizontal: Spacing.lg,
    ...(Platform.OS === 'web'
      ? {
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 15%, rgba(255,255,255,0.06) 85%, transparent)',
        }
      : {
          backgroundColor: GLASS_BORDER,
        }),
  } as Record<string, unknown>,

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md + 2,
  },

  input: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: Spacing.lg,
    color: Colors.text.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
        }
      : {}),
  } as Record<string, unknown>,

  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: FINN_CYAN_MED,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },

  sendBtnActive: {
    backgroundColor: FINN_CYAN,
    borderColor: FINN_CYAN_BRIGHT,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 0 12px rgba(59,130,246,0.3), 0 2px 6px rgba(0,0,0,0.2)',
        }
      : {}),
  } as Record<string, unknown>,

  sendBtnPressed: {
    ...(Platform.OS !== 'web'
      ? { transform: [{ scale: 0.92 }] }
      : {}),
  } as Record<string, unknown>,
});
