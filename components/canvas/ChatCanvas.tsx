/**
 * ChatCanvas - Premium 60/40 Split Container for Canvas Chat Mode
 *
 * $10K UI/UX Agency Quality:
 * - REAL depth with multi-layer shadows and blue ambient glow
 * - Two-tone gray aesthetic matching Authority Queue card
 * - Premium spring physics animations
 * - Responsive layout (stacks on tablet/mobile)
 * - Enterprise SSE streaming for live agent activity events
 * - Hybrid Browser View: when browser_screenshot events arrive,
 *   automatically switches to HybridWebPreview (40/60 split)
 *
 * Layout: VERTICAL — WebPreview (top, ~70%) / Persona (bottom, ~30%)
 * Hybrid: HybridWebPreview [ActivityFeed (40%) | BrowserPanel (60%)] within WebPreview panel
 */

import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Colors } from '@/constants/tokens';
import { WebPreview, WebPreviewProps } from '@/components/ai-elements/WebPreview';
import { HybridWebPreview } from '@/components/ai-elements/HybridWebPreview';
import { useActivityStream, type StreamEvent } from '@/hooks/useActivityStream';
import { addActivityEvent } from '@/lib/chatCanvasStore';
import type { BrowserScreenshotEvent } from '@/hooks/useBrowserStream';

// Premium spring configuration ($10K quality)
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 300,
  mass: 0.9,
};

// Responsive breakpoints
const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 768;

export interface ChatCanvasProps {
  webPreviewProps: WebPreviewProps;
  personaElement: React.ReactNode; // Ava orb, voice waveform, etc.
  /** Enable SSE activity streaming (default: false) */
  streamEnabled?: boolean;
  /** SSE endpoint URL override */
  streamUrl?: string;
  /** Browser screenshot events from SSE stream (enables hybrid mode) */
  browserEvents?: BrowserScreenshotEvent[];
  /** Whether browser content is loading */
  isBrowserLoading?: boolean;
  /** Browser panel error message */
  browserError?: string | null;
  /** Callback when screenshot image fails to load */
  onBrowserImageError?: (screenshotId: string) => void;
}

/**
 * Premium ChatCanvas Container
 *
 * Visual Design:
 * - Real depth with visible shadows (NOT invisible dark-on-dark)
 * - Blue ambient glow from edges for premium feel
 * - Two-tone gray (#1E1E1E surface + #2A2A2A elevated) matching Authority Queue
 * - Rim lighting effect on top edges
 *
 * SSE Integration:
 * - When streamEnabled=true, connects to orchestrator SSE endpoint
 * - Activity events are routed to chatCanvasStore for global state
 * - WebPreview receives events via props for rendering
 */
export function ChatCanvas({
  webPreviewProps,
  personaElement,
  streamEnabled = false,
  streamUrl,
  browserEvents: externalBrowserEvents,
  isBrowserLoading = false,
  browserError = null,
  onBrowserImageError,
}: ChatCanvasProps) {
  const { width } = useWindowDimensions();

  // Internal browser events state for SSE-sourced browser_screenshot events
  const [sseBrowserEvents, setSseBrowserEvents] = useState<BrowserScreenshotEvent[]>([]);

  // SSE activity stream -- routes events to chatCanvasStore
  const handleStreamEvent = useCallback((event: StreamEvent) => {
    // Handle browser_screenshot events -- accumulate internally
    if (event.type === 'browser_screenshot' && event.data) {
      const data = event.data as Record<string, unknown>;
      const screenshotEvent: BrowserScreenshotEvent = {
        screenshot_url: (data.screenshot_url as string) ?? '',
        screenshot_id: (data.screenshot_id as string) ?? '',
        page_url: (data.page_url as string) ?? '',
        page_title: (data.page_title as string) ?? '',
        timestamp: event.timestamp ?? Date.now(),
        viewport_width: (data.viewport_width as number) ?? 1280,
        viewport_height: (data.viewport_height as number) ?? 800,
      };
      setSseBrowserEvents((prev) => [...prev, screenshotEvent]);
      return;
    }

    // Only forward display-relevant events to the store (skip 'response', 'connected')
    if (
      event.type === 'thinking' ||
      event.type === 'tool_call' ||
      event.type === 'step' ||
      event.type === 'done' ||
      event.type === 'error'
    ) {
      addActivityEvent({
        type: event.type,
        message: event.message || '',
        icon: event.icon || event.type,
        agent: event.agent as 'ava' | 'finn' | 'eli' | undefined,
      });
    }
  }, []);

  const { connected: _streamConnected } = useActivityStream({
    enabled: streamEnabled,
    url: streamUrl,
    onEvent: handleStreamEvent,
  });

  // Merge external and SSE-sourced browser events
  const allBrowserEvents = externalBrowserEvents ?? sseBrowserEvents;
  const hasBrowserEvents = allBrowserEvents.length > 0;

  // Entrance animation
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.98);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Responsive layout detection
  const isMobile = width < MOBILE_BREAKPOINT;

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* Background layer with blue edge glow */}
      <View style={styles.backgroundLayer} />

      {/* Content panels — ALWAYS vertical: WebPreview on top, Persona below */}
      <View style={styles.contentWrapper}>
        {/* WebPreview / HybridWebPreview Panel (top, ~70%) */}
        <View style={styles.webPreviewPanel}>
          {/* Premium depth: dark shadow + blue ambient glow */}
          <View style={styles.panelShadowLayer} />
          <View style={styles.panelBlueShadowLayer} />

          {/* Top rim lighting (subtle blue catch light) */}
          <View style={styles.rimLightTop} />

          {/* Panel surface -- conditionally render Hybrid or standard WebPreview */}
          <View style={styles.panelSurface}>
            {hasBrowserEvents ? (
              <HybridWebPreview
                activityEvents={webPreviewProps.activityEvents}
                browserEvents={allBrowserEvents}
                isBrowserLoading={isBrowserLoading}
                browserError={browserError}
                onUrlClick={webPreviewProps.onUrlClick}
                onImageError={onBrowserImageError}
              />
            ) : (
              <WebPreview {...webPreviewProps} />
            )}
          </View>
        </View>

        {/* Persona (bottom, ~30%) — NO box/panel, orb floats directly */}
        {!isMobile && (
          <View style={styles.personaPanel}>
            <View style={styles.personaContent}>
              {personaElement}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

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
      ? {
          backgroundImage: `
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.1) 0%, transparent 40%),
            radial-gradient(circle at top right, rgba(59, 130, 246, 0.1) 0%, transparent 40%),
            radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
            radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.08) 0%, transparent 40%)
          `,
        } as unknown as ViewStyle
      : {}),
  },

  // Always vertical — WebPreview on top, Persona below
  contentWrapper: {
    flex: 1,
    flexDirection: 'column',
    gap: 16,
    padding: 24,
    zIndex: 1,
  },

  // WebPreview panel (top, ~70% of space)
  webPreviewPanel: {
    flex: 0.7,
    position: 'relative',
    borderRadius: 12,
    overflow: 'visible',
    minHeight: 300,
  },

  // Persona area (bottom, ~30%) — no box, orb floats clean
  personaPanel: {
    flex: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },

  // Premium depth system: REAL shadows that are VISIBLE
  // Layer 1: Dark shadow underneath (creates physical depth)
  panelShadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: `0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)`,
          pointerEvents: 'none',
        } as unknown as ViewStyle
      : {
          // Native fallback: use elevation
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
        }),
  },

  // Layer 2: Blue ambient glow (premium aesthetic)
  panelBlueShadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: `0 0 24px rgba(59, 130, 246, 0.15), 0 0 48px rgba(59, 130, 246, 0.08)`,
          pointerEvents: 'none',
        } as unknown as ViewStyle
      : {}),
  },

  // Top rim lighting (subtle blue catch light on top edge)
  rimLightTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    ...(Platform.OS === 'web'
      ? {
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(59, 130, 246, 0.3) 30%,
            rgba(59, 130, 246, 0.3) 70%,
            transparent 100%
          )`,
        } as unknown as ViewStyle
      : {
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
        }),
    zIndex: 2,
  },

  // Panel surface (elevated dark gray)
  panelSurface: {
    flex: 1,
    backgroundColor: CanvasTokens.background.surface, // #1E1E1E
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
    overflow: 'hidden',
    zIndex: 1,
  },

  // Persona content wrapper
  personaContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  // Horizontal divider between WebPreview and Persona
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...(Platform.OS === 'web'
      ? {
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(59, 130, 246, 0.2) 20%,
            rgba(59, 130, 246, 0.3) 50%,
            rgba(59, 130, 246, 0.2) 80%,
            transparent 100%
          )`,
        } as unknown as ViewStyle
      : {}),
    zIndex: 3,
    pointerEvents: 'none',
  },
});
