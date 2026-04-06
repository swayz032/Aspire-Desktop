import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useRef, useState } from 'react';

// Suppress known React Native framework warnings on web (not fixable in app code)
LogBox.ignoreLogs([
  'Cannot record touch end without a touch start',
  'Animated: `useNativeDriver` is not supported',
]);

// LogBox only suppresses the RN yellow box, not browser console.
// Patch console.warn on web to filter these RN-internal warnings from DevTools.
if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const _origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('Cannot record touch end without a touch start') ||
      msg.includes('`useNativeDriver` is not supported') ||
      msg.includes('width') && msg.includes('height') && msg.includes('chart should be greater than 0')
    ) return;
    _origWarn.apply(console, args);
  };
}

import { useColorScheme } from '@/hooks/useColorScheme';
import { SupabaseProvider, TenantProvider, SessionProvider, AvaDockProvider, MicStateProvider, useSupabase } from '@/providers';
import { ElevenLabsAgentProvider } from '@/hooks/useElevenLabsAgent';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { SessionTimeoutWarning } from '@/components/ui/SessionTimeoutWarning';
import { AvaMiniPlayer } from '@/components/AvaMiniPlayer';
import { IncomingCallOverlay } from '@/components/calls/IncomingCallOverlay';
import { IncomingVideoCallOverlay } from '@/components/calls/IncomingVideoCallOverlay';
import { CalendarNotificationOverlay } from '@/components/calendar/CalendarNotificationOverlay';
import { AvaPresentsProvider, useAvaPresentsContext } from '@/contexts/AvaPresentsContext';
import { ResearchModal } from '@/components/cards/ResearchModal';
import { useRealtimeConferenceInvitations } from '@/hooks/useRealtimeConferenceInvitations';
import { useRealtimeApprovalRequests } from '@/hooks/useRealtimeApprovalRequests';
import { useBackendConnectivity } from '@/hooks/useBackendConnectivity';
import { useDesktop } from '@/lib/useDesktop';
import { CanvasDragDropProvider } from '@/lib/canvasDragDrop';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { allowDevSupabaseBypass } from '@/lib/supabaseRuntime';
import { reportError } from '@/lib/errorReporter';
import { configureSentry, Sentry } from '@/lib/sentry';
import { AppState, type AppStateStatus } from 'react-native';
import { getBiometricPreference, authenticateWithBiometrics } from '@/lib/biometrics';
import { useSupabaseDevTools } from '@/lib/devtools/supabasePlugin';
import { useStoreDevTools } from '@/lib/devtools/storePlugin';
import { prefetchCriticalAssets } from '@/lib/assetPrefetch';

// Initialize Sentry before any component renders
configureSentry();

// Start prefetching critical assets immediately (before any component mounts)
prefetchCriticalAssets();

/**
 * Global Error Boundary — prevents white screen on uncaught errors.
 * Shows a recovery UI with reload button instead of a blank page.
 */
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('error', this.handleWindowError);
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    }
  }

  componentWillUnmount() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.removeEventListener('error', this.handleWindowError);
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    }
  }

  private handleWindowError = (event: ErrorEvent) => {
    reportError({
      title: event.message || 'Unhandled error',
      severity: 'sev2',
      component: 'window_error',
      stackTrace: event.error?.stack,
      errorCode: 'UNHANDLED_ERROR',
      fingerprint: `desktop:window_error:${(event.message || '').substring(0, 50)}`,
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportError({
      title: reason?.message || 'Unhandled promise rejection',
      severity: 'sev2',
      component: 'unhandled_rejection',
      stackTrace: reason?.stack,
      errorCode: 'UNHANDLED_REJECTION',
      fingerprint: `desktop:rejection:${(reason?.message || '').substring(0, 50)}`,
    });
  };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      Sentry.captureException(error, {
        extra: {
          pageName: 'GlobalErrorBoundary',
          componentStack: info.componentStack,
        },
      });
    } catch {
      // Sentry may not be initialized — safe to ignore
    }

    console.error('[Aspire] Fatal render error:', error.message, info.componentStack);
    emitCanvasEvent('error', {
      source: 'global_error_boundary',
      message: error.message.slice(0, 180),
      has_stack: !!info.componentStack,
    });
    reportError({
      title: 'Global app crash',
      severity: 'sev1',
      component: 'GlobalErrorBoundary',
      stackTrace: (info.componentStack || error.stack || '').substring(0, 4000),
      errorCode: 'GLOBAL_CRASH',
      message: error.message,
      fingerprint: `desktop:global_crash:${error.message?.substring(0, 50)}`,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => {
              if (Platform.OS === 'web') {
                window.location.reload();
              } else {
                this.setState({ hasError: false, error: null });
              }
            }}
          >
            <Text style={errorStyles.buttonText}>Reload Aspire</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    color: '#6e6e73',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 400,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

function useWebDesktopSetup() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    document.body.style.backgroundColor = '#0a0a0a';
    document.documentElement.style.backgroundColor = '#0a0a0a';

    const viewport = document.querySelector('meta[name="viewport"]');
    const isGuestJoinPage = window.location.pathname.startsWith('/join/');
    if (viewport && !isGuestJoinPage) {
      viewport.setAttribute('content', 'width=1440, initial-scale=1, shrink-to-fit=no');
    }
  }, []);
}

const DEV_BYPASS_AUTH = allowDevSupabaseBypass();

function isSyntheticPublicLoginRequest(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const search = new URLSearchParams(window.location.search);
  return search.get('e2eRoute') === 'login';
}

function useAuthGate() {
  const { session, isLoading, suiteId } = useSupabase();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(DEV_BYPASS_AUTH ? true : false);
  const [onboardingComplete, setOnboardingComplete] = useState(DEV_BYPASS_AUTH ? true : false);
  // Once onboarding is confirmed complete, never revert — prevents redirect loops
  // during token refresh races where suiteId briefly becomes null.
  const onboardingConfirmedRef = useRef(DEV_BYPASS_AUTH ? true : false);
  const navLockRef = useRef(false);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    // Don't check onboarding until session is fully loaded — avoids
    // races where session is still resolving from storage.
    if (isLoading) return;

    if (!session) {
      // Only reset if onboarding was never confirmed — prevents token refresh
      // races from bouncing an existing user back to onboarding.
      if (!onboardingConfirmedRef.current) {
        setOnboardingChecked(false);
        setOnboardingComplete(false);
      }
      return;
    }

    // If onboarding was already confirmed complete this session, skip re-checking.
    // This is the key fix: suiteId can briefly be null during token refresh,
    // which would otherwise set onboardingComplete=false and trigger a redirect.
    if (onboardingConfirmedRef.current) {
      setOnboardingChecked(true);
      setOnboardingComplete(true);
      return;
    }

    // If suiteId is null, the user might need onboarding OR suiteId might
    // still be loading from user_metadata. Don't assume — check the API.
    // Only skip the API check and immediately redirect to onboarding if
    // we have NO session token to check with.
    if (!session.access_token) {
      setOnboardingChecked(true);
      setOnboardingComplete(false);
      return;
    }

    const token = session.access_token;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch('/api/onboarding/status', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`onboarding_status_${r.status}`);
        }
        return r.json();
      })
      .then(({ complete }) => {
        clearTimeout(timeoutId);
        if (complete) onboardingConfirmedRef.current = true;
        setOnboardingComplete(!!complete);
        setOnboardingChecked(true);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // On failure, assume onboarding is complete — sending an existing user
        // back to onboarding is worse than letting a new user skip it.
        onboardingConfirmedRef.current = true;
        setOnboardingComplete(true);
        setOnboardingChecked(true);
      });
  }, [session, suiteId, isLoading]);

  useEffect(() => {
    // CRITICAL: If still loading session from storage, do nothing. 
    // This prevents the "flash to login" that forces users to sign in twice.
    if (isLoading) return;

    const inAuthGroup = segments[0] === ('(auth)' as any);
    const inPublicGroup = segments.length === 0 || segments[0] === ('sign' as any) || segments[0] === ('book' as any) || segments[0] === ('join' as any) || segments[0] === ('landing' as any) || segments[0] === ('index' as any);
    const onOnboarding = segments[1] === ('onboarding' as any);

    if (DEV_BYPASS_AUTH) {
      if (isSyntheticPublicLoginRequest()) {
        return;
      }
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
      return;
    }

    // Navigation debounce — prevents rapid redirect loops ("shaking") when
    // session oscillates during token refresh races or voice pipeline errors.
    if (navLockRef.current) return;

    const navigate = (target: string) => {
      navLockRef.current = true;
      router.replace(target as any);
      setTimeout(() => { navLockRef.current = false; }, 2000);
    };

    // Session pages (conference, voice) should NEVER redirect to login on transient
    // token refresh races — the user is mid-call. SupabaseProvider's stableSetSession
    // already attempts refreshSession() before accepting null. Give it time.
    const inSessionGroup = segments[0] === ('session' as any);

    if (!session && !inAuthGroup && !inPublicGroup) {
      if (inSessionGroup) {
        // Delay redirect for session pages — only act after 5s of confirmed no-session.
        navLockRef.current = true;
        setTimeout(() => { navLockRef.current = false; }, 5000);
        return;
      }
      navigate('/(auth)/login');
    } else if (session && onboardingChecked && !onboardingComplete && !onOnboarding && !inPublicGroup) {
      navigate('/(auth)/onboarding');
    } else if (session && inAuthGroup) {
      // User has a session and is on login/onboarding page — redirect to tabs.
      // Don't wait for onboardingChecked — the homepage can handle onboarding redirect
      // if needed. Waiting caused the "Please wait" freeze where the login button
      // stayed loading indefinitely because the onboarding check was async.
      if (onOnboarding && !onboardingChecked) {
        // Exception: if we're already on onboarding page and check isn't done, wait.
        return;
      }
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100%';
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100%';
        const root = document.getElementById('root');
        if (root) { root.style.overflow = 'hidden'; root.style.height = '100%'; root.style.minHeight = ''; root.style.display = 'flex'; }
      }
      navigate('/(tabs)');
    }
  }, [session, isLoading, segments, onboardingChecked, onboardingComplete]);
}

/** Biometric lock gate — prompts for biometric on app resume (native only). */
function useBiometricLock(isAuthenticated: boolean) {
  const [locked, setLocked] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (Platform.OS === 'web' || !isAuthenticated) return;

    const subscription = AppState.addEventListener('change', async (nextState) => {
      // App came to foreground from background
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const enabled = await getBiometricPreference();
        if (enabled) {
          setLocked(true);
          const verified = await authenticateWithBiometrics('Unlock Aspire');
          setLocked(!verified);
        }
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  return locked;
}

/** Thin wrapper — reads AvaPresents context and renders the modal */
function ResearchModalOverlay() {
  const avaPresents = useAvaPresentsContext();
  if (!avaPresents.visible) return null;
  return <ResearchModal {...avaPresents} />;
}

function AppNavigator() {
  const isDesktop = useDesktop();
  const colorScheme = useColorScheme();
  const { session, signOut } = useSupabase();
  useAuthGate();
  useRealtimeConferenceInvitations();
  useRealtimeApprovalRequests();
  useBackendConnectivity();
  const biometricLocked = useBiometricLock(!!session);
  const { showWarning, secondsLeft, extendSession } = useIdleTimeout();

  // Dev tools plugins — only active in __DEV__ builds (zero overhead in production)
  useSupabaseDevTools();
  useStoreDevTools();

  // Wave 7E: Dev-mode debugging — log Supabase Realtime channel status + Network Inspector hint
  useEffect(() => {
    if (!__DEV__) return;
    console.log('[Aspire DevTools] Dev mode active. Press j for React Native DevTools, shift+m for plugins.');
    console.log('[Aspire DevTools] Network Inspector: enable via Dev Menu > Toggle Network Inspector');
    console.log('[Aspire DevTools] Performance Monitor: enable via Dev Menu > Toggle Performance Monitor');
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="landing" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="session"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'fullScreenModal'
          }}
        />
        <Stack.Screen
          name="office-store"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="calendar"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="roadmap"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="cash-position"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="inbox"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="receipts"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="more"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="founder-hub"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="finance-hub"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="bookings"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="book"
          options={{
            headerShown: false,
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="team-workspace"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen
          name="sign"
          options={{
            headerShown: false,
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="join"
          options={{
            headerShown: false,
            presentation: 'card'
          }}
        />
        <Stack.Screen
          name="voice-test"
          options={{
            headerShown: false,
            presentation: isDesktop ? 'card' : 'modal'
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <IncomingCallOverlay />
      <IncomingVideoCallOverlay />
      <CalendarNotificationOverlay />
      <ResearchModalOverlay />
      {!isDesktop && <AvaMiniPlayer />}
      {session && showWarning && (
        <SessionTimeoutWarning
          secondsLeft={secondsLeft}
          onExtend={extendSession}
          onSignOut={signOut}
        />
      )}
      {/* Biometric lock overlay — native only */}
      {biometricLocked && (
        <View style={biometricStyles.overlay}>
          <View style={biometricStyles.content}>
            <Text style={biometricStyles.icon}>🔒</Text>
            <Text style={biometricStyles.title}>Aspire is Locked</Text>
            <Text style={biometricStyles.subtitle}>Authenticate to continue</Text>
            <TouchableOpacity
              style={biometricStyles.button}
              onPress={async () => {
                const verified = await authenticateWithBiometrics('Unlock Aspire');
                // useBiometricLock handles state — if verified, locked = false
                if (!verified) {
                  // Stay locked
                }
              }}
            >
              <Text style={biometricStyles.buttonText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

function RootLayout() {
  useWebDesktopSetup();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Permanent viewport lock — prevents homepage stretching on ALL routes.
  // Injected at the root layout so it fires before any child page mounts.
  // Uses !important CSS rule that survives all navigation and page transitions.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!document.getElementById('aspire-viewport-lock')) {
      const style = document.createElement('style');
      style.id = 'aspire-viewport-lock';
      style.textContent = `
        html, body, #root {
          overflow: hidden !important;
          height: 100% !important;
          max-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: 100vw !important;
        }
        #root {
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Inject Ionicons font via CSS on web — the Metro-bundled .ttf path inside
  // node_modules/.pnpm/ gets served as HTML by the SPA fallback (OTS parse error).
  // Loading from /fonts/Ionicons.ttf (public/ dir, served by express.static) works.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const existing = document.getElementById('ionicons-font');
      if (!existing) {
        const style = document.createElement('style');
        style.id = 'ionicons-font';
        style.textContent = `
          @font-face {
            font-family: 'Ionicons';
            src: url('/fonts/Ionicons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  if (!fontsLoaded) {
    // Dark splash instead of null — prevents white flash during font load
    return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;
  }

  return (
    <GlobalErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SupabaseProvider>
        <TenantProvider>
          <SessionProvider>
            <AvaDockProvider>
              <MicStateProvider>
                <ElevenLabsAgentProvider>
                <AvaPresentsProvider>
                <CanvasDragDropProvider>
                  <AppNavigator />
                </CanvasDragDropProvider>
                </AvaPresentsProvider>
                </ElevenLabsAgentProvider>
              </MicStateProvider>
            </AvaDockProvider>
          </SessionProvider>
        </TenantProvider>
        </SupabaseProvider>
      </GestureHandlerRootView>
    </GlobalErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    minHeight: '100%' as any,
    height: '100%' as any,
  },
});

const biometricStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0c',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6e6e73',
    fontSize: 14,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Wrap with Sentry error tracking (graceful — works even without DSN)
export default Sentry.wrap(RootLayout);
