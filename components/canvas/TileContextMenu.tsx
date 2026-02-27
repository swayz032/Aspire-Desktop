import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Canvas,
} from '@/constants/tokens';
import { getTile, type TileVerb } from '@/lib/tileManifest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TileContextMenuProps {
  tileId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSelectVerb: (verbId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_WIDTH = 220;
const MENU_PADDING = 6;
const EDGE_MARGIN = 12;

function getRiskColor(tier: TileVerb['riskTier']): string {
  switch (tier) {
    case 'green': return Colors.semantic.success;
    case 'yellow': return Colors.semantic.warning;
    case 'red': return Colors.semantic.error;
  }
}

function getRiskBg(tier: TileVerb['riskTier']): string {
  switch (tier) {
    case 'green': return Colors.semantic.successLight;
    case 'yellow': return Colors.semantic.warningLight;
    case 'red': return Colors.semantic.errorLight;
  }
}

// Viewport boundary detection — flip position to avoid overflow
function getAdjustedPosition(
  pos: { x: number; y: number },
  menuHeight: number,
): { top: number; left: number } {
  const { width: vw, height: vh } = Dimensions.get('window');

  let left = pos.x;
  let top = pos.y;

  // Flip horizontally if too close to right edge
  if (left + MAX_WIDTH + EDGE_MARGIN > vw) {
    left = pos.x - MAX_WIDTH;
  }
  // Ensure not off left edge
  if (left < EDGE_MARGIN) {
    left = EDGE_MARGIN;
  }

  // Flip vertically if too close to bottom edge
  if (top + menuHeight + EDGE_MARGIN > vh) {
    top = pos.y - menuHeight;
  }
  // Ensure not off top edge
  if (top < EDGE_MARGIN) {
    top = EDGE_MARGIN;
  }

  return { top, left };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TileContextMenu({
  tileId,
  position,
  onClose,
  onSelectVerb,
}: TileContextMenuProps): React.ReactElement | null {
  const tile = getTile(tileId);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Deny-by-default: unknown tile = no menu
  if (!tile) return null;

  const verbs = tile.verbs;
  if (verbs.length === 0) return null;

  // Estimate menu height for boundary detection
  const estimatedHeight = MENU_PADDING * 2 + verbs.length * 40;
  const adjusted = getAdjustedPosition(position, estimatedHeight);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: Canvas.motion.spring.damping,
        stiffness: Canvas.motion.spring.stiffness,
        mass: Canvas.motion.spring.mass,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  // Close on scroll (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [onClose]);

  // Close on click outside (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('[data-context-menu]')) {
        onClose();
      }
    };

    // Delay to avoid catching the opening right-click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, verbs.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const verb = verbs[focusedIndex];
        if (verb) {
          onSelectVerb(verb.id);
        }
      }
    },
    [verbs, focusedIndex, onClose, onSelectVerb],
  );

  return (
    <Animated.View
      style={[
        styles.menu,
        {
          top: adjusted.top,
          left: adjusted.left,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      accessibilityRole="menu"
      accessibilityLabel={`Actions for ${tile.label}`}
      {...(Platform.OS === 'web'
        ? {
            'data-context-menu': 'true',
            onKeyDown: handleKeyDown,
            tabIndex: 0,
          } as Record<string, unknown>
        : {})}
    >
      {verbs.map((verb, idx) => {
        const isFocused = idx === focusedIndex;

        return (
          <Pressable
            key={verb.id}
            style={({ hovered }: any) => [
              styles.menuItem,
              isFocused && styles.menuItemFocused,
              hovered && !isFocused && styles.menuItemHover,
            ]}
            onPress={() => onSelectVerb(verb.id)}
            accessibilityRole="menuitem"
            accessibilityLabel={`${verb.label} — ${verb.riskTier} risk`}
            accessibilityState={{ selected: isFocused }}
          >
            <Text
              style={[
                styles.menuItemLabel,
                isFocused && styles.menuItemLabelFocused,
              ]}
              numberOfLines={1}
            >
              {verb.label}
            </Text>
            <View style={[styles.riskPill, { backgroundColor: getRiskBg(verb.riskTier) }]}>
              <Text style={[styles.riskPillText, { color: getRiskColor(verb.riskTier) }]}>
                {verb.riskTier}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: MAX_WIDTH,
    backgroundColor: Colors.surface.cardElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.premium,
    padding: MENU_PADDING,
    zIndex: 600,
    ...Shadows.lg,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        } as unknown as ViewStyle)
      : {}),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    minHeight: 36,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background-color 0.1s ease-out' } as unknown as ViewStyle)
      : {}),
  },
  menuItemFocused: {
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  menuItemHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  menuItemLabel: {
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    color: Colors.text.secondary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  menuItemLabelFocused: {
    color: Colors.text.primary,
    fontWeight: '500',
  },
  riskPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  riskPillText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
