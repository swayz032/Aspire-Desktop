/**
 * MessagePartRenderer — Renders Vercel AI SDK UIMessage parts.
 *
 * Maps AI SDK part types to Aspire chat components:
 *   - reasoning → Reasoning (collapsible thinking, auto-open while streaming)
 *   - text → MessageBubble-style text (agent-colored bubble)
 *
 * This replaces the custom ChainOfThought + manual SSE event → ActivityEvent
 * pipeline with native AI SDK parts.
 */

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Platform,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';
import type { AgentId } from './types';
import { AGENT_COLORS } from './types';
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from './Reasoning';
import { copyToClipboard } from '@/lib/clipboard';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import type { UIMessage } from 'ai';

// ---------------------------------------------------------------------------
// Avatar Registry (shared with MessageBubble)
// ---------------------------------------------------------------------------

const AGENT_AVATARS: Partial<Record<AgentId, any>> = {
  ava: require('@/assets/avatars/ava.png'),
  finn: require('@/assets/avatars/finn.png'),
  eli: require('@/assets/avatars/eli-avatar.png'),
  nora: require('@/assets/avatars/nora.png'),
  sarah: require('@/assets/avatars/sarah.png'),
  quinn: require('@/assets/avatars/quinn.png'),
  clara: require('@/assets/avatars/clara.png'),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessagePartRendererProps {
  /** The AI SDK UIMessage to render. */
  message: UIMessage;
  /** Agent identity for theming. */
  agent: AgentId;
  /** Show avatar on agent messages. */
  showAvatar?: boolean;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitial(agent: AgentId): string {
  return agent.charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function MessagePartRendererInner({
  message,
  agent,
  showAvatar = true,
  style,
}: MessagePartRendererProps) {
  const isUser = message.role === 'user';
  const agentColor = AGENT_COLORS[agent] ?? Colors.accent.cyan;
  const avatarSource = AGENT_AVATARS[agent];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Gather reasoning and text from parts
  const reasoningParts = useMemo(
    () => message.parts.filter((p): p is Extract<typeof p, { type: 'reasoning' }> => p.type === 'reasoning'),
    [message.parts],
  );
  const textParts = useMemo(
    () => message.parts.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text'),
    [message.parts],
  );

  const fullText = textParts.map((p) => p.text).join('\n');
  const reasoningText = reasoningParts.map((p) => p.text).join('\n');
  const hasReasoning = reasoningParts.length > 0 && reasoningText.length > 0;
  const isStreaming = reasoningParts.some((p) => (p as any).state === 'streaming') || textParts.some((p) => (p as any).state === 'streaming');
  const isReasoningStreaming = reasoningParts.some((p) => (p as any).state === 'streaming');

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(fullText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [fullText]);

  const webHoverProps =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};

  // User messages — simple right-aligned bubble
  if (isUser) {
    return (
      <Animated.View style={[s.bubbleRow, s.bubbleRowUser, { opacity: fadeAnim }, style]}>
        <View style={[s.bubbleContentWrapper, s.bubbleContentUser]}>
          <View style={[s.bubble, s.bubbleUser]}>
            <Text style={[s.bubbleText, s.bubbleTextUser]} selectable>
              {fullText}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  // Agent messages — avatar + reasoning + text bubble
  return (
    <Animated.View
      style={[s.bubbleRow, s.bubbleRowAgent, { opacity: fadeAnim }, style]}
      {...(webHoverProps as Record<string, unknown>)}
    >
      {/* Avatar */}
      {showAvatar && (
        <View style={s.avatarContainer}>
          {avatarSource ? (
            <Image
              source={avatarSource}
              style={s.bubbleAvatar}
              accessibilityLabel={`${agent} avatar`}
            />
          ) : (
            <View style={[s.avatarFallback, { backgroundColor: `${agentColor}33` }]}>
              <Text style={[s.avatarInitial, { color: agentColor }]}>
                {getInitial(agent)}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={s.bubbleContentWrapper}>
        {/* Agent name */}
        <View style={s.nameRow}>
          <Text style={[s.agentName, { color: agentColor }]}>
            {agent.charAt(0).toUpperCase() + agent.slice(1)}
          </Text>
        </View>

        {/* Reasoning — collapsible thinking */}
        {hasReasoning && (
          <Reasoning
            agent={agent}
            isStreaming={isReasoningStreaming}
            style={{ marginBottom: 4 }}
          >
            <ReasoningTrigger />
            <ReasoningContent>{reasoningText}</ReasoningContent>
          </Reasoning>
        )}

        {/* Text bubble — only show when there's text content */}
        {fullText.length > 0 && (
          <View style={[s.bubble, s.bubbleAgent, { borderLeftColor: agentColor }]}>
            <Text style={[s.bubbleText, s.bubbleTextAgent]} selectable>
              {fullText}
            </Text>
          </View>
        )}

        {/* Streaming indicator when no text yet */}
        {fullText.length === 0 && isStreaming && (
          <View style={s.streamingPlaceholder}>
            <View style={[s.streamingDot, { backgroundColor: agentColor }]} />
            <View style={[s.streamingDot, { backgroundColor: agentColor, opacity: 0.6 }]} />
            <View style={[s.streamingDot, { backgroundColor: agentColor, opacity: 0.3 }]} />
          </View>
        )}

        {/* Meta row: copy */}
        {fullText.length > 0 && (
          <View style={s.metaRow}>
            {(Platform.OS !== 'web' || hovered) && (
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
                  color={copied ? (Colors.semantic.success as string) : Colors.text.muted}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Export with error boundary
// ---------------------------------------------------------------------------

export const MessagePartRenderer = React.memo(function MessagePartRenderer(
  props: MessagePartRendererProps,
) {
  return (
    <PageErrorBoundary pageName="message-part-renderer">
      <MessagePartRendererInner {...props} />
    </PageErrorBoundary>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const webCursorDefault =
  Platform.OS === 'web'
    ? ({ cursor: 'default' } as unknown as ViewStyle)
    : {};

const s = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    maxWidth: '88%' as unknown as number,
    ...webCursorDefault,
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  bubbleRowAgent: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
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
  bubbleContentWrapper: {
    flex: 1,
  },
  bubbleContentUser: {
    alignItems: 'flex-end',
  },
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
  bubbleText: {
    ...Typography.caption,
  },
  bubbleTextUser: {
    color: '#ffffff',
  },
  bubbleTextAgent: {
    color: Colors.text.secondary,
  },
  streamingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  copyButton: {
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
