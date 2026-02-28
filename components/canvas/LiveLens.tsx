import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Animated,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Canvas,
  Colors,
  Typography,
  Shadows,
  BorderRadius,
  Spacing,
} from '@/constants/tokens';
import { useImmersion } from '@/lib/immersionStore';
import { getTile, type TileLensField, type TileVerb } from '@/lib/tileManifest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveLensProps {
  tileId: string;
  anchorPosition: { x: number; y: number; width: number; height: number };
  onClose: () => void;
  onOpenStage: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_WIDTH = 320;
const EDGE_MARGIN = 12;

function getPlaceholder(type: TileLensField['type']): string {
  switch (type) {
    case 'currency': return '$0.00';
    case 'date': return 'Select date...';
    case 'email': return 'email@example.com';
    case 'status': return 'Pending';
    case 'text': return 'Enter...';
  }
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveLens({
  tileId,
  anchorPosition,
  onClose,
  onOpenStage,
}: LiveLensProps): React.ReactElement | null {
  const { mode } = useImmersion();
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Resolve tile data (deny-by-default) — hooks must run unconditionally
  const tile = useMemo(() => getTile(tileId), [tileId]);
  const defaultVerb = useMemo(() => {
    if (!tile) return null;
    return tile.verbs.find((v) => v.id === tile.defaultVerb) ?? tile.verbs[0] ?? null;
  }, [tile]);

  // Should render?
  const shouldRender = mode === 'canvas' && tile !== null && defaultVerb !== null;

  // Position: above or below anchor depending on viewport space
  // Also check right edge to avoid overflow
  const positionStyle = useMemo<ViewStyle>(() => {
    if (!shouldRender) return { position: 'absolute', top: 0, left: 0 };

    const viewportHeight = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerHeight
      : 800;
    const viewportWidth = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth
      : 1200;

    const spaceBelow = viewportHeight - (anchorPosition.y + anchorPosition.height);
    const showAbove = spaceBelow < 280;

    // Horizontal: prefer aligning with tile left edge, but clamp to viewport
    let left = anchorPosition.x;
    if (left + MAX_WIDTH + EDGE_MARGIN > viewportWidth) {
      left = viewportWidth - MAX_WIDTH - EDGE_MARGIN;
    }
    if (left < EDGE_MARGIN) {
      left = EDGE_MARGIN;
    }

    return {
      position: 'absolute',
      left,
      ...(showAbove
        ? { bottom: viewportHeight - anchorPosition.y + 8 }
        : { top: anchorPosition.y + anchorPosition.height + 8 }),
    };
  }, [shouldRender, anchorPosition]);

  // Entrance animation
  useEffect(() => {
    if (!shouldRender) return;

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: Canvas.motion.lensOpen,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: Canvas.motion.lensOpen,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shouldRender, scaleAnim, opacityAnim]);

  // Close with animation
  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: Canvas.motion.lensClose,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: Canvas.motion.lensClose,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [scaleAnim, opacityAnim, onClose]);

  // Keyboard: Enter opens Stage, Escape closes
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onOpenStage();
      }
    },
    [handleClose, onOpenStage],
  );

  // Early return AFTER all hooks
  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[
        styles.card,
        positionStyle,
        Shadows.lg,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Quick preview: ${tile!.label}`}
      {...(Platform.OS === 'web' ? { onKeyDown: handleKeyDown } as Record<string, unknown> : {})}
    >
      {/* Halo ring */}
      <View
        style={[styles.haloRing]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {/* Header: icon + label + risk badge */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={tile!.icon as keyof typeof Ionicons.glyphMap}
            size={18}
            color={Colors.accent.cyan}
          />
          <Text style={styles.headerLabel}>{tile!.label}</Text>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: getRiskBg(defaultVerb!.riskTier) }]}>
          <Text style={[styles.riskBadgeText, { color: getRiskColor(defaultVerb!.riskTier) }]}>
            {defaultVerb!.riskTier.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Verb label */}
      <Text style={styles.verbLabel}>{defaultVerb!.label}</Text>

      {/* Lens fields */}
      <View style={styles.fieldsContainer}>
        {defaultVerb!.lensFields.map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text style={styles.fieldValue}>{getPlaceholder(field.type)}</Text>
          </View>
        ))}
      </View>

      {/* Hint */}
      <View style={styles.hint}>
        <Ionicons name="return-down-back-outline" size={12} color={Colors.text.muted} />
        <Text style={styles.hintText}>Press Enter to open</Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    width: MAX_WIDTH,
    backgroundColor: Colors.surface.cardElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.premium,
    padding: Spacing.lg,
    zIndex: 500,
    overflow: 'hidden',
  },
  haloRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.lg,
    borderWidth: Canvas.halo.width,
    borderColor: Canvas.halo.color,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: `0 0 ${Canvas.halo.blurRadius}px ${Canvas.halo.color}`,
        } as unknown as ViewStyle)
      : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerLabel: {
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: Typography.captionMedium.fontWeight,
    color: Colors.text.primary,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  riskBadgeText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
  },
  verbLabel: {
    fontSize: Typography.small.fontSize,
    fontWeight: Typography.small.fontWeight,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  fieldsContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: Typography.small.fontSize,
    fontWeight: Typography.smallMedium.fontWeight,
    color: Colors.text.secondary,
  },
  fieldValue: {
    fontSize: Typography.small.fontSize,
    color: Colors.text.muted,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  hintText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.text.muted,
  },
});
