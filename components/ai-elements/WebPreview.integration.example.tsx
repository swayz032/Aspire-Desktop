/**
 * Canvas Chat Mode Integration Example
 *
 * Shows how WebPreview integrates with the full Canvas 3-panel layout:
 * - Left: Conversation history
 * - Center: WebPreview (agent activity)
 * - Right: Draft/Receipt preview
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebPreview, AgentActivityEvent } from './WebPreview';
import { CanvasTokens } from '@/constants/canvas.tokens';

// Simulated orchestrator event stream
function useAgentActivityStream() {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);

  useEffect(() => {
    // In production, this would connect to orchestrator WebSocket
    const mockStream = setInterval(() => {
      const mockEvent: AgentActivityEvent = {
        type: 'step',
        message: `Processing step ${events.length + 1}...`,
        icon: 'chevron',
        timestamp: Date.now(),
        agent: events.length % 3 === 0 ? 'ava' : events.length % 3 === 1 ? 'finn' : 'eli',
      };
      setEvents((prev) => [...prev, mockEvent]);
    }, 2000);

    return () => clearInterval(mockStream);
  }, [events.length]);

  return events;
}

// Conversation message type
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Draft preview type
interface Draft {
  type: 'invoice' | 'email' | 'contract';
  title: string;
  content: string;
  status: 'draft' | 'ready' | 'approved';
}

export function CanvasChatModeExample() {
  const activityEvents = useAgentActivityStream();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'user',
      content: 'Create an invoice for Acme Corp',
      timestamp: Date.now() - 10000,
    },
    {
      id: '2',
      role: 'assistant',
      content: "I'll create an invoice for Acme Corp. Let me fetch their details...",
      timestamp: Date.now() - 8000,
    },
  ]);
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Canvas Chat Mode</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.topBarButton}>
            <Ionicons name="settings-outline" size={20} color={CanvasTokens.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarButton}>
            <Ionicons name="close-outline" size={24} color={CanvasTokens.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3-Panel Layout */}
      <View style={styles.panels}>
        {/* Left Panel: Conversation History */}
        <View style={styles.leftPanel}>
          <View style={styles.panelHeader}>
            <Ionicons name="chatbubbles-outline" size={18} color={CanvasTokens.glow.ava} />
            <Text style={styles.panelTitle}>Conversation</Text>
          </View>
          <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.message,
                  msg.role === 'user' ? styles.messageUser : styles.messageAssistant,
                ]}
              >
                <Text style={styles.messageContent}>{msg.content}</Text>
                <Text style={styles.messageTime}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Center Panel: Agent Activity (WebPreview) */}
        <View style={styles.centerPanel}>
          <View style={styles.panelHeader}>
            <Ionicons name="analytics-outline" size={18} color={CanvasTokens.glow.eli} />
            <Text style={styles.panelTitle}>Agent Activity</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activityEvents.length}</Text>
            </View>
          </View>
          <WebPreview
            activityEvents={activityEvents}
            trustLevel="internal"
            onUrlClick={(url) => {
              console.log('[Canvas Chat] URL clicked:', url);
              // In production: orchestrator validates URL before opening
            }}
          />
        </View>

        {/* Right Panel: Draft Preview */}
        <View style={styles.rightPanel}>
          <View style={styles.panelHeader}>
            <Ionicons name="document-text-outline" size={18} color={CanvasTokens.glow.finn} />
            <Text style={styles.panelTitle}>Draft Preview</Text>
          </View>
          {draft ? (
            <ScrollView style={styles.draftPreview}>
              <Text style={styles.draftTitle}>{draft.title}</Text>
              <View
                style={[
                  styles.statusBadge,
                  draft.status === 'draft' && styles.statusDraft,
                  draft.status === 'ready' && styles.statusReady,
                  draft.status === 'approved' && styles.statusApproved,
                ]}
              >
                <Text style={styles.statusText}>{draft.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.draftContent}>{draft.content}</Text>
            </ScrollView>
          ) : (
            <View style={styles.emptyDraft}>
              <Ionicons name="document-outline" size={48} color={CanvasTokens.text.muted} />
              <Text style={styles.emptyText}>No draft yet</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Bar: Status */}
      <View style={styles.bottomBar}>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Ava is working...</Text>
        </View>
        <Text style={styles.statusDetails}>
          {activityEvents.length} events • {messages.length} messages
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CanvasTokens.background.base,
  },
  topBar: {
    height: 56,
    backgroundColor: CanvasTokens.background.surface,
    borderBottomWidth: 1,
    borderBottomColor: CanvasTokens.border.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 12,
  },
  topBarButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panels: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: 320,
    backgroundColor: CanvasTokens.background.surface,
    borderRightWidth: 1,
    borderRightColor: CanvasTokens.border.subtle,
  },
  centerPanel: {
    flex: 1,
    backgroundColor: CanvasTokens.background.base,
  },
  rightPanel: {
    width: 360,
    backgroundColor: CanvasTokens.background.surface,
    borderLeftWidth: 1,
    borderLeftColor: CanvasTokens.border.subtle,
  },
  panelHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: CanvasTokens.border.subtle,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
  },
  badge: {
    backgroundColor: CanvasTokens.glow.eli,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    gap: 12,
  },
  message: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 12,
  },
  messageUser: {
    alignSelf: 'flex-end',
    backgroundColor: CanvasTokens.glow.eli,
  },
  messageAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: CanvasTokens.background.elevated,
  },
  messageContent: {
    fontSize: 14,
    color: CanvasTokens.text.primary,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    color: CanvasTokens.text.muted,
    marginTop: 4,
  },
  draftPreview: {
    flex: 1,
    padding: 16,
  },
  draftTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  statusDraft: {
    backgroundColor: 'rgba(255, 159, 64, 0.2)',
  },
  statusReady: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  statusApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
  },
  draftContent: {
    fontSize: 14,
    color: CanvasTokens.text.secondary,
    lineHeight: 21,
  },
  emptyDraft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: CanvasTokens.text.muted,
  },
  bottomBar: {
    height: 48,
    backgroundColor: CanvasTokens.background.surface,
    borderTopWidth: 1,
    borderTopColor: CanvasTokens.border.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CanvasTokens.glow.ava,
  },
  statusDetails: {
    fontSize: 12,
    color: CanvasTokens.text.muted,
  },
});
