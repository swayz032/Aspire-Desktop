/**
 * WebPreview Visual Demo
 *
 * Interactive demonstration of WebPreview component for Canvas Chat Mode.
 * Shows all event types, agent colors, markdown rendering, and trust levels.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native';
import { WebPreview, AgentActivityEvent, TrustLevel } from './WebPreview';
import { CanvasTokens } from '@/constants/canvas.tokens';

// Sample event sequences
const DEMO_SEQUENCES = {
  thinking: [
    {
      type: 'thinking' as const,
      message: 'Analyzing your invoice request...',
      icon: 'bulb',
      timestamp: Date.now() - 8000,
      agent: 'ava' as const,
    },
    {
      type: 'thinking' as const,
      message: 'Checking **Stripe API** for customer data',
      icon: 'bulb',
      timestamp: Date.now() - 6000,
      agent: 'finn' as const,
    },
  ],
  tools: [
    {
      type: 'tool_call' as const,
      message: 'Calling `stripe.customers.retrieve()`',
      icon: 'hammer',
      timestamp: Date.now() - 5000,
      agent: 'finn' as const,
    },
    {
      type: 'tool_call' as const,
      message: 'Fetching recent invoice history from **QuickBooks**',
      icon: 'hammer',
      timestamp: Date.now() - 4000,
      agent: 'finn' as const,
    },
  ],
  steps: [
    {
      type: 'step' as const,
      message: 'Found customer: **Acme Corp** (ID: `cus_123`)',
      icon: 'chevron',
      timestamp: Date.now() - 3000,
      agent: 'finn' as const,
    },
    {
      type: 'step' as const,
      message: 'Retrieved 12 invoices from last 30 days',
      icon: 'chevron',
      timestamp: Date.now() - 2000,
      agent: 'finn' as const,
    },
  ],
  success: [
    {
      type: 'done' as const,
      message: 'Invoice draft created successfully. Ready for your review.',
      icon: 'checkmark',
      timestamp: Date.now() - 1000,
      agent: 'ava' as const,
    },
  ],
  error: [
    {
      type: 'error' as const,
      message: 'Failed to connect to **Stripe API**. Check credentials.',
      icon: 'alert',
      timestamp: Date.now() - 500,
      agent: 'finn' as const,
    },
  ],
};

export function WebPreviewDemo() {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>('internal');
  const [isStreaming, setIsStreaming] = useState(false);

  // Stream demo events
  const startStreaming = async () => {
    setIsStreaming(true);
    setEvents([]);

    const allEvents = [
      ...DEMO_SEQUENCES.thinking,
      ...DEMO_SEQUENCES.tools,
      ...DEMO_SEQUENCES.steps,
      ...DEMO_SEQUENCES.success,
    ];

    for (let i = 0; i < allEvents.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setEvents((prev) => [...prev, allEvents[i]]);
    }

    setIsStreaming(false);
  };

  // Add error event
  const addError = () => {
    setEvents((prev) => [...prev, ...DEMO_SEQUENCES.error]);
  };

  // Clear all events
  const clearEvents = () => {
    setEvents([]);
  };

  // Toggle trust level
  const cycleTrustLevel = () => {
    const levels: TrustLevel[] = ['internal', 'external_curated', 'external_untrusted'];
    const currentIndex = levels.indexOf(trustLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    setTrustLevel(levels[nextIndex]);
  };

  return (
    <View style={styles.container}>
      {/* Controls */}
      <View style={styles.controls}>
        <Text style={styles.title}>WebPreview Component Demo</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={startStreaming}
            disabled={isStreaming}
          >
            <Text style={styles.buttonText}>
              {isStreaming ? 'Streaming...' : 'Start Stream'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={addError}>
            <Text style={styles.buttonText}>Add Error</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={clearEvents}>
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <TouchableOpacity style={styles.trustBadge} onPress={cycleTrustLevel}>
            <Text style={styles.trustText}>Trust: {trustLevel}</Text>
          </TouchableOpacity>
          <Text style={styles.eventCount}>{events.length} events</Text>
        </View>
      </View>

      {/* Preview */}
      <View style={styles.previewContainer}>
        <WebPreview
          activityEvents={events}
          trustLevel={trustLevel}
          onUrlClick={(url) => {
            console.log('[WebPreview Demo] URL clicked:', url);
            // In production, this would route through orchestrator for validation
          }}
        />
      </View>

      {/* Instructions */}
      {events.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyHeadline}>No Activity Yet</Text>
          <Text style={styles.emptyBody}>
            Press "Start Stream" to see live agent activity rendering
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CanvasTokens.background.base,
  },
  controls: {
    backgroundColor: CanvasTokens.background.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CanvasTokens.border.subtle,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    backgroundColor: CanvasTokens.background.elevated,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: CanvasTokens.glow.eli,
    borderColor: CanvasTokens.glow.eli,
  },
  buttonDanger: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  buttonText: {
    color: CanvasTokens.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trustBadge: {
    backgroundColor: CanvasTokens.background.elevated,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CanvasTokens.border.emphasis,
  },
  trustText: {
    color: CanvasTokens.glow.eli,
    fontSize: 12,
    fontWeight: '600',
  },
  eventCount: {
    color: CanvasTokens.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  previewContainer: {
    flex: 1,
  },
  emptyState: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: -40,
    padding: 32,
  },
  emptyHeadline: {
    fontSize: 16,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: CanvasTokens.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
