import React, { useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, Typography } from '@/constants/tokens';
import {
  useImmersion,
  setImmersionMode,
  type ImmersionMode,
} from '@/lib/immersionStore';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// Mode config — order matters for index-based indicator positioning
// ---------------------------------------------------------------------------

interface ModeConfig {
  mode: ImmersionMode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const MODES: ModeConfig[] = [
  { mode: 'off', icon: 'eye-off-outline', label: 'Off' },
  { mode: 'depth', icon: 'eye-outline', label: 'Depth' },
  { mode: 'canvas', icon: 'layers-outline', label: 'Canvas' },
];

// ---------------------------------------------------------------------------
// Layout constants derived from tokens
// ---------------------------------------------------------------------------

const PILL_HEIGHT = Canvas.toggle.pillHeight; // 32
const PILL_PADDING = Canvas.toggle.pillPadding; // 3
const INDICATOR_RADIUS = Canvas.toggle.indicatorRadius; // 14
const ICON_SIZE = 14;

// Each option segment width — calculated to keep total toggle compact
const SEGMENT_WIDTH = 62;
const PILL_WIDTH = SEGMENT_WIDTH * MODES.length + PILL_PADDING * 2;
const INDICATOR_WIDTH = SEGMENT_WIDTH;
const INDICATOR_HEIGHT = PILL_HEIGHT - PILL_PADDING * 2;

// Spring config from Canvas tokens
const SPRING = Canvas.motion.spring;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasToggle(): React.ReactElement {
  const { mode } = useImmersion();
  const indicatorX = useRef(new Animated.Value(getModeOffset(mode))).current;

  // Slide the indicator when mode changes
  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: getModeOffset(mode),
      damping: SPRING.damping,
      stiffness: SPRING.stiffness,
      mass: SPRING.mass,
      useNativeDriver: true,
    }).start();
  }, [mode, indicatorX]);

  // Handle mode selection
  const handlePress = useCallback(
    (nextMode: ImmersionMode) => {
      if (nextMode === mode) return;
      emitCanvasEvent('mode_change', { from: mode, to: nextMode });
      setImmersionMode(nextMode);
    },
    [mode],
  );

  // Keyboard navigation — left/right arrows cycle modes
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIdx = MODES.findIndex((m) => m.mode === mode);
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
    [mode, handlePress],
  );

  return (
    <View
      style={styles.pill}
      accessibilityRole="radiogroup"
      accessibilityLabel="Canvas immersion mode"
      {...(Platform.OS === 'web' ? { onKeyDown: handleKeyDown } as Record<string, unknown> : {})}
    >
      {/* Sliding indicator — rendered behind the options */}
      <Animated.View
        style={[
          styles.indicator,
          { transform: [{ translateX: indicatorX }] },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {/* Mode options */}
      {MODES.map((cfg) => {
        const isActive = cfg.mode === mode;
        return (
          <Pressable
            key={cfg.mode}
            style={styles.segment}
            onPress={() => handlePress(cfg.mode)}
            accessibilityRole="radio"
            accessibilityLabel={`${cfg.label} immersion mode`}
            accessibilityState={{ checked: isActive }}
          >
            <Ionicons
              name={cfg.icon}
              size={ICON_SIZE}
              color={isActive ? Canvas.toggle.activeText : Canvas.toggle.inactiveText}
              style={styles.segmentIcon}
            />
            <Animated.Text
              style={[
                styles.segmentLabel,
                { color: isActive ? Canvas.toggle.activeText : Canvas.toggle.inactiveText },
              ]}
            >
              {cfg.label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getModeOffset(mode: ImmersionMode): number {
  const idx = MODES.findIndex((m) => m.mode === mode);
  return PILL_PADDING + idx * SEGMENT_WIDTH;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    width: PILL_WIDTH,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: Canvas.toggle.bg,
    position: 'relative',
    padding: PILL_PADDING,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer',
          userSelect: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  indicator: {
    position: 'absolute',
    top: PILL_PADDING,
    left: 0,
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_RADIUS,
    backgroundColor: Canvas.toggle.activeBg,
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: INDICATOR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    minWidth: 44,
    minHeight: 44,
  },
  segmentIcon: {
    marginRight: 4,
  },
  segmentLabel: {
    fontSize: Typography.small.fontSize,
    fontWeight: Typography.smallMedium.fontWeight,
    lineHeight: Typography.small.lineHeight,
  },
});
