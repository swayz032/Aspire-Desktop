import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HubPageShell } from '@/components/founder-hub/HubPageShell';
import { resolveHubImage } from '@/data/founderHub/imageHelper';
import { supabase } from '@/lib/supabase';

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

interface SavedItem {
  id: string;
  type: string;
  title: string;
  source: string;
  date: string;
  starred: boolean;
  imageKey: string;
  imageUrl?: string;
}

const IMAGE_KEYS_BY_TYPE: Record<string, string> = {
  brief: 'pallet-yard',
  insight: 'pallet-stacks',
  template: 'truck-loading',
  pulse: 'lumber-yard',
  note: 'warehouse-dock',
};

const avaRecommendations = [
  { id: '1', title: 'Grade B pricing optimization tips', type: 'Pulse' },
  { id: '2', title: 'Customer retention strategies', type: 'Template' },
  { id: '3', title: 'Fuel cost hedging guide', type: 'Brief' },
];

const collections = [
  { id: '1', name: 'Pricing Strategy', count: 5, color: '#60a5fa' },
  { id: '2', name: 'Sales Outreach', count: 3, color: '#3B82F6' },
  { id: '3', name: 'Operations', count: 4, color: '#a78bfa' },
];

export default function SavedScreen() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Saved items are bookmarked receipts/content — query from a saved_items table or tagged receipts
        const { data } = await supabase
          .from('receipts')
          .select('*')
          .or('action_type.like.founder_hub.saved%,action_type.like.adam.%,action_type.like.research.%')
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
          setSavedItems(data.map((r: any, idx: number) => {
            const p = r.payload ?? r.metadata ?? {};
            const type = p.content_type ?? p.type ?? 'insight';
            return {
              id: r.id ?? `saved-${idx}`,
              type,
              title: p.title ?? r.action_type ?? 'Saved item',
              source: p.source ?? 'Adam Research',
              date: formatAge(r.created_at ?? new Date().toISOString()),
              starred: p.starred ?? false,
              imageKey: IMAGE_KEYS_BY_TYPE[type] ?? 'warehouse-dock',
              imageUrl: p.image_url ?? p.results?.[0]?.image_url ?? undefined,
            };
          }));
        }
      } catch (err) {
        console.error('Failed to load saved items:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'brief': return 'sunny-outline';
      case 'insight': return 'bulb-outline';
      case 'template': return 'document-text-outline';
      case 'pulse': return 'pulse-outline';
      case 'note': return 'journal-outline';
      default: return 'bookmark-outline';
    }
  };

  const rightRail = (
    <View style={styles.railContent}>
      <Text style={styles.railTitle}>Collections</Text>
      <View style={styles.collectionsList}>
        {collections.map((col) => (
          <Pressable
            key={col.id}
            style={[
              styles.collectionItem,
              hoveredItem === `col-${col.id}` && styles.collectionItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`col-${col.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={[styles.collectionDot, { backgroundColor: col.color }]} />
            <Text style={styles.collectionName}>{col.name}</Text>
            <Text style={styles.collectionCount}>{col.count}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.newCollectionBtn, hoveredItem === 'new-col' && styles.newCollectionBtnHover]}
          onHoverIn={() => setHoveredItem('new-col')}
          onHoverOut={() => setHoveredItem(null)}
        >
          <Ionicons name="add-outline" size={16} color={THEME.accent} />
          <Text style={styles.newCollectionText}>New Collection</Text>
        </Pressable>
      </View>

      <View style={styles.railDivider} />

      <Text style={styles.railTitle}>Ava Recommends</Text>
      <View style={styles.recommendsList}>
        {avaRecommendations.map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.recommendItem,
              hoveredItem === `rec-${item.id}` && styles.recommendItemHover,
            ]}
            onHoverIn={() => setHoveredItem(`rec-${item.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.recommendIcon}>
              <Ionicons name="sparkles" size={14} color={THEME.accent} />
            </View>
            <View style={styles.recommendContent}>
              <Text style={styles.recommendTitle}>{item.title}</Text>
              <Text style={styles.recommendType}>{item.type}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.railDivider} />

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Saved Stats</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total saved</Text>
          <Text style={styles.statValue}>24</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Starred</Text>
          <Text style={styles.statValue}>8</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>This week</Text>
          <Text style={styles.statValue}>5</Text>
        </View>
      </View>
    </View>
  );

  return (
    <HubPageShell rightRail={rightRail}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Saved</Text>
        <Text style={styles.pageSubtitle}>Your bookmarked insights and resources</Text>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterBtn, activeFilter === 'all' && styles.filterBtnActive]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterBtnText, activeFilter === 'all' && styles.filterBtnTextActive]}>All</Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, activeFilter === 'starred' && styles.filterBtnActive]}
          onPress={() => setActiveFilter('starred')}
        >
          <Ionicons
            name={activeFilter === 'starred' ? 'star' : 'star-outline'}
            size={14}
            color={activeFilter === 'starred' ? '#000' : THEME.text.muted}
          />
          <Text style={[styles.filterBtnText, activeFilter === 'starred' && styles.filterBtnTextActive]}>Starred</Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, activeFilter === 'briefs' && styles.filterBtnActive]}
          onPress={() => setActiveFilter('briefs')}
        >
          <Text style={[styles.filterBtnText, activeFilter === 'briefs' && styles.filterBtnTextActive]}>Briefs</Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, activeFilter === 'templates' && styles.filterBtnActive]}
          onPress={() => setActiveFilter('templates')}
        >
          <Text style={[styles.filterBtnText, activeFilter === 'templates' && styles.filterBtnTextActive]}>Templates</Text>
        </Pressable>
        <Pressable
          style={[styles.filterBtn, activeFilter === 'notes' && styles.filterBtnActive]}
          onPress={() => setActiveFilter('notes')}
        >
          <Text style={[styles.filterBtnText, activeFilter === 'notes' && styles.filterBtnTextActive]}>Notes</Text>
        </Pressable>
      </View>

      <View style={styles.savedList}>
        {savedItems
          .filter(item => activeFilter === 'all' || (activeFilter === 'starred' && item.starred))
          .map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.savedCard,
              hoveredItem === `saved-${item.id}` && styles.savedCardHover,
            ]}
            onHoverIn={() => setHoveredItem(`saved-${item.id}`)}
            onHoverOut={() => setHoveredItem(null)}
          >
            <View style={styles.savedImage}>
              <Image
                source={resolveHubImage(item.imageUrl, item.imageKey)}
                style={styles.savedThumb}
              />
            </View>
            <View style={styles.savedContent}>
              <View style={styles.savedMeta}>
                <View style={styles.savedType}>
                  <Ionicons name={getTypeIcon(item.type) as any} size={12} color={THEME.text.muted} />
                  <Text style={styles.savedTypeText}>{item.source}</Text>
                </View>
                <Text style={styles.savedDate}>{item.date}</Text>
              </View>
              <Text style={styles.savedTitle}>{item.title}</Text>
            </View>
            <View style={styles.savedActions}>
              <Pressable style={styles.actionBtn}>
                <Ionicons
                  name={item.starred ? 'star' : 'star-outline'}
                  size={18}
                  color={item.starred ? '#fbbf24' : THEME.text.muted}
                />
              </Pressable>
              <Pressable style={styles.actionBtn}>
                <Ionicons name="ellipsis-horizontal" size={18} color={THEME.text.muted} />
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
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
  savedList: {
    gap: 12,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  savedCardHover: {
    backgroundColor: THEME.surfaceHover,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  savedImage: {
    width: 70,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
  },
  savedThumb: {
    width: '100%',
    height: '100%',
  },
  savedContent: {
    flex: 1,
    gap: 6,
  },
  savedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedTypeText: {
    fontSize: 11,
    color: THEME.text.muted,
  },
  savedDate: {
    fontSize: 11,
    color: THEME.text.muted,
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text.primary,
    lineHeight: 18,
  },
  savedActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
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
  collectionsList: {
    gap: 6,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  collectionItemHover: {
    backgroundColor: THEME.surface,
  },
  collectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  collectionName: {
    flex: 1,
    fontSize: 13,
    color: THEME.text.secondary,
  },
  collectionCount: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  newCollectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  newCollectionBtnHover: {
    backgroundColor: THEME.accentMuted,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  newCollectionText: {
    fontSize: 13,
    color: THEME.accent,
    fontWeight: '500',
  },
  railDivider: {
    height: 1,
    backgroundColor: THEME.border,
  },
  recommendsList: {
    gap: 10,
  },
  recommendItem: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    backgroundColor: THEME.surface,
    borderRadius: 8,
  },
  recommendItemHover: {
    backgroundColor: THEME.surfaceHover,
  },
  recommendIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: THEME.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendContent: {
    flex: 1,
  },
  recommendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 2,
  },
  recommendType: {
    fontSize: 10,
    color: THEME.text.muted,
  },
  statsCard: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text.primary,
    marginBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    color: THEME.text.muted,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.text.primary,
  },
});
