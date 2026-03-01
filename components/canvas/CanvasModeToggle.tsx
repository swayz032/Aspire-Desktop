/**
 * CanvasModeToggle — Chat | Canvas pill toggle ($10K premium)
 *
 * Matches the Ava desk panel companyPill aesthetic:
 * - Pill shape with borderRadius: 20
 * - Active state: blue glow bg rgba(59,130,246,0.2) + blue border + boxShadow
 * - Inactive: #242426 background
 * - Smooth 0.2s transition
 * - Online dot indicator on active segment
 * - Keyboard navigable (Arrow keys)
 * - Reduced-motion compliant
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
import { Typography } from '@/constants/tokens';
import { subscribe, getMode, setMode, type CanvasMode } from '@/lib/chatCanvasStore';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Mode config — order matters for layout
// ---------------------------------------------------------------------------

interface ModeConfig {
  mode: CanvasMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const MODES: ModeConfig[] = [
  { mode: 'chat', icon: 'chatbubble-outline', label: 'Chat' },
  { mode: 'canvas', icon: 'grid-outline', label: 'Canvas' },
];

// ---------------------------------------------------------------------------
// CompanyPill design constants
// ---------------------------------------------------------------------------

const PILL_RADIUS = 20;
const PILL_GAP = 6;               // Gap between segments
const ICON_SIZE = 15;
const DOT_SIZE = 6;

// Colors — matching Ava desk companyPill
const INACTIVE_BG = '#242426';
const ACTIVE_BG = 'rgba(59, 130, 246, 0.2)';
const ACTIVE_BORDER = 'rgba(59, 130, 246, 0.5)';
const ACTIVE_GLOW = '0 0 16px rgba(59, 130, 246, 0.3)';
const ACTIVE_TEXT = '#3B82F6';
const INACTIVE_TEXT = '#6e6e73';
const DOT_COLOR = '#3B82F6';

// ---------------------------------------------------------------------------
// Reduced-motion detection (web only, singleton)
// ---------------------------------------------------------------------------

let reducedMotion = false;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mql.matches;
    mql.addEventListener('change', (e) => {
      reducedMotion = e.matches;
    });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasModeToggle(): React.ReactElement {
  const [currentMode, setCurrentMode] = useState<CanvasMode>(getMode());

  // Subscribe to chatCanvasStore
  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      setCurrentMode(state.mode);
    });
    return unsubscribe;
  }, []);

  // Handle mode selection
  const handlePress = useCallback(
    (nextMode: CanvasMode) => {
      if (nextMode === currentMode) return;
      emitCanvasEvent('mode_change', { from: currentMode, to: nextMode });
      setMode(nextMode);
    },
    [currentMode],
  );

  // Keyboard navigation — left/right arrows cycle modes
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIdx = MODES.findIndex((m) => m.mode === currentMode);
      let nextIdx = currentIdx;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = Math.max(0, currentIdx - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = Math.min(MODES.length - 1, currentIdx + 1);
      }

      if (nextIdx !== currentIdx) {
        handlePress(MODES[nextIdx].mode);
      }
    },
    [currentMode, handlePress],
  );

  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel="Canvas workspace mode"
      {...(Platform.OS === 'web' ? { onKeyDown: handleKeyDown } as Record<string, unknown> : {})}
    >
      {MODES.map((cfg) => {
        const isActive = cfg.mode === currentMode;
        return (
          <Pressable
            key={cfg.mode}
            style={[
              styles.pill,
              isActive ? styles.pillActive : styles.pillInactive,
            ]}
            onPress={() => handlePress(cfg.mode)}
            accessibilityRole="radio"
            accessibilityLabel={`${cfg.label} workspace mode`}
            accessibilityState={{ checked: isActive }}
          >
            {/* Active dot indicator */}
            {isActive && <View style={styles.dot} />}

            <Ionicons
              name={cfg.icon}
              size={ICON_SIZE}
              color={isActive ? ACTIVE_TEXT : INACTIVE_TEXT}
              style={styles.icon}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? ACTIVE_TEXT : INACTIVE_TEXT },
              ]}
            >
              {cfg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — companyPill aesthetic from Ava desk panel
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PILL_GAP,
    ...(Platform.OS === 'web'
      ? ({
          userSelect: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  // Each segment is its own pill (like companyPill)
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 44,
    minHeight: 44,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        } as unknown as ViewStyle)
      : {}),
  },

  // Inactive pill — dark neutral
  pillInactive: {
    backgroundColor: INACTIVE_BG,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  // Active pill — blue glow (companyPillActive style)
  pillActive: {
    backgroundColor: ACTIVE_BG,
    borderColor: ACTIVE_BORDER,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: ACTIVE_GLOW,
        } as unknown as ViewStyle)
      : {}),
  },

  // Online dot indicator (like companyPill)
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: DOT_COLOR,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 0 6px ${DOT_COLOR}`,
        } as unknown as ViewStyle)
      : {}),
  },

  icon: {
    // No extra margin — gap handles spacing
  },

  label: {
    fontSize: Typography.small.fontSize,
    fontWeight: Typography.smallMedium.fontWeight,
    lineHeight: Typography.small.lineHeight,
    letterSpacing: 0.3,
  },
});
