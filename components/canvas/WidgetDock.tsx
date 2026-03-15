import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ScrollView,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Canvas } from '@/constants/tokens';
import { playSound, initSoundManager } from '@/lib/soundManager';
import { snapToGrid } from '@/lib/canvasDragDrop';

import { EmailIcon } from '@/components/icons/widgets/EmailIcon';
import { InvoiceIcon } from '@/components/icons/widgets/InvoiceIcon';
import { QuoteIcon } from '@/components/icons/widgets/QuoteIcon';
import { ContractIcon } from '@/components/icons/widgets/ContractIcon';
import { CalendarIcon } from '@/components/icons/widgets/CalendarIcon';
import { FinanceIcon } from '@/components/icons/widgets/FinanceIcon';
import { TaskIcon } from '@/components/icons/widgets/TaskIcon';
import { ApprovalIcon } from '@/components/icons/widgets/ApprovalIcon';
import { NoteIcon } from '@/components/icons/widgets/NoteIcon';
import { ReceiptIcon } from '@/components/icons/widgets/ReceiptIcon';
import { PhoneIcon } from '@/components/icons/widgets/PhoneIcon';
import { TextMessageIcon } from '@/components/icons/widgets/TextMessageIcon';

export interface WidgetDefinition {
  id: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  color?: string;
  avatarImage?: ImageSourcePropType;
  iconImage?: string;
  isAgent?: boolean;
}

export interface WidgetDockProps {
  widgets: WidgetDefinition[];
  onWidgetSelect?: (widgetId: string) => void;
  onWidgetDrop?: (widgetId: string, position: { x: number; y: number }) => void;
  onAgentSelect?: (agentId: string) => void;
  position?: 'bottom' | 'top';
  activeWidgetIds?: string[];
  activeAgentId?: string | null;
}

export const DEFAULT_WIDGETS: WidgetDefinition[] = [
  { id: 'email', icon: EmailIcon, label: 'Email', color: CanvasTokens.glow.eli },
  { id: 'invoice', icon: InvoiceIcon, label: 'Invoice', color: CanvasTokens.glow.finn },
  { id: 'phone', icon: PhoneIcon, label: 'Phone', color: '#22C55E' },
  { id: 'messages', icon: TextMessageIcon, label: 'Messages', color: '#0EA5E9' },
  { id: 'quote', icon: QuoteIcon, label: 'Quote', color: CanvasTokens.glow.ava },
  { id: 'contract', icon: ContractIcon, label: 'Contract', color: '#F59E0B' },
  { id: 'calendar', icon: CalendarIcon, label: 'Calendar', color: '#8B5CF6' },
  { id: 'finance', icon: FinanceIcon, label: 'Finance', color: CanvasTokens.glow.finn },
  { id: 'task', icon: TaskIcon, label: 'Task', color: '#06B6D4' },
  { id: 'approval', icon: ApprovalIcon, label: 'Approval', color: '#EAB308' },
  { id: 'note', icon: NoteIcon, label: 'Note', color: '#A855F7' },
  { id: 'receipt', icon: ReceiptIcon, label: 'Receipt', color: '#10B981' },
];

export const AGENT_WIDGETS: WidgetDefinition[] = [
  { id: 'ava', label: 'Ava', isAgent: true, avatarImage: require('@/assets/avatars/ava.png') },
  { id: 'eli', label: 'Eli', isAgent: true, avatarImage: require('@/assets/avatars/eli.png') },
  { id: 'finn', label: 'Finn', isAgent: true, avatarImage: require('@/assets/avatars/finn.png') },
];

const SPRING_CONFIG = { damping: 22, stiffness: 260, mass: 0.9 };
const AVATAR_INSET = 3;
const AVATAR_SIZE = CanvasTokens.dock.iconSize - AVATAR_INSET * 2;
const AVATAR_RADIUS = CanvasTokens.dock.iconRadius - 2;

interface WidgetIconButtonProps {
  widget: WidgetDefinition;
  onPress: () => void;
  onDragDrop?: (widgetId: string, position: { x: number; y: number }) => void;
  index: number;
  isActive?: boolean;
  isVoiceActive?: boolean;
}

function WidgetIconButton({ widget, onPress, onDragDrop, index, isActive, isVoiceActive }: WidgetIconButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isAgent = !!widget.isAgent;
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  const scaleValue = useSharedValue(1.0);
  const translateY = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const opacityValue = useSharedValue(1.0);
  const entranceScale = useSharedValue(0.5);
  const entranceOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(1.0);

  useEffect(() => {
    entranceScale.value = withDelay(
      200 + index * 35,
      withSpring(1, { damping: 18, stiffness: 200 })
    );
    entranceOpacity.value = withDelay(
      200 + index * 35,
      withTiming(1, { duration: 250 })
    );
  }, []);

  useEffect(() => {
    if (isVoiceActive) {
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 800 }),
          withTiming(1.0, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      glowPulse.value = withTiming(1.0, { duration: 300 });
    }
  }, [isVoiceActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleValue.value * entranceScale.value },
      { translateY: translateY.value },
    ],
    opacity: opacityValue.value * entranceOpacity.value,
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [{ translateY: tooltipOpacity.value === 0 ? 4 : 0 }],
  }));

  const voiceGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowPulse.value }],
  }));

  useEffect(() => {
    if (isDragging) {
      opacityValue.value = withSpring(0.4, SPRING_CONFIG);
      scaleValue.value = withSpring(0.9, SPRING_CONFIG);
      playSound('dock_drag_start');
    } else {
      opacityValue.value = withSpring(1.0, SPRING_CONFIG);
      scaleValue.value = withSpring(1.0, SPRING_CONFIG);
    }
  }, [isDragging]);

  const ghostRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    const pe = e as PointerEvent;
    dragStartRef.current = { x: pe.clientX, y: pe.clientY };
    didDragRef.current = false;

    const gradientColors = CanvasTokens.iconGradients[widget.id] || ['#3B82F6', '#2563EB'];

    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 6 && !didDragRef.current) return;

      if (!didDragRef.current) {
        didDragRef.current = true;
        setIsDragging(true);
        const ghost = document.createElement('div');
        ghost.style.cssText = `
          position: fixed; z-index: 99999; pointer-events: none;
          width: ${CanvasTokens.dock.iconSize}px; height: ${CanvasTokens.dock.iconSize}px;
          border-radius: ${CanvasTokens.dock.iconRadius}px;
          background: linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]});
          box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.15);
          opacity: 0.9;
        `;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
      }

      if (ghostRef.current) {
        ghostRef.current.style.left = `${ev.clientX - CanvasTokens.dock.iconSize / 2}px`;
        ghostRef.current.style.top = `${ev.clientY - CanvasTokens.dock.iconSize / 2}px`;
      }
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
    };

    const onUp = (ev: PointerEvent) => {
      const wasDragging = didDragRef.current;
      dragStartRef.current = null;
      didDragRef.current = false;
      cleanup();

      if (wasDragging) {
        setIsDragging(false);
        const canvasEl = document.querySelector('[data-canvas-drop]') as HTMLElement | null;
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          if (
            ev.clientX >= rect.left && ev.clientX <= rect.right &&
            ev.clientY >= rect.top && ev.clientY <= rect.bottom
          ) {
            const relX = snapToGrid(ev.clientX - rect.left);
            const relY = snapToGrid(ev.clientY - rect.top);
            onDragDrop?.(widget.id, { x: Math.max(0, relX), y: Math.max(0, relY) });
          }
        }
      }
    };

    const onCancel = () => {
      dragStartRef.current = null;
      didDragRef.current = false;
      setIsDragging(false);
      cleanup();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  }, [isAgent, widget.id, onDragDrop]);

  const handleHoverIn = () => {
    if (isDragging) return;
    initSoundManager();
    setIsHovered(true);
    scaleValue.value = withSpring(1.08, SPRING_CONFIG);
    translateY.value = withSpring(-8, SPRING_CONFIG);
    tooltipOpacity.value = withTiming(1, { duration: 150 });
    playSound('dock_hover');
  };

  const handleHoverOut = () => {
    setIsHovered(false);
    if (!isPressed && !isDragging) {
      scaleValue.value = withSpring(1.0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      tooltipOpacity.value = withTiming(0, { duration: 120 });
    }
  };

  const handlePressIn = () => {
    setIsPressed(true);
    scaleValue.value = withSpring(0.92, { damping: 30, stiffness: 400, mass: 0.8 });
    translateY.value = withSpring(2, { damping: 30, stiffness: 400 });
  };

  const handlePressOut = () => {
    setIsPressed(false);
    if (isHovered) {
      scaleValue.value = withSpring(1.08, SPRING_CONFIG);
      translateY.value = withSpring(-8, SPRING_CONFIG);
    } else {
      scaleValue.value = withSpring(1.0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      tooltipOpacity.value = withTiming(0, { duration: 120 });
    }
  };

  const handlePress = useCallback(() => {
    if (didDragRef.current) return;
    onPress();
  }, [onPress]);

  const gradientColors = CanvasTokens.iconGradients[widget.id] || ['#3B82F6', '#2563EB'];
  const iconColor = gradientColors[0];

  const icon3DFilter = Platform.OS === 'web'
    ? isHovered
      ? (`drop-shadow(0 5px 0px rgba(0,0,0,0.75)) drop-shadow(0 10px 20px rgba(0,0,0,0.65)) drop-shadow(0 0 18px ${iconColor}99)` as any)
      : (`drop-shadow(0 3px 0px rgba(0,0,0,0.65)) drop-shadow(0 6px 14px rgba(0,0,0,0.55)) drop-shadow(0 0 10px ${iconColor}66)` as any)
    : undefined;

  const voiceGlowWebStyle = Platform.OS === 'web' && isVoiceActive
    ? ({
        boxShadow: `0 0 16px 4px ${iconColor}88, 0 0 32px 8px ${iconColor}44`,
      } as any)
    : {};

  const cursorStyle = Platform.OS === 'web'
    ? isDragging
      ? ({ cursor: 'grabbing' } as any)
      : ({ cursor: 'grab' } as any)
    : {};

  const IconComponent = widget.icon;

  return (
    <Pressable
      onPointerDown={Platform.OS === 'web' ? handlePointerDown : undefined}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={Platform.OS === 'web' ? handleHoverIn : undefined}
      onHoverOut={Platform.OS === 'web' ? handleHoverOut : undefined}
      accessibilityRole="button"
      accessibilityLabel={
        isAgent
          ? `${widget.label} - Tap to open voice widget`
          : `${widget.label} - Drag to canvas or tap to open`
      }
      style={[styles.iconButtonWrapper, cursorStyle]}
    >
      <Animated.View style={[styles.tooltip, tooltipStyle]} pointerEvents="none">
        <Text style={styles.tooltipText}>{widget.label}</Text>
      </Animated.View>

      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        {isVoiceActive && (
          <Animated.View
            style={[styles.voiceGlowRing, voiceGlowStyle, voiceGlowWebStyle]}
            pointerEvents="none"
          />
        )}
        <View
          style={[styles.iconTile, ...(Platform.OS === 'web' ? [{ filter: icon3DFilter } as any] : [])]}
        >
          {widget.avatarImage ? (
            <Image
              source={widget.avatarImage}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : widget.iconImage ? (
            <Image
              source={{ uri: widget.iconImage }}
              style={styles.dockIconImg}
              resizeMode="contain"
            />
          ) : IconComponent ? (
            <IconComponent size={40} color={iconColor} />
          ) : null}
        </View>
      </Animated.View>

      {isActive && <View style={styles.activeDot} />}
      {isVoiceActive && <View style={[styles.activeDot, { backgroundColor: iconColor }]} />}
    </Pressable>
  );
}

function DockDivider() {
  return <View style={styles.divider} />;
}

export function WidgetDock({
  widgets = DEFAULT_WIDGETS,
  onWidgetSelect,
  onWidgetDrop,
  onAgentSelect,
  position = 'bottom',
  activeWidgetIds = [],
  activeAgentId = null,
}: WidgetDockProps) {
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const styleId = 'dock-scrollbar-hide';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = '.dock-scroll::-webkit-scrollbar { display: none; }';
    document.head.appendChild(style);
  }, []);

  const dockSlideY = useSharedValue(50);
  const dockOpacity = useSharedValue(0);

  useEffect(() => {
    dockSlideY.value = withDelay(180, withSpring(0, { damping: 20, stiffness: 180, mass: 1.1 }));
    dockOpacity.value = withDelay(180, withTiming(1, { duration: 300 }));
  }, []);

  const dockAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dockSlideY.value }],
    opacity: dockOpacity.value,
  }));

  const margin = width >= 1440
    ? Canvas.workspace.margin.wide
    : width >= 1200
      ? Canvas.workspace.margin.desktop
      : width >= 1024
        ? Canvas.workspace.margin.laptop
        : Canvas.workspace.margin.tablet;

  const handlePress = (widget: WidgetDefinition) => {
    if (widget.isAgent) {
      onAgentSelect?.(widget.id);
    } else {
      onWidgetSelect?.(widget.id);
    }
  };

  const allWidgets = [...widgets, ...AGENT_WIDGETS];

  return (
    <Animated.View
      style={[
        styles.dock,
        position === 'top' ? styles.dockTop : styles.dockBottom,
        { paddingBottom: position === 'bottom' ? margin : undefined },
        dockAnimStyle,
      ]}
    >
      <View style={styles.dockShelf}>
        <View style={styles.shelfEdgeBottom} pointerEvents="none" />
        <View style={styles.shelfEdgeRight} pointerEvents="none" />

        <View style={styles.shelfSurface}>
          <View style={styles.shelfDecorationClip} pointerEvents="none">
            <View style={styles.shelfHighlight} />
            <View style={styles.shelfInnerTop} />
            <View style={styles.shelfInnerBottom} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={[
              styles.scrollView,
              Platform.OS === 'web' && ({
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              } as any),
            ]}
            {...(Platform.OS === 'web' ? { dataSet: { class: 'dock-scroll' }, className: 'dock-scroll' } as any : {})}
          >
            <View style={styles.iconsContainer}>
              {allWidgets.map((widget, index) => {
                const showDivider = index === widgets.length;
                return (
                  <React.Fragment key={widget.id}>
                    {showDivider && <DockDivider />}
                    <WidgetIconButton
                      widget={widget}
                      onPress={() => handlePress(widget)}
                      onDragDrop={onWidgetDrop}
                      index={index}
                      isActive={activeWidgetIds.includes(widget.id)}
                      isVoiceActive={widget.isAgent && activeAgentId === widget.id}
                    />
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },

  dockBottom: {
    bottom: 0,
    paddingBottom: 24,
  },

  dockTop: {
    top: 0,
    paddingTop: 24,
  },

  dockShelf: {
    position: 'relative',
    maxWidth: 920,
  },

  shelfEdgeBottom: {
    position: 'absolute',
    bottom: -CanvasTokens.dock.edgeThickness,
    left: 2,
    right: -2,
    height: CanvasTokens.dock.edgeThickness,
    backgroundColor: CanvasTokens.dock.edgeColor,
    borderBottomLeftRadius: CanvasTokens.dock.surfaceRadius,
    borderBottomRightRadius: CanvasTokens.dock.surfaceRadius,
    zIndex: 0,
  },

  shelfEdgeRight: {
    position: 'absolute',
    top: 2,
    right: -CanvasTokens.dock.edgeThickness / 2,
    bottom: -2,
    width: CanvasTokens.dock.edgeThickness / 2,
    backgroundColor: CanvasTokens.dock.edgeColor,
    borderTopRightRadius: CanvasTokens.dock.surfaceRadius,
    borderBottomRightRadius: CanvasTokens.dock.surfaceRadius,
    zIndex: 0,
  },

  shelfSurface: {
    backgroundColor: CanvasTokens.dock.background,
    borderRadius: CanvasTokens.dock.surfaceRadius,
    paddingHorizontal: CanvasTokens.dock.paddingH,
    paddingVertical: CanvasTokens.dock.paddingV,
    position: 'relative',
    zIndex: 1,
    ...(Platform.OS === 'web' && {
      boxShadow: CanvasTokens.dock.outerShadow,
    } as any),
  },

  shelfDecorationClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CanvasTokens.dock.surfaceRadius,
    overflow: 'hidden',
    zIndex: 10,
    pointerEvents: 'none',
  },

  shelfHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 100%)',
        } as any)
      : { backgroundColor: CanvasTokens.dock.topHighlight }),
  },

  shelfInnerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 5,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 100%)',
        } as any)
      : {}),
  },

  shelfInnerBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    zIndex: 5,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.12) 0%, transparent 100%)',
        } as any)
      : {}),
  },

  scrollView: {
    maxWidth: '100%',
  },

  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },

  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: CanvasTokens.dock.iconSpacing,
    paddingTop: 26,
  },

  iconButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  tooltip: {
    position: 'absolute',
    top: -30,
    backgroundColor: CanvasTokens.dock.tooltipBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 100,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    } as any),
  },

  tooltipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  iconContainer: {
    width: CanvasTokens.dock.iconSize,
    height: CanvasTokens.dock.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  voiceGlowRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: CanvasTokens.dock.iconRadius + 4,
    zIndex: -1,
  },

  iconTile: {
    width: CanvasTokens.dock.iconSize,
    height: CanvasTokens.dock.iconSize,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },

  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    zIndex: 1,
  },

  dockIconImg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    zIndex: 1,
  },

  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
    alignSelf: 'center',
    borderRadius: 0.5,
  },

  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 4px rgba(255,255,255,0.5)',
    } as any),
  },
});
