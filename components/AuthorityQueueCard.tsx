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

const RISK_TIER_CONFIG = {
  green: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', label: 'GREEN', icon: 'shield-checkmark' as const },
  yellow: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'YELLOW', icon: 'warning' as const },
  red: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'RED', icon: 'alert-circle' as const },
};

const AGENT_AVATARS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  quinn: { icon: 'receipt', color: '#8b5cf6' },
  finn: { icon: 'card', color: '#ef4444' },
  eli: { icon: 'mail', color: '#3b82f6' },
  sarah: { icon: 'call', color: '#22c55e' },
  nora: { icon: 'videocam', color: '#06b6d4' },
  clara: { icon: 'document-text', color: '#f59e0b' },
  milo: { icon: 'people', color: '#ec4899' },
  teressa: { icon: 'calculator', color: '#14b8a6' },
  adam: { icon: 'search', color: '#6366f1' },
  tec: { icon: 'folder', color: '#84cc16' },
  ava: { icon: 'sparkles', color: '#3b82f6' },
};

function useExpiryCountdown(expiresAt?: string): string | null {
  const [label, setLabel] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!expiresAt) { setLabel(null); return; }
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setLabel('Expired'); return; }
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) setLabel(`${hrs}h ${mins % 60}m left`);
      else setLabel(`${mins}m left`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return label;
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
  const riskConfig = item.riskTier ? RISK_TIER_CONFIG[item.riskTier] : null;
  const agentConfig = item.assignedAgent ? AGENT_AVATARS[item.assignedAgent] || AGENT_AVATARS.ava : null;
  const expiryLabel = useExpiryCountdown(item.expiresAt);

  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <Badge
          label={item.status.toUpperCase()}
          variant={statusVariant}
          size="sm"
        />
        {riskConfig && (
          <View style={[styles.riskBadge, { backgroundColor: riskConfig.bg }]}>
            <Ionicons name={riskConfig.icon} size={10} color={riskConfig.color} />
            <Text style={[styles.riskBadgeText, { color: riskConfig.color }]}>{riskConfig.label}</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        {agentConfig && (
          <View style={[styles.agentBadge, { backgroundColor: `${agentConfig.color}20` }]}>
            <Ionicons name={agentConfig.icon} size={12} color={agentConfig.color} />
          </View>
        )}
        <Pressable style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text.muted} />
        </Pressable>
      </View>

      <Text style={styles.subtitle}>{item.subtitle}</Text>

      {item.draftSummary && (
        <View style={styles.draftSummaryRow}>
          <Ionicons name="document-text-outline" size={12} color={Colors.text.tertiary} />
          <Text style={styles.draftSummaryText} numberOfLines={2}>{item.draftSummary}</Text>
        </View>
      )}

      {expiryLabel && (
        <View style={styles.expiryRow}>
          <Ionicons name="time-outline" size={11} color={expiryLabel === 'Expired' ? Colors.semantic.error : Colors.text.muted} />
          <Text style={[styles.expiryText, expiryLabel === 'Expired' && { color: Colors.semantic.error }]}>{expiryLabel}</Text>
        </View>
      )}

      {isSession && item.thumbnailUrl && (
        <View>
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

          {item.documentPreview && (
            <View style={styles.sessionExpandedInfo}>
              <View style={styles.sessionAgendaSection}>
                <Text style={styles.sessionAgendaLabel}>Agenda</Text>
                <Text style={styles.sessionAgendaContent} numberOfLines={6}>
                  {item.documentPreview.content.split('\n').filter((l: string) => l.startsWith('•')).join('\n')}
                </Text>
              </View>
              <View style={styles.sessionFooterRow}>
                {item.documentPreview.metadata?.duration && (
                  <View style={styles.sessionMetaChip}>
                    <Ionicons name="time-outline" size={12} color={Colors.accent.cyan} />
                    <Text style={styles.sessionMetaText}>{item.documentPreview.metadata.duration}</Text>
                  </View>
                )}
                {item.staffRole && (
                  <View style={styles.sessionMetaChip}>
                    <Ionicons name="person-circle" size={12} color={Colors.text.muted} />
                    <Text style={styles.sessionMetaText}>Managed by {item.staffRole}</Text>
                  </View>
                )}
              </View>
            </View>
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
              pandadocDocumentId={item.pandadocDocumentId}
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
            pandadocDocumentId={item.pandadocDocumentId}
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
    marginBottom: 0,
    height: '100%',
  } as any,
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
  sessionExpandedInfo: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.background.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  sessionAgendaSection: {
    marginBottom: Spacing.sm,
  },
  sessionAgendaLabel: {
    color: Colors.text.muted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sessionAgendaContent: {
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
    lineHeight: 18,
  },
  sessionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  sessionMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionMetaText: {
    color: Colors.text.muted,
    fontSize: Typography.small.fontSize,
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
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  agentBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: Spacing.xs,
    paddingLeft: 2,
  },
  draftSummaryText: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.small.fontSize,
    lineHeight: 16,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
    paddingLeft: 2,
  },
  expiryText: {
    color: Colors.text.muted,
    fontSize: Typography.micro.fontSize,
  },
});
