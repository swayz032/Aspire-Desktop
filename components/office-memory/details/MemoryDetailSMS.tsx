/**
 * MemoryDetailSMS — premium iMessage-fidelity SMS thread.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Contact rail (avatar · name · phone · last seen)     │
 *   │                                                       │
 *   │ <ChatBubbleStream messages={...} />                   │
 *   │   ─ owner side: Aspire-blue gradient bubbles         │
 *   │   ─ contact side: dark gray bubbles                   │
 *   │   ─ time separators · delivery status · MMS thumbs    │
 *   │                                                       │
 *   │ ╭─────────────────────────────────────────────────╮  │
 *   │ │ Composer  [TextInput] ─────────── [Send] (Y)    │  │
 *   │ ╰─────────────────────────────────────────────────╯  │
 *   │ Yellow-tier confirm modal ▸ "Send to +1 555…?"        │
 *   └──────────────────────────────────────────────────────┘
 *
 * Framer notes (§12.1):
 *   - The composer floats at the bottom with a subtle elevated shadow + 1px
 *     hairline — it reads as a fixed station, not a content row. Mirrors
 *     iMessage's bottom dock.
 *   - Send button is the rare "filled" button on this surface — earns a
 *     primary CTA treatment because the action is Yellow-tier.
 *   - Yellow-tier confirm modal slides up with spring physics; backdrop
 *     dims the thread but never hides it (so you remember who you're texting).
 *   - Empty thread state: faded SMS icon at 14% opacity + "No messages yet.
 *     Replies will land here." — §12.1 personality.
 *   - `onSendSMS` is wired in Pass 17. For now it resolves to a mock + appends
 *     a local "sending" bubble so the UX feels real to the demo.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { ChatBubbleStream } from '../blocks/ChatBubbleStream';
import type { ChatMessage } from '../blocks/ChatBubbleStream';
import { injectMemoryKeyframes } from '../cardAnimations';

injectMemoryKeyframes();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemoryDetailSMSProps {
  memory: MemoryDetail;
  /**
   * Wired in Pass 17 — backend SMS send. Resolves on success, rejects on fail.
   * For the Pass 15 demo, the component falls back to a local mock that
   * resolves after ~600ms so the UX feels real.
   */
  onSendSMS?: (body: string) => Promise<void>;
}

interface LocalDraftMessage {
  id: string;
  direction: 'outbound';
  body: string;
  ts: string;
  status: 'sending' | 'sent' | 'failed';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLastSeen(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'Active now';
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Active ${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Last seen yesterday';
  if (diffDays < 7) return `Last seen ${diffDays}d ago`;
  return `Last seen ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MemoryDetailSMS({ memory, onSendSMS }: MemoryDetailSMSProps) {
  const contact = memory.contact ?? {
    name: memory.entity?.name ?? 'Unknown',
    phone: '',
  };

  // Combine server messages + local drafts (sending/sent/failed appended below)
  const serverMessages = (memory.messages ?? []) as ChatMessage[];
  const [drafts, setDrafts] = useState<LocalDraftMessage[]>([]);
  const allMessages: ChatMessage[] = React.useMemo(() => {
    return [
      ...serverMessages,
      ...drafts.map<ChatMessage>((d) => ({
        id: d.id,
        direction: d.direction,
        body: d.body,
        ts: d.ts,
        // Map our local 'sending' state to 'sent' for the bubble stream — the
        // optimistic bubble appears immediately; backend ack lands in Pass 17.
        status: d.status === 'sending' ? 'sent' : d.status,
      })),
    ];
  }, [serverMessages, drafts]);

  // Composer state
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length > 0 && !sending;

  // Modal slide-up animation
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: confirmOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [confirmOpen, slide]);

  const handleAttemptSend = () => {
    if (!canSend) return;
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!trimmedDraft) return;
    const id = `draft_${Date.now()}`;
    const ts = new Date().toISOString();
    setConfirmOpen(false);
    setSending(true);
    setDrafts((prev) => [
      ...prev,
      { id, direction: 'outbound', body: trimmedDraft, ts, status: 'sending' },
    ]);
    setDraft('');

    try {
      if (onSendSMS) {
        await onSendSMS(trimmedDraft);
      } else {
        // Mock — Pass 17 will replace this.
        await new Promise<void>((resolve) => setTimeout(resolve, 620));
      }
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'sent' } : d)),
      );
    } catch {
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'failed' } : d)),
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleCancelConfirm = () => setConfirmOpen(false);

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = allMessages.length === 0;

  return (
    <View style={styles.root}>
      {/* Contact rail */}
      <View style={styles.contactRail}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactInitials}>{initialsFor(contact.name)}</Text>
        </View>
        <View style={styles.contactBody}>
          <Text style={styles.contactName} numberOfLines={1}>
            {contact.name}
          </Text>
          {!!contact.phone && (
            <View style={styles.contactPhoneRow}>
              <Ionicons name="call-outline" size={11} color={Colors.text.tertiary} />
              <Text style={styles.contactPhone} numberOfLines={1}>
                {contact.phone}
              </Text>
            </View>
          )}
          {!!memory.date && (
            <Text style={styles.contactSubtle}>{formatLastSeen(memory.date)}</Text>
          )}
        </View>
        <View style={styles.contactBadge}>
          <Ionicons name="chatbubbles-outline" size={12} color="#34D399" />
          <Text style={styles.contactBadgeText}>SMS THREAD</Text>
        </View>
      </View>

      {/* Thread */}
      <View style={styles.thread}>
        {isEmpty ? (
          <View style={styles.empty}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={48}
              color="rgba(255,255,255,0.14)"
            />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>
              Replies from {contact.name.split(' ')[0]} will land here.
              You can also start the conversation below.
            </Text>
          </View>
        ) : (
          <ChatBubbleStream
            messages={allMessages}
            eyebrow={`Conversation with ${contact.name}`}
          />
        )}
      </View>

      {/* Composer dock */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.composerWrap}
      >
        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={`iMessage to ${contact.name.split(' ')[0]}`}
            placeholderTextColor={Colors.text.muted}
            style={styles.input}
            multiline
            blurOnSubmit
            returnKeyType="default"
            accessibilityLabel="Message body"
            editable={!sending}
            {...(Platform.OS === 'web'
              ? ({ outlineWidth: 0, outlineStyle: 'none' } as any)
              : {})}
          />
          <Pressable
            onPress={handleAttemptSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && canSend && styles.sendBtnPressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="arrow-up"
                size={18}
                color={canSend ? '#fff' : Colors.text.muted}
              />
            )}
          </Pressable>
        </View>
        <View style={styles.composerHintRow}>
          <View style={styles.yellowDot} />
          <Text style={styles.composerHint}>
            Yellow-tier · approval required before send
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Yellow-tier confirm modal */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConfirm}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCancelConfirm}>
          <Animated.View
            style={[
              styles.modalSheet,
              {
                opacity: slide,
                transform: [
                  {
                    translateY: slide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation?.()}>
              <View style={styles.modalHead}>
                <View style={styles.yellowChip}>
                  <Ionicons name="shield-checkmark-outline" size={12} color="#FBBF24" />
                  <Text style={styles.yellowChipText}>YELLOW TIER</Text>
                </View>
                <Text style={styles.modalTitle}>Send SMS?</Text>
                <Text style={styles.modalSub}>
                  Outbound to{' '}
                  <Text style={styles.modalSubMono}>{contact.phone || contact.name}</Text>
                </Text>
              </View>

              <View style={styles.previewBubble}>
                <Text style={styles.previewBody}>{trimmedDraft}</Text>
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={handleCancelConfirm}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalBtnGhost,
                    pressed && styles.modalBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmSend}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalBtnPrimary,
                    pressed && styles.modalBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm and send"
                >
                  <Ionicons name="paper-plane" size={14} color="#fff" />
                  <Text style={styles.modalBtnPrimaryText}>Send Message</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    gap: 20,
    minWidth: 0,
  },

  // Contact rail
  contactRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.4,
  },
  contactBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  contactPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  contactPhone: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
  },
  contactSubtle: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.3,
  },
  contactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
  },
  contactBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 1.4,
  },

  // Thread
  thread: {
    minHeight: 360,
    backgroundColor: '#0a0a0c',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: -0.1,
    marginTop: 8,
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.muted,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
  },

  // Composer dock
  composerWrap: {
    gap: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 8,
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 6px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.40,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }),
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 1px 6px rgba(59,130,246,0.45), 0 0 0 1px rgba(59,130,246,0.35)',
          transition: 'transform 120ms ease-out',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.5,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }),
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'none', cursor: 'default' } as unknown as ViewStyle)
      : {}),
  },
  sendBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  composerHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  yellowDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#FBBF24',
  },
  composerHint: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.2,
  },

  // Confirm modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(6px)' } as unknown as ViewStyle)
      : {}),
  },
  modalSheet: {
    width: '100%' as unknown as number,
    maxWidth: 440,
    backgroundColor: '#141417',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 24,
    gap: 20,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.55,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 16 },
          elevation: 12,
        }),
  },
  modalHead: { gap: 8 },
  yellowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.30)',
  },
  yellowChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 1.4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  modalSubMono: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
  },
  previewBubble: {
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderRadius: 18,
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-end',
    maxWidth: '90%' as unknown as number,
  },
  previewBody: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.primary,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    minHeight: 40,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  modalBtnPressed: { opacity: 0.78 },
  modalBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalBtnGhostText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 6px rgba(59,130,246,0.45), 0 0 0 1px rgba(59,130,246,0.40)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.5,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }),
  },
  modalBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
});

// Suppress unused-import lint for Spacing while we hold it for future polish
void Spacing;

export default MemoryDetailSMS;
