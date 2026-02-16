import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from './Badge';

interface ListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  rightContent?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
}

export function ListItem({
  icon,
  title,
  subtitle,
  badge,
  badgeVariant = 'default',
  rightContent,
  showChevron = true,
  onPress,
}: ListItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {badge && <Badge label={badge} variant={badgeVariant} size="sm" />}
        </View>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      
      {rightContent}
      
      {showChevron && (
        <Ionicons 
          name="chevron-forward" 
          size={18} 
          color={Colors.text.muted} 
          style={styles.chevron}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: Colors.background.tertiary,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: Typography.bodyMedium.fontWeight,
  },
  subtitle: {
    color: Colors.text.tertiary,
    fontSize: Typography.small.fontSize,
  },
  chevron: {
    marginLeft: Spacing.sm,
  },
});
