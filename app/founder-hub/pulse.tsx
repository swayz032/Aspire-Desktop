import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { pulseItems } from '@/data/founderHub/palletMock';
import { getHubImage } from '@/data/founderHub/imageHelper';

const THEME = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceHover: '#111111',
  border: 'rgba(255,255,255,0.06)',
  accent: '#3B82F6',
  accentMuted: 'rgba(59, 130, 246, 0.12)',
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.70)',
    muted: 'rgba(255,255,255,0.45)',
  },
};

const trendingTopics = [
  { id: '1', label: 'Lumber prices', count: 12 },
  { id: '2', label: 'Supply chain', count: 8 },
  { id: '3', label: 'Grade B pallets', count: 6 },
  { id: '4', label: 'EPA regulations', count: 5 },
  { id: '5', label: 'Fuel costs', count: 4 },
];

const quickFilters = [
  { id: 'all', label: 'All', icon: 'apps-outline' as const },
  { id: 'sales', label: 'Sales', icon: 'trending-up-outline' as const },
  { id: 'operations', label: 'Operations', icon: 'construct-outline' as const },
  { id: 'procurement', label: 'Procurement', icon: 'cube-outline' as const },
  { id: 'safety', label: 'Safety', icon: 'shield-checkmark-outline' as const },
  { id: 'market', label: 'Market', icon: 'analytics-outline' as const },
];

export default function PulseScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Sales': '#3B82F6',
      'Operations': '#a78bfa',
      'Procurement': '#34d399',
      'Safety': '#fbbf24',
      'Market': '#f472b6',
      'Pricing': '#60a5fa',
    };
    return colors[category] || THEME.accent;
  };

  const rightRail = (
    <View style={styles.railContent}>
      <View style={styles.askAvaCard}>
        <LinearGradient
          colors={['#0c2d4d', '#0a1f35', '#061525']}
          style={styles.askAvaGradient}
        >
          <Ionicons name="sparkles" size={24} color={THEME.accent} />
          <Text style={styles.askAvaTitle}>Ask Ava</Text>
          <Text style={styles.askAvaDesc}>Deep-dive into any topic with AI-powered analysis</Text>
          <Pressable
            style={[styles.askAvaBtn, hoveredItem === 'ask' && styles.askAvaBtnHover]}
            onHoverIn={() => setHoveredItem('ask')}
            onHoverOut={() => setHoveredItem(null)}
          >
            <Text style={styles.askAvaBtnText}>Start conversation</Text>
          </Pressable>
        </LinearGradient>
      </View>

      <Text style={styles.railTitle}>Trending Topics</Text>
      <View style={styles.topicsList}>
        {trendingTopics.map((topic) => (
          <Pressable
            key={topic.id}
            style={[
              styles.topicItem,
              hoveredItem === `topic-${topic.id}` && styles.topicItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`topic-${topic.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <Text style={styles.topicLabel}>{topic.label}</Text>
            <View style={styles.topicCount}>
              <Text style={styles.topicCountText}>{topic.count}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Your Alerts</Text>
      <View style={styles.alertCard}>
        <View style={styles.alertIcon}>
          <Ionicons name="notifications" size={16} color={THEME.accent} />
        </View>
        <View style={styles.alertContent}>
          <Text style={styles.alertTitle}>Price drop alert</Text>
          <Text style={styles.alertDesc}>Grade B pallets below $12</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={THEME.text.muted} />
      </View>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.pageTitle}>Industry Pulse</Text>
            <Text style={styles.pageSubtitle}>Real-time intelligence for your market</Text>
          </View>
          <Pressable
            style={[styles.refreshBtn, hoveredItem === 'refresh' && styles.refreshBtnHover]}
            onHoverIn={() => setHoveredItem('refresh')}
            onHoverOut={() => setHoveredItem(null)}
          >
            <Ionicons name="refresh-outline" size={18} color={THEME.accent} />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {quickFilters.map((filter) => (
            <Pressable
              key={filter.id}
              style={[
                styles.filterBtn,
                activeFilter === filter.id && styles.filterBtnActive,
              ]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Ionicons
                name={filter.icon}
                size={14}
                color={activeFilter === filter.id ? '#000' : THEME.text.muted}
              />
              <Text style={[
                styles.filterBtnText,
                activeFilter === filter.id && styles.filterBtnTextActive,
              ]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.pulseGrid}>
        {pulseItems.map((item, idx) => (
          <Pressable
            key={item.id}
            style={[
              styles.pulseCard,
              hoveredItem === `pulse-${item.id}` && styles.pulseCardHover,
            ]}
            onHoverIn={() => setHoveredItem(`pulse-${item.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <ImageBackground
              source={getHubImage(item.imageKey)}
              style={styles.pulseImage}
              imageStyle={styles.pulseImageStyle}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.pulseOverlay}
              >
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                  <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
                    {item.category}
                  </Text>
                </View>
              </LinearGradient>
            </ImageBackground>
            <View style={styles.pulseContent}>
              <Text style={styles.pulseTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.pulseDesc} numberOfLines={2}>{item.summary}</Text>
              <View style={styles.pulseFooter}>
                <Text style={styles.pulseTime}>2h ago</Text>
                <Pressable style={styles.pulseAction}>
                  <Ionicons name="chatbubble-outline" size={14} color={THEME.accent} />
                  <Text style={styles.pulseActionText}>Ask Ava</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.loadMore}>
        <Pressable
          style={[styles.loadMoreBtn, hoveredItem === 'load' && styles.loadMoreBtnHover]}
          onHoverIn={() => setHoveredItem('load')}
          onHoverOut={() => setHoveredItem(null)}
        >
          <Text style={styles.loadMoreText}>Load more insights</Text>
          <Ionicons name="chevron-down" size={16} color={THEME.accent} />
        </Pressable>
      </View>
    </HubPageShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.text.primary,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: THEME.text.muted,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  refreshBtnHover: {
    backgroundColor: THEME.accentMuted,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  refreshBtnText: {
    fontSize: 13,
    color: THEME.accent,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  filterBtnActive: {
    backgroundColor: THEME.accent,
    borderColor: THEME.accent,
  },
  filterBtnText: {
    fontSize: 13,
    color: THEME.text.muted,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pulseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  pulseCard: {
    width: 'calc(50% - 10px)' as any,
    minWidth: 280,
    backgroundColor: THEME.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  pulseCardHover: {
    borderColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 1.01 }],
  },
  pulseImage: {
    height: 140,
  },
  pulseImageStyle: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  pulseOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pulseContent: {
    padding: 16,
    gap: 8,
  },
  pulseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text.primary,
    lineHeight: 20,
  },
  pulseDesc: {
    fontSize: 13,
    color: THEME.text.muted,
    lineHeight: 18,
  },
  pulseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  pulseTime: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  pulseAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pulseActionText: {
    fontSize: 12,
    color: THEME.accent,
    fontWeight: '500',
  },
  loadMore: {
    alignItems: 'center',
    marginTop: 32,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  loadMoreBtnHover: {
    backgroundColor: THEME.accentMuted,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  loadMoreText: {
    fontSize: 14,
    color: THEME.accent,
    fontWeight: '500',
  },
  railContent: {
    gap: 24,
  },
  askAvaCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  askAvaGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  askAvaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text.primary,
  },
  askAvaDesc: {
    fontSize: 13,
    color: THEME.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  askAvaBtn: {
    backgroundColor: THEME.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  askAvaBtnHover: {
    opacity: 0.9,
  },
  askAvaBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topicsList: {
    gap: 6,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: THEME.surface,
  },
  topicItemHover: {
    backgroundColor: THEME.surfaceHover,
  },
  topicLabel: {
    fontSize: 13,
    color: THEME.text.secondary,
  },
  topicCount: {
    backgroundColor: THEME.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  topicCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.accent,
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: THEME.surface,
    borderRadius: 10,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  alertDesc: {
    fontSize: 12,
    color: THEME.text.muted,
  },
});
