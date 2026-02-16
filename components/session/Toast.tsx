import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  onHide: () => void;
  duration?: number;
}

const TYPE_CONFIG: Record<ToastType, { bg: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { bg: Colors.semantic.successDark, icon: 'checkmark-circle', color: Colors.semantic.success },
  error: { bg: Colors.semantic.errorDark, icon: 'close-circle', color: Colors.semantic.error },
  info: { bg: Colors.accent.cyanDark, icon: 'information-circle', color: Colors.accent.cyan },
  warning: { bg: Colors.semantic.warningDark, icon: 'warning', color: Colors.semantic.warning },
};

export function Toast({ visible, message, type = 'success', onHide, duration = 3000 }: ToastProps) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: false,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(translateY, {
            toValue: -50,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => onHide());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const config = TYPE_CONFIG[type];

  return (
    <Animated.View 
      style={[
        styles.container,
        { backgroundColor: config.bg },
        { opacity, transform: [{ translateY }] }
      ]}
    >
      <Ionicons name={config.icon} size={20} color={config.color} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    zIndex: 1000,
    pointerEvents: 'none',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
  },
});
