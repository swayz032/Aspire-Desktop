/**
 * Canvas Demo Page — WidgetContainer showcase
 *
 * Demonstrates:
 * - Draggable widget with spring physics
 * - Resizable corners with constraints
 * - Grid snap behavior
 * - Close animation
 * - Premium depth/shadow system
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WidgetContainer } from '@/components/canvas/WidgetContainer';
import { CanvasTokens } from '@/constants/canvas.tokens';

export default function CanvasDemoScreen() {
  const [widgets, setWidgets] = useState([
    {
      id: 'widget-1',
      title: 'Invoice Widget',
      position: { x: 100, y: 100 },
      size: { width: 400, height: 300 },
    },
    {
      id: 'widget-2',
      title: 'Calendar Widget',
      position: { x: 550, y: 150 },
      size: { width: 350, height: 280 },
    },
  ]);

  const handlePositionChange = (id: string, position: { x: number; y: number }) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, position } : w))
    );
    console.log(`Widget ${id} moved to:`, position);
  };

  const handleSizeChange = (id: string, size: { width: number; height: number }) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, size } : w)));
    console.log(`Widget ${id} resized to:`, size);
  };

  const handleClose = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    console.log(`Widget ${id} closed`);
  };

  const addWidget = () => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      title: 'New Widget',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 100 },
      size: { width: 400, height: 300 },
    };
    setWidgets((prev) => [...prev, newWidget]);
  };

  return (
    <View style={styles.container}>
      {/* Canvas Background */}
      <View style={styles.canvas}>
        {/* Widgets */}
        {widgets.map((widget) => (
          <WidgetContainer
            key={widget.id}
            title={widget.title}
            position={widget.position}
            size={widget.size}
            onPositionChange={(pos) => handlePositionChange(widget.id, pos)}
            onSizeChange={(size) => handleSizeChange(widget.id, size)}
            onClose={() => handleClose(widget.id)}
            minWidth={280}
            minHeight={200}
            maxWidth={800}
            maxHeight={600}
          >
            <View style={styles.widgetContent}>
              <Text style={styles.contentTitle}>{widget.title} Content</Text>
              <Text style={styles.contentText}>
                This is a draggable and resizable widget.
              </Text>
              <Text style={styles.contentText}>
                • Drag the header to move
              </Text>
              <Text style={styles.contentText}>
                • Drag corners to resize
              </Text>
              <Text style={styles.contentText}>
                • Click X to close
              </Text>
              <Text style={styles.contentText}>
                • Snaps to 32px grid on release
              </Text>
            </View>
          </WidgetContainer>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable style={styles.addButton} onPress={addWidget}>
          <Text style={styles.addButtonText}>+ Add Widget</Text>
        </Pressable>
        <Text style={styles.instructionText}>
          {widgets.length} widget{widgets.length !== 1 ? 's' : ''} on canvas
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  canvas: {
    flex: 1,
    backgroundColor: CanvasTokens.background.base, // #0A0A0A
    position: 'relative',
  },

  controls: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1000,
    gap: 12,
  },

  addButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },

  addButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },

  instructionText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '400',
  },

  widgetContent: {
    gap: 12,
  },

  contentTitle: {
    color: CanvasTokens.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },

  contentText: {
    color: CanvasTokens.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
