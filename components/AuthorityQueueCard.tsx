import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { DocumentThumbnail } from './DocumentThumbnail';
import { AuthorityItem } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';

interface AuthorityQueueCardProps {
  item: AuthorityItem;
  onAction?: (action: string) => void;
}

export function AuthorityQueueCard({ item, onAction }: AuthorityQueueCardProps) {
  const statusVariant = {
    live: 'live',
    pending: 'pending',
    blocked: 'warning',
    failed: 'error',
    logged: 'muted',
  }[item.status] as 'live' | 'pending' | 'warning' | 'error' | 'muted';

  const isSession = item.type === 'session';

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <Badge 
          label={item.status.toUpperCase()} 
          variant={statusVariant}
          size="sm"
        />
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Pressable style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text.muted} />
        </Pressable>
      </View>
      
      <Text style={styles.subtitle}>{item.subtitle}</Text>

      {isSession && item.thumbnailUrl && (
        <View style={styles.previewContainer}>
          <Image 
            source={{ uri: item.thumbnailUrl }}
            style={styles.preview}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.previewOverlay}
          />
          {item.documentPreview && (
            <View style={styles.meetingDetails}>
              <Text style={styles.meetingAgenda} numberOfLines={3}>
                {item.documentPreview.content.split('\n').slice(0, 3).join('\n')}
              </Text>
              {item.documentPreview.metadata?.participants && (
                <Text style={styles.participants}>
                  {item.documentPreview.metadata.participants.join(' • ')}
                </Text>
              )}
            </View>
          )}
          {item.actions.includes('join') && (
            <Pressable 
              style={styles.joinButton}
              onPress={() => onAction?.('join')}
            >
              <Text style={styles.joinButtonText}>Join</Text>
            </Pressable>
          )}
        </View>
      )}

      {!isSession && item.documentPreview && (
        <View style={styles.documentPreviewContainer}>
          <View style={styles.docHeader}>
            <DocumentThumbnail 
              type={item.type === 'invoice' ? 'invoice' : item.type === 'contract' ? 'contract' : 'document'}
              size="xl"
              variant={0}
              context="authorityqueue"
            />
            <View style={styles.docMeta}>
              {item.documentPreview.metadata?.amount && (
                <Text style={styles.docAmount}>{item.documentPreview.metadata.amount}</Text>
              )}
              {item.documentPreview.metadata?.dueDate && (
                <Text style={styles.docDueDate}>Due: {item.documentPreview.metadata.dueDate}</Text>
              )}
              {item.documentPreview.metadata?.counterparty && (
                <Text style={styles.docCounterparty}>{item.documentPreview.metadata.counterparty}</Text>
              )}
            </View>
            <Badge label={item.status} variant={statusVariant} size="md" />
          </View>
          
          <View style={styles.docContentPreview}>
            <Text style={styles.docContent} numberOfLines={6}>
              {item.documentPreview.content}
            </Text>
          </View>
          
          {item.staffRole && (
            <View style={styles.staffInfo}>
              <Ionicons name="person-circle" size={16} color={Colors.text.muted} />
              <Text style={styles.staffText}>Prepared by {item.staffRole}</Text>
            </View>
          )}
        </View>
      )}

      {!isSession && !item.documentPreview && (
        <View style={styles.documentRow}>
          <DocumentThumbnail 
            type={item.type === 'invoice' ? 'invoice' : item.type === 'contract' ? 'contract' : 'document'}
            size="xl"
            variant={0}
            context="authorityqueue"
          />
          
          <View style={styles.docInfo}>
            {item.dueDate && (
              <Text style={styles.dueText}>Due: {item.dueDate}</Text>
            )}
            {item.staffRole && (
              <Text style={styles.staffText}>Staff: {item.staffRole}</Text>
            )}
          </View>

          <View style={styles.statusCol}>
            <Badge label={item.status} variant={statusVariant} size="md" />
          </View>
        </View>
      )}

      {item.actions.length > 0 && !isSession && (
        <View style={styles.actionsRow}>
          {item.actions.slice(0, 3).map((action) => (
            <Button
              key={action}
              label={action.charAt(0).toUpperCase() + action.slice(1)}
              variant={action === 'approve' ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => onAction?.(action)}
              style={styles.actionButton}
            />
          ))}
          {item.actions.length > 3 && (
            <Pressable style={styles.moreActionsButton}>
              <Ionicons name="ellipsis-horizontal" size={16} color={Colors.text.muted} />
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: Typography.bodyMedium.fontWeight,
  },
  moreButton: {
    padding: Spacing.xs,
  },
  subtitle: {
    color: Colors.text.tertiary,
    fontSize: Typography.small.fontSize,
    marginBottom: Spacing.md,
  },
  previewContainer: {
    height: 140,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  meetingDetails: {
    position: 'absolute',
    left: Spacing.md,
    bottom: Spacing.md,
    right: Spacing.md + 60,
  },
  meetingAgenda: {
    color: Colors.text.primary,
    fontSize: Typography.small.fontSize,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  participants: {
    color: Colors.text.tertiary,
    fontSize: Typography.micro.fontSize,
  },
  joinButton: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.accent.cyan,
  },
  joinButtonText: {
    color: Colors.text.primary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  documentPreviewContainer: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  docThumbnail: {
    width: 48,
    height: 56,
    backgroundColor: Colors.text.primary,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadge: {
    backgroundColor: Colors.semantic.error,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 2,
  },
  pdfText: {
    color: Colors.text.primary,
    fontSize: 8,
    fontWeight: 'bold',
  },
  docMeta: {
    flex: 1,
  },
  docAmount: {
    color: '#FFFFFF',
    fontSize: Typography.headline.fontSize,
    fontWeight: Typography.headline.fontWeight,
  },
  docDueDate: {
    color: '#FFFFFF',
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  docCounterparty: {
    color: '#FFFFFF',
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  docContentPreview: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  docContent: {
    color: '#FFFFFF',
    fontSize: Typography.small.fontSize,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  staffInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  dueText: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
  },
  staffText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
  },
  statusCol: {
    alignItems: 'flex-end',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  actionButton: {
    flex: 1,
  },
  moreActionsButton: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
