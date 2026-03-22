import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

interface SessionTimeoutWarningProps {
  secondsLeft: number;
  onExtend: () => void;
  onSignOut: () => void;
}

function SessionTimeoutWarningInner({ secondsLeft, onExtend, onSignOut }: SessionTimeoutWarningProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={32} color="#F59E0B" />
        </View>
        <Text style={styles.title}>Session Expiring</Text>
        <Text style={styles.subtitle}>
          Your session will expire in {secondsLeft}s due to inactivity.
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            onPress={onSignOut}
            style={({ hovered }: any) => [styles.button, styles.secondaryButton, hovered && styles.secondaryButtonHover]}
          >
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
          <Pressable
            onPress={onExtend}
            style={({ hovered }: any) => [styles.button, styles.primaryButton, hovered && styles.primaryButtonHover]}
          >
            <Text style={styles.primaryButtonText}>Continue Session</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(4px)' } : {}),
  } as any,
  modal: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 32,
    width: 380,
    maxWidth: '90%',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)' } : {}),
  } as any,
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F2F2F2',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.15s ease-out' } : {}),
  } as any,
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  primaryButtonHover: {
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryButtonHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
});

export function SessionTimeoutWarning(props: SessionTimeoutWarningProps) {
  return (
    <PageErrorBoundary pageName="session-timeout-warning">
      <SessionTimeoutWarningInner {...props} />
    </PageErrorBoundary>
  );
}
