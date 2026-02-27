import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Animated,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Canvas,
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
  type TileVerb,
} from '@/lib/tileManifest';
import { VignetteOverlay } from './VignetteOverlay';
import { Stage } from './Stage';
import { LiveLens } from './LiveLens';
import { RunwayDisplay } from './RunwayDisplay';
import { CommandPalette } from './CommandPalette';
import { TileContextMenu } from './TileContextMenu';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { playSound } from '@/lib/soundManager';

// ---------------------------------------------------------------------------
// CSS Keyframes — injected once on web for ambient effects
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-canvas-workspace-keyframes';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      @keyframes canvasTileBreathe {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
      }
      @keyframes canvasGridReveal {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes canvasSpotlightPulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      .canvas-tile {
        transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                    border-color 0.28s ease-out,
                    box-shadow 0.35s ease-out;
        cursor: pointer;
      }
      .canvas-tile:hover {
        transform: translateY(-6px) scale(1.015);
      }
      .canvas-tile:active {
        transform: translateY(-2px) scale(0.995);
        transition-duration: 0.08s;
      }
      .canvas-tile-glow {
        animation: canvasTileBreathe 5s ease-in-out infinite;
        pointer-events: none;
      }
      .canvas-grid-bg {
        animation: canvasGridReveal 1.2s ease-out forwards;
      }
      .canvas-spotlight {
        animation: canvasSpotlightPulse 4s ease-in-out infinite;
        pointer-events: none;
      }
      .canvas-desk-tag {
        transition: background-color 0.2s ease-out, color 0.2s ease-out;
      }
      .canvas-tile:hover .canvas-desk-tag {
        background-color: rgba(255,255,255,0.08);
      }
      .canvas-verb-row {
        transition: opacity 0.2s ease-out;
        opacity: 0.7;
      }
      .canvas-tile:hover .canvas-verb-row {
        opacity: 1;
      }
      .canvas-tile-icon-ring {
        transition: box-shadow 0.3s ease-out, transform 0.3s ease-out;
      }
      .canvas-tile:hover .canvas-tile-icon-ring {
        transform: scale(1.08);
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Desk accent colors — each agent has a signature color
// ---------------------------------------------------------------------------

const DESK_ACCENT: Record<string, string> = {
  quinn:  '#3B82F6', // Invoice — blue
  nora:   '#8B5CF6', // Calendar — violet
  eli:    '#06B6D4', // Email — cyan
  clara:  '#F59E0B', // Contract — amber
  finn:   '#EF4444', // Payment — red
  tec:    '#10B981', // Document — emerald
};

function getDeskAccent(desk: string): string {
  return DESK_ACCENT[desk] ?? Colors.accent.cyan;
}

// ---------------------------------------------------------------------------
// Risk tier pill
// ---------------------------------------------------------------------------

const RISK_META: Record<string, { bg: string; text: string; label: string }> = {
  green:  { bg: 'rgba(52,199,89,0.12)',  text: '#34c759', label: 'GREEN' },
  yellow: { bg: 'rgba(212,160,23,0.12)', text: '#d4a017', label: 'YELLOW' },
  red:    { bg: 'rgba(255,59,48,0.12)',   text: '#ff3b30', label: 'RED' },
};

// ---------------------------------------------------------------------------
// Tile anchor tracking (for LiveLens + ContextMenu)
// ---------------------------------------------------------------------------

interface TileAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// CanvasTile — individual frosted glass tile card
// ---------------------------------------------------------------------------

interface CanvasTileProps {
  tile: TileEntry;
  index: number;
  entranceAnim: Animated.Value;
  onPress: (tileId: string) => void;
  onHoverIn: (tileId: string, anchor: TileAnchor) => void;
  onHoverOut: () => void;
  onContextMenu: (tileId: string, position: { x: number; y: number }) => void;
}

function CanvasTile({
  tile,
  index,
  entranceAnim,
  onPress,
  onHoverIn,
  onHoverOut,
  onContextMenu,
}: CanvasTileProps): React.ReactElement {
  const accent = getDeskAccent(tile.desk);
  const defaultVerb = tile.verbs.find((v) => v.id === tile.defaultVerb) ?? tile.verbs[0];
  const risk = RISK_META[defaultVerb?.riskTier ?? 'green'] ?? RISK_META.green;
  const tileRef = useRef<View>(null);

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

  // Get bounding rect for LiveLens anchor
  const measureAndHover = useCallback(() => {
    if (Platform.OS === 'web' && tileRef.current) {
      const el = tileRef.current as unknown as HTMLElement;
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

  // Glass card web styles
  const webGlassStyle: ViewStyle = Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        boxShadow: `
          0 4px 32px rgba(0,0,0,0.45),
          0 0 0 1px rgba(255,255,255,0.03),
          inset 0 1px 0 rgba(255,255,255,0.05)
        `,
      } as unknown as ViewStyle)
    : {};

  const webHoverGlowStyle: ViewStyle = Platform.OS === 'web'
    ? ({
        // Hover glow injected via CSS class .canvas-tile:hover
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
        ref={tileRef}
        style={[tileStyles.card, webGlassStyle]}
        {...(Platform.OS === 'web'
          ? {
              className: 'canvas-tile',
              onMouseEnter: measureAndHover,
              onMouseLeave: onHoverOut,
              onContextMenu: handleContextMenu,
            } as unknown as Record<string, unknown>
          : {})}
      >
        {/* Ambient desk-color underglow */}
        <View
          style={[
            tileStyles.underglow,
            { backgroundColor: accent },
          ]}
          {...(Platform.OS === 'web'
            ? { className: 'canvas-tile-glow' } as unknown as Record<string, unknown>
            : {})}
        />

        {/* Icon ring */}
        <View
          style={[tileStyles.iconRing, { borderColor: `${accent}30` }]}
          {...(Platform.OS === 'web'
            ? {
                className: 'canvas-tile-icon-ring',
                style: [
                  tileStyles.iconRing,
                  { borderColor: `${accent}30` },
                  { boxShadow: `0 0 20px ${accent}15` } as unknown as ViewStyle,
                ],
              } as unknown as Record<string, unknown>
            : {})}
        >
          <View style={[tileStyles.iconCircle, { backgroundColor: `${accent}12` }]}>
            <Ionicons
              name={tile.icon as keyof typeof Ionicons.glyphMap}
              size={26}
              color={accent}
            />
          </View>
        </View>

        {/* Tile label */}
        <Text style={tileStyles.label}>{tile.label}</Text>

        {/* Desk tag */}
        <View
          style={tileStyles.deskTag}
          {...(Platform.OS === 'web'
            ? { className: 'canvas-desk-tag' } as unknown as Record<string, unknown>
            : {})}
        >
          <Text style={[tileStyles.deskText, { color: `${accent}CC` }]}>
            {tile.desk.toUpperCase()}
          </Text>
        </View>

        {/* Default verb + risk */}
        {defaultVerb && (
          <View
            style={tileStyles.verbRow}
            {...(Platform.OS === 'web'
              ? { className: 'canvas-verb-row' } as unknown as Record<string, unknown>
              : {})}
          >
            <Text style={tileStyles.verbLabel} numberOfLines={1}>
              {defaultVerb.label}
            </Text>
            <View style={[tileStyles.riskPill, { backgroundColor: risk.bg }]}>
              <Text style={[tileStyles.riskText, { color: risk.text }]}>
                {risk.label}
              </Text>
            </View>
          </View>
        )}

        {/* Verb count */}
        <Text style={tileStyles.verbCount}>
          {tile.verbs.length} action{tile.verbs.length !== 1 ? 's' : ''}
        </Text>

        {/* Hit area — entire card is pressable */}
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
// Tile card styles
// ---------------------------------------------------------------------------

const tileStyles = StyleSheet.create({
  card: {
    width: 260,
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(16,16,20,0.8)',
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 12,
  },
  underglow: {
    position: 'absolute',
    bottom: -40,
    left: '20%' as any,
    right: '20%' as any,
    height: 60,
    borderRadius: 30,
    opacity: 0.06,
    ...(Platform.OS === 'web'
      ? { filter: 'blur(30px)' } as unknown as ViewStyle
      : {}),
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F2F2F2',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  deskTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  deskText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  verbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto' as any,
  },
  verbLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
    flex: 1,
  },
  riskPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verbCount: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted,
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
});

// ---------------------------------------------------------------------------
// CanvasWorkspace — full workspace layout
// ---------------------------------------------------------------------------

export function CanvasWorkspace(): React.ReactElement {
  const { mode, runwayState, stageOpen } = useImmersion();
  const tiles = useMemo(() => getAllTiles(), []);

  // Staggered entrance animations
  const tileAnims = useRef(tiles.map(() => new Animated.Value(0))).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const runwayAnim = useRef(new Animated.Value(0)).current;

  // LiveLens state
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);
  const [hoverAnchor, setHoverAnchor] = useState<TileAnchor | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    tileId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Cursor spotlight position (web only)
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });

  // -------------------------------------------------------------------------
  // Entrance animation sequence
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Reset anims
    headerAnim.setValue(0);
    runwayAnim.setValue(0);
    tileAnims.forEach((a) => a.setValue(0));

    // Stagger: header → tiles → runway
    const headerSpring = Animated.spring(headerAnim, {
      toValue: 1,
      damping: 24,
      stiffness: 200,
      mass: 0.8,
      useNativeDriver: true,
    });

    const tileStagger = Animated.stagger(
      70,
      tileAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          damping: Canvas.motion.spring.damping,
          stiffness: Canvas.motion.spring.stiffness,
          mass: Canvas.motion.spring.mass,
          useNativeDriver: true,
        }),
      ),
    );

    const runwaySpring = Animated.spring(runwayAnim, {
      toValue: 1,
      damping: 20,
      stiffness: 180,
      mass: 1,
      useNativeDriver: true,
    });

    Animated.sequence([
      headerSpring,
      Animated.delay(60),
      tileStagger,
      Animated.delay(100),
      runwaySpring,
    ]).start();

    emitCanvasEvent('mode_change', { mode: 'canvas' });
  }, []);

  // -------------------------------------------------------------------------
  // Cursor spotlight tracking (web only, RAF-throttled)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let rafId: number;
    const handler = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setSpotlightPos({ x: e.clientX, y: e.clientY });
      });
    };

    window.addEventListener('mousemove', handler, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handler);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // -------------------------------------------------------------------------
  // LiveLens hover handlers
  // -------------------------------------------------------------------------

  const handleHoverIn = useCallback((tileId: string, anchor: TileAnchor) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      setHoveredTile(tileId);
      setHoverAnchor(anchor);
      setLensOpen(true, tileId);
    }, 400);
  }, []);

  const handleHoverOut = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setHoveredTile(null);
    setHoverAnchor(null);
    setLensOpen(false);
  }, []);

  // -------------------------------------------------------------------------
  // Tile press → open Stage
  // -------------------------------------------------------------------------

  const handleTilePress = useCallback((tileId: string) => {
    handleHoverOut(); // dismiss lens
    setStageOpen(true, tileId);
    playSound('stage_open');
    emitCanvasEvent('stage_open', { tileId });
  }, [handleHoverOut]);

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

  // Header entrance
  const headerOpacity = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  // Runway entrance
  const runwayOpacity = runwayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const runwayTranslateY = runwayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  // Spotlight gradient style (web only)
  const spotlightStyle: ViewStyle = Platform.OS === 'web'
    ? ({
        background: `radial-gradient(800px circle at ${spotlightPos.x}px ${spotlightPos.y}px, rgba(59,130,246,0.025), transparent 55%)`,
      } as unknown as ViewStyle)
    : {};

  return (
    <View style={ws.root}>
      {/* Layer 0: Dot grid background */}
      <View
        style={ws.gridBg}
        {...(Platform.OS === 'web'
          ? { className: 'canvas-grid-bg' } as unknown as Record<string, unknown>
          : {})}
      />

      {/* Layer 1: Cursor spotlight */}
      {Platform.OS === 'web' && (
        <View
          style={[ws.spotlight, spotlightStyle]}
          pointerEvents="none"
          {...({ className: 'canvas-spotlight' } as unknown as Record<string, unknown>)}
        />
      )}

      {/* Layer 2: Vignette */}
      <VignetteOverlay />

      {/* Layer 3: Content */}
      <View style={ws.content}>
        {/* Header */}
        <Animated.View
          style={[
            ws.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={ws.headerLeft}>
            <View style={ws.headerDot} />
            <Text style={ws.headerTitle}>Canvas</Text>
          </View>
          <Text style={ws.headerSub}>
            6 desks{' \u00b7 '}governed execution{' \u00b7 '}every action leaves a receipt
          </Text>
        </Animated.View>

        {/* Tile grid — 3×2 */}
        <View style={ws.tileGrid}>
          {tiles.map((tile, idx) => (
            <CanvasTile
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

        {/* Runway display — always visible */}
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
      </View>

      {/* Layer 4: LiveLens overlay */}
      {hoveredTile && hoverAnchor && !stageOpen && (
        <LiveLens
          tileId={hoveredTile}
          anchorPosition={hoverAnchor}
          onClose={handleHoverOut}
          onOpenStage={() => handleTilePress(hoveredTile)}
        />
      )}

      {/* Layer 5: Context menu */}
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

      {/* Layer 6: Stage overlay */}
      <Stage />

      {/* Layer 7: Command Palette */}
      <CommandPalette />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Workspace styles
// ---------------------------------------------------------------------------

const DOT_GRID_BG = Platform.OS === 'web'
  ? ({
      backgroundImage:
        'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    } as unknown as ViewStyle)
  : {};

const ws = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060608',
    position: 'relative',
    overflow: 'hidden',
  },

  // Dot grid background
  gridBg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    ...DOT_GRID_BG,
  } as any,

  // Cursor spotlight layer
  spotlight: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  // Main content container
  content: {
    flex: 1,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 32,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 12px rgba(59,130,246,0.5), 0 0 4px rgba(59,130,246,0.8)',
        } as unknown as ViewStyle)
      : {}),
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F2F2F2',
    letterSpacing: 3,
    textTransform: 'uppercase',
  } as any,
  headerSub: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.muted,
    letterSpacing: 0.3,
  },

  // Tile grid
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    maxWidth: 840,
  },

  // Runway container
  runwayContainer: {
    marginTop: 40,
    width: '100%',
    maxWidth: 600,
  },
});
