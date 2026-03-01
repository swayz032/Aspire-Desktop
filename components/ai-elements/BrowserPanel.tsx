/**
 * BrowserPanel -- Premium browser screenshot display panel.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - Dark glass surface (rgba(30,30,30,0.98)) with blue glow border
 * - Multi-layer shadows (ambient + elevation + blue halo)
 * - Smooth fade transition (300ms) when new screenshot arrives
 * - Rim lighting on top edge (subtle blue gradient)
 * - Loading state: Spinner with blue glow
 * - Error state: Error icon + message
 * - Reduced motion support (WCAG 2.1 AA)
 *
 * Reference Quality: CanvasWorkspace.tsx widget depth aesthetic.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { BrowserScreenshotEvent } from '@/hooks/useBrowserStream';

// ---------------------------------------------------------------------------
// CSS Keyframes -- injected once on web for premium animations
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-browser-panel-premium';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      @keyframes browserPanelGlow {
        0% { box-shadow: 0 0 24px rgba(59, 130, 246, 0.12); }
        50% { box-shadow: 0 0 32px rgba(59, 130, 246, 0.18); }
        100% { box-shadow: 0 0 24px rgba(59, 130, 246, 0.12); }
      }

      @keyframes browserSpinnerGlow {
        0% { opacity: 0.6; }
        50% { opacity: 1.0; }
        100% { opacity: 0.6; }
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

export interface BrowserPanelProps {
  /** The latest screenshot to display */
  screenshot: BrowserScreenshotEvent | null;
  /** Whether a new screenshot is being loaded */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback when screenshot image fails to load */
  onImageError?: (screenshotId: string) => void;
  /** Test ID for testing */
  testID?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FADE_DURATION_MS = 300;
const FADE_DURATION_REDUCED_MS = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrowserPanel({
  screenshot,
  isLoading = false,
  error = null,
  onImageError,
  testID = 'browser-panel',
}: BrowserPanelProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [imageError, setImageError] = useState(false);
  const [currentScreenshotId, setCurrentScreenshotId] = useState<string | null>(null);

  // Fade-in transition when new screenshot arrives
  useEffect(() => {
    if (!screenshot) return;

    // Only animate if this is a new screenshot
    if (screenshot.screenshot_id === currentScreenshotId) return;

    setCurrentScreenshotId(screenshot.screenshot_id);
    setImageError(false);

    const duration = reducedMotion ? FADE_DURATION_REDUCED_MS : FADE_DURATION_MS;

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [screenshot, currentScreenshotId, fadeAnim, reducedMotion]);

  const handleImageError = useCallback(() => {
    setImageError(true);
    if (screenshot && onImageError) {
      onImageError(screenshot.screenshot_id);
    }
  }, [screenshot, onImageError]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  // Loading state
  if (isLoading && !screenshot) {
    return (
      <View
        style={[styles.container, webContainerStyle]}
        testID={testID}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading browser screenshot"
      >
        <View style={styles.surfaceLayer}>
          <View style={styles.loadingContainer}>
            <View style={[styles.spinnerGlow, webSpinnerGlowStyle]}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
            <Text style={styles.loadingText}>Loading browser view...</Text>
          </View>
        </View>
      </View>
    );
  }

  // Error state
  if (error || (screenshot && imageError)) {
    return (
      <View
        style={[styles.container, webContainerStyle]}
        testID={testID}
        accessibilityRole="alert"
        accessibilityLabel={error ?? 'Failed to load screenshot'}
      >
        <View style={styles.surfaceLayer}>
          <View style={styles.errorContainer}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle-outline" size={32} color="#ff3b30" />
            </View>
            <Text style={styles.errorTitle}>Failed to load screenshot</Text>
            <Text style={styles.errorMessage}>
              {error ?? 'The browser screenshot could not be displayed.'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Empty state (no screenshot yet)
  if (!screenshot) {
    return (
      <View
        style={[styles.container, webContainerStyle]}
        testID={testID}
        accessibilityRole="none"
        accessibilityLabel="Browser panel - waiting for activity"
      >
        <View style={styles.surfaceLayer}>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="globe-outline" size={32} color="#3B82F6" />
            </View>
            <Text style={styles.emptyTitle}>Browser View</Text>
            <Text style={styles.emptyMessage}>
              Live browser screenshots will appear here during agent activity.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Screenshot display
  return (
    <View
      style={[styles.container, webContainerStyle]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={`Browser screenshot of ${screenshot.page_title || screenshot.page_url}`}
    >
      {/* Premium depth: dark shadow layer */}
      <View style={styles.shadowLayer} />

      {/* Premium depth: blue ambient glow layer */}
      <View style={styles.blueGlowLayer} />

      {/* Top rim lighting (subtle blue catch light) */}
      <View style={styles.rimLight} />

      {/* Surface layer with screenshot */}
      <View style={styles.surfaceLayer}>
        {/* URL bar */}
        <View style={styles.urlBar}>
          <View style={styles.urlBarLeft}>
            <View style={styles.urlDot} />
            <Ionicons name="lock-closed-outline" size={12} color={CanvasTokens.text.muted} />
            <Text style={styles.urlText} numberOfLines={1}>
              {screenshot.page_url}
            </Text>
          </View>
          <Text style={styles.urlTitle} numberOfLines={1}>
            {screenshot.page_title}
          </Text>
        </View>

        {/* Screenshot image with fade transition */}
        <Animated.View
          style={[
            styles.screenshotContainer,
            { opacity: fadeAnim },
          ]}
        >
          {Platform.OS === 'web' ? (
            <View
              style={styles.screenshotImage}
              accessibilityRole="image"
              accessibilityLabel={`Screenshot of ${screenshot.page_title}`}
            >
              {/* Web: render img tag directly for best performance */}
              <View
                style={StyleSheet.absoluteFill}
                {...({
                  dangerouslySetInnerHTML: {
                    __html: `<img
                      src="${escapeHtml(screenshot.screenshot_url)}"
                      alt="${escapeHtml(screenshot.page_title || 'Browser screenshot')}"
                      style="width:100%;height:100%;object-fit:contain;border-radius:0 0 11px 11px;"
                      onerror="this.style.display='none'"
                    />`,
                  },
                } as unknown as Record<string, unknown>)}
              />
            </View>
          ) : (
            // Native: use Image component
            <View style={styles.screenshotImage}>
              <Text style={styles.nativeFallbackText}>
                Browser screenshots are only available on desktop.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Loading overlay for new screenshot arriving */}
        {isLoading && screenshot && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#3B82F6" />
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Web-only premium styles (box-shadow, backdrop-filter)
// ---------------------------------------------------------------------------

const webContainerStyle: ViewStyle = Platform.OS === 'web'
  ? ({
      // Glassmorphism backdrop
      backdropFilter: 'blur(16px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
      // Smooth transitions
      transition: 'box-shadow 0.4s ease-out, border-color 0.3s ease-out',
    } as unknown as ViewStyle)
  : {};

const webSpinnerGlowStyle: ViewStyle = Platform.OS === 'web'
  ? ({
      animation: 'browserSpinnerGlow 2s ease-in-out infinite',
    } as unknown as ViewStyle)
  : {};

// ---------------------------------------------------------------------------
// Styles -- $10K premium aesthetic
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    borderRadius: 12,
    overflow: 'visible', // Allow shadows to extend beyond bounds
  },

  // Premium depth: dark shadow underneath (creates physical depth)
  shadowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: [
            '0 8px 24px rgba(0, 0, 0, 0.5)',
            '0 4px 12px rgba(0, 0, 0, 0.4)',
          ].join(', '),
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

  // Premium depth: blue ambient glow (halo effect)
  blueGlowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: [
            '0 0 32px rgba(59, 130, 246, 0.15)',
            '0 0 60px rgba(59, 130, 246, 0.08)',
          ].join(', '),
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  // Top rim lighting (subtle blue catch light on top edge)
  rimLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    ...(Platform.OS === 'web'
      ? ({
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(59, 130, 246, 0.3) 30%,
            rgba(59, 130, 246, 0.3) 70%,
            transparent 100%
          )`,
        } as unknown as ViewStyle)
      : {
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
        }),
    zIndex: 2,
  },

  // Panel surface (dark glass)
  surfaceLayer: {
    flex: 1,
    backgroundColor: 'rgba(30, 30, 30, 0.98)', // Dark glass
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)', // Blue glow border
    overflow: 'hidden',
    zIndex: 1,
  },

  // URL bar
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(20, 20, 20, 0.6)',
  },

  urlBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },

  urlDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34c759',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 6px rgba(52, 199, 89, 0.5)',
        } as unknown as ViewStyle)
      : {}),
  },

  urlText: {
    fontSize: 12,
    fontWeight: '400',
    color: CanvasTokens.text.muted,
    flex: 1,
  },

  urlTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: CanvasTokens.text.secondary,
    maxWidth: 200,
  },

  // Screenshot container
  screenshotContainer: {
    flex: 1,
    position: 'relative',
  },

  screenshotImage: {
    flex: 1,
    width: '100%',
  },

  nativeFallbackText: {
    color: CanvasTokens.text.muted,
    fontSize: 14,
    textAlign: 'center',
    padding: 32,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 300,
  },

  spinnerGlow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 24px rgba(59, 130, 246, 0.2)',
        } as unknown as ViewStyle)
      : {}),
  },

  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: CanvasTokens.text.muted,
    letterSpacing: 0.3,
  },

  // Loading overlay (when a new screenshot is arriving on top of existing)
  loadingOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 300,
    padding: 32,
  },

  errorIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },

  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff3b30',
  },

  errorMessage: {
    fontSize: 13,
    fontWeight: '400',
    color: CanvasTokens.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 300,
    padding: 32,
  },

  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.15)',
        } as unknown as ViewStyle)
      : {}),
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CanvasTokens.text.primary,
  },

  emptyMessage: {
    fontSize: 13,
    fontWeight: '400',
    color: CanvasTokens.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
