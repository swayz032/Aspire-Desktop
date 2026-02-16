import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Modal, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';

type Proposal = {
  id: string;
  title: string;
  type: 'payroll' | 'collection' | 'transfer' | 'payment' | 'reserve';
  impact: {
    amount: number;
    description: string;
  };
  evidence: string[];
  sources: string[];
  risk: 'LOW' | 'MED' | 'HIGH';
  approvalLevel: string;
};

type Props = {
  visible: boolean;
  proposal: Proposal | null;
  onClose: () => void;
  onSendToQueue: (proposal: Proposal) => void;
};

const TYPE_COLORS: Record<string, string> = {
  payroll: '#3B82F6',
  collection: '#34c759',
  transfer: '#f59e0b',
  payment: '#0891B2',
  reserve: '#8b5cf6',
};

const RISK_STYLES: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'rgba(52,199,89,0.15)', text: '#34c759' },
  MED: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  HIGH: { bg: 'rgba(255,59,48,0.15)', text: '#ff3b30' },
};

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs >= 1000
    ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '$' + abs.toFixed(2);
  return amount >= 0 ? '+' + formatted : '-' + formatted;
}

function getAmountColor(amount: number): string {
  if (amount > 0) return '#34c759';
  if (amount < 0) return '#ff3b30';
  return '#f59e0b';
}

export type { Proposal };

export function ProposalReviewSheet({ visible, proposal, onClose, onSendToQueue }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  if (!visible || !proposal) return null;

  const riskStyle = RISK_STYLES[proposal.risk];
  const typeColor = TYPE_COLORS[proposal.type] || Colors.accent.cyan;

  const handleSend = () => {
    onSendToQueue(proposal);
    onClose();
  };

  const panelContent = (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Proposal Review</Text>
          <Pressable
            onPress={onClose}
            style={({ hovered }: any) => [
              styles.closeButton,
              hovered && styles.closeButtonHover,
            ]}
          >
            <Ionicons name="close-outline" size={24} color={Colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Text style={styles.proposalTitle}>{proposal.title}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeColor + '22' }]}>
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {proposal.type.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.impactCard}>
            <Text style={styles.sectionLabel}>IMPACT</Text>
            <Text style={[styles.impactAmount, { color: getAmountColor(proposal.impact.amount) }]}>
              {formatAmount(proposal.impact.amount)}
            </Text>
            <Text style={styles.impactDescription}>{proposal.impact.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EVIDENCE</Text>
            <View style={styles.chipRow}>
              {proposal.evidence.map((item, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SOURCES</Text>
            <View style={styles.chipRow}>
              {proposal.sources.map((item, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RISK LEVEL</Text>
            <View style={[styles.riskBadge, { backgroundColor: riskStyle.bg }]}>
              <Text style={[styles.riskBadgeText, { color: riskStyle.text }]}>
                {proposal.risk}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REQUIRED APPROVAL</Text>
            <View style={styles.approvalRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.text.secondary} />
              <Text style={styles.approvalText}>{proposal.approvalLevel}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={handleSend}
            style={({ hovered }: any) => [
              styles.sendButton,
              hovered && styles.sendButtonHover,
            ]}
          >
            <Text style={styles.sendButtonText}>Send to Authority Queue</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ hovered }: any) => [
              styles.cancelButton,
              hovered && styles.cancelButtonHover,
            ]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );

  if (Platform.OS === 'web') {
    return panelContent;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {panelContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
      },
      default: {
        flex: 1,
      },
    }),
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...Platform.select({
      web: {
        position: 'absolute' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      default: {
        flex: 1,
      },
    }),
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  panel: {
    width: 480,
    backgroundColor: Colors.surface.card,
    borderLeftWidth: 1,
    borderColor: Colors.border.default,
    flexDirection: 'column' as const,
    ...Platform.select({
      web: {
        position: 'absolute' as any,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: 0,
      },
      default: {
        borderRadius: 16,
        borderWidth: 1,
        maxHeight: '90%',
        alignSelf: 'center',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  closeButtonHover: {
    backgroundColor: Colors.surface.cardHover,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  proposalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  impactCard: {
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  impactAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  impactDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  section: {
    gap: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.surface.cardHover,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  riskBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  riskBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  approvalText: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  actions: {
    padding: Spacing.xl,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  sendButton: {
    backgroundColor: Colors.accent.cyan,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  sendButtonHover: {
    backgroundColor: Colors.accent.cyanDark,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  cancelButton: {
    padding: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  cancelButtonHover: {
    backgroundColor: Colors.surface.cardHover,
  },
  cancelButtonText: {
    fontSize: 15,
    color: Colors.text.tertiary,
  },
});
