/**
 * MessageBubble -- Shared chat message bubble for all agent chat panels.
 *
 * Replaces duplicated MessageBubble implementations in:
 *   - EliVoiceChatPanel (inline MessageBubble ~lines 98-174)
 *   - AvaDeskPanel (inline chat message rendering)
 *   - FinnDeskPanel (inline chat message rendering)
 *
 * Agent messages: left-aligned with avatar + agent color accent.
 * User messages: right-aligned with neutral dark styling.
 *
 * Features:
 *   - Agent-colored left border accent
 *   - Avatar display with fallback initials
 *   - Copy button (hover on web, always visible on agent messages)
 *   - Timestamp display
 *   - Attachment list rendering
 *   - Inline ActivityTimeline for messages with activity events
 *   - Fade-in entrance animation
 *   - Voice indicator (mic icon for voice messages)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  type ViewStyle,
  type ImageSourcePropType,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';
import type { AgentChatMessage, AgentActivityEvent, AgentId } from './types';
import { AGENT_COLORS } from './types';
import { ActivityTimeline } from './ActivityTimeline';

// ---------------------------------------------------------------------------
// Avatar Registry
// ---------------------------------------------------------------------------

/**
 * Map agent IDs to their avatar image sources.
 * Uses require() for static bundling with Metro/Webpack.
 */
const AGENT_AVATARS: Partial<Record<AgentId, ImageSourcePropType>> = {
  ava: require('@/assets/avatars/ava.png'),
  finn: require('@/assets/avatars/finn.png'),
  eli: require('@/assets/avatars/eli-avatar.png'),
  nora: require('@/assets/avatars/nora.png'),
  sarah: require('@/assets/avatars/sarah.png'),
  quinn: require('@/assets/avatars/quinn.png'),
  clara: require('@/assets/avatars/clara.png'),
};

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
  } catch {
    // Silent fail -- clipboard may not be available
  }
  return false;
}

/** Format epoch timestamp to HH:MM. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Get first letter of agent name for avatar fallback. */
function getInitial(agent: AgentId): string {
  return agent.charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  /** The chat message to render. */
  message: AgentChatMessage;
  /** Agent identity for color theming. */
  agent: AgentId;
  /** Show agent avatar on agent messages (default: true). */
  showAvatar?: boolean;
  /** Show timestamp below bubble (default: true). */
  showTimestamp?: boolean;
  /** Callback when user copies message text. */
  onCopy?: (text: string) => void;
  /** Activity events to render inline (from ActiveRun). */
  activityEvents?: AgentActivityEvent[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** File attachment chip. */
const AttachmentChip = React.memo(function AttachmentChip({
  name,
  kind,
}: {
  name: string;
  kind: string;
}) {
  const iconName: keyof typeof Ionicons.glyphMap =
    kind === 'PDF'
      ? 'document-text'
      : kind === 'XLSX' || kind === 'CSV'
        ? 'grid'
        : kind === 'PNG'
          ? 'image'
          : 'document';

  return (
    <View style={s.attachmentChip}>
      <Ionicons name={iconName} size={14} color={Colors.text.tertiary} />
      <Text style={s.attachmentName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const MessageBubble = React.memo(function MessageBubble({
  message,
  agent,
  showAvatar = true,
  showTimestamp = true,
  onCopy,
  activityEvents,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isUser = message.from === 'user';
  const agentColor = AGENT_COLORS[agent] ?? Colors.accent.cyan;
  const avatarSource = AGENT_AVATARS[agent];
  const hasAttachments =
    message.attachments && message.attachments.length > 0;
  // Ava uses ChainOfThought for reasoning; suppress inline activity timeline boxes.
  const hasActivity =
    agent !== 'ava' &&
    activityEvents &&
    activityEvents.length > 0;

  // Fade-in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(message.text);
    if (ok) {
      setCopied(true);
      onCopy?.(message.text);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [message.text, onCopy]);

  // Web hover handlers
  const webHoverProps =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};

  return (
    <Animated.View
      style={[
        s.bubbleRow,
        isUser ? s.bubbleRowUser : s.bubbleRowAgent,
        { opacity: fadeAnim },
      ]}
      {...(webHoverProps as Record<string, unknown>)}
    >
      {/* Agent avatar (left side) */}
      {!isUser && showAvatar && (
        <View style={s.avatarContainer}>
          {avatarSource ? (
            <Image
              source={avatarSource}
              style={s.bubbleAvatar}
              accessibilityLabel={`${agent} avatar`}
            />
          ) : (
            <View
              style={[s.avatarFallback, { backgroundColor: `${agentColor}33` }]}
            >
              <Text style={[s.avatarInitial, { color: agentColor }]}>
                {getInitial(agent)}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={[s.bubbleContentWrapper, isUser && s.bubbleContentUser]}>
        {/* Agent name */}
        {!isUser && (
          <View style={s.nameRow}>
            <Text style={[s.agentName, { color: agentColor }]}>
              {message.senderName ||
                agent.charAt(0).toUpperCase() + agent.slice(1)}
            </Text>
            {message.isVoice && (
              <Ionicons
                name="mic"
                size={11}
                color={Colors.text.muted}
                style={s.voiceIcon}
              />
            )}
          </View>
        )}

        {/* Bubble */}
        <View
          style={[
            s.bubble,
            isUser
              ? s.bubbleUser
              : [s.bubbleAgent, { borderLeftColor: agentColor }],
          ]}
        >
          <Text
            style={[
              s.bubbleText,
              isUser ? s.bubbleTextUser : s.bubbleTextAgent,
            ]}
            selectable
          >
            {message.text}
          </Text>

          {/* Attachments */}
          {hasAttachments && (
            <View style={s.attachmentList}>
              {message.attachments!.map((att) => (
                <AttachmentChip key={att.id} name={att.name} kind={att.kind} />
              ))}
            </View>
          )}
        </View>

        {/* Inline activity timeline */}
        {hasActivity && (
          <ActivityTimeline
            events={activityEvents!}
            agent={agent}
            compact
            style={s.inlineTimeline}
          />
        )}

        {/* Meta row: timestamp + copy */}
        <View
          style={[
            s.metaRow,
            isUser ? s.metaRowUser : s.metaRowAgent,
          ]}
        >
          {showTimestamp && message.timestamp != null && (
            <Text style={s.timestamp}>{formatTime(message.timestamp)}</Text>
          )}

          {/* User voice indicator */}
          {isUser && message.isVoice && (
            <Ionicons
              name="mic"
              size={11}
              color={Colors.text.muted}
              style={s.voiceIcon}
            />
          )}

          {/* Copy button -- always visible on agent messages (mobile), hover on web */}
          {!isUser && (Platform.OS !== 'web' || hovered) && (
            <TouchableOpacity
              onPress={handleCopy}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Copied' : 'Copy message'}
              style={s.copyButton}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={13}
                color={
                  copied ? Colors.semantic.success : Colors.text.muted
                }
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const webCursorPointer =
  Platform.OS === 'web'
    ? ({ cursor: 'default' } as unknown as ViewStyle)
    : {};

const s = StyleSheet.create({
  // Row layout
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    maxWidth: '88%' as unknown as number,
    ...webCursorPointer,
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  bubbleRowAgent: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },

  // Avatar
  avatarContainer: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  bubbleAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Content wrapper
  bubbleContentWrapper: {
    flex: 1,
  },
  bubbleContentUser: {
    alignItems: 'flex-end',
  },

  // Agent name
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  agentName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
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
  bubbleAgent: {
    backgroundColor: Colors.surface.cardElevated,
    borderBottomLeftRadius: 4,
    borderLeftWidth: 2,
  },

  // Bubble text
  bubbleText: {
    ...Typography.caption,
  },
  bubbleTextUser: {
    color: '#ffffff',
  },
  bubbleTextAgent: {
    color: Colors.text.secondary,
  },

  // Attachments
  attachmentList: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.sm,
  },
  attachmentName: {
    ...Typography.small,
    color: Colors.text.tertiary,
    flex: 1,
  },

  // Inline timeline
  inlineTimeline: {
    marginTop: Spacing.sm,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  metaRowUser: {
    justifyContent: 'flex-end',
  },
  metaRowAgent: {
    justifyContent: 'flex-start',
  },

  // Timestamp
  timestamp: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '400',
  },

  // Voice icon
  voiceIcon: {
    marginLeft: 2,
  },

  // Copy button
  copyButton: {
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
