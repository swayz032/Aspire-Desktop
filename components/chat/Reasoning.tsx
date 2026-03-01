/**
 * Reasoning -- Collapsible AI reasoning/thinking display.
 *
 * Auto-opens when reasoning is streaming, auto-closes when complete.
 * User can toggle to review reasoning after it finishes.
 *
 * Features:
 *   - Automatic open/close driven by isStreaming prop
 *   - Smooth height animation (CSS transition on web, Animated on native)
 *   - Pulsing streaming indicator
 *   - Agent-colored accent line
 *   - Manual toggle re-expand for review
 *   - Muted visual treatment (secondary to actual response)
 *   - Duration display when reasoning is complete
 *   - Accessible with keyboard navigation
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';
import type { AgentId } from './types';
import { AGENT_COLORS } from './types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration?: number;
  agentColor: string;
}

const ReasoningContext = createContext<ReasoningContextValue>({
  isStreaming: false,
  isOpen: false,
  setIsOpen: () => {},
  agentColor: Colors.accent.cyan,
});

/** Access reasoning context from child components. */
export function useReasoning(): ReasoningContextValue {
  return useContext(ReasoningContext);
}

// ---------------------------------------------------------------------------
// Root: <Reasoning />
// ---------------------------------------------------------------------------

interface ReasoningProps {
  /** Whether reasoning is currently streaming. */
  isStreaming?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Default open state (uncontrolled). */
  defaultOpen?: boolean;
  /** Callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Duration in seconds (shown when reasoning is complete). */
  duration?: number;
  /** Agent identity for accent theming. */
  agent?: AgentId;
  /** Additional container style. */
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const Reasoning = React.memo(function Reasoning({
  isStreaming = false,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  duration,
  agent,
  style,
  children,
}: ReasoningProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? isStreaming);
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const agentColor = agent ? AGENT_COLORS[agent] : Colors.accent.cyan;

  const setIsOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // Auto-open when streaming starts, auto-close when streaming ends
  const prevStreaming = useRef(isStreaming);
  useEffect(() => {
    if (isStreaming && !prevStreaming.current) {
      setIsOpen(true);
    } else if (!isStreaming && prevStreaming.current) {
      setIsOpen(false);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming, setIsOpen]);

  const contextValue = useMemo(
    () => ({ isStreaming, isOpen, setIsOpen, duration, agentColor }),
    [isStreaming, isOpen, setIsOpen, duration, agentColor],
  );

  return (
    <ReasoningContext.Provider value={contextValue}>
      <View
        style={[s.root, { borderLeftColor: `${agentColor}66` }, style]}
        accessibilityRole="none"
        accessibilityLabel="AI reasoning"
      >
        {children}
      </View>
    </ReasoningContext.Provider>
  );
});

// ---------------------------------------------------------------------------
// <ReasoningTrigger />
// ---------------------------------------------------------------------------

interface ReasoningTriggerProps {
  /** Custom thinking message function. */
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => React.ReactNode;
  style?: ViewStyle;
}

export const ReasoningTrigger = React.memo(function ReasoningTrigger({
  getThinkingMessage,
  style,
}: ReasoningTriggerProps) {
  const { isStreaming, isOpen, setIsOpen, duration, agentColor } = useReasoning();

  const defaultMessage = isStreaming
    ? 'Thinking...'
    : duration != null
      ? `Thought for ${duration}s`
      : 'Thought process';

  const displayMessage = getThinkingMessage
    ? getThinkingMessage(isStreaming, duration)
    : defaultMessage;

  return (
    <Pressable
      onPress={() => setIsOpen(!isOpen)}
      style={[s.trigger, style]}
      accessibilityRole="button"
      accessibilityLabel={
        isOpen ? 'Collapse reasoning' : 'Expand reasoning'
      }
      accessibilityState={{ expanded: isOpen }}
    >
      <View style={s.triggerLeft}>
        {/* Streaming pulse indicator */}
        {isStreaming && <StreamingPulse color={agentColor} />}

        {/* Brain/sparkle icon */}
        {!isStreaming && (
          <Ionicons
            name="bulb-outline"
            size={13}
            color={Colors.text.muted}
            style={s.triggerIcon}
          />
        )}

        <Text style={s.triggerText}>{displayMessage}</Text>
      </View>

      <Ionicons
        name={isOpen ? 'chevron-up' : 'chevron-down'}
        size={12}
        color={Colors.text.muted}
      />
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// <ReasoningContent />
// ---------------------------------------------------------------------------

interface ReasoningContentProps {
  /** The reasoning text to display. */
  children: string;
  style?: ViewStyle;
}

export const ReasoningContent = React.memo(function ReasoningContent({
  children,
  style,
}: ReasoningContentProps) {
  const { isOpen } = useReasoning();
  const fadeAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isOpen, fadeAnim]);

  // Web: CSS transition for smooth height
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          s.contentWrapper,
          {
            maxHeight: isOpen ? 2000 : 0,
            overflow: 'hidden',
            opacity: isOpen ? 1 : 0,
            transition: 'max-height 200ms ease-out, opacity 150ms ease-out',
          } as unknown as ViewStyle,
          style,
        ]}
      >
        <View style={s.contentInner}>
          <Text style={s.contentText} selectable>
            {children}
          </Text>
        </View>
      </View>
    );
  }

  // Native: conditional render with fade
  if (!isOpen) return null;

  return (
    <Animated.View style={[s.contentWrapper, { opacity: fadeAnim }, style]}>
      <View style={s.contentInner}>
        <Text style={s.contentText} selectable>
          {children}
        </Text>
      </View>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Internal: Streaming Pulse
// ---------------------------------------------------------------------------

function StreamingPulse({ color }: { color: string }) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: false,
        }),
      ]),
    ).start();

    return () => pulseAnim.stopAnimation();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        s.streamingDot,
        { backgroundColor: color, opacity: pulseAnim },
      ]}
      accessibilityLabel="Streaming"
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const webCursor =
  Platform.OS === 'web'
    ? ({ cursor: 'pointer' } as unknown as ViewStyle)
    : {};

const s = StyleSheet.create({
  // Root
  root: {
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderLeftWidth: 2,
    overflow: 'hidden',
  },

  // Trigger
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
    ...webCursor,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  triggerIcon: {
    marginRight: 1,
  },
  triggerText: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  // Content
  contentWrapper: {},
  contentInner: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  contentText: {
    ...Typography.small,
    color: Colors.text.muted,
    lineHeight: 18,
  },

  // Streaming dot
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
