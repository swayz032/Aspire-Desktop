// Build cache bust: 2026-03-13
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';
import { SupabaseProvider, TenantProvider, SessionProvider, AvaDockProvider, MicStateProvider, useSupabase } from '@/providers';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { SessionTimeoutWarning } from '@/components/ui/SessionTimeoutWarning';
import { AvaMiniPlayer } from '@/components/AvaMiniPlayer';
import { IncomingCallOverlay } from '@/components/calls/IncomingCallOverlay';
import { IncomingVideoCallOverlay } from '@/components/calls/IncomingVideoCallOverlay';
import { useRealtimeConferenceInvitations } from '@/hooks/useRealtimeConferenceInvitations';
import { useRealtimeApprovalRequests } from '@/hooks/useRealtimeApprovalRequests';
import { useDesktop } from '@/lib/useDesktop';
import { CanvasDragDropProvider } from '@/lib/canvasDragDrop';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { allowDevSupabaseBypass } from '@/lib/supabaseRuntime';

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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Aspire] Fatal render error:', error.message, info.componentStack);
    emitCanvasEvent('error', {
      source: 'global_error_boundary',
      message: error.message.slice(0, 180),
      has_stack: !!info.componentStack,
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

function useAuthGate() {
  const { session, isLoading, suiteId } = useSupabase();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(DEV_BYPASS_AUTH ? true : false);
  const [onboardingComplete, setOnboardingComplete] = useState(DEV_BYPASS_AUTH ? true : false);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    if (!session) {
      setOnboardingChecked(false);
      setOnboardingComplete(false);
      return;
    }

    if (!suiteId) {
      setOnboardingChecked(true);
      setOnboardingComplete(false);
      return;
    }

    setOnboardingChecked(false);

    const token = session.access_token;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch('/api/onboarding/status', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(({ complete }) => {
        clearTimeout(timeoutId);
        setOnboardingComplete(!!complete);
        setOnboardingChecked(true);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setOnboardingComplete(false);
        setOnboardingChecked(true);
      });
  }, [session, suiteId]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === ('(auth)' as any);
    const inPublicGroup = segments.length === 0 || segments[0] === ('sign' as any) || segments[0] === ('book' as any) || segments[0] === ('join' as any) || segments[0] === ('landing' as any) || segments[0] === ('index' as any);
    const onOnboarding = segments[1] === ('onboarding' as any);

    if (DEV_BYPASS_AUTH) {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
      return;
    }

    if (!session && !inAuthGroup && !inPublicGroup) {
      router.replace('/(auth)/login' as any);
    } else if (session && onboardingChecked && !onboardingComplete && !onOnboarding && !inPublicGroup) {
      router.replace('/(auth)/onboarding' as any);
    } else if (session && onboardingChecked && onboardingComplete && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, onboardingChecked, onboardingComplete]);
}

function AppNavigator() {
  const isDesktop = useDesktop();
  const colorScheme = useColorScheme();
  const { session, signOut } = useSupabase();
  useAuthGate();
  useRealtimeConferenceInvitations();
  useRealtimeApprovalRequests();
  const { showWarning, secondsLeft, extendSession } = useIdleTimeout();

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
        <Stack.Screen name="+not-found" />
      </Stack>
      <IncomingCallOverlay />
      <IncomingVideoCallOverlay />
      {!isDesktop && <AvaMiniPlayer />}
      {session && showWarning && (
        <SessionTimeoutWarning
          secondsLeft={secondsLeft}
          onExtend={extendSession}
          onSignOut={signOut}
        />
      )}
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useWebDesktopSetup();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <GlobalErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SupabaseProvider>
        <TenantProvider>
          <SessionProvider>
            <AvaDockProvider>
              <MicStateProvider>
                <CanvasDragDropProvider>
                  <AppNavigator />
                </CanvasDragDropProvider>
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
