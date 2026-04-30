/**
 * ChatBubbleStream — iMessage-style SMS thread.
 *
 * Layout:
 *   ─── Today, 2:14 PM ───
 *
 *               Hey, can you confirm?    ▸
 *                 sent 2:14 PM ✓
 *
 *   ◂  Yes, on my way.
 *      delivered 2:16 PM
 *
 * Editorial details per §12.1:
 *   - Outbound (owner) bubbles: Aspire-blue, right-aligned, white text.
 *   - Inbound (contact) bubbles: dark gray, left-aligned, primary text.
 *   - Time separators ("Today, 2:14 PM") appear when a gap > 30min between
 *     consecutive messages so the thread reads like a transcript, not a wall
 *     of bubbles.
 *   - Status pills under outbound bubbles (sent / delivered / read / failed)
 *     in 11/500 muted text. Failed = red.
 *   - Inline media tiles (mediaUrls) preview below the body text.
 *   - Bubble entrance: `aspire-bubble-in` keyframe (web) for a soft pop-in.
 */

import React, { useMemo } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { injectMemoryKeyframes } from '../cardAnimations';

injectMemoryKeyframes();

export interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  /** ISO datetime string */
  ts: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  mediaUrls?: string[];
}

export interface ChatBubbleStreamProps {
  messages: ChatMessage[];
  /** Eyebrow override (default: "Conversation"). */
  eyebrow?: string;
  /** Empty-state copy override. */
  emptyMessage?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function fmtSeparator(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const datePart = isToday
    ? 'Today'
    : isYesterday
    ? 'Yesterday'
    : `${months[d.getMonth()]} ${d.getDate()}`;
  return `${datePart}, ${fmtBubbleTime(iso)}`;
}

const STATUS_LABEL: Record<NonNullable<ChatMessage['status']>, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ChatBubbleStream({
  messages,
  eyebrow = 'Conversation',
  emptyMessage = 'No messages yet. Replies will land here as the thread grows.',
}: ChatBubbleStreamProps) {
  // Compute separator break-points. A separator appears before a message when
  // the gap from the prior message exceeds 30 min OR it's the first message.
  const grouped = useMemo(() => {
    const result: Array<{ separator?: string; msg: ChatMessage }> = [];
    let prevTs: number | null = null;
    for (const msg of messages) {
      const t = new Date(msg.ts).getTime();
      const showSeparator =
        prevTs === null || (Number.isFinite(t) && t - prevTs > 30 * 60 * 1000);
      if (showSeparator) result.push({ separator: fmtSeparator(msg.ts), msg });
      else result.push({ msg });
      if (Number.isFinite(t)) prevTs = t;
    }
    return result;
  }, [messages]);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={32} color={Colors.text.muted as string} />
          </View>
          <Text style={styles.emptyTitle}>Quiet so far</Text>
          <Text style={styles.emptyBody}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.thread}>
          {grouped.map(({ separator, msg }, idx) => {
            const isOut = msg.direction === 'outbound';
            return (
              <React.Fragment key={msg.id}>
                {separator && (
                  <View style={styles.separatorRow} accessibilityRole="header">
                    <View style={styles.separatorLine} />
                    <Text style={styles.separatorText}>{separator}</Text>
                    <View style={styles.separatorLine} />
                  </View>
                )}
                <View
                  style={[styles.bubbleRow, isOut ? styles.bubbleRowOut : styles.bubbleRowIn]}
                  accessibilityRole="text"
                  accessibilityLabel={`${isOut ? 'Sent' : 'Received'}: ${msg.body}`}
                  {...(Platform.OS === 'web' && idx === grouped.length - 1
                    ? ({ className: 'aspire-bubble-in' } as object)
                    : {})}
                >
                  <View
                    style={[
                      styles.bubble,
                      isOut ? styles.bubbleOut : styles.bubbleIn,
                      msg.status === 'failed' && styles.bubbleFailed,
                    ]}
                  >
                    <Text style={[styles.bubbleText, isOut ? styles.bubbleTextOut : styles.bubbleTextIn]}>
                      {msg.body}
                    </Text>

                    {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                      <View style={styles.mediaRow}>
                        {msg.mediaUrls.map((url, mi) => (
                          <View key={`${msg.id}-media-${mi}`} style={styles.mediaTile}>
                            {Platform.OS === 'web' ? (
                              <Image
                                source={{ uri: url }}
                                style={styles.mediaImg}
                                accessibilityLabel="Inline image"
                              />
                            ) : (
                              <View style={styles.mediaImg}>
                                <Ionicons
                                  name="image-outline"
                                  size={20}
                                  color={Colors.text.tertiary as string}
                                />
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={[styles.statusRow, isOut ? styles.statusRowOut : styles.statusRowIn]}>
                    <Text style={styles.statusText}>
                      {fmtBubbleTime(msg.ts)}
                      {msg.status ? ` · ${STATUS_LABEL[msg.status]}` : ''}
                    </Text>
                    {msg.status === 'read' && (
                      <Ionicons name="checkmark-done" size={11} color={'#93C5FD'} />
                    )}
                    {msg.status === 'delivered' && (
                      <Ionicons name="checkmark-done" size={11} color={Colors.text.muted as string} />
                    )}
                    {msg.status === 'sent' && (
                      <Ionicons name="checkmark" size={11} color={Colors.text.muted as string} />
                    )}
                    {msg.status === 'failed' && (
                      <Ionicons name="alert-circle" size={11} color={Colors.semantic.error as string} />
                    )}
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
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
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  thread: {
    gap: 8,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 14,
    paddingHorizontal: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  separatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted as string,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  bubbleRow: {
    maxWidth: '78%',
    gap: 4,
  },
  bubbleRowOut: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleRowIn: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    gap: 8,
  },
  bubbleOut: {
    backgroundColor: Colors.accent.cyan as string,
    borderBottomRightRadius: 6,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 12px rgba(59,130,246,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }),
  },
  bubbleIn: {
    backgroundColor: '#1F1F23',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderBottomLeftRadius: 6,
  },
  bubbleFailed: {
    backgroundColor: 'rgba(255,59,48,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.55)',
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.05,
  },
  bubbleTextOut: {
    color: '#FFFFFF',
  },
  bubbleTextIn: {
    color: Colors.text.primary as string,
  },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mediaTile: {
    width: 120,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  statusRowOut: {
    justifyContent: 'flex-end',
  },
  statusRowIn: {
    justifyContent: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted as string,
    letterSpacing: 0.1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary as string,
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 19,
  },
});

export default ChatBubbleStream;
