import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect } from 'react';

import { useColorScheme } from '@/hooks/useColorScheme';
import { TenantProvider, SessionProvider, AvaDockProvider, MicStateProvider } from '@/providers';
import { AvaMiniPlayer } from '@/components/AvaMiniPlayer';
import { useDesktop } from '@/lib/useDesktop';

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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDesktop = useDesktop();
  useWebDesktopSetup();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <TenantProvider>
        <SessionProvider>
          <AvaDockProvider>
            <MicStateProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
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
                  <Stack.Screen name="+not-found" />
                </Stack>
                {!isDesktop && <AvaMiniPlayer />}
                <StatusBar style="light" />
              </ThemeProvider>
            </MicStateProvider>
          </AvaDockProvider>
        </SessionProvider>
      </TenantProvider>
    </GestureHandlerRootView>
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
