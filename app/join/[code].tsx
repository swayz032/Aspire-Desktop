/**
 * Guest Join Page — Public, NO auth required.
 *
 * External guests receive a link like /join/{code} and land on this page.
 * Join code resolved via GET /api/conference/join/:code (PUBLIC endpoint).
 *
 * Uses Zoom Video SDK UI Toolkit (@zoom/videosdk-ui-toolkit) for the full
 * conference experience: PreJoin preview, video grid, controls, chat,
 * screen share, virtual background, captions, recording indicator — all
 * production-grade, mobile/tablet/laptop optimized by Zoom.
 *
 * Flow: loading → uitoolkit (preview + session) → disconnected
 * Error states: expired (410) | invalid (404) | error
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Pressable,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { reportProviderError } from '@/lib/providerErrorReporter';
import { VIDEO_CAPTURE_DEFAULTS } from '@/lib/zoom-config';

// ── Types ────────────────────────────────────────────────────────────────────

interface JoinResponse {
  token: string;
  topic?: string;
  roomName: string;
  guestName: string;
}

type PageState = 'loading' | 'ready' | 'active' | 'disconnected' | 'expired' | 'invalid' | 'error';

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

const GuestColors = {
  canvas: Colors.background.primary,
  ringPulse: 'rgba(59, 130, 246, 0.25)',
};

// ── Web Setup ────────────────────────────────────────────────────────────────

function ensureMobileViewport() {
  if (Platform.OS !== 'web') return;
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
}

function injectGuestStyles() {
  if (Platform.OS !== 'web') return;
  if (document.getElementById('aspire-guest-styles')) return;
  const style = document.createElement('style');
  style.id = 'aspire-guest-styles';
  style.textContent = `
    @keyframes guestRingPulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.18); opacity: 0.15; }
    }
    @keyframes guestFadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes guestBreatheDot {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    /* iOS Safari overscroll prevention */
    html, body { overscroll-behavior: none; }
    .aspire-guest-conference-root button,
    .aspire-guest-conference-root [role="button"] {
      -webkit-user-select: none;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    /* Zoom UI Toolkit dark theme override for Aspire branding */
    #zoom-uitoolkit-container {
      height: 100dvh !important;
      width: 100vw !important;
    }
    @supports not (height: 100dvh) {
      #zoom-uitoolkit-container {
        height: -webkit-fill-available !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Loading State ────────────────────────────────────────────────────────────

function LoadingView() {
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 0.5, duration: 1200, useNativeDriver: false }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  return (
    <View style={styles.centerContainer} accessibilityRole="progressbar" accessibilityLabel="Loading conference">
      <View style={styles.ringContainer}>
        <View style={styles.ringOuter} />
        <View style={styles.ringDashed} />
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.logoInner, { opacity: breatheAnim }]}>
            <Ionicons name="videocam" size={32} color={Colors.accent.cyan} />
          </Animated.View>
        </View>
      </View>
      <Text style={styles.loadingTitle}>Joining Conference</Text>
      <View style={styles.dotsRow}>
        {[0, 1, 2].map(i => (
          <Animated.View
            key={i}
            style={[styles.breatheDot, {
              opacity: breatheAnim,
              ...(Platform.OS === 'web' ? {
                animationName: 'guestBreatheDot',
                animationDuration: '1.2s',
                animationIterationCount: 'infinite',
                animationDelay: `${i * 0.2}s`,
              } : {}),
            }]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Error / Expired / Invalid States ─────────────────────────────────────────

function ErrorView({
  state,
  message,
  onRetry,
}: {
  state: 'expired' | 'invalid' | 'error';
  message: string;
  onRetry: () => void;
}) {
  const config = {
    expired: { icon: 'time-outline' as const, title: 'Link Expired', desc: 'This conference link has expired. Links are valid for 60 minutes.', color: Colors.semantic.warning },
    invalid: { icon: 'close-circle-outline' as const, title: 'Link Not Found', desc: 'This conference link is invalid or has already been used.', color: Colors.semantic.error },
    error: { icon: 'cloud-offline-outline' as const, title: 'Connection Error', desc: message || 'Unable to connect. Please check your network.', color: Colors.semantic.error },
  }[state];

  return (
    <View style={styles.centerContainer} accessibilityRole="alert">
      <View style={[styles.errorCard, { borderColor: config.color + '40' }]}>
        <Ionicons name={config.icon} size={40} color={config.color} />
        <Text style={styles.errorTitle}>{config.title}</Text>
        <Text style={styles.errorDesc}>{config.desc}</Text>
        {state === 'error' && (
          <Pressable style={styles.retryButton} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry connection">
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        )}
        <View style={styles.brandingRow}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </View>
  );
}

// ── Disconnected State ───────────────────────────────────────────────────────

function DisconnectedView({ onRejoin }: { onRejoin: (() => void) | null }) {
  return (
    <View style={styles.centerContainer} accessibilityRole="alert" accessibilityLabel="Call ended">
      <View style={[styles.errorCard, { borderColor: Colors.accent.cyanMedium }]}>
        <Ionicons name="checkmark-circle-outline" size={40} color={Colors.accent.cyan} />
        <Text style={styles.errorTitle}>Session Ended</Text>
        <Text style={styles.errorDesc}>You have left the conference.</Text>
        {onRejoin && (
          <Pressable style={styles.retryButton} onPress={onRejoin} accessibilityRole="button" accessibilityLabel="Rejoin conference">
            <Ionicons name="arrow-forward-circle-outline" size={16} color="#fff" />
            <Text style={styles.retryText}>Rejoin</Text>
          </Pressable>
        )}
        <View style={styles.brandingRow}>
          <View style={styles.brandingDot} />
          <Text style={styles.brandingText}>Aspire Conference</Text>
        </View>
      </View>
    </View>
  );
}

// ── Zoom UI Toolkit Conference ───────────────────────────────────────────────

function ZoomUIToolkitSession({
  token,
  topic,
  guestName,
  onSessionEnd,
  onError,
}: {
  token: string;
  topic: string;
  guestName: string;
  onSessionEnd: () => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uitoolkitRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const onSessionEndRef = useRef(onSessionEnd);
  onSessionEndRef.current = onSessionEnd;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const hasJoinedRef = useRef(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    mountedRef.current = true;
    hasJoinedRef.current = false;

    let destroyed = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Timeout: if toolkit doesn't render within 20s, surface error
    timeoutId = setTimeout(() => {
      if (!destroyed && mountedRef.current && !hasJoinedRef.current) {
        onErrorRef.current('Conference took too long to connect. Please refresh and try again.');
      }
    }, 20000);

    const loadStylesheet = (): Promise<void> => {
      const existingLink = document.getElementById('zoom-uitoolkit-css') as HTMLLinkElement | null;
      if (existingLink?.sheet) return Promise.resolve();

      return new Promise((resolve) => {
        if (existingLink) {
          // Already inserted but not loaded yet — wait for it
          existingLink.addEventListener('load', () => resolve(), { once: true });
          existingLink.addEventListener('error', () => resolve(), { once: true });
          // Resolve after 3s even if CSS fails — toolkit may still work with defaults
          setTimeout(resolve, 3000);
          return;
        }
        const link = document.createElement('link');
        link.id = 'zoom-uitoolkit-css';
        link.rel = 'stylesheet';
        link.href = '/videosdk-ui-toolkit.css';
        link.onload = () => resolve();
        link.onerror = () => resolve(); // Don't block on CSS failure
        document.head.appendChild(link);
        // Resolve after 3s even if CSS fails
        setTimeout(resolve, 3000);
      });
    };

    const init = async () => {
      try {
        // Wait for CSS to fully load BEFORE rendering toolkit
        await loadStylesheet();

        if (destroyed) return;

        // Load UMD script if not already loaded
        let uitoolkit = (window as any).UIToolkit;
        if (!uitoolkit) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById('zoom-uitoolkit-script');
            if (existing) {
              // Script tag exists — check if already loaded
              if ((window as any).UIToolkit) { resolve(); return; }
              existing.addEventListener('load', () => resolve());
              existing.addEventListener('error', () => reject(new Error('Failed to load Zoom UI Toolkit script')));
              return;
            }
            const script = document.createElement('script');
            script.id = 'zoom-uitoolkit-script';
            script.src = '/videosdk-ui-toolkit.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Zoom UI Toolkit script'));
            document.head.appendChild(script);
          });
          uitoolkit = (window as any).UIToolkit;
          if (!uitoolkit) throw new Error('Zoom UI Toolkit not available after script load');
        }
        uitoolkitRef.current = uitoolkit;

        if (destroyed || !containerRef.current) return;

        const config = {
          videoSDKJWT: token,
          sessionName: topic,
          userName: guestName,
          featuresOptions: {
            preview: { enable: true, isAllowModifyName: true },
            video: {
              enable: true,
              enforceMultipleVideos: true,
              fullHd: VIDEO_CAPTURE_DEFAULTS.fullHd,
              hd: VIDEO_CAPTURE_DEFAULTS.hd,
            },
            audio: { enable: true, backgroundNoiseSuppression: true },
            share: { enable: true },
            chat: { enable: true, enableEmoji: true },
            users: { enable: true },
            settings: { enable: true },
            recording: { enable: false },
            virtualBackground: {
              enable: true,
              allowVirtualBackgroundUpload: true,
              virtualBackgrounds: [
                { url: 'blur', displayName: 'Blur' },
              ],
            },
            caption: { enable: true },
            viewMode: {
              enable: true,
              defaultViewMode: 'gallery' as any,
              viewModes: ['gallery', 'speaker', 'ribbon'] as any[],
            },
            leave: { enable: true },
            invite: { enable: false },
            theme: { enable: false, defaultTheme: 'dark' as const },
            header: { enable: true },
            footer: { enable: true },
          },
        };

        // joinSession renders the full Zoom UI into the container.
        // MUST be called before registering any event callbacks (SDK requirement).
        await uitoolkit.joinSession(containerRef.current, config);

        // If we reach here, toolkit successfully initialized
        if (!destroyed && mountedRef.current) {
          hasJoinedRef.current = true;
          setInitializing(false);
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        }

        // Register session lifecycle callbacks AFTER joinSession (SDK requires this order)
        uitoolkit.onSessionDestroyed(() => {
          if (mountedRef.current && hasJoinedRef.current) {
            onSessionEndRef.current();
          }
        });
      } catch (err) {
        reportProviderError({ provider: 'zoom-uitoolkit', action: 'init', error: err, component: 'GuestJoinPage' });
        if (!destroyed && mountedRef.current) {
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
          const message = err instanceof Error ? err.message : 'Failed to initialize conference';
          onErrorRef.current(message);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      mountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      const uitoolkit = uitoolkitRef.current;
      if (uitoolkit) {
        try { uitoolkit.destroy(); } catch (_e) { /* best-effort */ }
      }
    };
  }, [token, topic, guestName]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorDesc}>Video conferencing is only available in a web browser.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, position: 'relative' as const }}>
      <div
        ref={containerRef}
        id="zoom-uitoolkit-container"
        className="aspire-guest-conference-root"
        style={{
          height: '100dvh',
          width: '100vw',
          background: Colors.background.primary,
          overflow: 'hidden',
        }}
      />
      {/* Loading overlay — shown while toolkit initializes, hides once joined */}
      {initializing && (
        <View style={styles.toolkitLoadingOverlay} pointerEvents="none">
          <View style={styles.ringContainer}>
            <View style={styles.ringOuter} />
            <View style={styles.logoContainer}>
              <Ionicons name="videocam" size={28} color={Colors.accent.cyan} />
            </View>
          </View>
          <Text style={styles.loadingTitle}>Starting Conference...</Text>
        </View>
      )}
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function GuestJoinContent() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Inject styles + mobile viewport on mount
  useEffect(() => {
    ensureMobileViewport();
    injectGuestStyles();
  }, []);

  // Validate join code → fetch token
  useEffect(() => {
    if (!code) {
      setPageState('invalid');
      setErrorMessage('No join code provided');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(`${API_BASE}/api/conference/join/${encodeURIComponent(code)}`, {
      signal: controller.signal,
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (res.status === 404) { setPageState('invalid'); return null; }
        if (res.status === 410) { setPageState('expired'); return null; }
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data: JoinResponse | null) => {
        if (!data) return;
        if (!data.token) {
          setPageState('error');
          setErrorMessage('Invalid response from server');
          return;
        }
        setJoinData(data);
        setPageState('ready');
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setErrorMessage('Connection timed out. Please check your network and try again.');
        } else {
          setErrorMessage(err.message || 'Failed to join conference');
        }
        setPageState('error');
      });

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [code]);

  const handleSessionEnd = useCallback(() => {
    setPageState('disconnected');
  }, []);

  const handleToolkitError = useCallback((message: string) => {
    setErrorMessage(message);
    setPageState('error');
  }, []);

  const handleRejoin = useCallback(() => {
    if (joinData) setPageState('ready');
  }, [joinData]);

  const handleRetry = useCallback(() => {
    if (Platform.OS === 'web') window.location.reload();
  }, []);

  return (
    <View style={styles.page}>
      {pageState === 'loading' && <LoadingView />}

      {(pageState === 'ready' || pageState === 'active') && joinData && (
        <ZoomUIToolkitSession
          token={joinData.token}
          topic={joinData.topic || joinData.roomName}
          guestName={joinData.guestName}
          onSessionEnd={handleSessionEnd}
          onError={handleToolkitError}
        />
      )}

      {pageState === 'disconnected' && (
        <DisconnectedView onRejoin={joinData ? handleRejoin : null} />
      )}

      {(pageState === 'expired' || pageState === 'invalid' || pageState === 'error') && (
        <ErrorView state={pageState} message={errorMessage} onRetry={handleRetry} />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

export default function GuestJoinPage() {
  return (
    <PageErrorBoundary pageName="join-conference">
      <GuestJoinContent />
    </PageErrorBoundary>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: GuestColors.canvas,
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'radial-gradient(ellipse at center, transparent 60%, rgba(0, 0, 0, 0.4) 100%)',
    } as unknown as ViewStyle : {}),
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  // Loading rings
  ringContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  ringOuter: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: GuestColors.ringPulse,
    ...(Platform.OS === 'web' ? {
      animationName: 'guestRingPulse',
      animationDuration: '2.4s',
      animationIterationCount: 'infinite',
    } : {}),
  } as any,
  ringDashed: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.08)',
    borderStyle: 'dashed',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  logoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  breatheDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent.cyan,
  },
  // Error states
  errorCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
    maxWidth: 400,
    width: '100%',
  },
  errorTitle: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  errorDesc: {
    ...Typography.body,
    color: Colors.text.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.lg,
  },
  brandingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  brandingText: {
    color: Colors.text.muted,
    fontSize: 11,
  },
  toolkitLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary,
  },
});
