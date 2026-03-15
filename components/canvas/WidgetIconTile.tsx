/**
 * WidgetIconTile — Compact canvas placeholder for a dropped widget.
 *
 * Placed at the drop position on the canvas.
 * Tap to open the widget modal.
 * X button to remove from canvas.
 * Draggable to reposition.
 */

import React, { useEffect, ComponentProps } from 'react';
import type { PressableState } from '@/types/common';
import {
  View,
  Text,
  Pressable,
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

interface WidgetIconTileProps {
  title: string;
  accent: string;
  icon: string;
  position: { x: number; y: number };
  onPress: () => void;
  onRemove: () => void;
  onPositionChange?: (pos: { x: number; y: number }) => void;
}

const TILE_SIZE = 88;
const GRID_SIZE = 32;
const SPRING = { damping: 20, stiffness: 300, mass: 0.85 };
const SNAP_SPRING = { damping: 22, stiffness: 280, mass: 0.9 };

function snapToGrid(value: number): number {
  'worklet';
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function WidgetIconTile({
  title,
  accent,
  icon,
  position,
  onPress,
  onRemove,
  onPositionChange,
}: WidgetIconTileProps) {
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, SPRING);
  }, []);

  const dragGesture = Gesture.Pan()
    .minDistance(6)
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
      translateX.value = withSpring(sx, SNAP_SPRING);
      translateY.value = withSpring(sy, SNAP_SPRING);
      if (onPositionChange) runOnJS(onPositionChange)({ x: sx, y: sy });
    });

  const tileStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: isDragging.value ? withSpring(1.08, SPRING) : scale.value },
    ],
    opacity: isDragging.value ? withTiming(0.75, { duration: 120 }) : opacity.value,
  }));

  const shortLabel = title.length > 8 ? title.slice(0, 8) + '…' : title;

  const boxShadow = Platform.OS === 'web'
    ? `0 8px 24px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px ${accent}44, 0 0 20px ${accent}22`
    : undefined;

  return (
    <GestureDetector gesture={dragGesture}>
      <Reanimated.View
        style={[
          s.tile as ViewStyle,
          tileStyle,
          Platform.OS === 'web' ? { boxShadow } : {
            shadowColor: accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          },
        ]}
      >
        {/* Gradient background using nested views */}
        <View style={[s.bg, { backgroundColor: `${accent}18` }]} />
        <View style={[s.bgBorder, { borderColor: `${accent}55` }]} />

        {/* Top bevel */}
        <View style={s.bevel} pointerEvents="none" />

        {/* Tap area — whole tile */}
        <Pressable
          onPress={onPress}
          style={[s.tapArea, ...(Platform.OS === 'web' ? [{ cursor: 'pointer' } as ViewStyle] : [])]}
        >
          {/* Icon circle */}
          <View style={[s.iconCircle, { backgroundColor: `${accent}28`, borderColor: `${accent}66` }]}>
            <Ionicons name={icon as ComponentProps<typeof Ionicons>['name']} size={26} color={accent} />
          </View>

          {/* Label */}
          <Text style={[s.label, { color: accent }]} numberOfLines={1}>
            {shortLabel}
          </Text>
        </Pressable>

        {/* Remove X button */}
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }: PressableState) => [
            s.removeBtn,
            {
              backgroundColor: pressed ? 'rgba(239,68,68,0.3)' : 'rgba(13,17,23,0.85)',
              borderColor: pressed ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.14)',
            },
          ]}
        >
          <Ionicons name="close" size={10} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </Reanimated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  tile: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 20,
    overflow: 'visible',
    ...(Platform.OS === 'web' ? ({ cursor: 'grab' }) : {}),
  },

  bg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },

  bgBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' })
      : {}),
  },

  bevel: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 36,
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
    zIndex: 1,
    pointerEvents: 'none',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)',
        })
      : { backgroundColor: 'rgba(255,255,255,0.05)' }),
  },

  tapArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' }) : {}),
  },
});
