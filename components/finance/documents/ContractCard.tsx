/**
 * ContractCard -- Card component for the document library grid.
 * Displays contract title, counterparty, status badge, lane, and date.
 * Hover lift effect on web, press navigation to detail page.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { ContractStatusBadge } from './ContractStatusBadge';
import { LANE_META, type ContractStatus, type TemplateLane } from './contractConstants';

export interface ContractCardData {
  id: string;
  title: string;
  counterparty?: string;
  status: ContractStatus;
  lane?: TemplateLane;
  template_key?: string;
  created_at: string;
  updated_at?: string;
}

interface ContractCardProps {
  contract: ContractCardData;
  index?: number;
}

function ContractCardInner({ contract, index = 0 }: ContractCardProps) {
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push(`/finance-hub/documents/${contract.id}` as any);
  }, [router, contract.id]);

  const laneMeta = contract.lane ? LANE_META[contract.lane] : undefined;
  const dateStr = formatRelativeDate(contract.updated_at || contract.created_at);

  const webAnimationStyle = Platform.OS === 'web' ? {
    animationName: 'fadeInUp',
    animationDuration: '0.35s',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    animationDelay: `${index * 50}ms`,
    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer',
  } as any : {};

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Contract: ${contract.title}, Status: ${contract.status}`}
      style={({ hovered, pressed }: any) => [
        styles.card,
        webAnimationStyle,
        hovered && styles.cardHovered,
        pressed && styles.cardPressed,
        hovered && Platform.OS === 'web' ? {
          transform: [{ translateY: -2 }],
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          borderColor: 'rgba(255,255,255,0.10)',
        } as any : {},
      ]}
    >
      {/* Top row: icon + lane */}
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="document-text-outline"
            size={18}
            color={laneMeta?.color ?? Colors.text.muted}
          />
        </View>
        {laneMeta && (
          <View style={[styles.lanePill, { backgroundColor: laneMeta.color + '18' }]}>
            <Ionicons name={laneMeta.icon as any} size={12} color={laneMeta.color} />
            <Text style={[styles.laneLabel, { color: laneMeta.color }]}>
              {laneMeta.label}
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {contract.title}
      </Text>

      {/* Counterparty */}
      {contract.counterparty ? (
        <Text style={styles.counterparty} numberOfLines={1}>
          {contract.counterparty}
        </Text>
      ) : (
        <Text style={styles.counterpartyEmpty}>No counterparty</Text>
      )}

      {/* Bottom row: status + date */}
      <View style={styles.bottomRow}>
        <ContractStatusBadge status={contract.status} />
        <Text style={styles.date}>{dateStr}</Text>
      </View>
    </Pressable>
  );
}

export const ContractCard = React.memo(ContractCardInner);

function formatRelativeDate(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (_e) {
    return '';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    padding: 18,
    minHeight: 170,
    justifyContent: 'space-between',
  },
  cardHovered: {
    backgroundColor: '#222224',
  },
  cardPressed: {
    backgroundColor: '#1a1a1c',
    opacity: 0.95,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lanePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  laneLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 4,
  },
  counterparty: {
    fontSize: 13,
    color: Colors.text.tertiary,
    marginBottom: 14,
  },
  counterpartyEmpty: {
    fontSize: 13,
    color: Colors.text.disabled,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
});
