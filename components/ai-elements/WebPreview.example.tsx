/**
 * WebPreview Example Usage
 *
 * This file demonstrates how to use the WebPreview component
 * in Canvas Chat Mode for displaying agent activity.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { WebPreview, AgentActivityEvent } from './WebPreview';

export function WebPreviewExample() {
  const [events, setEvents] = useState<AgentActivityEvent[]>([
    {
      type: 'thinking',
      message: 'Analyzing your request...',
      icon: 'bulb',
      timestamp: Date.now() - 5000,
      agent: 'ava',
    },
    {
      type: 'tool_call',
      message: 'Searching **Stripe API** for recent invoices',
      icon: 'hammer',
      timestamp: Date.now() - 3000,
      agent: 'finn',
    },
    {
      type: 'step',
      message: 'Found `12 invoices` in the last 30 days',
      icon: 'chevron',
      timestamp: Date.now() - 2000,
      agent: 'finn',
    },
    {
      type: 'done',
      message: 'Analysis complete. Ready to proceed.',
      icon: 'checkmark',
      timestamp: Date.now() - 1000,
      agent: 'ava',
    },
  ]);

  // Simulate new event every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const newEvent: AgentActivityEvent = {
        type: 'step',
        message: `Processing step ${events.length + 1}...`,
        icon: 'chevron',
        timestamp: Date.now(),
        agent: 'eli',
      };
      setEvents((prev) => [...prev, newEvent]);
    }, 3000);

    return () => clearInterval(interval);
  }, [events.length]);

  // Simulate error event
  const addErrorEvent = () => {
    const errorEvent: AgentActivityEvent = {
      type: 'error',
      message: 'Failed to connect to **QuickBooks API**. Retrying...',
      icon: 'alert',
      timestamp: Date.now(),
      agent: 'finn',
    };
    setEvents((prev) => [...prev, errorEvent]);
  };

  return (
    <View style={styles.container}>
      <WebPreview
        activityEvents={events}
        trustLevel="internal"
        onUrlClick={(url) => {
          console.log('URL clicked:', url);
        }}
      />
      <View style={styles.controls}>
        <Button title="Add Error Event" onPress={addErrorEvent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  controls: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
});
