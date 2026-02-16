import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useDesktop } from '@/lib/useDesktop';
import { useRouter } from 'expo-router';

export default function MicScreen() {
  const isDesktop = useDesktop();
  const router = useRouter();

  useEffect(() => {
    if (isDesktop) {
      router.replace('/(tabs)');
    }
  }, [isDesktop]);

  if (isDesktop) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mic-outline" size={48} color={Colors.accent.cyan} />
        </View>
        <Text style={styles.title}>Ava Session</Text>
        <Text style={styles.subtitle}>
          Tap the microphone button below to start a voice session with Ava
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.background.secondary,
    borderWidth: 2,
    borderColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.title,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
