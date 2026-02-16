import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { ExplainItem, EventProvider } from './types';

const PROVIDER_COLORS: Record<EventProvider, string> = {
  plaid: '#10B981',
  stripe: '#635BFF',
  quickbooks: '#2CA01C',
  gusto: '#F45D48',
  manual: '#8e8e93',
  system: '#6e6e73',
};

function fmt(n: number): string {
  const abs = Math.abs(n);
  const str = abs >= 1000 ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '$' + abs.toFixed(2);
  return n < 0 ? '-' + str : str;
}

interface StoryExplainDrawerProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  total?: number;
  items: ExplainItem[];
  onClose: () => void;
  sourceLabel?: string;
}

export function StoryExplainDrawer({ visible, title, subtitle, total, items, onClose, sourceLabel }: StoryExplainDrawerProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const maxPct = Math.max(...items.map(i => Math.abs(i.percentage)), 1);

  return (
    <Animated.View style={[
      styles.overlay,
      { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
    ]}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[
        styles.drawer,
        { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
      ]}>
        <View style={styles.handle} />
        <View style={styles.drawerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.drawerTitle}>{title}</Text>
            {subtitle && <Text style={styles.drawerSubtitle}>{subtitle}</Text>}
          </View>
          {total !== undefined && (
            <Text style={styles.drawerTotal}>{fmt(total)}</Text>
          )}
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#d1d1d6" />
          </Pressable>
        </View>

        {sourceLabel && (
          <View style={styles.sourceRow}>
            <Ionicons name="link-outline" size={14} color="#3B82F6" />
            <Text style={styles.sourceText}>{sourceLabel}</Text>
          </View>
        )}

        <ScrollView style={styles.itemsScroll} showsVerticalScrollIndicator={false}>
          {items.map((item, idx) => {
            const barWidth = Math.max((Math.abs(item.percentage) / maxPct) * 100, 4);
            const color = item.provider ? (PROVIDER_COLORS[item.provider] || '#3B82F6') : '#3B82F6';
            return (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: color + '40' }]}>
                      <View style={[styles.barInner, { backgroundColor: color }]} />
                    </View>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemAmount}>{fmt(item.amount)}</Text>
                  <Text style={[styles.itemPct, { color }]}>{item.percentage.toFixed(1)}%</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999, justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: CARD_BORDER, borderBottomWidth: 0,
    maxHeight: '70%', paddingBottom: 24,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 10, marginBottom: 12,
  },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: CARD_BORDER,
  },
  drawerTitle: { color: '#f2f2f2', fontSize: 16, fontWeight: '700' },
  drawerSubtitle: { color: '#8e8e93', fontSize: 12, marginTop: 2 },
  drawerTotal: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  sourceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: CARD_BORDER,
  },
  sourceText: { color: '#3B82F6', fontSize: 12, fontWeight: '500' },
  itemsScroll: { paddingHorizontal: 20, paddingTop: 12 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  itemLeft: { flex: 1, gap: 6 },
  itemLabel: { color: '#d1d1d6', fontSize: 13, fontWeight: '500' },
  barTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  barFill: { height: 6, borderRadius: 3, minWidth: 4 },
  barInner: { width: 4, height: 6, borderRadius: 3 },
  itemRight: { alignItems: 'flex-end', gap: 2 },
  itemAmount: { color: '#f2f2f2', fontSize: 13, fontWeight: '600' },
  itemPct: { fontSize: 11, fontWeight: '700' },
});
