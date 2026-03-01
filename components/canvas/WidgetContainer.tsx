/**
 * WidgetContainer — Premium draggable/resizable container for Canvas Mode widgets.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - REAL depth: Multi-layer shadow system VISIBLE on dark canvas
 * - Premium drag/resize: Spring physics, 60fps, grid snap
 * - Custom SVG icons: NO emojis
 * - Smooth animations: react-native-reanimated worklets
 * - Glass header: Two-tone design with blue accent
 * - Bloomberg Terminal / Figma / macOS window panel quality
 *
 * Reference: Authority Queue card premium feel, Today's Plan depth system.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { DragHandleIcon } from '@/components/icons/ui/DragHandleIcon';
import { CloseIcon } from '@/components/icons/ui/CloseIcon';
import { ResizeIcon } from '@/components/icons/ui/ResizeIcon';
import { CanvasTokens } from '@/constants/canvas.tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetContainerProps {
  title: string;
  children: React.ReactNode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  onClose?: () => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_SIZE = 32; // Snap to 32px grid
const HEADER_HEIGHT = CanvasTokens.widget.titleBarHeight; // 44
const RESIZE_HANDLE_SIZE = 32; // Touch target
const RESIZE_HANDLE_VISUAL_SIZE = 12; // Visual indicator
const BORDER_RADIUS = CanvasTokens.widget.borderRadius; // 12

// Spring physics (snappy, premium feel)
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.9,
};

// Grid snap spring (tighter)
const SNAP_SPRING_CONFIG = {
  damping: 22,
  stiffness: 280,
  mass: 0.9,
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Snap value to 32px grid */
function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WidgetContainer({
  title,
  children,
  position,
  size,
  onPositionChange,
  onSizeChange,
  onClose,
  minWidth = 280,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 600,
}: WidgetContainerProps) {
  // Animated values
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const width = useSharedValue(size.width);
  const height = useSharedValue(size.height);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const isHovering = useSharedValue(false);

  // Drag gesture state
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Resize gesture state
  const resizeStartWidth = useSharedValue(0);
  const resizeStartHeight = useSharedValue(0);

  // ---------------------------------------------------------------------------
  // Entrance Animation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Spring entrance
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  // ---------------------------------------------------------------------------
  // Close Handler
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    // Animate out
    scale.value = withTiming(0, { duration: 250 });
    opacity.value = withTiming(0, { duration: 250 });

    // Trigger callback after animation
    setTimeout(() => {
      onClose?.();
    }, 250);
  };

  // ---------------------------------------------------------------------------
  // Drag Gesture (Header Only)
  // ---------------------------------------------------------------------------

  const dragGesture = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
      dragStartX.value = translateX.value;
      dragStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = dragStartX.value + event.translationX;
      translateY.value = dragStartY.value + event.translationY;
    })
    .onEnd(() => {
      isDragging.value = false;

      // Snap to grid with spring physics
      const snappedX = snapToGrid(translateX.value);
      const snappedY = snapToGrid(translateY.value);

      translateX.value = withSpring(snappedX, SNAP_SPRING_CONFIG);
      translateY.value = withSpring(snappedY, SNAP_SPRING_CONFIG);

      // Trigger callback
      if (onPositionChange) {
        runOnJS(onPositionChange)({ x: snappedX, y: snappedY });
      }
    });

  // ---------------------------------------------------------------------------
  // Resize Gesture (Bottom-Right Corner)
  // ---------------------------------------------------------------------------

  const resizeGesture = Gesture.Pan()
    .onBegin(() => {
      resizeStartWidth.value = width.value;
      resizeStartHeight.value = height.value;
    })
    .onUpdate((event) => {
      const newWidth = resizeStartWidth.value + event.translationX;
      const newHeight = resizeStartHeight.value + event.translationY;

      // Enforce min/max constraints
      width.value = clamp(newWidth, minWidth, maxWidth);
      height.value = clamp(newHeight, minHeight, maxHeight);
    })
    .onEnd(() => {
      // Trigger callback with final size
      if (onSizeChange) {
        runOnJS(onSizeChange)({
          width: width.value,
          height: height.value,
        });
      }
    });

  // ---------------------------------------------------------------------------
  // Animated Styles
  // ---------------------------------------------------------------------------

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    width: width.value,
    height: height.value,
  }));

  const headerAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'web') {
      return {};
    }
    return {
      cursor: isDragging.value ? 'grabbing' : 'grab',
    } as any;
  });

  // ---------------------------------------------------------------------------
  // Premium Shadow System (Web)
  // ---------------------------------------------------------------------------

  const premiumShadow: ViewStyle =
    Platform.OS === 'web'
      ? ({
          boxShadow: `
            0 12px 32px rgba(0, 0, 0, 0.6),
            0 4px 16px rgba(0, 0, 0, 0.8),
            0 0 40px rgba(59, 130, 246, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3)
          `,
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.6,
          shadowRadius: 32,
          elevation: 12,
        };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Reanimated.View
      style={[styles.container, containerAnimatedStyle, premiumShadow]}
    >
      {/* Header (Draggable) */}
      <GestureDetector gesture={dragGesture}>
        <Reanimated.View style={[styles.header, headerAnimatedStyle]}>
          <DragHandleIcon size={16} color="rgba(255,255,255,0.3)" />
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <CloseIcon size={20} color="#FFFFFF" />
          </Pressable>
        </Reanimated.View>
      </GestureDetector>

      {/* Content Area */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>

      {/* Resize Handle (Bottom-Right) */}
      <GestureDetector gesture={resizeGesture}>
        <Reanimated.View style={[styles.resizeHandle, styles.bottomRight]}>
          <ResizeIcon size={RESIZE_HANDLE_VISUAL_SIZE} color="rgba(255,255,255,0.3)" />
        </Reanimated.View>
      </GestureDetector>

      {/* Resize Handle (Bottom-Left) */}
      <GestureDetector gesture={resizeGesture}>
        <Reanimated.View style={[styles.resizeHandle, styles.bottomLeft]}>
          <ResizeIcon size={RESIZE_HANDLE_VISUAL_SIZE} color="rgba(255,255,255,0.3)" />
        </Reanimated.View>
      </GestureDetector>

      {/* Resize Handle (Top-Right) */}
      <GestureDetector gesture={resizeGesture}>
        <Reanimated.View style={[styles.resizeHandle, styles.topRight]}>
          <ResizeIcon size={RESIZE_HANDLE_VISUAL_SIZE} color="rgba(255,255,255,0.3)" />
        </Reanimated.View>
      </GestureDetector>

      {/* Resize Handle (Top-Left) */}
      <GestureDetector gesture={resizeGesture}>
        <Reanimated.View style={[styles.resizeHandle, styles.topLeft]}>
          <ResizeIcon size={RESIZE_HANDLE_VISUAL_SIZE} color="rgba(255,255,255,0.3)" />
        </Reanimated.View>
      </GestureDetector>
    </Reanimated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: CanvasTokens.background.elevated, // #2A2A2A
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: CanvasTokens.border.emphasis, // Blue glow accent
    overflow: 'hidden',
  },

  header: {
    height: HEADER_HEIGHT,
    backgroundColor: CanvasTokens.background.surface, // #1E1E1E
    borderBottomWidth: 1,
    borderBottomColor: CanvasTokens.border.emphasis, // rgba(59,130,246,0.4)
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },

  title: {
    flex: 1,
    color: CanvasTokens.text.primary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 150ms ease',
        } as any)
      : {}),
  },

  content: {
    flex: 1,
    backgroundColor: CanvasTokens.background.elevated, // #2A2A2A
    padding: 16,
  },

  resizeHandle: {
    position: 'absolute',
    width: RESIZE_HANDLE_SIZE,
    height: RESIZE_HANDLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'nwse-resize',
        } as any)
      : {}),
  },

  bottomRight: {
    bottom: -4,
    right: -4,
  },

  bottomLeft: {
    bottom: -4,
    left: -4,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'nesw-resize',
        } as any)
      : {}),
  },

  topRight: {
    top: HEADER_HEIGHT - 4,
    right: -4,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'nesw-resize',
        } as any)
      : {}),
  },

  topLeft: {
    top: HEADER_HEIGHT - 4,
    left: -4,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'nwse-resize',
        } as any)
      : {}),
  },
});
