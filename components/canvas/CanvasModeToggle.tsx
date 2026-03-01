/**
 * CanvasModeToggle — Chat | Canvas mode switcher (Wave 8)
 *
 * Simple toggle button in header that switches between Chat and Canvas modes.
 * State persists to localStorage via chatCanvasStore.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { subscribe, getMode, setMode, type CanvasMode } from '@/lib/chatCanvasStore';

export function CanvasModeToggle() {
  const [currentMode, setCurrentMode] = useState<CanvasMode>(getMode());

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      setCurrentMode(state.mode);
    });
    return unsubscribe;
  }, []);

  const handleToggle = (mode: CanvasMode) => {
    setMode(mode);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.button,
          currentMode === 'chat' && styles.buttonActive,
        ]}
        onPress={() => handleToggle('chat')}
        accessibilityRole="button"
        accessibilityLabel="Switch to Chat mode"
        accessibilityState={{ selected: currentMode === 'chat' }}
      >
        <Text
          style={[
            styles.buttonText,
            currentMode === 'chat' && styles.buttonTextActive,
          ]}
        >
          Chat
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.button,
          currentMode === 'canvas' && styles.buttonActive,
        ]}
        onPress={() => handleToggle('canvas')}
        accessibilityRole="button"
        accessibilityLabel="Switch to Canvas mode"
        accessibilityState={{ selected: currentMode === 'canvas' }}
      >
        <Text
          style={[
            styles.buttonText,
            currentMode === 'canvas' && styles.buttonTextActive,
          ]}
        >
          Canvas
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: CanvasTokens.background.surface,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    // Smooth transition
    transitionProperty: 'background-color, transform',
    transitionDuration: '150ms',
  },
  buttonActive: {
    backgroundColor: CanvasTokens.glow.eli, // Blue active state
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: CanvasTokens.text.secondary,
    // Smooth transition
    transitionProperty: 'color',
    transitionDuration: '150ms',
  },
  buttonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
