/**
 * CanvasModeToggle — Chat | Canvas tab toggle
 *
 * Matches the "Voice with Ava | Video with Ava" TabButton style
 * from AvaDeskPanel exactly:
 * - Contained pill with #0f0f0f bg + borderRadius: 10 + padding: 3
 * - Active tab: #242426 bg + borderRadius: 8
 * - Inactive tab: transparent
 * - Icon (14px) + label (11px, fontWeight 600)
 * - Active text: white, Inactive text: tertiary
 * - Compact, clean, no blue glow
 */

import React, { useEffect, useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  Text,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { subscribe, getMode, setMode, type CanvasMode } from '@/lib/chatCanvasStore';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

interface TabConfig {
  mode: CanvasMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TABS: TabConfig[] = [
  { mode: 'chat', icon: 'chatbubble-outline', label: 'Chat' },
  { mode: 'canvas', icon: 'grid-outline', label: 'Canvas' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasModeToggle(): React.ReactElement {
  const [currentMode, setCurrentMode] = useState<CanvasMode>(getMode());

  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      setCurrentMode(state.mode);
    });
    return unsubscribe;
  }, []);

  const handlePress = useCallback(
    (nextMode: CanvasMode) => {
      if (nextMode === currentMode) return;
      emitCanvasEvent('mode_change', { from: currentMode, to: nextMode });
      setMode(nextMode);
    },
    [currentMode],
  );

  return (
    <View
      style={styles.tabs}
      accessibilityRole="radiogroup"
      accessibilityLabel="Canvas workspace mode"
    >
      {TABS.map((tab) => {
        const isActive = tab.mode === currentMode;
        return (
          <Pressable
            key={tab.mode}
            style={[styles.tabBtn, isActive && styles.tabBtnActive]}
            onPress={() => handlePress(tab.mode)}
            accessibilityRole="radio"
            accessibilityLabel={`${tab.label} mode`}
            accessibilityState={{ checked: isActive }}
          >
            {isActive && <View style={styles.dot} />}
            <Ionicons
              name={tab.icon}
              size={14}
              color={isActive ? Colors.accent.cyan : Colors.text.tertiary}
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — exact match of AvaDeskPanel TabButton / tabs
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Container pill — matches AvaDeskPanel styles.tabs
  tabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.background.tertiary, // #0f0f0f
    borderRadius: 10,
    padding: 3,
    ...(Platform.OS === 'web'
      ? ({
          userSelect: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  // Each tab button — matches AvaDeskPanel styles.tabBtn
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
        } as unknown as ViewStyle)
      : {}),
  },

  // Active tab — matches AvaDeskPanel styles.tabBtnActive
  tabBtnActive: {
    backgroundColor: '#242426',
  },

  // Active dot indicator
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 6px rgba(59,130,246,0.4)',
        } as unknown as ViewStyle)
      : {}),
  },

  // Tab label — matches AvaDeskPanel styles.tabText
  tabText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },

  // Active label — matches AvaDeskPanel styles.tabTextActive
  tabTextActive: {
    color: Colors.text.primary,
  },
});
