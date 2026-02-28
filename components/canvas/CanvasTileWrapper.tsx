import React, { useRef, useCallback } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import type { ImmersionMode } from '@/lib/immersionStore';
import { Canvas } from '@/constants/tokens';
import { getTile } from '@/lib/tileManifest';

// ---------------------------------------------------------------------------
// CSS halo — premium glass glow per desk color, injected once on web
// ---------------------------------------------------------------------------

const HALO_STYLE_ID = 'aspire-canvas-home-tile-halo';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(HALO_STYLE_ID)) {
    const h = Canvas.halo;
    const t = Canvas.modeTransition;
    const style = document.createElement('style');
    style.id = HALO_STYLE_ID;
    // Per-desk classes are generated dynamically; base transition is shared.
    // Depth mode: subtle elevation only, no halo ring.
    // Canvas mode: full glass glow with per-desk accent.
    style.textContent = `
      .canvas-tile-depth {
        transition: ${t.css};
        box-shadow: ${Canvas.depth.webShadowDepth};
      }
      .canvas-tile-depth:hover {
        box-shadow: ${Canvas.depth.webShadowDepth}, 0 0 0 1px rgba(255,255,255,0.04);
      }

      .canvas-home-tile {
        transition: box-shadow ${h.transitionMs}ms ${h.easing},
                    border-color ${h.transitionMs}ms ${h.easing};
        box-shadow: ${Canvas.depth.webShadowCanvas};
      }

      /* Per-desk accent halos — layered inner ring + outer atmospheric glow */
      .canvas-home-tile[data-desk="sarah"]:hover {
        box-shadow: 0 0 ${h.innerBlur}px ${h.desk.sarah.ring},
                    0 0 ${h.outerBlur}px ${h.outerSpread}px ${h.desk.sarah.glow},
                    ${Canvas.depth.webShadowCanvas};
        border-color: ${h.desk.sarah.ring};
      }
      .canvas-home-tile[data-desk="finn"]:hover {
        box-shadow: 0 0 ${h.innerBlur}px ${h.desk.finn.ring},
                    0 0 ${h.outerBlur}px ${h.outerSpread}px ${h.desk.finn.glow},
                    ${Canvas.depth.webShadowCanvas};
        border-color: ${h.desk.finn.ring};
      }
      .canvas-home-tile[data-desk="eli"]:hover {
        box-shadow: 0 0 ${h.innerBlur}px ${h.desk.eli.ring},
                    0 0 ${h.outerBlur}px ${h.outerSpread}px ${h.desk.eli.glow},
                    ${Canvas.depth.webShadowCanvas};
        border-color: ${h.desk.eli.ring};
      }
      .canvas-home-tile[data-desk="nora"]:hover {
        box-shadow: 0 0 ${h.innerBlur}px ${h.desk.nora.ring},
                    0 0 ${h.outerBlur}px ${h.outerSpread}px ${h.desk.nora.glow},
                    ${Canvas.depth.webShadowCanvas};
        border-color: ${h.desk.nora.ring};
      }
      .canvas-home-tile[data-desk="quinn"]:hover {
        box-shadow: 0 0 ${h.innerBlur}px ${h.desk.quinn.ring},
                    0 0 ${h.outerBlur}px ${h.outerSpread}px ${h.desk.quinn.glow},
                    ${Canvas.depth.webShadowCanvas};
        border-color: ${h.desk.quinn.ring};
      }

      @media (prefers-reduced-motion: reduce) {
        .canvas-home-tile,
        .canvas-tile-depth {
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TileAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasTileWrapperProps {
  tileId: string;
  mode: ImmersionMode;
  children: React.ReactNode;
  onPress?: (tileId: string) => void;
  onHoverIn?: (tileId: string, anchor: TileAnchor) => void;
  onHoverOut?: () => void;
  onContextMenu?: (tileId: string, position: { x: number; y: number }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasTileWrapper({
  tileId,
  mode,
  children,
  onPress,
  onHoverIn,
  onHoverOut,
  onContextMenu,
}: CanvasTileWrapperProps): React.ReactElement {
  const wrapperRef = useRef<View>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Off mode: pure passthrough, zero overhead ---
  if (mode === 'off') {
    return <>{children}</>;
  }

  // --- Handlers (shared between depth + canvas) ---

  const handlePress = useCallback(() => {
    onPress?.(tileId);
  }, [tileId, onPress]);

  // --- Depth mode: pressable wrapper with subtle elevation, no hover/context ---
  if (mode === 'depth') {
    return (
      <Pressable
        onPress={handlePress}
        style={styles.depthWrapper}
        accessibilityRole="button"
        accessibilityLabel={`Open ${tileId} workspace`}
        {...(Platform.OS === 'web'
          ? {
              className: 'canvas-tile-depth',
            } as unknown as Record<string, unknown>
          : {})}
      >
        {children}
      </Pressable>
    );
  }

  // --- Canvas mode: full interaction layer ---

  // Resolve desk for per-desk accent halo
  const deskName = getTile(tileId)?.desk ?? 'quinn';

  const handleMouseEnter = useCallback(() => {
    if (Platform.OS !== 'web' || !onHoverIn) return;

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    hoverTimeoutRef.current = setTimeout(() => {
      if (wrapperRef.current) {
        const el = wrapperRef.current as unknown as HTMLElement;
        const rect = el.getBoundingClientRect();
        onHoverIn(tileId, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }, 400);
  }, [tileId, onHoverIn]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    onHoverOut?.();
  }, [onHoverOut]);

  const handleContextMenu = useCallback(
    (e: any) => {
      if (Platform.OS !== 'web' || !onContextMenu) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      onContextMenu(tileId, {
        x: e.nativeEvent?.pageX ?? e.pageX ?? 0,
        y: e.nativeEvent?.pageY ?? e.pageY ?? 0,
      });
    },
    [tileId, onContextMenu],
  );

  return (
    <View
      ref={wrapperRef}
      style={styles.canvasWrapper}
      accessibilityRole="button"
      accessibilityLabel={`Open ${tileId} workspace`}
      {...(Platform.OS === 'web'
        ? {
            className: 'canvas-home-tile',
            'data-desk': deskName,
            onMouseEnter: handleMouseEnter,
            onMouseLeave: handleMouseLeave,
            onContextMenu: handleContextMenu,
          } as unknown as Record<string, unknown>
        : {})}
    >
      {children}
      {/* Hit area overlay for press */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${tileId} workspace`}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  depthWrapper: {
    // Depth mode: minor structural wrapper for elevation, no layout change
    position: 'relative',
  },
  canvasWrapper: {
    // Canvas mode: relative for hit-area overlay + halo positioning
    position: 'relative',
  },
});
