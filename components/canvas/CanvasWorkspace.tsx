/**
 * CanvasWorkspace — Premium physical canvas workspace with REAL depth.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - REAL canvas with physical presence — thick, substantial workspace surface
 * - Two-tone gray: #2A2A2A canvas surface + #1E1E1E widget cards
 * - Clean physical shadows (NOT sci-fi blue glow)
 * - Subtle edge vignette for depth (NOT radial blue gradients)
 * - Dot grid visible on gray surface — premium drafting table feel
 *
 * Reference Quality: Claude.ai Cowork, Figma workspace, Bloomberg Terminal.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
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
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Canvas as CanvasTokens,
  Shadows,
} from '@/constants/tokens';
import {
  useImmersion,
  setStageOpen,
  setLensOpen,
} from '@/lib/immersionStore';
import {
  getAllTiles,
  type TileEntry,
} from '@/lib/tileManifest';
import { useDroppable, useCanvasDragDrop } from '@/lib/canvasDragDrop';
import { CanvasGrid } from './CanvasGrid';
import { VignetteOverlay } from './VignetteOverlay';
import { Stage } from './Stage';
import { LiveLens } from './LiveLens';
import { RunwayDisplay } from './RunwayDisplay';
import { CommandPalette } from './CommandPalette';
import { TileContextMenu } from './TileContextMenu';
import { SnapGhost } from './SnapGhost';
import { DragPreview } from './DragPreview';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { playSound } from '@/lib/soundManager';
import { CanvasModeToggle } from './CanvasModeToggle';
import { ChatCanvas } from './ChatCanvas';
import { Persona } from '@/components/ai-elements/Persona';
import { subscribe as subscribeCanvas, getMode as getCanvasMode, getPersonaState, getActiveAgent } from '@/lib/chatCanvasStore';
import type { CanvasMode } from '@/lib/chatCanvasStore';

// ---------------------------------------------------------------------------
// Premium spring physics for Canvas Mode entrance
// ---------------------------------------------------------------------------

const CANVAS_SPRING_CONFIG = {
  damping: 25,
  stiffness: 200,
  mass: 1.0,
  useNativeDriver: true,
};

// ---------------------------------------------------------------------------
// CSS Keyframes — injected once on web for premium animations
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-canvas-workspace-premium';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      /* Widget drop from dock — spring entrance */
      @keyframes widgetDrop {
        0% { transform: translateY(-100px) scale(0.95); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }

      /* Shadow grow on widget placement — clean physical depth */
      @keyframes shadowGrow {
        0% { box-shadow: 0 0 0 rgba(0,0,0,0); }
        100% {
          box-shadow:
            0 2px 8px rgba(0,0,0,0.3),
            0 1px 3px rgba(0,0,0,0.2);
        }
      }

      /* Reduced motion — snap all animations */
      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.01ms !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Desk accent colors
// ---------------------------------------------------------------------------

const DESK_ACCENT: Record<string, string> = {
  quinn: '#3B82F6', // Invoice — blue
  nora: '#8B5CF6', // Calendar — violet
  eli: '#06B6D4', // Email — cyan
  clara: '#F59E0B', // Contract — amber
  finn: '#EF4444', // Payment — red
  tec: '#10B981', // Document — emerald
};

function getDeskAccent(desk: string): string {
  return DESK_ACCENT[desk] ?? Colors.accent.cyan;
}

// ---------------------------------------------------------------------------
// Risk tier pill metadata
// ---------------------------------------------------------------------------

const RISK_META: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: 'rgba(52,199,89,0.12)', text: '#34c759', label: 'GREEN' },
  yellow: { bg: 'rgba(212,160,23,0.12)', text: '#d4a017', label: 'YELLOW' },
  red: { bg: 'rgba(255,59,48,0.12)', text: '#ff3b30', label: 'RED' },
};

// ---------------------------------------------------------------------------
// Tile anchor tracking (for LiveLens + ContextMenu positioning)
// ---------------------------------------------------------------------------

interface TileAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// CanvasWidget — Premium widget card with VISIBLE shadows + rim lighting
// ---------------------------------------------------------------------------

interface CanvasWidgetProps {
  tile: TileEntry;
  index: number;
  entranceAnim: Animated.Value;
  onPress: (tileId: string) => void;
  onHoverIn: (tileId: string, anchor: TileAnchor) => void;
  onHoverOut: () => void;
  onContextMenu: (tileId: string, position: { x: number; y: number }) => void;
}

function CanvasWidget({
  tile,
  index,
  entranceAnim,
  onPress,
  onHoverIn,
  onHoverOut,
  onContextMenu,
}: CanvasWidgetProps): React.ReactElement {
  const accent = getDeskAccent(tile.desk);
  const defaultVerb = tile.verbs.find((v) => v.id === tile.defaultVerb) ?? tile.verbs[0];
  const risk = RISK_META[defaultVerb?.riskTier ?? 'green'] ?? RISK_META.green;
  const widgetRef = useRef<View>(null);

  // Entrance animation interpolations
  const translateY = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],
  });
  const scale = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });
  const opacity = entranceAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.6, 1],
  });

  // Measure widget bounds for LiveLens anchor
  const measureAndHover = useCallback(() => {
    if (Platform.OS === 'web' && widgetRef.current) {
      const el = widgetRef.current as unknown as HTMLElement;
      const rect = el.getBoundingClientRect();
      onHoverIn(tile.id, {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  }, [tile.id, onHoverIn]);

  const handleContextMenu = useCallback(
    (e: any) => {
      if (Platform.OS === 'web') {
        e.preventDefault?.();
        e.stopPropagation?.();
        onContextMenu(tile.id, {
          x: e.nativeEvent?.pageX ?? e.pageX ?? 0,
          y: e.nativeEvent?.pageY ?? e.pageY ?? 0,
        });
      }
    },
    [tile.id, onContextMenu],
  );

  // Premium widget surface — clean solid card with physical depth
  // NO glassmorphism, NO blue glow — real shadows on gray canvas
  const webPremiumStyle: ViewStyle = Platform.OS === 'web'
    ? ({
        // Clean physical shadows — grounds card onto #2A2A2A surface
        boxShadow: [
          // Primary depth shadow — visible on gray canvas
          `0 2px 8px rgba(0,0,0,0.3)`,
          // Contact shadow — tight, grounding
          `0 1px 3px rgba(0,0,0,0.2)`,
          // Subtle top edge highlight — card separation
          `inset 0 1px 0 rgba(255,255,255,0.04)`,
        ].join(', '),
        // Cursor feedback
        cursor: 'pointer',
        // Smooth transitions
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      } as unknown as ViewStyle)
    : {};

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View
        ref={widgetRef}
        style={[widgetStyles.card, webPremiumStyle]}
        {...(Platform.OS === 'web'
          ? {
              onMouseEnter: measureAndHover,
              onMouseLeave: onHoverOut,
              onContextMenu: handleContextMenu,
            } as unknown as Record<string, unknown>
          : {})}
      >
        {/* Desk-color underglow (ambient color bleed) */}
        <View
          style={[
            widgetStyles.underglow,
            { backgroundColor: accent },
          ]}
        />

        {/* Icon ring — desk accent border */}
        <View
          style={[
            widgetStyles.iconRing,
            { borderColor: `${accent}40` },
          ]}
        >
          <View style={[widgetStyles.iconCircle, { backgroundColor: `${accent}15` }]}>
            <Ionicons
              name={tile.icon as keyof typeof Ionicons.glyphMap}
              size={28}
              color={accent}
            />
          </View>
        </View>

        {/* Tile label */}
        <Text style={widgetStyles.label}>{tile.label}</Text>

        {/* Desk tag */}
        <View style={widgetStyles.deskTag}>
          <Text style={[widgetStyles.deskText, { color: `${accent}CC` }]}>
            {tile.desk.toUpperCase()}
          </Text>
        </View>

        {/* Default verb + risk pill */}
        {defaultVerb && (
          <View style={widgetStyles.verbRow}>
            <Text style={widgetStyles.verbLabel} numberOfLines={1}>
              {defaultVerb.label}
            </Text>
            <View style={[widgetStyles.riskPill, { backgroundColor: risk.bg }]}>
              <Text style={[widgetStyles.riskText, { color: risk.text }]}>
                {risk.label}
              </Text>
            </View>
          </View>
        )}

        {/* Verb count */}
        <Text style={widgetStyles.verbCount}>
          {tile.verbs.length} action{tile.verbs.length !== 1 ? 's' : ''}
        </Text>

        {/* Pressable hit area */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onPress(tile.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${tile.label} workspace`}
        />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Widget card styles
// ---------------------------------------------------------------------------

const widgetStyles = StyleSheet.create({
  card: {
    width: CanvasTokens.workspace.tileWidth,
    height: CanvasTokens.workspace.tileHeight,
    borderRadius: CanvasTokens.workspace.tileBorderRadius,
    borderWidth: 1,
    borderColor: CanvasTokens.workspace.tileBorderColor,
    backgroundColor: CanvasTokens.workspace.tileBg,
    padding: CanvasTokens.workspace.tilePadding,
    overflow: 'visible', // CRITICAL: Shadows extend beyond bounds
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 10,
  },
  underglow: {
    position: 'absolute',
    bottom: -32,
    left: '25%' as any,
    right: '25%' as any,
    height: 48,
    borderRadius: 24,
    opacity: 0.04,
    ...(Platform.OS === 'web'
      ? { filter: 'blur(32px)' } as unknown as ViewStyle
      : {}),
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: CanvasTokens.tileType.label.fontSize,
    fontWeight: CanvasTokens.tileType.label.fontWeight,
    letterSpacing: CanvasTokens.tileType.label.letterSpacing,
    color: Colors.text.bright,
    marginTop: 4,
  },
  deskTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  deskText: {
    fontSize: CanvasTokens.tileType.deskTag.fontSize,
    fontWeight: CanvasTokens.tileType.deskTag.fontWeight,
    letterSpacing: CanvasTokens.tileType.deskTag.letterSpacing,
  },
  verbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 'auto' as any,
  },
  verbLabel: {
    fontSize: CanvasTokens.tileType.verbLabel.fontSize,
    fontWeight: CanvasTokens.tileType.verbLabel.fontWeight,
    color: Colors.text.tertiary,
    flex: 1,
  },
  riskPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  riskText: {
    fontSize: CanvasTokens.tileType.riskPill.fontSize,
    fontWeight: CanvasTokens.tileType.riskPill.fontWeight,
    letterSpacing: CanvasTokens.tileType.riskPill.letterSpacing,
  },
  verbCount: {
    fontSize: CanvasTokens.tileType.verbCount.fontSize,
    fontWeight: CanvasTokens.tileType.verbCount.fontWeight,
    color: Colors.text.muted,
    position: 'absolute',
    bottom: CanvasTokens.workspace.tilePadding,
    right: CanvasTokens.workspace.tilePadding,
  },
});

// ---------------------------------------------------------------------------
// CanvasWorkspace — REAL physical canvas with depth
// ---------------------------------------------------------------------------

export function CanvasWorkspace(): React.ReactElement {
  const { mode, runwayState, stageOpen } = useImmersion();
  const tiles = useMemo(() => getAllTiles(), []);

  // Chat | Canvas sub-mode (internal to workspace)
  const [subMode, setSubMode] = useState<CanvasMode>(getCanvasMode());
  useEffect(() => {
    const unsubscribe = subscribeCanvas((state) => {
      setSubMode(state.mode);
    });
    return unsubscribe;
  }, []);

  // Drag-drop integration (web-only)
  const { setNodeRef, isOver } = Platform.OS === 'web'
    ? useDroppable({ id: 'canvas-workspace' })
    : { setNodeRef: () => {}, isOver: false };
  const { dragState, widgets, checkCollision } = useCanvasDragDrop();

  // Staggered entrance animations
  const tileAnims = useRef(tiles.map(() => new Animated.Value(0))).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const runwayAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.06)).current;

  // LiveLens state
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<TileAnchor | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    tileId: string;
    position: { x: number; y: number };
  } | null>(null);

  // -------------------------------------------------------------------------
  // Subtle feedback on drag-over (no blue glow — just slight vignette shift)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isOver && dragState.isDragging) {
      Animated.timing(glowAnim, {
        toValue: 0.12,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(glowAnim, {
        toValue: 0.06,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [isOver, dragState.isDragging]);

  // -------------------------------------------------------------------------
  // Entrance animation sequence
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Reset animations
    headerAnim.setValue(0);
    runwayAnim.setValue(0);
    glowAnim.setValue(0.06);
    tileAnims.forEach((a) => a.setValue(0));

    // Header entrance
    const headerSpring = Animated.spring(headerAnim, {
      toValue: 1,
      ...CANVAS_SPRING_CONFIG,
    });

    // Tiles stagger
    const tileStagger = Animated.stagger(
      CanvasTokens.motion.tileStagger,
      tileAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          ...CANVAS_SPRING_CONFIG,
        }),
      ),
    );

    // Runway entrance
    const runwaySpring = Animated.spring(runwayAnim, {
      toValue: 1,
      ...CANVAS_SPRING_CONFIG,
    });

    Animated.sequence([
      headerSpring,
      Animated.delay(50),
      tileStagger,
      Animated.delay(100),
      runwaySpring,
    ]).start();

    emitCanvasEvent('mode_change', { mode: 'canvas' });
  }, []);

  // -------------------------------------------------------------------------
  // LiveLens hover handlers
  // -------------------------------------------------------------------------

  const handleHoverIn = useCallback((tileId: string, anchor: TileAnchor) => {
    setHoveredTile(tileId);
    setHoverAnchor(anchor);
    setLensOpen(true, tileId);
  }, []);

  const handleHoverOut = useCallback(() => {
    setHoveredTile(null);
    setHoverAnchor(null);
    setLensOpen(false);
  }, []);

  // -------------------------------------------------------------------------
  // Tile press → open Stage
  // -------------------------------------------------------------------------

  const handleTilePress = useCallback(
    (tileId: string) => {
      handleHoverOut();
      setStageOpen(true, tileId);
      playSound('stage_open');
      emitCanvasEvent('stage_open', { tileId });
    },
    [handleHoverOut],
  );

  // -------------------------------------------------------------------------
  // Context menu
  // -------------------------------------------------------------------------

  const handleContextMenu = useCallback(
    (tileId: string, position: { x: number; y: number }) => {
      setContextMenu({ tileId, position });
    },
    [],
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleVerbSelect = useCallback(
    (verbId: string) => {
      if (contextMenu) {
        setStageOpen(true, contextMenu.tileId);
      }
      setContextMenu(null);
    },
    [contextMenu],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Header entrance interpolations
  const headerOpacity = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  // Runway entrance interpolations
  const runwayOpacity = runwayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const runwayTranslateY = runwayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  // Edge vignette intensity (subtle, NOT blue glow)
  const _vignetteOpacity = glowAnim; // retained for drag-over feedback

  // Check collision for snap ghost
  const snapIsValid =
    dragState.previewPosition && dragState.activeWidgetId
      ? !checkCollision(
          dragState.previewPosition,
          { width: 280, height: 200 }, // Default widget size
          dragState.activeWidgetId
        )
      : true;

  return (
    <View ref={Platform.OS === 'web' ? setNodeRef as any : undefined} style={ws.root}>
      {/* Layer 1: Authority Queue gray surface */}
      <View style={ws.baseLayer} />

      {/* Layer 2: Subtle edge vignette (slight darkening at edges, NOT blue glow) */}
      <View
        style={[
          ws.edgeVignetteLayer,
          Platform.OS === 'web'
            ? ({
                backgroundImage: `
                  radial-gradient(ellipse at center, transparent 60%, rgba(0, 0, 0, 0.15) 100%)
                `,
              } as unknown as ViewStyle)
            : {},
        ]}
        pointerEvents="none"
      />

      {/* Layer 3: Subtle vignette (depth enhancement) */}
      <VignetteOverlay />

      {/* Layer 4: Dot grid (painted ON surface) */}
      <CanvasGrid />

      {/* Layer 5: Content (widgets scroll OVER grid) */}
      <View style={ws.content}>
        {/* Header with mode toggle */}
        <Animated.View
          style={[
            ws.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={ws.headerRow}>
            <View style={ws.headerLeft}>
              <View style={ws.headerDot} />
              <Text style={ws.headerTitle}>CANVAS</Text>
            </View>
            <CanvasModeToggle />
          </View>
          <Text style={ws.headerSub}>
            Governed execution workspace • Every action leaves a receipt
          </Text>
        </Animated.View>

        {/* Conditional: ChatCanvas (chat mode) or tile grid (canvas mode) */}
        {subMode === 'chat' ? (
          <View style={ws.chatCanvasContainer}>
            <ChatCanvas
              webPreviewProps={{
                activityEvents: [],
                trustLevel: 'internal',
              }}
              personaElement={
                <Persona
                  state={getPersonaState()}
                  variant={getActiveAgent()}
                />
              }
            />
          </View>
        ) : (
          <>
            {/* Tile grid — 3×2 layout */}
            <View style={ws.tileGrid}>
              {tiles.map((tile, idx) => (
                <CanvasWidget
                  key={tile.id}
                  tile={tile}
                  index={idx}
                  entranceAnim={tileAnims[idx]}
                  onPress={handleTilePress}
                  onHoverIn={handleHoverIn}
                  onHoverOut={handleHoverOut}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </View>

            {/* Runway display */}
            <Animated.View
              style={[
                ws.runwayContainer,
                {
                  opacity: runwayOpacity,
                  transform: [{ translateY: runwayTranslateY }],
                },
              ]}
            >
              <RunwayDisplay currentState={runwayState} />
            </Animated.View>
          </>
        )}
      </View>

      {/* Layer 6: LiveLens overlay */}
      {hoveredTile && hoverAnchor && !stageOpen && (
        <LiveLens
          tileId={hoveredTile}
          anchorPosition={hoverAnchor}
          onClose={handleHoverOut}
          onOpenStage={() => handleTilePress(hoveredTile)}
        />
      )}

      {/* Layer 7: Context menu */}
      {contextMenu && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleContextMenuClose}
          />
          <TileContextMenu
            tileId={contextMenu.tileId}
            position={contextMenu.position}
            onClose={handleContextMenuClose}
            onSelectVerb={handleVerbSelect}
          />
        </>
      )}

      {/* Layer 8: Snap ghost (grid preview during drag) */}
      {dragState.isDragging && dragState.previewPosition && (
        <SnapGhost
          position={dragState.previewPosition}
          size={{ width: 280, height: 200 }}
          isValid={snapIsValid}
        />
      )}

      {/* Layer 9: Drag preview */}
      <DragPreview
        widgetId={dragState.activeWidgetId}
        isDragging={dragState.isDragging}
      />

      {/* Layer 10: Stage overlay */}
      <Stage />

      {/* Layer 11: Command Palette */}
      <CommandPalette />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Workspace styles — REAL physical canvas with depth
// ---------------------------------------------------------------------------

const ws = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    overflow: 'visible', // CRITICAL: Shadows extend beyond bounds
  },

  // Layer 1: Authority Queue gray surface (physical canvas base)
  baseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CanvasTokens.workspace.bg, // #2A2A2A — Authority Queue gray
    zIndex: 0,
  },

  // Layer 2: Subtle edge vignette (slight darkening at edges for depth)
  edgeVignetteLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: 'none',
  },

  // Layer 5: Content container
  content: {
    flex: 1,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CanvasTokens.workspace.contentPaddingH,
    paddingVertical: CanvasTokens.workspace.contentPaddingV,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: CanvasTokens.workspace.headerBottomMargin,
    gap: CanvasTokens.workspace.headerGap,
    width: '100%',
    maxWidth: CanvasTokens.workspace.gridMaxWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // ChatCanvas container — fills workspace area
  chatCanvasContainer: {
    flex: 1,
    width: '100%',
    maxWidth: CanvasTokens.workspace.gridMaxWidth,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 6px rgba(59,130,246,0.4)',
        } as unknown as ViewStyle)
      : {}),
  },
  headerTitle: {
    fontSize: CanvasTokens.tileType.headerTitle.fontSize,
    fontWeight: CanvasTokens.tileType.headerTitle.fontWeight,
    color: Colors.text.bright,
    letterSpacing: CanvasTokens.tileType.headerTitle.letterSpacing,
    textTransform: 'uppercase',
  } as any,
  headerSub: {
    fontSize: CanvasTokens.tileType.headerSub.fontSize,
    fontWeight: CanvasTokens.tileType.headerSub.fontWeight,
    color: Colors.text.muted,
    letterSpacing: CanvasTokens.tileType.headerSub.letterSpacing,
  },

  // Tile grid — 3 columns, auto-wrap
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: CanvasTokens.workspace.gridGap,
    maxWidth: CanvasTokens.workspace.gridMaxWidth,
  },

  // Runway container
  runwayContainer: {
    marginTop: CanvasTokens.workspace.runwayTopMargin,
    width: '100%',
    maxWidth: CanvasTokens.workspace.runwayMaxWidth,
  },
});
