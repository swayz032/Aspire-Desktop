/**
 * WebPreview â€” SDK-quality Browser Preview Panel
 *
 * AI Elements SDK-inspired browser chrome with:
 * - Navigation bar: back/forward/reload + URL field + console toggle
 * - Preview body: iframe (web) or activity feed (native/fallback)
 * - Collapsible console panel: color-coded logs with timestamps
 *
 * Backward compatible: all original exports preserved.
 * When no URL is set, falls back to ActivityFeed (agent event cards).
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';
import ReactMarkdown from 'react-markdown';
import { Ionicons } from '@expo/vector-icons';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors } from '@/constants/tokens';

// ---------------------------------------------------------------------------
// Type definitions (backward compatible)
// ---------------------------------------------------------------------------

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

export interface ConsoleLogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: Date;
}

export interface WebPreviewProps {
  /** Activity events from orchestrator SSE */
  activityEvents?: AgentActivityEvent[];
  /** Trust level for sandbox policy */
  trustLevel?: TrustLevel;
  /** Callback when a URL link is clicked */
  onUrlClick?: (url: string) => void;
  /** Default URL to load in the preview iframe */
  defaultUrl?: string;
  /** Callback when URL changes */
  onUrlChange?: (url: string) => void;
  /** Console log entries */
  consoleLogs?: ConsoleLogEntry[];
}

// ---------------------------------------------------------------------------
// Icon mapping for event types
// ---------------------------------------------------------------------------

function getIconForEvent(type: EventType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'thinking': return 'bulb-outline';
    case 'tool_call': return 'hammer-outline';
    case 'step': return 'chevron-forward-outline';
    case 'done': return 'checkmark-circle-outline';
    case 'error': return 'alert-circle-outline';
  }
}

// Sandbox policy based on trust level
function getSandboxPolicy(level: TrustLevel): string {
  switch (level) {
    case 'internal': return 'allow-scripts allow-same-origin';
    case 'external_curated': return 'allow-scripts allow-forms';
    case 'external_untrusted': return '';
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

// ---------------------------------------------------------------------------
// NavButton â€” individual navigation button
// ---------------------------------------------------------------------------

function NavButton({
  icon,
  onPress,
  disabled = false,
  size = 16,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.navBtn,
        disabled && s.navBtnDisabled,
        pressed && !disabled && s.navBtnPressed,
      ]}
      accessibilityRole="button"
    >
      <Ionicons
        name={icon}
        size={size}
        color={disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)'}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// NavigationBar â€” back/forward/reload + URL + console toggle
// ---------------------------------------------------------------------------

function NavigationBar({
  url,
  onUrlSubmit,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReload,
  consoleOpen,
  onToggleConsole,
  consoleErrorCount,
  consoleWarnCount,
}: {
  url: string;
  onUrlSubmit: (url: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
  consoleErrorCount: number;
  consoleWarnCount: number;
}) {
  const [inputUrl, setInputUrl] = useState(url);

  useEffect(() => {
    setInputUrl(url);
  }, [url]);

  const handleSubmit = () => {
    let finalUrl = inputUrl.trim();
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }
    if (finalUrl) onUrlSubmit(finalUrl);
  };

  return (
    <View style={s.navBar}>
      {/* Navigation buttons */}
      <View style={s.navBtnGroup}>
        <NavButton icon="chevron-back" onPress={onBack} disabled={!canGoBack} />
        <NavButton icon="chevron-forward" onPress={onForward} disabled={!canGoForward} />
        <NavButton icon="reload" onPress={onReload} />
      </View>

      {/* URL field */}
      <View style={s.urlFieldContainer}>
        <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.3)" style={s.urlLock} />
        <TextInput
          style={s.urlInput as any}
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={handleSubmit}
          placeholder="Enter URL..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus
        />
      </View>

      {/* Console toggle + badges */}
      <View style={s.navBtnGroup}>
        {consoleErrorCount > 0 && (
          <View style={[s.consoleBadge, s.consoleBadgeError]}>
            <Text style={s.consoleBadgeText}>{consoleErrorCount}</Text>
          </View>
        )}
        {consoleWarnCount > 0 && (
          <View style={[s.consoleBadge, s.consoleBadgeWarn]}>
            <Text style={s.consoleBadgeText}>{consoleWarnCount}</Text>
          </View>
        )}
        <NavButton
          icon={consoleOpen ? 'terminal' : 'terminal-outline'}
          onPress={onToggleConsole}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ConsolePanel â€” collapsible log panel
// ---------------------------------------------------------------------------

function ConsolePanel({
  logs,
  isOpen,
}: {
  logs: ConsoleLogEntry[];
  isOpen: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current && logs.length > 0) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [logs.length, isOpen]);

  if (!isOpen) return null;

  return (
    <View style={s.consolePanel}>
      {/* Console header */}
      <View style={s.consoleHeader}>
        <Text style={s.consoleTitle}>Console</Text>
        <Text style={s.consoleCount}>{logs.length} entries</Text>
      </View>

      {/* Console body */}
      <ScrollView ref={scrollRef} style={s.consoleBody}>
        {logs.length === 0 ? (
          <Text style={s.consoleEmpty}>No console output</Text>
        ) : (
          logs.map((log, i) => (
            <View key={i} style={s.consoleRow}>
              <Text style={s.consoleTimestamp}>
                {log.timestamp.toLocaleTimeString('en-US', { hour12: false })}
              </Text>
              <View
                style={[
                  s.consoleLevelBadge,
                  log.level === 'error' && s.consoleLevelError,
                  log.level === 'warn' && s.consoleLevelWarn,
                ]}
              >
                <Text
                  style={[
                    s.consoleLevelText,
                    log.level === 'error' && { color: '#EF4444' },
                    log.level === 'warn' && { color: '#F59E0B' },
                  ]}
                >
                  {log.level}
                </Text>
              </View>
              <Text
                style={[
                  s.consoleMessage,
                  log.level === 'error' && { color: '#EF4444' },
                  log.level === 'warn' && { color: '#F59E0B' },
                ]}
                numberOfLines={3}
              >
                {log.message}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EventCard â€” activity feed card (preserved from original)
// ---------------------------------------------------------------------------

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
        s.eventCard,
        isLatest && s.eventCardLatest,
        isLatest && { borderColor: CanvasTokens.border.emphasis },
      ]}
    >
      <View style={s.eventHeader}>
        <View style={[s.iconContainer, { backgroundColor: agentColor + '20' }]}>
          <Ionicons name={iconName} size={16} color={agentColor} />
        </View>
        <Text style={s.timestamp}>{formatTimestamp(event.timestamp)}</Text>
      </View>
      <View style={s.eventContent}>
        <ReactMarkdown
          components={{
            p: ({ children }) => <Text style={s.markdownText}>{children}</Text>,
            strong: ({ children }) => <Text style={s.markdownBold}>{children}</Text>,
            em: ({ children }) => <Text style={s.markdownItalic}>{children}</Text>,
            code: ({ children }) => <Text style={s.markdownCode}>{children}</Text>,
            a: ({ children, href }) => (
              <Text
                style={s.markdownLink}
                onPress={() => { if (href && onUrlClick) onUrlClick(href); }}
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

// ---------------------------------------------------------------------------
// ActivityFeed â€” extracted for reuse in HybridWebPreview
// ---------------------------------------------------------------------------

export interface ActivityFeedProps {
  activityEvents: AgentActivityEvent[];
  onUrlClick?: (url: string) => void;
}

export function ActivityFeed({ activityEvents, onUrlClick }: ActivityFeedProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current && activityEvents.length > 0) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [activityEvents.length]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={s.scrollView}
      contentContainerStyle={s.scrollContent}
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
// PreviewBody â€” iframe (web) or activity feed fallback
// ---------------------------------------------------------------------------

function PreviewBody({
  url,
  trustLevel,
  activityEvents,
  onUrlClick,
}: {
  url: string;
  trustLevel: TrustLevel;
  activityEvents: AgentActivityEvent[];
  onUrlClick?: (url: string) => void;
}) {
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !url) return;
    setIframeBlocked(false);
    setIframeLoading(true);
    const timeout = setTimeout(() => {
      setIframeLoading((loading) => {
        if (loading) {
          setIframeBlocked(true);
          return false;
        }
        return loading;
      });
    }, 6500);
    return () => clearTimeout(timeout);
  }, [url]);

  if (!url) {
    if (activityEvents.length > 0) {
      return <ActivityFeed activityEvents={activityEvents} onUrlClick={onUrlClick} />;
    }
    return (
      <View style={s.emptyBody}>
        <Ionicons name="globe-outline" size={48} color="rgba(255,255,255,0.15)" />
        <Text style={s.emptyTitle}>No URL loaded</Text>
        <Text style={s.emptySub}>Enter a URL above or wait for agent activity</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    if (iframeBlocked) {
      return (
        <View style={s.emptyBody}>
          <Ionicons name="warning-outline" size={38} color="rgba(96,165,250,0.75)" />
          <Text style={s.emptyTitle}>Site cannot be embedded</Text>
          <Text style={s.emptySub}>This domain blocked preview. Live agent screenshots will appear during web tasks.</Text>
          {activityEvents.length > 0 && (
            <View style={{ width: '100%', maxHeight: 220 }}>
              <ActivityFeed activityEvents={activityEvents} onUrlClick={onUrlClick} />
            </View>
          )}
        </View>
      );
    }

    const sandbox = getSandboxPolicy(trustLevel);
    return (
      <View style={s.iframeContainer}>
        {iframeLoading && (
          <View style={s.iframeLoadingOverlay}>
            <Text style={s.iframeLoadingText}>Loading preview...</Text>
          </View>
        )}
        <iframe
          src={url}
          sandbox={sandbox}
          onLoad={() => setIframeLoading(false)}
          onError={() => {
            setIframeLoading(false);
            setIframeBlocked(true);
          }}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#1E1E1E',
          }}
          title="Web Preview"
        />
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: url }}
      javaScriptEnabled={trustLevel !== 'external_untrusted'}
      style={s.webView}
      scrollEnabled
      showsVerticalScrollIndicator
      onShouldStartLoadWithRequest={(request) => {
        if (request.url !== url && onUrlClick) {
          onUrlClick(request.url);
          return false;
        }
        return true;
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main WebPreview component
// ---------------------------------------------------------------------------

export function WebPreview({
  activityEvents = [],
  trustLevel = 'internal',
  onUrlClick,
  defaultUrl = '',
  onUrlChange,
  consoleLogs = [],
}: WebPreviewProps) {
  const [currentUrl, setCurrentUrl] = useState(defaultUrl);
  const [history, setHistory] = useState<string[]>(defaultUrl ? [defaultUrl] : []);
  const [historyIndex, setHistoryIndex] = useState(defaultUrl ? 0 : -1);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const navigate = useCallback((url: string) => {
    setCurrentUrl(url);
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(url);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
    onUrlChange?.(url);
  }, [historyIndex, onUrlChange]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentUrl(history[newIndex]);
      onUrlChange?.(history[newIndex]);
    }
  }, [historyIndex, history, onUrlChange]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentUrl(history[newIndex]);
      onUrlChange?.(history[newIndex]);
    }
  }, [historyIndex, history, onUrlChange]);

  const reload = useCallback(() => {
    if (currentUrl) {
      // Force re-render by toggling URL
      const url = currentUrl;
      setCurrentUrl('');
      setTimeout(() => setCurrentUrl(url), 50);
    }
  }, [currentUrl]);

  const errorCount = consoleLogs.filter((l) => l.level === 'error').length;
  const warnCount = consoleLogs.filter((l) => l.level === 'warn').length;

  return (
    <View style={s.container}>
      {/* Navigation bar */}
      <NavigationBar
        url={currentUrl}
        onUrlSubmit={navigate}
        canGoBack={historyIndex > 0}
        canGoForward={historyIndex < history.length - 1}
        onBack={goBack}
        onForward={goForward}
        onReload={reload}
        consoleOpen={consoleOpen}
        onToggleConsole={() => setConsoleOpen((prev) => !prev)}
        consoleErrorCount={errorCount}
        consoleWarnCount={warnCount}
      />

      {/* Preview body */}
      <View style={s.bodyContainer}>
        <PreviewBody
          url={currentUrl}
          trustLevel={trustLevel}
          activityEvents={activityEvents}
          onUrlClick={(url) => {
            navigate(url);
            onUrlClick?.(url);
          }}
        />
      </View>

      {/* Console panel */}
      <ConsolePanel logs={consoleLogs} isOpen={consoleOpen} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CanvasTokens.background.surface,
  },

  // --- Navigation Bar ---
  navBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
    backgroundColor: '#141416',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background-color 0.1s ease' } as unknown as ViewStyle)
      : {}),
  },
  navBtnDisabled: {
    opacity: 0.4,
    ...(Platform.OS === 'web' ? ({ cursor: 'default' } as unknown as ViewStyle) : {}),
  },
  navBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // --- URL Field ---
  urlFieldContainer: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0C0E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
  },
  urlLock: {
    marginRight: 6,
  },
  urlInput: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 0,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none' } as unknown as ViewStyle)
      : {}),
  },

  // --- Console badges ---
  consoleBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  consoleBadgeError: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  consoleBadgeWarn: {
    backgroundColor: 'rgba(245,158,11,0.2)',
  },
  consoleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // --- Preview Body ---
  bodyContainer: {
    flex: 1,
  },
  iframeContainer: {
    flex: 1,
    ...(Platform.OS === 'web' ? {} : {}),
  },
  iframeLoadingOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3,
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iframeLoadingText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
  },
  emptySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
  },

  // --- Console Panel ---
  consolePanel: {
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0C0C0E',
  },
  consoleHeader: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  consoleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  consoleCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  consoleBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  consoleEmpty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 8,
  },
  consoleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  consoleTimestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 60,
    flexShrink: 0,
  },
  consoleLevelBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    width: 36,
    alignItems: 'center',
    flexShrink: 0,
  },
  consoleLevelError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  consoleLevelWarn: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  consoleLevelText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  consoleMessage: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // --- Activity Feed (preserved) ---
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
      ? ({ boxShadow: `0 0 12px ${CanvasTokens.shadow.ambient}` } as unknown as ViewStyle)
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

