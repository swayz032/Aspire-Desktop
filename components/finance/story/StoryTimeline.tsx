import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { TimelineGroup, FinanceEvent, EventProvider } from './types';

const PROVIDER_CONFIG: Record<EventProvider, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  plaid: { icon: 'business-outline', color: '#10B981', label: 'Plaid' },
  stripe: { icon: 'card-outline', color: '#635BFF', label: 'Stripe' },
  quickbooks: { icon: 'book-outline', color: '#2CA01C', label: 'QuickBooks' },
  gusto: { icon: 'people-outline', color: '#F45D48', label: 'Gusto' },
  manual: { icon: 'pencil-outline', color: '#8e8e93', label: 'Manual' },
  system: { icon: 'settings-outline', color: '#6e6e73', label: 'System' },
};

function fmt(n: number): string {
  const abs = Math.abs(n);
  const str = abs >= 1000 ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '$' + abs.toFixed(2);
  return n < 0 ? '-' + str : str;
}

function EventRow({ event, onExplain }: { event: FinanceEvent; onExplain?: (event: FinanceEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  const prov = PROVIDER_CONFIG[event.provider] || PROVIDER_CONFIG.system;
  const isInflow = event.direction === 'inflow';

  return (
    <Pressable
      style={[styles.eventRow, hovered && styles.eventRowHover, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
      onPress={() => onExplain?.(event)}
      {...(Platform.OS === 'web' ? {
        onHoverIn: () => setHovered(true),
        onHoverOut: () => setHovered(false),
      } : {})}
    >
      <View style={[styles.eventIcon, { backgroundColor: prov.color + '15' }]}>
        <Ionicons name={prov.icon} size={14} color={prov.color} />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventDesc} numberOfLines={1}>{event.description || event.type}</Text>
        <View style={styles.eventMeta}>
          <Text style={styles.eventCounterparty}>{event.counterparty}</Text>
          {event.category && (
            <>
              <Text style={styles.eventDot}>·</Text>
              <Text style={styles.eventCategory}>{event.category}</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.eventRight}>
        <Text style={[styles.eventAmount, { color: isInflow ? '#10B981' : '#d1d1d6' }]}>
          {isInflow ? '+' : '-'}{fmt(event.amount)}
        </Text>
        <Text style={styles.eventTime}>
          {new Date(event.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </Pressable>
  );
}

interface StoryTimelineProps {
  groups: TimelineGroup[];
  onExplain?: (event: FinanceEvent) => void;
  emptyMessage?: string;
}

export function StoryTimeline({ groups, onExplain, emptyMessage }: StoryTimelineProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(groups.slice(0, 2).map(g => g.label)));

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (!groups.length) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={32} color="#6e6e73" />
        <Text style={styles.emptyText}>{emptyMessage || 'No activity to display'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.label);
        return (
          <View key={group.label} style={styles.groupContainer}>
            <Pressable
              style={[styles.groupHeader, Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}]}
              onPress={() => toggleGroup(group.label)}
            >
              <View style={styles.groupLeft}>
                <View style={styles.timelineDot} />
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.eventCount}>
                  <Text style={styles.eventCountText}>{group.events.length}</Text>
                </View>
              </View>
              <View style={styles.groupRight}>
                {group.totalInflow > 0 && (
                  <Text style={styles.groupInflow}>+{fmt(group.totalInflow)}</Text>
                )}
                {group.totalOutflow > 0 && (
                  <Text style={styles.groupOutflow}>-{fmt(group.totalOutflow)}</Text>
                )}
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#6e6e73" />
              </View>
            </Pressable>

            {isExpanded && (
              <View style={styles.groupEvents}>
                <View style={styles.timelineLine} />
                {group.events.map(event => (
                  <EventRow key={event.id} event={event} onExplain={onExplain} />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: '#6e6e73', fontSize: 14 },
  groupContainer: { marginBottom: 4 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: CARD_BG, borderRadius: 12,
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  groupLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
  groupLabel: { color: '#f2f2f2', fontSize: 14, fontWeight: '600' },
  eventCount: { backgroundColor: 'rgba(59, 130, 246, 0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  eventCountText: { color: '#3B82F6', fontSize: 11, fontWeight: '700' },
  groupInflow: { color: '#10B981', fontSize: 13, fontWeight: '600' },
  groupOutflow: { color: '#8e8e93', fontSize: 13, fontWeight: '500' },
  groupEvents: { paddingLeft: 20, marginTop: 2, position: 'relative' },
  timelineLine: {
    position: 'absolute', left: 3, top: 0, bottom: 0,
    width: 2, backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: 1,
  },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(28, 28, 30, 0.6)', borderRadius: 10,
    marginBottom: 4, marginLeft: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  eventRowHover: { borderColor: CARD_BORDER, backgroundColor: CARD_BG },
  eventIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1, gap: 2 },
  eventDesc: { color: '#f2f2f2', fontSize: 13, fontWeight: '500' },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventCounterparty: { color: '#8e8e93', fontSize: 11 },
  eventDot: { color: '#6e6e73', fontSize: 10 },
  eventCategory: { color: '#6e6e73', fontSize: 11 },
  eventRight: { alignItems: 'flex-end', gap: 2 },
  eventAmount: { fontSize: 14, fontWeight: '700' },
  eventTime: { color: '#6e6e73', fontSize: 11 },
});
