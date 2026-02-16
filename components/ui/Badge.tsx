import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing, Typography } from '@/constants/tokens';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'live' | 'pending' | 'muted' | 'primary';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

const variantStyles = {
  default: {
    bg: Colors.background.tertiary,
    text: Colors.text.secondary,
  },
  success: {
    bg: Colors.semantic.successLight,
    text: Colors.semantic.success,
  },
  warning: {
    bg: Colors.semantic.warningLight,
    text: Colors.semantic.warning,
  },
  error: {
    bg: Colors.semantic.errorLight,
    text: Colors.semantic.error,
  },
  info: {
    bg: Colors.accent.cyanLight,
    text: Colors.accent.cyan,
  },
  live: {
    bg: Colors.accent.cyanLight,
    text: Colors.accent.cyan,
  },
  pending: {
    bg: Colors.semantic.warningLight,
    text: Colors.semantic.warning,
  },
  muted: {
    bg: Colors.background.elevated,
    text: '#FFFFFF',
  },
  primary: {
    bg: 'rgba(79, 172, 254, 0.15)',
    text: 'rgba(255, 255, 255, 0.9)',
  },
};

export function Badge({ label, variant = 'default', size = 'sm', icon }: BadgeProps) {
  const colors = variantStyles[variant];
  
  return (
    <View style={[
      styles.base,
      size === 'sm' ? styles.sm : styles.md,
      { backgroundColor: colors.bg }
    ]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[
        styles.text,
        size === 'sm' ? styles.textSm : styles.textMd,
        { color: colors.text }
      ]}>
        {label}
      </Text>
    </View>
  );
}

export function StatusDot({ status }: { status: 'live' | 'active' | 'inactive' }) {
  const color = status === 'live' ? Colors.accent.cyan : 
                status === 'active' ? Colors.accent.cyan : 
                Colors.text.muted;
  
  return (
    <View style={[styles.dot, { backgroundColor: color }]} />
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xs,
  },
  sm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  md: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: Typography.micro.fontSize,
  },
  textMd: {
    fontSize: Typography.small.fontSize,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
