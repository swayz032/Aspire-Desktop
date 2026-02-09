import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Colors, BorderRadius, Spacing, Typography } from '@/constants/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const variantStyles = {
  primary: {
    bg: Colors.accent.cyan,
    bgPressed: Colors.accent.cyanDark,
    text: '#FFFFFF',
    border: Colors.accent.cyan,
  },
  secondary: {
    bg: Colors.background.tertiary,
    bgPressed: Colors.background.elevated,
    text: Colors.text.secondary,
    border: Colors.border.default,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: Colors.surface.card,
    text: Colors.text.secondary,
    border: 'transparent',
  },
  danger: {
    bg: Colors.semantic.errorDark,
    bgPressed: Colors.semantic.error,
    text: Colors.semantic.error,
    border: Colors.semantic.error,
  },
  success: {
    bg: Colors.semantic.successDark,
    bgPressed: Colors.semantic.success,
    text: Colors.semantic.success,
    border: Colors.semantic.success,
  },
};

export function Button({ 
  label, 
  onPress, 
  variant = 'secondary', 
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const colors = variantStyles[variant];
  
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        {
          backgroundColor: pressed ? colors.bgPressed : colors.bg,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <>
          {icon}
          <Text style={[
            styles.text,
            styles[`text_${size}`],
            { color: colors.text },
            icon ? styles.textWithIcon : undefined,
          ]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  md: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  lg: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  text: {
    fontWeight: '600',
  },
  text_sm: {
    fontSize: Typography.small.fontSize,
  },
  text_md: {
    fontSize: Typography.caption.fontSize,
  },
  text_lg: {
    fontSize: Typography.body.fontSize,
  },
  textWithIcon: {
    marginLeft: Spacing.sm,
  },
  fullWidth: {
    width: '100%',
  },
});
