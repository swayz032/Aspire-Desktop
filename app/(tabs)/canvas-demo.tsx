import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { WidgetDock, DEFAULT_WIDGETS } from '@/components/canvas';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors, Typography } from '@/constants/tokens';

/**
 * Canvas Demo Page - Showcases WidgetDock component
 *
 * Wave 11: Widget Dock Implementation
 * - Premium 60fps spring animations
 * - Responsive layout (desktop/tablet/mobile)
 * - Custom SVG icons (no emojis)
 * - Blue glow on hover
 */
export default function CanvasDemoScreen() {
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<string[]>([]);

  const handleWidgetSelect = (widgetId: string) => {
    setSelectedWidget(widgetId);
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog((prev) => [
      `[${timestamp}] Selected: ${widgetId}`,
      ...prev.slice(0, 9), // Keep last 10 entries
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Canvas Mode - Widget Dock Demo</Text>
        <Text style={styles.subtitle}>
          Premium UI with 60fps spring animations
        </Text>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Selected widget display */}
        <View style={styles.selectedCard}>
          <Text style={styles.cardTitle}>Selected Widget</Text>
          <Text style={styles.selectedText}>
            {selectedWidget ? selectedWidget.toUpperCase() : 'None'}
          </Text>
        </View>

        {/* Activity log */}
        <View style={styles.logCard}>
          <Text style={styles.cardTitle}>Activity Log</Text>
          <ScrollView style={styles.logScroll}>
            {activityLog.length === 0 ? (
              <Text style={styles.emptyText}>
                Tap any widget icon in the dock below
              </Text>
            ) : (
              activityLog.map((entry, index) => (
                <Text key={index} style={styles.logEntry}>
                  {entry}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        {/* Feature highlights */}
        <View style={styles.featuresCard}>
          <Text style={styles.cardTitle}>Features</Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>
              ✨ 60fps spring animations (damping: 20, stiffness: 300)
            </Text>
            <Text style={styles.featureItem}>
              🎨 Custom SVG icons (10 widgets)
            </Text>
            <Text style={styles.featureItem}>
              📱 Responsive layout (desktop/tablet/mobile)
            </Text>
            <Text style={styles.featureItem}>
              💎 Blue glow on hover (Canvas.glow.eli)
            </Text>
            <Text style={styles.featureItem}>
              ⌨️ Keyboard accessible (Tab + Enter)
            </Text>
            <Text style={styles.featureItem}>
              🌑 Dark glass background with backdrop blur
            </Text>
          </View>
        </View>
      </View>

      {/* Widget Dock - bottom position */}
      <WidgetDock
        widgets={DEFAULT_WIDGETS}
        onWidgetSelect={handleWidgetSelect}
        position="bottom"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CanvasTokens.background.base,
  },

  header: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: CanvasTokens.border.subtle,
  },

  title: {
    ...Typography.display,
    color: Colors.text.primary,
    marginBottom: 8,
  },

  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
  },

  content: {
    flex: 1,
    padding: 32,
    gap: 20,
  },

  selectedCard: {
    backgroundColor: CanvasTokens.background.elevated,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
  },

  logCard: {
    backgroundColor: CanvasTokens.background.elevated,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
    flex: 1,
  },

  featuresCard: {
    backgroundColor: CanvasTokens.background.elevated,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
  },

  cardTitle: {
    ...Typography.headline,
    color: Colors.text.primary,
    marginBottom: 12,
  },

  selectedText: {
    ...Typography.display,
    color: CanvasTokens.glow.eli,
    fontWeight: '700',
  },

  logScroll: {
    maxHeight: 200,
  },

  emptyText: {
    ...Typography.caption,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },

  logEntry: {
    ...Typography.small,
    color: Colors.text.secondary,
    marginBottom: 8,
    fontFamily: 'monospace',
  },

  featuresList: {
    gap: 12,
  },

  featureItem: {
    ...Typography.caption,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
});
