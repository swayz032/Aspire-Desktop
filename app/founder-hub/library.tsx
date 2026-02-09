import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
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

const categories = [
  { id: 'all', label: 'All', count: 24 },
  { id: 'sales', label: 'Sales', count: 8 },
  { id: 'operations', label: 'Operations', count: 6 },
  { id: 'pricing', label: 'Pricing', count: 5 },
  { id: 'market', label: 'Market', count: 3 },
  { id: 'strategy', label: 'Strategy', count: 2 },
];

const libraryItems = [
  {
    id: '1',
    type: 'article',
    title: 'How to price repair-grade pallets for maximum margin',
    source: 'Ava Summary',
    date: '2 days ago',
    category: 'Pricing',
    saved: true,
    imageKey: 'pallet-stacks',
  },
  {
    id: '2',
    type: 'insight',
    title: 'Your Grade B margins outperform industry average by 23%',
    source: 'AI Analysis',
    date: '3 days ago',
    category: 'Operations',
    saved: true,
    imageKey: 'warehouse-dock',
  },
  {
    id: '3',
    type: 'article',
    title: 'EPA treated lumber regulations: What pallet shops need to know',
    source: 'Industry Brief',
    date: '1 week ago',
    category: 'Market',
    saved: false,
    imageKey: 'lumber-yard',
  },
  {
    id: '4',
    type: 'template',
    title: 'Cold outreach email template for warehouse prospects',
    source: 'Template Library',
    date: '1 week ago',
    category: 'Sales',
    saved: true,
    imageKey: 'truck-loading',
  },
  {
    id: '5',
    type: 'insight',
    title: 'Fuel cost trends suggest Q2 logistics price increase',
    source: 'Market Watch',
    date: '2 weeks ago',
    category: 'Market',
    saved: false,
    imageKey: 'delivery-truck',
  },
];

const recentSearches = ['lumber pricing', 'Grade B margins', 'EPA regulations', 'cold email'];

export default function LibraryScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article': return 'document-text-outline';
      case 'insight': return 'bulb-outline';
      case 'template': return 'copy-outline';
      default: return 'document-outline';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Sales': '#3B82F6',
      'Operations': '#a78bfa',
      'Pricing': '#60a5fa',
      'Market': '#f472b6',
      'Strategy': '#34d399',
    };
    return colors[category] || THEME.accent;
  };

  const rightRail = (
    <View style={styles.railContent}>
      <Text style={styles.railTitle}>Categories</Text>
      <View style={styles.categoryList}>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryItem,
              activeCategory === cat.id && styles.categoryItemActive,
            ]}
            onPress={() => setActiveCategory(cat.id)}
          >
            <Text style={[
              styles.categoryLabel,
              activeCategory === cat.id && styles.categoryLabelActive,
            ]}>
              {cat.label}
            </Text>
            <Text style={styles.categoryCount}>{cat.count}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Recent Searches</Text>
      <View style={styles.searchesList}>
        {recentSearches.map((search, idx) => (
          <Pressable
            key={idx}
            style={[
              styles.searchItem,
              hoveredItem === `search-${idx}` && styles.searchItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`search-${idx}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <Ionicons name="time-outline" size={14} color={THEME.text.muted} />
            <Text style={styles.searchText}>{search}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.railDivider} />

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Library</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Saved items</Text>
          <Text style={styles.statValue}>24</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>AI summaries</Text>
          <Text style={styles.statValue}>18</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Templates used</Text>
          <Text style={styles.statValue}>6</Text>
        </View>
      </View>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Knowledge Library</Text>
          <Text style={styles.pageSubtitle}>Your curated vault of insights and resources</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={THEME.text.muted} />
        <Text style={styles.searchPlaceholder}>Search your library...</Text>
        <View style={styles.searchShortcut}>
          <Text style={styles.shortcutText}>⌘K</Text>
        </View>
      </View>

      <View style={styles.filterTabs}>
        <Pressable style={[styles.filterTab, styles.filterTabActive]}>
          <Text style={[styles.filterTabText, styles.filterTabTextActive]}>All</Text>
        </Pressable>
        <Pressable style={styles.filterTab}>
          <Ionicons name="bookmark" size={14} color={THEME.text.muted} />
          <Text style={styles.filterTabText}>Saved</Text>
        </Pressable>
        <Pressable style={styles.filterTab}>
          <Ionicons name="sparkles" size={14} color={THEME.text.muted} />
          <Text style={styles.filterTabText}>AI Summaries</Text>
        </Pressable>
        <Pressable style={styles.filterTab}>
          <Ionicons name="documents" size={14} color={THEME.text.muted} />
          <Text style={styles.filterTabText}>Templates</Text>
        </Pressable>
      </View>

      <View style={styles.itemsList}>
        {libraryItems.map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.libraryItem,
              hoveredItem === `item-${item.id}` && styles.libraryItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`item-${item.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.itemImage}>
              <Image
                source={getHubImage(item.imageKey)}
                style={styles.itemThumb}
              />
            </View>
            <View style={styles.itemContent}>
              <View style={styles.itemMeta}>
                <View style={styles.itemType}>
                  <Ionicons name={getTypeIcon(item.type) as any} size={12} color={THEME.text.muted} />
                  <Text style={styles.itemTypeText}>{item.type}</Text>
                </View>
                <View style={[styles.itemCategory, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
                  <Text style={[styles.itemCategoryText, { color: getCategoryColor(item.category) }]}>
                    {item.category}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <View style={styles.itemFooter}>
                <Text style={styles.itemSource}>{item.source}</Text>
                <Text style={styles.itemDot}>•</Text>
                <Text style={styles.itemDate}>{item.date}</Text>
              </View>
            </View>
            <View style={styles.itemActions}>
              <Pressable style={styles.actionBtn}>
                <Ionicons
                  name={item.saved ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={item.saved ? THEME.accent : THEME.text.muted}
                />
              </Pressable>
              <Pressable style={styles.actionBtn}>
                <Ionicons name="share-outline" size={18} color={THEME.text.muted} />
              </Pressable>
            </View>
          </Pressable>
        ))}
      </View>
    </HubPageShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 20,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: THEME.text.muted,
  },
  searchShortcut: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  shortcutText: {
    fontSize: 11,
    color: THEME.text.muted,
    fontWeight: '500',
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  filterTabActive: {
    backgroundColor: THEME.accent,
    borderColor: THEME.accent,
  },
  filterTabText: {
    fontSize: 13,
    color: THEME.text.muted,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  itemsList: {
    gap: 12,
  },
  libraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  libraryItemHover: {
    backgroundColor: THEME.surfaceHover,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  itemImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemContent: {
    flex: 1,
    gap: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemTypeText: {
    fontSize: 11,
    color: THEME.text.muted,
    textTransform: 'capitalize',
  },
  itemCategory: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemCategoryText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text.primary,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemSource: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  itemDot: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  itemDate: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  railContent: {
    gap: 24,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoryList: {
    gap: 4,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  categoryItemActive: {
    backgroundColor: THEME.accentMuted,
  },
  categoryLabel: {
    fontSize: 13,
    color: THEME.text.secondary,
  },
  categoryLabelActive: {
    color: THEME.accent,
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  searchesList: {
    gap: 6,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  searchItemHover: {
    backgroundColor: THEME.surface,
  },
  searchText: {
    fontSize: 13,
    color: THEME.text.secondary,
  },
  statsCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text.primary,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 13,
    color: THEME.text.muted,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text.primary,
  },
});
