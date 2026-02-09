import React, { ReactNode } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface FullscreenSessionShellProps {
  children: ReactNode;
  showBackButton?: boolean;
  backLabel?: string;
}

export function FullscreenSessionShell({ 
  children, 
  showBackButton = true,
  backLabel = 'Exit'
}: FullscreenSessionShellProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {showBackButton && (
        <Pressable 
          style={styles.backButton}
          onPress={() => router.push('/')}
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
    top: 24,
    left: 24,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
