/**
 * ActivityTimeline -- Shared expandable activity step list for all agent chats.
 *
 * Replaces duplicated AvaActivityInline and FinnActivityInline components.
 * Displays orchestrator pipeline events as a vertical timeline with
 * connector lines, status icons, and expand/collapse behavior.
 *
 * Features:
 *   - Auto-collapses when > 3 events
 *   - Running steps show spinner animation
 *   - Agent-themed accent colors
 *   - Smooth fade-in on mount
 *   - Compact mode for inline MessageBubble display
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import type { AgentActivityEvent, AgentId } from './types';
import { AGENT_COLORS } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLAPSE_THRESHOLD = 3;

/** Default icons per event type when no icon override is present. */
const DEFAULT_ICONS: Record<
  AgentActivityEvent['type'],
  keyof typeof Ionicons.glyphMap
> = {
  thinking: 'sparkles',
  step: 'cog',
  tool_call: 'hammer',
  done: 'checkmark-circle',
  error: 'alert-circle',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActivityTimelineProps {
  /** Activity events to display. */
  events: AgentActivityEvent[];
  /** Start collapsed when > threshold events (default: true). */
  collapsed?: boolean;
  /** Agent identity for accent theming. */
  agent?: AgentId;
  /** Compact rendering for inline use within MessageBubble. */
  compact?: boolean;
  /** Additional container style. */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single timeline event row. */
const EventRow = React.memo(function EventRow({
  event,
  accentColor,
  isLast,
  compact,
}: {
  event: AgentActivityEvent;
  accentColor: string;
  isLast: boolean;
  compact: boolean;
}) {
  const isDone = event.type === 'done';
  const isError = event.type === 'error' || event.status === 'error';
  const isActive = event.status === 'active';
  const isCompleted = event.status === 'completed';
  const iconName = event.icon || DEFAULT_ICONS[event.type];

  // Determine icon color
  let iconColor: string = Colors.text.muted;
  if (isDone || isCompleted) iconColor = Colors.semantic.success;
  if (isActive) iconColor = accentColor;
  if (isError) iconColor = Colors.semantic.error;

  // Determine icon background
  let iconBg: string = '#1E1E20';
  if (isDone || isCompleted) iconBg = 'rgba(52,199,89,0.12)';
  if (isActive) iconBg = `${accentColor}1F`; // ~12% opacity
  if (isError) iconBg = 'rgba(255,59,48,0.12)';

  const iconSize = compact ? 10 : 12;
  const wrapSize = compact ? 18 : 22;

  return (
    <View style={[s.eventRow, compact && s.eventRowCompact]}>
      {/* Connector line (except last) */}
      <View style={s.connectorColumn}>
        <View
          style={[
            s.iconWrap,
            { width: wrapSize, height: wrapSize, borderRadius: wrapSize / 3, backgroundColor: iconBg },
          ]}
        >
          <Ionicons name={iconName} size={iconSize} color={iconColor} />
        </View>
        {!isLast && (
          <View
            style={[
              s.connectorLine,
              { backgroundColor: isCompleted || isDone ? Colors.semantic.success : Colors.border.subtle },
            ]}
          />
        )}
      </View>

      {/* Label */}
      <Text
        style={[
          s.eventText,
          compact && s.eventTextCompact,
          isDone && s.eventTextDone,
          isActive && { color: Colors.text.secondary, fontWeight: '500' },
          isError && { color: Colors.semantic.error },
        ]}
        numberOfLines={1}
      >
        {event.label}
      </Text>

      {/* Timestamp */}
      {event.timestamp > 0 && !compact && (
        <Text style={s.eventTime}>
          {new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      )}

      {/* Active spinner */}
      {isActive && <ActiveSpinner color={accentColor} size={compact ? 12 : 14} />}
    </View>
  );
});

/** Spinning indicator for active steps. */
function ActiveSpinner({ color, size }: { color: string; size: number }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      }),
    ).start();
  }, [spinAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        s.spinner,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderTopColor: color,
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ActivityTimeline = React.memo(function ActivityTimeline({
  events,
  collapsed: collapsedProp,
  agent,
  compact = false,
  style,
}: ActivityTimelineProps) {
  const accentColor = agent ? AGENT_COLORS[agent] : Colors.accent.cyan;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Auto-collapse logic
  const shouldAutoCollapse =
    collapsedProp !== undefined ? collapsedProp : events.length > COLLAPSE_THRESHOLD;
  const [isCollapsed, setIsCollapsed] = useState(shouldAutoCollapse);

  // Fade-in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [fadeAnim]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  if (events.length === 0) return null;

  // Filter out 'thinking' type for collapsed display
  const displayEvents = events.filter((e) => e.type !== 'thinking');
  const visibleEvents = isCollapsed
    ? displayEvents.slice(0, COLLAPSE_THRESHOLD)
    : displayEvents;
  const hiddenCount = displayEvents.length - COLLAPSE_THRESHOLD;
  const hasRunning = events.some((e) => e.status === 'active');
  const currentEvent = events[events.length - 1];

  return (
    <Animated.View
      style={[s.container, compact && s.containerCompact, style, { opacity: fadeAnim }]}
      accessibilityRole="none"
      accessibilityLabel={`Activity timeline, ${events.length} steps`}
    >
      {/* Status bar (running indicator) */}
      {hasRunning && currentEvent && (
        <View style={[s.statusBar, compact && s.statusBarCompact]}>
          <View style={s.statusLeft}>
            <ActiveSpinner color={accentColor} size={14} />
            <Text style={s.statusText} numberOfLines={1}>
              {currentEvent.label}
            </Text>
          </View>
          {displayEvents.length > COLLAPSE_THRESHOLD && (
            <Pressable
              onPress={toggleCollapse}
              style={s.toggleBtn}
              accessibilityRole="button"
              accessibilityLabel={isCollapsed ? 'Show more steps' : 'Show fewer steps'}
            >
              <Text style={[s.toggleText, { color: accentColor }]}>
                {isCollapsed ? 'Show details' : 'Hide details'}
              </Text>
              <Ionicons
                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                size={12}
                color={accentColor}
              />
            </Pressable>
          )}
        </View>
      )}

      {/* Event list */}
      {(!hasRunning || !isCollapsed) && (
        <View style={[s.eventList, compact && s.eventListCompact]}>
          {visibleEvents.map((event, idx) => (
            <EventRow
              key={event.id}
              event={event}
              accentColor={accentColor}
              isLast={idx === visibleEvents.length - 1}
              compact={compact}
            />
          ))}
        </View>
      )}

      {/* Expand/collapse toggle (non-running state) */}
      {!hasRunning && hiddenCount > 0 && (
        <Pressable
          onPress={toggleCollapse}
          style={s.expandBar}
          accessibilityRole="button"
          accessibilityLabel={
            isCollapsed
              ? `Show ${hiddenCount} more steps`
              : 'Collapse steps'
          }
        >
          <Text style={[s.expandText, { color: accentColor }]}>
            {isCollapsed
              ? `Show ${hiddenCount} more step${hiddenCount > 1 ? 's' : ''}...`
              : 'Show less'}
          </Text>
          <Ionicons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={12}
            color={accentColor}
          />
        </Pressable>
      )}
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const webTransition =
  Platform.OS === 'web'
    ? ({ transition: 'opacity 300ms ease-out' } as unknown as ViewStyle)
    : {};

const s = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#232325',
    overflow: 'hidden',
    ...webTransition,
  },
  containerCompact: {
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },

  // Status bar (running)
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statusBarCompact: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    flex: 1,
  },

  // Toggle button
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Event list
  eventList: {
    paddingHorizontal: 14,
    paddingBottom: Spacing.md,
    gap: 2,
  },
  eventListCompact: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 0,
  },

  // Event row
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  eventRowCompact: {
    gap: Spacing.sm,
    paddingVertical: 3,
  },

  // Connector column
  connectorColumn: {
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectorLine: {
    width: 1,
    height: 8,
    marginTop: 2,
  },

  // Event text
  eventText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
  },
  eventTextCompact: {
    fontSize: 11,
  },
  eventTextDone: {
    color: Colors.semantic.success,
    fontWeight: '500',
  },

  // Event timestamp
  eventTime: {
    fontSize: 10,
    fontWeight: '400',
    color: Colors.text.muted,
  },

  // Spinner
  spinner: {
    borderWidth: 2,
    borderColor: '#2C2C2E',
    borderTopWidth: 2,
  },

  // Expand bar
  expandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#232325',
  },
  expandText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
