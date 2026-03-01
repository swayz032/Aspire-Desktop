/**
 * HybridWebPreview -- Premium 40/60 split-panel layout for Canvas Browser Mode.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - ActivityFeed (left 40%) | BrowserPanel (right 60%)
 * - Resizable splitter (web-only): Drag handle between panels, persist to localStorage
 * - Responsive: Stack vertical on tablet (<1024px), full-width on mobile
 * - Premium divider: 1px blue glow line between panels
 * - Smooth panel transitions: Spring physics for resize
 * - Two-tone dark gray aesthetic (#1E1E1E surface, #2A2A2A elevated)
 * - Blue ambient glow (#3B82F6 at 20% opacity)
 * - Multi-layer depth with visible shadows
 * - 60fps animations, reduced motion support
 *
 * Reference Quality: ChatCanvas.tsx premium container + CanvasWorkspace.tsx depth.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ActivityFeed, type AgentActivityEvent } from './WebPreview';
import { BrowserPanel } from './BrowserPanel';
import type { BrowserScreenshotEvent } from '@/hooks/useBrowserStream';

// ---------------------------------------------------------------------------
// CSS Keyframes -- injected once on web
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-hybrid-web-preview-premium';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      /* Splitter hover glow pulse */
      @keyframes splitterGlow {
        0% { opacity: 0.3; }
        50% { opacity: 0.6; }
        100% { opacity: 0.3; }
      }

      /* Panel entrance -- staggered fade-in */
      @keyframes panelEntranceLeft {
        0% { opacity: 0; transform: translateX(-12px); }
        100% { opacity: 1; transform: translateX(0); }
      }

      @keyframes panelEntranceRight {
        0% { opacity: 0; transform: translateX(12px); }
        100% { opacity: 1; transform: translateX(0); }
      }

      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.01ms !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HybridWebPreviewProps {
  /** Activity events for the ActivityFeed panel */
  activityEvents: AgentActivityEvent[];
  /** Browser screenshot events from SSE stream */
  browserEvents: BrowserScreenshotEvent[];
  /** Whether new browser content is loading */
  isBrowserLoading?: boolean;
  /** Browser panel error message */
  browserError?: string | null;
  /** URL click handler for activity feed */
  onUrlClick?: (url: string) => void;
  /** Callback when screenshot fails to load */
  onImageError?: (screenshotId: string) => void;
  /** Test ID for testing */
  testID?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Premium spring configuration ($10K quality) */
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.9,
};

/** Responsive breakpoints */
const TABLET_BREAKPOINT = 1024;

/** Splitter constraints */
const MIN_PANEL_RATIO = 0.25;
const MAX_PANEL_RATIO = 0.65;
const DEFAULT_LEFT_RATIO = 0.4;

/** localStorage key for persisted split ratio */
const SPLIT_RATIO_KEY = 'aspire_hybrid_split_ratio';

// ---------------------------------------------------------------------------
// Split ratio persistence
// ---------------------------------------------------------------------------

function loadSplitRatio(): number {
  if (typeof window === 'undefined') return DEFAULT_LEFT_RATIO;
  try {
    const stored = localStorage.getItem(SPLIT_RATIO_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= MIN_PANEL_RATIO && parsed <= MAX_PANEL_RATIO) {
        return parsed;
      }
    }
  } catch {
    // localStorage access failed
  }
  return DEFAULT_LEFT_RATIO;
}

function saveSplitRatio(ratio: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPLIT_RATIO_KEY, ratio.toFixed(4));
  } catch {
    // localStorage write failed
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HybridWebPreview({
  activityEvents,
  browserEvents,
  isBrowserLoading = false,
  browserError = null,
  onUrlClick,
  onImageError,
  testID = 'hybrid-web-preview',
}: HybridWebPreviewProps): React.ReactElement {
  const { width: windowWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const isStacked = windowWidth < TABLET_BREAKPOINT;

  // Split ratio state (left panel percentage)
  const [leftRatio, setLeftRatio] = useState(loadSplitRatio);

  // Entrance animation
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.98);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      scale.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [opacity, scale, reducedMotion]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Latest screenshot
  const latestScreenshot = browserEvents.length > 0
    ? browserEvents[browserEvents.length - 1]
    : null;

  // ---------------------------------------------------------------------------
  // Splitter drag logic (web-only)
  // ---------------------------------------------------------------------------

  const isDragging = useRef(false);
  const containerRef = useRef<View>(null);

  const handleSplitterMouseDown = useCallback(
    (e: unknown) => {
      if (Platform.OS !== 'web' || isStacked) return;

      const mouseEvent = e as { preventDefault?: () => void };
      mouseEvent.preventDefault?.();
      isDragging.current = true;

      // Set cursor globally
      if (typeof document !== 'undefined') {
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;

        const el = containerRef.current as unknown as HTMLElement;
        const rect = el.getBoundingClientRect();
        const relativeX = moveEvent.clientX - rect.left;
        const containerWidth = rect.width;

        if (containerWidth <= 0) return;

        let newRatio = relativeX / containerWidth;
        // Clamp to constraints
        newRatio = Math.max(MIN_PANEL_RATIO, Math.min(MAX_PANEL_RATIO, newRatio));

        setLeftRatio(newRatio);
      };

      const handleMouseUp = () => {
        if (isDragging.current) {
          isDragging.current = false;
          // Persist final ratio
          setLeftRatio((current) => {
            saveSplitRatio(current);
            return current;
          });
        }

        if (typeof document !== 'undefined') {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isStacked],
  );

  // Cleanup drag listeners on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Panel count for header
  // ---------------------------------------------------------------------------

  const screenshotCount = browserEvents.length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Animated.View
      style={[styles.container, containerAnimatedStyle]}
      testID={testID}
    >
      {/* Background layer with blue edge glow */}
      <View style={styles.backgroundLayer} />

      {/* Content panels */}
      <View
        ref={containerRef}
        style={[
          styles.contentWrapper,
          isStacked && styles.contentWrapperVertical,
        ]}
      >
        {/* LEFT PANEL: ActivityFeed */}
        <View
          style={[
            styles.panel,
            isStacked
              ? styles.panelStacked
              : { flex: leftRatio },
            webPanelLeftStyle,
          ]}
          testID="hybrid-activity-panel"
        >
          {/* Panel header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderLeft}>
              <View style={[styles.headerDot, styles.headerDotBlue]} />
              <Text style={styles.panelHeaderTitle}>ACTIVITY</Text>
            </View>
            {activityEvents.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{activityEvents.length}</Text>
              </View>
            )}
          </View>

          {/* Premium depth layers */}
          <View style={styles.panelShadowLayer} />
          <View style={styles.panelBlueShadowLayer} />
          <View style={styles.rimLightTop} />

          {/* Panel surface */}
          <View style={styles.panelSurface}>
            <ActivityFeed
              activityEvents={activityEvents}
              onUrlClick={onUrlClick}
            />
          </View>
        </View>

        {/* SPLITTER (web-only, horizontal layout only) */}
        {!isStacked && Platform.OS === 'web' && (
          <Pressable
            style={styles.splitter}
            onPress={() => {}}
            accessibilityRole="adjustable"
            accessibilityLabel="Resize panel divider"
            accessibilityHint="Drag to resize the activity and browser panels"
            {...({
              onMouseDown: handleSplitterMouseDown,
            } as unknown as Record<string, unknown>)}
          >
            {/* Glow line */}
            <View style={styles.splitterLine} />

            {/* Drag handle dots */}
            <View style={styles.splitterHandle}>
              <View style={styles.splitterDot} />
              <View style={styles.splitterDot} />
              <View style={styles.splitterDot} />
            </View>
          </Pressable>
        )}

        {/* RIGHT PANEL: BrowserPanel */}
        <View
          style={[
            styles.panel,
            isStacked
              ? styles.panelStacked
              : { flex: 1 - leftRatio },
            webPanelRightStyle,
          ]}
          testID="hybrid-browser-panel"
        >
          {/* Panel header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderLeft}>
              <View style={[styles.headerDot, styles.headerDotGreen]} />
              <Text style={styles.panelHeaderTitle}>BROWSER</Text>
            </View>
            {screenshotCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{screenshotCount}</Text>
              </View>
            )}
          </View>

          {/* BrowserPanel with premium depth handled internally */}
          <BrowserPanel
            screenshot={latestScreenshot}
            isLoading={isBrowserLoading}
            error={browserError}
            onImageError={onImageError}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Web-only styles
// ---------------------------------------------------------------------------

const webPanelLeftStyle: ViewStyle = Platform.OS === 'web'
  ? ({
      animation: 'panelEntranceLeft 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards',
    } as unknown as ViewStyle)
  : {};

const webPanelRightStyle: ViewStyle = Platform.OS === 'web'
  ? ({
      animation: 'panelEntranceRight 0.4s cubic-bezier(0.19, 1, 0.22, 1) 0.1s forwards',
    } as unknown as ViewStyle)
  : {};

// ---------------------------------------------------------------------------
// Styles -- $10K premium aesthetic
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },

  // Background layer with radial blue glow from edges
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CanvasTokens.background.base,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: `
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
            radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.06) 0%, transparent 40%)
          `,
        } as unknown as ViewStyle)
      : {}),
  },

  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 0, // Splitter provides gap
    zIndex: 1,
  },

  contentWrapperVertical: {
    flexDirection: 'column',
    gap: 16,
  },

  // Panel base
  panel: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'visible',
  },

  panelStacked: {
    flex: 1,
    minHeight: 300,
  },

  // Panel header
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingBottom: 10,
  },

  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  headerDotBlue: {
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)',
        } as unknown as ViewStyle)
      : {}),
  },

  headerDotGreen: {
    backgroundColor: '#34c759',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 8px rgba(52, 199, 89, 0.6)',
        } as unknown as ViewStyle)
      : {}),
  },

  panelHeaderTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.5,
    color: CanvasTokens.text.muted,
    textTransform: 'uppercase',
  } as any, // TextStyle with textTransform requires `any` cast in StyleSheet

  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },

  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },

  // Premium depth: dark shadow underneath (creates physical depth)
  panelShadowLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 34, // Below header
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
        }),
  },

  // Premium depth: blue ambient glow
  panelBlueShadowLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 34,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 24px rgba(59, 130, 246, 0.12), 0 0 48px rgba(59, 130, 246, 0.06)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  // Top rim lighting
  rimLightTop: {
    position: 'absolute',
    top: 34,
    left: 0,
    right: 0,
    height: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    ...(Platform.OS === 'web'
      ? ({
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(59, 130, 246, 0.25) 30%,
            rgba(59, 130, 246, 0.25) 70%,
            transparent 100%
          )`,
        } as unknown as ViewStyle)
      : {
          backgroundColor: 'rgba(59, 130, 246, 0.25)',
        }),
    zIndex: 2,
  },

  // Panel surface
  panelSurface: {
    flex: 1,
    backgroundColor: CanvasTokens.background.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
    overflow: 'hidden',
    zIndex: 1,
  },

  // Splitter (web-only draggable divider)
  splitter: {
    width: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'col-resize',
        } as unknown as ViewStyle)
      : {}),
  },

  // Splitter blue glow line
  splitterLine: {
    position: 'absolute',
    top: 34, // Below headers
    bottom: 0,
    width: 1,
    ...(Platform.OS === 'web'
      ? ({
          background: `linear-gradient(180deg,
            transparent 0%,
            rgba(59, 130, 246, 0.2) 20%,
            rgba(59, 130, 246, 0.35) 50%,
            rgba(59, 130, 246, 0.2) 80%,
            transparent 100%
          )`,
        } as unknown as ViewStyle)
      : {
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
        }),
  },

  // Splitter drag handle (3 dots)
  splitterHandle: {
    width: 12,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 0.2s ease',
        } as unknown as ViewStyle)
      : {}),
  },

  splitterDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
});
