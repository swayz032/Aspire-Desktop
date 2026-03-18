/**
 * WidgetContainer — Premium draggable/resizable container for Canvas Mode widgets.
 *
 * Each widget has branded identity:
 * - Accent color stripe on header left edge
 * - Widget-specific icon in header
 * - Accent-tinted close button hover
 * - Premium depth with multi-layer shadows
 * - Drag via header, resize via corners
 */

import React, { useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

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
  /** Brand accent color for this widget */
  accent?: string;
  /** Ionicons icon name for this widget */
  icon?: string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_SIZE = 32;
const HEADER_HEIGHT = 48;
const BORDER_RADIUS = 16;

const SPRING_CONFIG = { damping: 20, stiffness: 300, mass: 0.9 };
const SNAP_SPRING_CONFIG = { damping: 22, stiffness: 280, mass: 0.9 };

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function WidgetContainerInner({
  title,
  children,
  position,
  size,
  onPositionChange,
  onSizeChange,
  onClose,
  accent = '#3B82F6',
  icon,
  minWidth = 280,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 600,
}: WidgetContainerProps) {
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const width = useSharedValue(size.width);
  const height = useSharedValue(size.height);
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const resizeStartWidth = useSharedValue(0);
  const resizeStartHeight = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const handleClose = () => {
    scale.value = withTiming(0.9, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => onClose?.(), 200);
  };

  // Drag gesture (header)
  const dragGesture = Gesture.Pan()
    .onBegin(() => {
      isDragging.value = true;
      dragStartX.value = translateX.value;
      dragStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = dragStartX.value + e.translationX;
      translateY.value = dragStartY.value + e.translationY;
    })
    .onEnd(() => {
      isDragging.value = false;
      const sx = snapToGrid(translateX.value);
      const sy = snapToGrid(translateY.value);
      translateX.value = withSpring(sx, SNAP_SPRING_CONFIG);
      translateY.value = withSpring(sy, SNAP_SPRING_CONFIG);
      if (onPositionChange) runOnJS(onPositionChange)({ x: sx, y: sy });
    });

  // Resize gesture (bottom-right)
  const resizeGesture = Gesture.Pan()
    .onBegin(() => {
      resizeStartWidth.value = width.value;
      resizeStartHeight.value = height.value;
    })
    .onUpdate((e) => {
      width.value = clamp(resizeStartWidth.value + e.translationX, minWidth, maxWidth);
      height.value = clamp(resizeStartHeight.value + e.translationY, minHeight, maxHeight);
    })
    .onEnd(() => {
      if (onSizeChange) runOnJS(onSizeChange)({ width: width.value, height: height.value });
    });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    width: width.value,
    height: height.value,
  }));

  const headerCursorStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'web') return {};
    return { cursor: isDragging.value ? 'grabbing' : 'grab' } as any;
  });

  // Premium shadow
  const shadow: ViewStyle = Platform.OS === 'web'
    ? ({
        boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px ${accent}22`,
      } as unknown as ViewStyle)
    : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.55, shadowRadius: 24, elevation: 12 };

  return (
    <Reanimated.View style={[s.container, containerStyle, shadow]}>
      <View style={s.topHighlight} pointerEvents="none" />

      {/* Header */}
      <GestureDetector gesture={dragGesture}>
        <Reanimated.View style={[s.header, headerCursorStyle]}>
          <View style={[s.accentDot, { backgroundColor: accent }]} />
          {icon && <Ionicons name={icon as any} size={16} color={accent} />}
          <Text style={[s.title, { color: accent }]}>{title}</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              s.closeBtn,
              {
                backgroundColor: pressed ? `${accent}33` : 'rgba(255,255,255,0.03)',
                borderColor: pressed ? `${accent}66` : 'rgba(255,255,255,0.08)',
              },
            ]}
          >
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.62)" />
          </Pressable>
        </Reanimated.View>
      </GestureDetector>

      {/* Content */}
      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>

      {/* Resize handle */}
      <GestureDetector gesture={resizeGesture}>
        <Reanimated.View style={s.resizeHandle}>
          <View style={s.resizeDotWrap}>
            <View style={[s.resizeDot, { backgroundColor: `${accent}99` }]} />
            <View style={[s.resizeDot, { backgroundColor: `${accent}B3` }]} />
            <View style={[s.resizeDot, { backgroundColor: `${accent}CC` }]} />
          </View>
        </Reanimated.View>
      </GestureDetector>
    </Reanimated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as any)
      : {}),
  },

  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 1,
    right: 1,
    height: 42,
    zIndex: 1,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 45%, transparent 100%)',
        } as any)
      : { backgroundColor: 'rgba(255,255,255,0.04)' }),
  },

  header: {
    height: HEADER_HEIGHT,
    backgroundColor: 'rgba(13,17,23,0.78)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
    zIndex: 3,
  },

  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 8px currentColor' } as any) : {}),
  },

  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as any,

  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  content: {
    flex: 1,
    backgroundColor: 'rgba(13,17,23,0.72)',
  },

  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'nwse-resize' } as any) : {}),
  },

  resizeDotWrap: {
    width: 12,
    height: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 2,
  },

  resizeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});

export function WidgetContainer(props: any) {
  return (
    <PageErrorBoundary pageName="widget-container">
      <WidgetContainerInner {...props} />
    </PageErrorBoundary>
  );
}
