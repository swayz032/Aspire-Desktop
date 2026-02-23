import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { resolveHubImage } from '@/data/founderHub/imageHelper';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/providers';

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

interface LibraryItem {
  id: string;
  type: string;
  title: string;
  source: string;
  date: string;
  category: string;
  saved: boolean;
  imageKey: string;
  imageUrl?: string;
}

const recentSearches = ['lumber pricing', 'Grade B margins', 'EPA regulations', 'cold email'];

const IMAGE_KEYS_BY_CATEGORY: Record<string, string> = {
  Sales: 'truck-loading',
  Operations: 'warehouse-dock',
  Pricing: 'pallet-stacks',
  Market: 'delivery-truck',
  Strategy: 'lumber-yard',
};

export default function LibraryScreen() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate categories from servicesNeeded (or fallback to defaults)
  const dynamicCategories = useMemo(() => {
    const base = [{ id: 'all', label: 'All', count: 0 }];
    if (tenant?.servicesNeeded && tenant.servicesNeeded.length > 0) {
      return [
        ...base,
        ...tenant.servicesNeeded.map((s) => ({
          id: s.toLowerCase().replace(/\s+/g, '_'),
          label: s.charAt(0).toUpperCase() + s.slice(1),
          count: 0,
        })),
      ];
    }
    return categories;
  }, [tenant?.servicesNeeded]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('receipts')
          .select('*')
          .or('action_type.like.adam.library%,action_type.like.research.%,action_type.like.founder_hub.library%')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!mounted) return;
        if (data && data.length > 0) {
          const formatAge = (dateStr: string) => {
            const diff = Date.now() - new Date(dateStr).getTime();
            const days = Math.floor(diff / 86400000);
            if (days === 0) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            if (days < 14) return '1 week ago';
            return `${Math.floor(days / 7)} weeks ago`;
          };
          setLibraryItems(data.map((r: any, idx: number) => {
            const p = r.payload ?? r.metadata ?? {};
            const category = p.category ?? p.domain ?? 'Market';
            return {
              id: r.id ?? `lib-${idx}`,
              type: p.content_type ?? p.type ?? 'article',
              title: p.title ?? r.action_type ?? 'Resource',
              source: p.source ?? 'Adam Research',
              date: formatAge(r.created_at ?? new Date().toISOString()),
              category,
              saved: false,
              imageKey: IMAGE_KEYS_BY_CATEGORY[category] ?? 'warehouse-dock',
              imageUrl: p.image_url ?? p.results?.[0]?.image_url ?? undefined,
            };
          }));
        }
      } catch (err) {
        console.error('Failed to load library items:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
        {dynamicCategories.map((cat) => (
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

  if (loading || tenantLoading) {
    return (
      <HubPageShell rightRail={<View />}>
        <View style={styles.header}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
        <View style={styles.skeletonSearch} />
        <View style={styles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonListItem} />
          ))}
        </View>
      </HubPageShell>
    );
  }

  if (!tenant?.onboardingCompleted) {
    return (
      <HubPageShell rightRail={<View />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Knowledge Library</Text>
            <Text style={styles.pageSubtitle}>Your curated vault of insights and resources</Text>
          </View>
        </View>
        <View style={styles.emptyStateContainer}>
          <Ionicons name="person-circle-outline" size={48} color={THEME.text.muted} />
          <Text style={styles.emptyStateTitle}>Complete your profile to unlock your Library</Text>
          <Text style={styles.emptyStateDesc}>
            Once you finish onboarding, Adam will curate resources tailored to your services and industry.
          </Text>
        </View>
      </HubPageShell>
    );
  }

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Knowledge Library</Text>
          <Text style={styles.pageSubtitle}>
            {tenant?.industry
              ? `Resources curated for your ${tenant.industry} business`
              : 'Your curated vault of insights and resources'}
          </Text>
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
        {libraryItems.length === 0 && (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="library-outline" size={48} color={THEME.text.muted} />
            <Text style={styles.emptyStateTitle}>Your personalized library is being prepared...</Text>
            <Text style={styles.emptyStateDesc}>
              Adam is curating {tenant?.industry ?? 'business'} resources for you. Articles, templates, and insights will appear here soon.
            </Text>
          </View>
        )}
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
                source={resolveHubImage(item.imageUrl, item.imageKey)}
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
  skeletonTitle: {
    width: 220,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  skeletonSubtitle: {
    width: 340,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skeletonSearch: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 20,
  },
  skeletonList: {
    gap: 12,
  },
  skeletonListItem: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text.secondary,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: THEME.text.muted,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 20,
  },
});
