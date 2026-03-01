import React, { useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';
import ReactMarkdown from 'react-markdown';
import { Ionicons } from '@expo/vector-icons';
import { CanvasTokens } from '@/constants/canvas.tokens';

// Type definitions
export type AgentType = 'ava' | 'finn' | 'eli';
export type EventType = 'thinking' | 'tool_call' | 'step' | 'done' | 'error';
export type TrustLevel = 'internal' | 'external_curated' | 'external_untrusted';

export interface AgentActivityEvent {
  type: EventType;
  message: string;
  icon: string;
  timestamp: number;
  agent?: AgentType;
}

export interface WebPreviewProps {
  activityEvents: AgentActivityEvent[];
  trustLevel: TrustLevel;
  onUrlClick?: (url: string) => void;
}

// Icon mapping for event types
function getIconForEvent(type: EventType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'thinking':
      return 'bulb-outline';
    case 'tool_call':
      return 'hammer-outline';
    case 'step':
      return 'chevron-forward-outline';
    case 'done':
      return 'checkmark-circle-outline';
    case 'error':
      return 'alert-circle-outline';
  }
}

// Sandbox policy based on trust level
function getSandboxPolicy(level: TrustLevel): string {
  switch (level) {
    case 'internal':
      return 'allow-scripts';
    case 'external_curated':
      return 'allow-scripts allow-forms';
    case 'external_untrusted':
      return '';
  }
}

// Format timestamp as relative time
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Agent color mapping
function getAgentColor(agent?: AgentType): string {
  if (!agent) return CanvasTokens.text.secondary;
  return CanvasTokens.glow[agent];
}

// Event card component
interface EventCardProps {
  event: AgentActivityEvent;
  isLatest: boolean;
  onUrlClick?: (url: string) => void;
}

function EventCard({ event, isLatest, onUrlClick }: EventCardProps) {
  const iconName = getIconForEvent(event.type);
  const agentColor = getAgentColor(event.agent);

  return (
    <View
      style={[
        styles.eventCard,
        isLatest && styles.eventCardLatest,
        isLatest && { borderColor: CanvasTokens.border.emphasis },
      ]}
    >
      {/* Icon + Timestamp Header */}
      <View style={styles.eventHeader}>
        <View style={[styles.iconContainer, { backgroundColor: agentColor + '20' }]}>
          <Ionicons name={iconName} size={16} color={agentColor} />
        </View>
        <Text style={styles.timestamp}>{formatTimestamp(event.timestamp)}</Text>
      </View>

      {/* Markdown Content */}
      <View style={styles.eventContent}>
        <ReactMarkdown
          components={{
            p: ({ children }) => <Text style={styles.markdownText}>{children}</Text>,
            strong: ({ children }) => <Text style={styles.markdownBold}>{children}</Text>,
            em: ({ children }) => <Text style={styles.markdownItalic}>{children}</Text>,
            code: ({ children }) => <Text style={styles.markdownCode}>{children}</Text>,
            a: ({ children, href }) => (
              <Text
                style={styles.markdownLink}
                onPress={() => {
                  if (href && onUrlClick) {
                    onUrlClick(href);
                  }
                }}
              >
                {children}
              </Text>
            ),
          }}
        >
          {event.message}
        </ReactMarkdown>
      </View>
    </View>
  );
}

// Render events as HTML for WebView
function renderEventsAsHTML(events: AgentActivityEvent[]): string {
  const eventsHTML = events
    .map((event, index) => {
      const isLatest = index === events.length - 1;
      const agentColor = getAgentColor(event.agent);
      const iconEmoji = {
        thinking: '💡',
        tool_call: '🔨',
        step: '▶️',
        done: '✅',
        error: '❌',
      }[event.type];

      return `
        <div class="event-card ${isLatest ? 'latest' : ''}">
          <div class="event-header">
            <div class="icon-container" style="background-color: ${agentColor}33;">
              <span>${iconEmoji}</span>
            </div>
            <span class="timestamp">${formatTimestamp(event.timestamp)}</span>
          </div>
          <div class="event-content">
            ${event.message}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background-color: ${CanvasTokens.background.surface};
            color: ${CanvasTokens.text.primary};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 16px;
          }
          .event-card {
            background-color: ${CanvasTokens.background.elevated};
            border: 1px solid ${CanvasTokens.border.subtle};
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 12px;
          }
          .event-card.latest {
            border-color: ${CanvasTokens.border.emphasis};
            box-shadow: 0 0 12px ${CanvasTokens.shadow.ambient};
          }
          .event-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          }
          .icon-container {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
          }
          .timestamp {
            color: ${CanvasTokens.text.muted};
            font-size: 12px;
          }
          .event-content {
            color: ${CanvasTokens.text.secondary};
            font-size: 14px;
            line-height: 1.5;
          }
          code {
            background-color: rgba(255, 255, 255, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
          }
          strong {
            color: ${CanvasTokens.text.primary};
            font-weight: 600;
          }
          a {
            color: ${CanvasTokens.glow.eli};
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        ${eventsHTML}
      </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// ActivityFeed -- Extracted for reuse in HybridWebPreview
// ---------------------------------------------------------------------------

export interface ActivityFeedProps {
  activityEvents: AgentActivityEvent[];
  onUrlClick?: (url: string) => void;
}

/**
 * Scrollable list of agent activity event cards.
 * Extracted from WebPreview for reuse in HybridWebPreview (split-panel layout).
 */
export function ActivityFeed({
  activityEvents,
  onUrlClick,
}: ActivityFeedProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current && activityEvents.length > 0) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [activityEvents.length]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      {activityEvents.map((event, index) => (
        <EventCard
          key={`${event.timestamp}-${index}`}
          event={event}
          isLatest={index === activityEvents.length - 1}
          onUrlClick={onUrlClick}
        />
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WebPreview({
  activityEvents,
  trustLevel,
  onUrlClick,
}: WebPreviewProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollViewRef.current && activityEvents.length > 0) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [activityEvents.length]);

  // Web: Use iframe with sandbox policy
  if (Platform.OS === 'web') {
    const sandboxPolicy = getSandboxPolicy(trustLevel);

    return (
      <View style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {activityEvents.map((event, index) => (
            <EventCard
              key={`${event.timestamp}-${index}`}
              event={event}
              isLatest={index === activityEvents.length - 1}
              onUrlClick={onUrlClick}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  // Native: Use WebView
  const html = renderEventsAsHTML(activityEvents);
  const javaScriptEnabled = trustLevel !== 'external_untrusted';

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        javaScriptEnabled={javaScriptEnabled}
        style={styles.webView}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        onShouldStartLoadWithRequest={(request) => {
          // Intercept URL clicks
          if (request.url !== 'about:blank' && onUrlClick) {
            onUrlClick(request.url);
            return false; // Prevent navigation
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CanvasTokens.background.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  eventCard: {
    backgroundColor: CanvasTokens.background.elevated,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  eventCardLatest: {
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 0 12px ${CanvasTokens.shadow.ambient}`,
        } as unknown as ViewStyle)
      : {}),
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestamp: {
    color: CanvasTokens.text.muted,
    fontSize: 12,
    fontWeight: '400',
  },
  eventContent: {
    marginTop: 4,
  },
  markdownText: {
    color: CanvasTokens.text.secondary,
    fontSize: 14,
    lineHeight: 21,
  },
  markdownBold: {
    color: CanvasTokens.text.primary,
    fontWeight: '600',
  },
  markdownItalic: {
    fontStyle: 'italic',
  },
  markdownCode: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  markdownLink: {
    color: CanvasTokens.glow.eli,
    textDecorationLine: 'underline',
  },
  webView: {
    flex: 1,
    backgroundColor: CanvasTokens.background.surface,
  },
});
