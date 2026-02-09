import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Card } from './ui/Card';
import { PipelineStage } from '@/types';

interface PipelineCardProps {
  stages: PipelineStage[];
  onPress?: () => void;
}

export function PipelineCard({ stages, onPress }: PipelineCardProps) {
  return (
    <Card variant="elevated" onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="trending-up" size={20} color={Colors.semantic.success} />
        </View>
        <Text style={styles.headerTitle}>Business Roadmap</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.text.muted} />
      </View>

      <View style={styles.pipeline}>
        {stages.map((stage, index) => {
          const progress = Math.min((stage.count / stage.target) * 100, 100);
          const trendIcon = stage.trend === 'up' ? 'arrow-up' : 
                           stage.trend === 'down' ? 'arrow-down' : 'remove';
          const trendColor = stage.trend === 'up' ? Colors.semantic.success :
                            stage.trend === 'down' ? Colors.semantic.error :
                            Colors.text.muted;

          return (
            <View key={stage.name} style={styles.stageRow}>
              <View style={styles.stageInfo}>
                <Text style={styles.stageName}>{stage.name}</Text>
                <View style={styles.stageStats}>
                  <Text style={styles.stageCount}>{stage.count}</Text>
                  <Text style={styles.stageTarget}>/{stage.target}</Text>
                  <Ionicons name={trendIcon as any} size={12} color={trendColor} style={styles.trendIcon} />
                </View>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${progress}%`,
                        backgroundColor: progress >= 80 ? Colors.semantic.success :
                                        progress >= 50 ? Colors.semantic.warning :
                                        Colors.accent.cyan,
                      }
                    ]} 
                  />
                </View>
              </View>

              {index < stages.length - 1 && (
                <View style={styles.connector}>
                  <Ionicons name="chevron-forward" size={12} color={Colors.text.muted} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.semantic.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: Typography.captionMedium.fontWeight,
  },
  pipeline: {
    gap: Spacing.sm,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageInfo: {
    width: 90,
  },
  stageName: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
  },
  stageStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageCount: {
    color: Colors.text.primary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  stageTarget: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  trendIcon: {
    marginLeft: Spacing.xs,
  },
  progressContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  progressBg: {
    height: 6,
    backgroundColor: Colors.background.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  connector: {
    marginLeft: Spacing.sm,
    opacity: 0.3,
  },
});
