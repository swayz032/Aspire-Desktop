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
import { AvaMiniPlayer } from '@/components/AvaMiniPlayer';
import { useDesktop } from '@/lib/useDesktop';
import { CanvasDragDropProvider } from '@/lib/canvasDragDrop';

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
    if (viewport) {
      viewport.setAttribute('content', 'width=1440, initial-scale=1, shrink-to-fit=no');
    }
  }, []);
}

/**
 * Auth Gate — Law #3: Fail Closed
 * - Unauthenticated users → login
 * - Authenticated users without completed onboarding → onboarding
 * - Authenticated users with completed onboarding → main app
 */
function useAuthGate() {
  const { session, isLoading, suiteId } = useSupabase();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Check onboarding status when session is available
  useEffect(() => {
    if (!session) {
      setOnboardingChecked(false);
      setOnboardingComplete(false);
      return;
    }

    // No suite_id in user_metadata → user definitely needs onboarding (including bootstrap)
    if (!suiteId) {
      setOnboardingChecked(true);
      setOnboardingComplete(false);
      return;
    }

    // Reset while re-checking — prevents stale state from causing premature redirect
    setOnboardingChecked(false);

    // Use server endpoint (supabaseAdmin) — bypasses RLS.
    // Client-side Supabase queries fail if suite_profiles has RLS enabled
    // with no read policy, causing an infinite onboarding redirect loop.
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
        // Fail closed — treat as incomplete if check fails
        setOnboardingComplete(false);
        setOnboardingChecked(true);
      });
  }, [session, suiteId]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === ('(auth)' as any);
    const inPublicGroup = segments[0] === ('sign' as any) || segments[0] === ('book' as any) || segments[0] === ('join' as any);
    const onOnboarding = segments[1] === ('onboarding' as any);

    if (!session && !inAuthGroup && !inPublicGroup) {
      // Not logged in → login (public routes like /sign and /book are exempt)
      router.replace('/(auth)/login' as any);
    } else if (session && onboardingChecked && !onboardingComplete && !onOnboarding && !inPublicGroup) {
      // Logged in but onboarding incomplete → onboarding (cannot bypass, but public routes are exempt)
      router.replace('/(auth)/onboarding' as any);
    } else if (session && onboardingChecked && onboardingComplete && inAuthGroup) {
      // Logged in + onboarding done + still on auth pages → main app
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, onboardingChecked, onboardingComplete]);
}

function AppNavigator() {
  const isDesktop = useDesktop();
  const colorScheme = useColorScheme();
  useAuthGate();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
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
      {!isDesktop && <AvaMiniPlayer />}
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
