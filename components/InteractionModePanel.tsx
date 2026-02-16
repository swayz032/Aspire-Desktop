import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { InteractionModeOption } from '@/types';
import { useRouter } from 'expo-router';

interface InteractionModePanelProps {
  options: InteractionModeOption[];
}

export function InteractionModePanel({ options }: InteractionModePanelProps) {
  const router = useRouter();

  return (
    <Card variant="elevated" padding="none" style={styles.container}>
      {options.map((option, index) => (
        <Pressable
          key={option.id}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
            index === options.length - 1 && styles.lastRow,
          ]}
          onPress={() => router.push(option.route as any)}
        >
          <View style={styles.iconContainer}>
            <Ionicons 
              name={option.icon as any} 
              size={22} 
              color={Colors.accent.cyan} 
            />
          </View>
          
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{option.title}</Text>
              {option.badge && (
                <Badge 
                  label={option.badge.toString()} 
                  variant="warning" 
                  size="sm" 
                />
              )}
            </View>
            <Text style={styles.subtitle}>{option.subtitle}</Text>
          </View>
          
          <Ionicons 
            name="chevron-forward" 
            size={18} 
            color={Colors.text.muted} 
          />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  rowPressed: {
    backgroundColor: Colors.surface.cardHover,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.accent.cyanLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  subtitle: {
    color: Colors.text.tertiary,
    fontSize: 11,
    marginTop: 1,
  },
});
