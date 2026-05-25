/**
 * HoverLens — web-only hover magnifier for thumbnail images.
 *
 * Wraps a child render (typically an <Image />) and adds:
 *   - A small "lens" affordance icon in the upper-right corner of the
 *     thumbnail, so the user knows hover-zoom is available.
 *   - A radial magnifier that follows the cursor on hover, magnifying the
 *     source image by `zoom` (default 2.0) inside a circle of `size`
 *     pixels (default 120).
 *
 * Gated by:
 *   - `Platform.OS === 'web'` — RN doesn't have mousemove semantics on native.
 *   - `(hover: hover) and (pointer: fine)` media query at CSS level — touch
 *     and stylus users never see the lens icon or the magnifier.
 *
 * Non-web / no-image fallback: renders `children` unchanged, no wrapper,
 * no event listeners. Zero cost on native.
 *
 * Law #7: render layer only. No state writes outside local hover.
 */
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AMBER = '#fbbf24';

interface HoverLensProps {
  children: React.ReactNode;
  /** Image URL the lens magnifies. If null/undefined the lens is disabled
   *  and children render as a plain wrapper. */
  src: string | null | undefined;
  /** Zoom factor (1.5–4.0 sensible). Default 2.0 */
  zoom?: number;
  /** Lens diameter in pixels. Default 120 */
  size?: number;
  /** Show the corner lens-icon affordance. Default true. */
  showIcon?: boolean;
  /** TestID for E2E discovery. */
  testID?: string;
}

// 2026-05-25 — Web-only CSS that hides the lens icon + magnifier on touch
// devices. `(hover: hover) and (pointer: fine)` matches mouse-capable
// browsers only; touch + stylus skip the magnifier entirely.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'hover-lens-touch-gate';
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      [data-hover-lens-host="1"] [data-hover-lens-icon="1"],
      [data-hover-lens-host="1"] [data-hover-lens-magnifier="1"] {
        display: none;
      }
      @media (hover: hover) and (pointer: fine) {
        [data-hover-lens-host="1"] [data-hover-lens-icon="1"] {
          display: flex;
        }
        [data-hover-lens-host="1"][data-hover-lens-active="1"] [data-hover-lens-magnifier="1"] {
          display: block;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export function HoverLens({
  children,
  src,
  zoom = 2.0,
  size = 120,
  showIcon = true,
  testID,
}: HoverLensProps): React.ReactElement {
  // Native or no source → render children unchanged. No DOM events, no
  // re-renders. Keeps the native code path zero-cost.
  if (Platform.OS !== 'web' || !src) {
    return <>{children}</>;
  }

  return <HoverLensWeb src={src} zoom={zoom} size={size} showIcon={showIcon} testID={testID}>{children}</HoverLensWeb>;
}

// ---------------------------------------------------------------------------
// Web implementation — kept as a separate component so the native branch
// of HoverLens stays a clean React.Fragment passthrough (no hooks called
// on native).
// ---------------------------------------------------------------------------

function HoverLensWeb({
  children,
  src,
  zoom,
  size,
  showIcon,
  testID,
}: Required<Omit<HoverLensProps, 'testID'>> & { testID?: string }): React.ReactElement {
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [bounds, setBounds] = useState({ w: 0, h: 0 });

  const onMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setBounds({ w: r.width, h: r.height });
    setHovering(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setHovering(false);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    // Re-sample bounds on each move so the magnifier stays correct after
    // the surrounding layout reflows (grid resize, scroll, etc.).
    if (r.width !== bounds.w || r.height !== bounds.h) {
      setBounds({ w: r.width, h: r.height });
    }
  }, [bounds.w, bounds.h]);

  const radius = size / 2;
  const bgWidth = bounds.w * zoom;
  const bgHeight = bounds.h * zoom;
  // Position the scaled background so the cursor sits at the center of
  // the lens (offsets are negative; we shift the bg image up + left).
  const bgX = -pos.x * zoom + radius;
  const bgY = -pos.y * zoom + radius;

  // Use raw HTML elements (web-only branch) so we can attach native
  // onMouseMove + use inline CSS for the background-image magnifier. RN
  // View doesn't forward mousemove and StyleSheet doesn't support
  // background-image, so this is the right primitive on web.
  return (
    <div
      data-hover-lens-host="1"
      data-hover-lens-active={hovering ? '1' : '0'}
      data-testid={testID ?? 'hover-lens'}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      style={hostStyle}
    >
      {children}

      {showIcon ? (
        <div data-hover-lens-icon="1" style={iconCornerStyle}>
          <View style={[styles.iconBubble, hovering && styles.iconBubbleActive]}>
            <Ionicons
              name="search"
              size={11}
              color={hovering ? AMBER : 'rgba(255,255,255,0.75)'}
            />
          </View>
        </div>
      ) : null}

      <div
        data-hover-lens-magnifier="1"
        data-testid={testID ? `${testID}-magnifier` : 'hover-lens-magnifier'}
        style={{
          position: 'absolute',
          left: pos.x - radius,
          top: pos.y - radius,
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundImage: `url(${src})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${bgWidth}px ${bgHeight}px`,
          backgroundPosition: `${bgX}px ${bgY}px`,
          border: `2px solid ${AMBER}`,
          boxShadow:
            '0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.18)',
          pointerEvents: 'none',
          zIndex: 50,
          // Hidden by default; CSS gate above re-enables it on hover when
          // the device has a real mouse pointer.
          display: 'none',
        }}
      />
    </div>
  );
}

// CSS objects for the raw <div> branch. Mirrors RN StyleSheet semantics so
// the wrapper sits flush over its parent slot.
const hostStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  // Pointer cursor is rendered by the underlying Pressable/Image; we don't
  // override it here so the parent slot's cursor (zoom-in vs default)
  // wins.
};

const iconCornerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  zIndex: 4,
  pointerEvents: 'none',
};

const styles = StyleSheet.create({
  iconBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(11,13,18,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? (({ transition: 'all 150ms ease' } as unknown) as ViewStyle)
      : {}),
  },
  iconBubbleActive: {
    backgroundColor: 'rgba(11,13,18,0.92)',
    borderColor: AMBER,
  },
});
