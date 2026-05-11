import React, { ReactNode } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useSafeAreaInsetsCompat } from '@/lib/safeArea';
import { useDynamicViewportHeight } from '@/lib/useDesktop';

interface FullscreenSessionShellProps {
  children: ReactNode;
  showBackButton?: boolean;
  backLabel?: string;
}

function FullscreenSessionShellInner({
  children,
  showBackButton = true,
  backLabel = 'Exit'
}: FullscreenSessionShellProps) {
  const router = useRouter();
  const insets = useSafeAreaInsetsCompat();
  // Subscribe to dvh recompute so iPad Safari URL bar collapse / Stage Manager
  // resize re-applies correctly (height: 100% on a fixed-position element
  // resolves against window.innerHeight which dvh tracks).
  useDynamicViewportHeight();

  // Respect safe-area insets so the close pill never sits under the iPad
  // notch / home indicator / Dynamic Island corner radii.
  const backButtonOffset = {
    top: 24 + insets.top,
    left: 24 + insets.left,
  };

  return (
    <View style={styles.container}>
      {showBackButton && (
        <Pressable
          style={[styles.backButton, backButtonOffset]}
          onPress={() => router.push('/')}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          // Coarse pointer expansion so a thumb tap doesn't graze the edge
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color="rgba(255, 255, 255, 0.8)" />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // @ts-ignore - web-only fixed positioning
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    zIndex: 9999,
  },
  backButton: {
    position: 'absolute',
    // top/left injected at render time so safe-area insets layer in (iPad notch,
    // home indicator on rotated landscape). Inline values are min defaults.
    top: 24,
    left: 24,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Tap target >= 48px tall (Apple HIG 44 + Material 3 48 floor)
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#242426',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    // @ts-ignore - web-only cursor
    cursor: 'pointer',
  },
  backLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export function FullscreenSessionShell(props: any) {
  return (
    <PageErrorBoundary pageName="fullscreen-session-shell">
      <FullscreenSessionShellInner {...props} />
    </PageErrorBoundary>
  );
}
