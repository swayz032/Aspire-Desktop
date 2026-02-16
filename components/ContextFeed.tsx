import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';

export type ActionStatus = 'in_progress' | 'complete' | 'pending' | 'failed';
export type ActionType = 'search' | 'read' | 'generate' | 'analyze' | 'send' | 'approve' | 'thinking';

export interface ContextAction {
  id: string;
  type: ActionType;
  label: string;
  status: ActionStatus;
  timestamp?: string;
  documentName?: string;
  downloadUrl?: string;
}

interface ContextFeedProps {
  actions: ContextAction[];
  onDownload?: (action: ContextAction) => void;
}

const actionIcons: Record<ActionType, string> = {
  search: 'search',
  read: 'document-text',
  generate: 'create',
  analyze: 'analytics',
  send: 'send',
  approve: 'checkmark-circle',
  thinking: 'ellipsis-horizontal',
};

const statusColors: Record<ActionStatus, string> = {
  in_progress: Colors.accent.cyan,
  complete: Colors.semantic.success,
  pending: Colors.text.muted,
  failed: Colors.semantic.error,
};

function ActionItem({ action, onDownload }: { action: ContextAction; onDownload?: (action: ContextAction) => void }) {
  const iconName = actionIcons[action.type] as any;
  const statusColor = statusColors[action.status];
  const isInProgress = action.status === 'in_progress';

  return (
    <View style={styles.actionItem}>
      <View style={[styles.iconContainer, { borderColor: statusColor }]}>
        <Ionicons 
          name={iconName} 
          size={14} 
          color={statusColor} 
        />
      </View>
      
      <View style={styles.actionContent}>
        <Text style={[styles.actionLabel, isInProgress && styles.actionLabelActive]}>
          {action.label}
          {isInProgress && <Text style={styles.ellipsis}>...</Text>}
        </Text>
        
        {action.documentName && action.status === 'complete' && (
          <Pressable 
            style={styles.downloadRow}
            onPress={() => onDownload?.(action)}
          >
            <Ionicons name="document" size={12} color={Colors.accent.cyan} />
            <Text style={styles.documentName}>{action.documentName}</Text>
            <View style={styles.downloadBadge}>
              <Ionicons name="download" size={10} color={Colors.text.primary} />
            </View>
          </Pressable>
        )}
      </View>

      {action.status === 'complete' && (
        <Ionicons name="checkmark" size={14} color={Colors.semantic.success} />
      )}
      {action.status === 'in_progress' && (
        <View style={styles.pulsingDot} />
      )}
    </View>
  );
}

export function ContextFeed({ actions, onDownload }: ContextFeedProps) {
  if (actions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyDot} />
        <Text style={styles.emptyText}>Waiting for Ava...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDot} />
        <Text style={styles.headerText}>Ava is working</Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {actions.map((action) => (
          <ActionItem 
            key={action.id} 
            action={action} 
            onDownload={onDownload}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  headerText: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
    maxHeight: 200,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
  },
  actionLabelActive: {
    color: Colors.text.primary,
  },
  ellipsis: {
    color: Colors.accent.cyan,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  documentName: {
    color: Colors.accent.cyan,
    fontSize: Typography.small.fontSize,
  },
  downloadBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  emptyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.muted,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: Typography.caption.fontSize,
  },
});

export default ContextFeed;
