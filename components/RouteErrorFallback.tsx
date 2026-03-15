import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface RouteErrorFallbackProps {
  error: Error;
  resetError: () => void;
  routeName?: string;
}

export function RouteErrorFallback({ error, resetError, routeName }: RouteErrorFallbackProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{'\u26A0\uFE0F'}</Text>
      <Text style={styles.title}>Something went wrong</Text>
      {routeName && <Text style={styles.route}>{routeName}</Text>}
      <Text style={styles.message}>{error.message}</Text>
      <Pressable style={styles.button} onPress={resetError}>
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0a0a0f',
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  route: { fontSize: 14, color: '#666', marginBottom: 12 },
  message: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24, maxWidth: 320 },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
