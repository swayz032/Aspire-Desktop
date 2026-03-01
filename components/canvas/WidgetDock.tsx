import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useDraggable } from '@/lib/canvasDragDrop';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Canvas } from '@/constants/tokens';

// Import custom SVG icons
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

// ============================================================================
// Types
// ============================================================================

export interface WidgetDefinition {
  id: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  color?: string;
}

export interface WidgetDockProps {
  widgets: WidgetDefinition[];
  onWidgetSelect?: (widgetId: string) => void;
  position?: 'bottom' | 'top';
}

// ============================================================================
// Default Widget Definitions
// ============================================================================

export const DEFAULT_WIDGETS: WidgetDefinition[] = [
  { id: 'email', icon: EmailIcon, label: 'Email', color: CanvasTokens.glow.eli },
  { id: 'invoice', icon: InvoiceIcon, label: 'Invoice', color: CanvasTokens.glow.finn },
  { id: 'quote', icon: QuoteIcon, label: 'Quote', color: CanvasTokens.glow.ava },
  { id: 'contract', icon: ContractIcon, label: 'Contract', color: '#F59E0B' },
  { id: 'calendar', icon: CalendarIcon, label: 'Calendar', color: '#8B5CF6' },
  { id: 'finance', icon: FinanceIcon, label: 'Finance', color: CanvasTokens.glow.finn },
  { id: 'task', icon: TaskIcon, label: 'Task', color: '#06B6D4' },
  { id: 'approval', icon: ApprovalIcon, label: 'Approval', color: '#EAB308' },
  { id: 'note', icon: NoteIcon, label: 'Note', color: '#A855F7' },
  { id: 'receipt', icon: ReceiptIcon, label: 'Receipt', color: '#10B981' },
];

// ============================================================================
// Widget Icon Button Component
// ============================================================================

interface WidgetIconButtonProps {
  widget: WidgetDefinition;
  onPress: () => void;
  index: number;
}

function WidgetIconButton({ widget, onPress, index }: WidgetIconButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Drag-drop integration (web-only)
  const { attributes, listeners, setNodeRef, isDragging } = Platform.OS === 'web'
    ? useDraggable({ id: widget.id })
    : { attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false };

  // Shared values for spring animations
  const scaleValue = useSharedValue(1.0);
  const glowOpacity = useSharedValue(0);
  const opacityValue = useSharedValue(1.0);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
    opacity: opacityValue.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Visual feedback during drag
  React.useEffect(() => {
    if (isDragging) {
      // Fade out when dragging (widget moves to canvas)
      opacityValue.value = withSpring(0.3, {
        damping: 20,
        stiffness: 300,
      });
      scaleValue.value = withSpring(0.95, {
        damping: 25,
        stiffness: 280,
      });
    } else {
      // Restore opacity when drag ends
      opacityValue.value = withSpring(1.0, {
        damping: 25,
        stiffness: 280,
      });
      scaleValue.value = withSpring(1.0, {
        damping: 25,
        stiffness: 200,
      });
    }
  }, [isDragging]);

  // Handle hover enter
  const handleHoverIn = () => {
    if (isDragging) return;
    setIsHovered(true);
    scaleValue.value = withSpring(1.1, {
      damping: 20,
      stiffness: 300,
      mass: 1,
    });
    glowOpacity.value = withSpring(0.4, {
      damping: 20,
      stiffness: 300,
    });
  };

  // Handle hover exit
  const handleHoverOut = () => {
    setIsHovered(false);
    if (!isPressed && !isDragging) {
      scaleValue.value = withSpring(1.0, {
        damping: 25,
        stiffness: 200,
      });
      glowOpacity.value = withSpring(0, {
        damping: 25,
        stiffness: 200,
      });
    }
  };

  // Handle press in
  const handlePressIn = () => {
    setIsPressed(true);
    scaleValue.value = withSpring(0.95, {
      damping: 30,
      stiffness: 400,
      mass: 0.8,
    });
  };

  // Handle press out
  const handlePressOut = () => {
    setIsPressed(false);
    if (isHovered) {
      scaleValue.value = withSpring(1.1, {
        damping: 20,
        stiffness: 300,
        mass: 1,
      });
    } else {
      scaleValue.value = withSpring(1.0, {
        damping: 25,
        stiffness: 200,
      });
      glowOpacity.value = withSpring(0, {
        damping: 25,
        stiffness: 200,
      });
    }
  };

  const IconComponent = widget.icon;
  const iconColor = widget.color || CanvasTokens.glow.eli;

  const pressableProps = Platform.OS === 'web'
    ? {
        ...attributes,
        ...listeners,
        ref: setNodeRef as any,
      }
    : {};

  return (
    <Pressable
      {...pressableProps}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={Platform.OS === 'web' ? handleHoverIn : undefined}
      onHoverOut={Platform.OS === 'web' ? handleHoverOut : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${widget.label} - Drag to canvas or tap to open`}
      style={[
        styles.iconButtonWrapper,
        Platform.OS === 'web' && isDragging
          ? ({ cursor: 'grabbing' } as any)
          : Platform.OS === 'web'
          ? ({ cursor: 'grab' } as any)
          : {},
      ]}
    >
      <Animated.View style={[styles.iconContainer, animatedStyle]}>
        {/* Glow layer (visible on hover) */}
        <Animated.View
          style={[
            styles.glowLayer,
            glowStyle,
            {
              shadowColor: iconColor,
              ...(Platform.OS === 'web' && {
                filter: `blur(12px)`,
              } as any),
            },
          ]}
        />

        {/* Icon content */}
        <View style={styles.iconContent}>
          <IconComponent size={24} color="#FFFFFF" />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// Main WidgetDock Component
// ============================================================================

export function WidgetDock({
  widgets = DEFAULT_WIDGETS,
  onWidgetSelect,
  position = 'bottom',
}: WidgetDockProps) {
  const { width } = useWindowDimensions();

  // Responsive layout logic
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

  // Determine visible icons and scroll behavior
  const visibleIconCount = isDesktop ? 10 : isTablet ? 8 : 6;
  const needsScroll = widgets.length > visibleIconCount;
  const visibleWidgets = needsScroll ? widgets.slice(0, visibleIconCount) : widgets;

  const handleWidgetPress = (widgetId: string) => {
    onWidgetSelect?.(widgetId);
  };

  const dockContent = (
    <View style={styles.iconsContainer}>
      {visibleWidgets.map((widget, index) => (
        <WidgetIconButton
          key={widget.id}
          widget={widget}
          onPress={() => handleWidgetPress(widget.id)}
          index={index}
        />
      ))}
    </View>
  );

  return (
    <View
      style={[
        styles.dock,
        position === 'top' ? styles.dockTop : styles.dockBottom,
      ]}
    >
      <View style={styles.dockInner}>
        {needsScroll ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
          >
            {dockContent}
          </ScrollView>
        ) : (
          dockContent
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

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
    paddingBottom: 20,
  },

  dockTop: {
    top: 0,
    paddingTop: 20,
  },

  dockInner: {
    backgroundColor: CanvasTokens.dock.background,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } as any),
    // Shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  scrollView: {
    maxWidth: '100%',
  },

  scrollContent: {
    alignItems: 'center',
  },

  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: CanvasTokens.dock.iconSpacing,
  },

  iconButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconContainer: {
    width: CanvasTokens.dock.iconSize,
    height: CanvasTokens.dock.iconSize,
    borderRadius: CanvasTokens.dock.iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  glowLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CanvasTokens.dock.iconSize / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },

  iconContent: {
    width: CanvasTokens.dock.iconSize,
    height: CanvasTokens.dock.iconSize,
    borderRadius: CanvasTokens.dock.iconSize / 2,
    backgroundColor: CanvasTokens.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
  },
});
