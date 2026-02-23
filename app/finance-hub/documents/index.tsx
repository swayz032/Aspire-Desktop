/**
 * Document Library -- Main contract listing with filter tabs, search, and card grid.
 * Follows the same pattern as invoices.tsx for data fetching and FinanceHubShell wrapping.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER } from '@/constants/cardPatterns';
import { getContracts } from '@/lib/api';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import {
  ContractCard,
  type ContractCardData,
  CONTRACT_STATUS,
  type ContractStatus,
} from '@/components/finance/documents';

const webOnly = (styles: Record<string, unknown>) => Platform.OS === 'web' ? styles : {};

// Inject fadeInUp keyframes for web staggered card animation
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'aspire-doc-keyframes';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      @keyframes fadeInUp {
        0% { opacity: 0; transform: translateY(12px); }
        100% { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(el);
  }
}

type FilterTab = 'all' | ContractStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'sent', label: 'Sent' },
  { key: 'signed', label: 'Signed' },
  { key: 'expired', label: 'Expired' },
];

type SortOption = 'newest' | 'oldest' | 'name';

const NUM_COLUMNS = 3;

export default function DocumentLibraryPage() {
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();

  const [contracts, setContracts] = useState<ContractCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = activeTab !== 'all' ? { status: activeTab } : {};
      const data = await getContracts(authenticatedFetch, filters);
      // Normalize API response to ContractCardData shape
      const normalized: ContractCardData[] = (Array.isArray(data) ? data : []).map((c: Record<string, unknown>) => ({
        id: String(c.id ?? ''),
        title: String(c.title ?? c.name ?? 'Untitled'),
        counterparty: c.counterparty ? String(c.counterparty) : undefined,
        status: (String(c.status ?? 'draft') as ContractStatus),
        lane: c.lane as ContractCardData['lane'],
        template_key: c.template_key ? String(c.template_key) : undefined,
        created_at: String(c.created_at ?? new Date().toISOString()),
        updated_at: c.updated_at ? String(c.updated_at) : undefined,
      }));
      setContracts(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, activeTab]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Filter by search query
  const filteredContracts = useMemo(() => {
    let result = contracts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        c =>
          c.title.toLowerCase().includes(q) ||
          (c.counterparty?.toLowerCase().includes(q) ?? false) ||
          (c.template_key?.toLowerCase().includes(q) ?? false),
      );
    }
    // Sort
    if (sortBy === 'newest') {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'oldest') {
      result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [contracts, searchQuery, sortBy]);

  // Status counts for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contracts) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [contracts]);

  const renderCard = useCallback(({ item, index }: { item: ContractCardData; index: number }) => (
    <View style={styles.cardCell}>
      <ContractCard contract={item} index={index} />
    </View>
  ), []);

  const keyExtractor = useCallback((item: ContractCardData) => item.id, []);

  const handleAskClara = useCallback(() => {
    // Navigate to main Ava desk -- Clara is invoked through Ava
    router.push('/(tabs)' as any);
  }, [router]);

  return (
    <FinanceHubShell>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Documents</Text>
            <Text style={styles.pageSubtitle}>Contracts, agreements, and legal documents</Text>
          </View>
          <Pressable
            style={[styles.claraCta, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
            onPress={handleAskClara}
            accessibilityRole="button"
            accessibilityLabel="Ask Clara to draft a document"
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.claraCtaText}>Ask Clara to Draft</Text>
          </Pressable>
        </View>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          {[
            { label: 'Total', value: String(contracts.length), icon: 'folder-outline' as const, color: '#3B82F6' },
            { label: 'Awaiting Signature', value: String(statusCounts['sent'] ?? 0), icon: 'create-outline' as const, color: '#f59e0b' },
            { label: 'Signed', value: String(statusCounts['signed'] ?? 0), icon: 'checkmark-circle-outline' as const, color: '#34c759' },
            { label: 'Expired', value: String(statusCounts['expired'] ?? 0), icon: 'alert-circle-outline' as const, color: '#ff3b30' },
          ].map((kpi, idx) => (
            <View key={idx} style={[styles.kpiCard, webOnly({ cursor: 'default' })]}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconWrap, { backgroundColor: kpi.color + '20' }]}>
                  <Ionicons name={kpi.icon} size={18} color={kpi.color} />
                </View>
              </View>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* Filters + Search card */}
        <View style={styles.card}>
          {/* Filter tabs */}
          <View style={styles.filterRow}>
            <View style={styles.tabsRow}>
              {FILTER_TABS.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={[styles.filterTab, active && styles.filterTabActive, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
                    onPress={() => setActiveTab(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                      {tab.label}
                    </Text>
                    {tab.key !== 'all' && (statusCounts[tab.key] ?? 0) > 0 && (
                      <View style={[styles.tabCount, active && styles.tabCountActive]}>
                        <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                          {statusCounts[tab.key]}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Search + Sort */}
            <View style={styles.searchSortRow}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={16} color={Colors.text.muted} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search documents..."
                  placeholderTextColor={Colors.text.disabled}
                  accessibilityLabel="Search documents"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} style={webOnly({ cursor: 'pointer' })}>
                    <Ionicons name="close-circle" size={16} color={Colors.text.muted} />
                  </Pressable>
                )}
              </View>
              <View style={styles.sortWrap}>
                {(['newest', 'oldest', 'name'] as SortOption[]).map(opt => (
                  <Pressable
                    key={opt}
                    style={[
                      styles.sortBtn,
                      sortBy === opt && styles.sortBtnActive,
                      webOnly({ cursor: 'pointer' }),
                    ]}
                    onPress={() => setSortBy(opt)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort by ${opt}`}
                  >
                    <Text style={[styles.sortBtnText, sortBy === opt && styles.sortBtnTextActive]}>
                      {opt === 'newest' ? 'Newest' : opt === 'oldest' ? 'Oldest' : 'A-Z'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Content */}
          <View style={styles.contentArea}>
            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={Colors.accent.cyan} />
                <Text style={styles.stateText}>Loading documents...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerState}>
                <Ionicons name="alert-circle" size={40} color={Colors.semantic.error} />
                <Text style={styles.stateText}>{error}</Text>
                <Pressable
                  style={[styles.retryBtn, webOnly({ cursor: 'pointer' })]}
                  onPress={fetchContracts}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading documents"
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : filteredContracts.length === 0 ? (
              <View style={styles.centerState}>
                <Ionicons name="folder-open-outline" size={48} color={Colors.text.disabled} />
                <Text style={styles.stateText}>
                  {searchQuery ? 'No documents match your search' : 'No documents yet'}
                </Text>
                <Text style={styles.stateSubtext}>
                  {searchQuery
                    ? 'Try adjusting your search or filter'
                    : 'Ask Clara to draft your first contract'}
                </Text>
                {!searchQuery && (
                  <Pressable
                    style={[styles.emptyCtaBtn, webOnly({ cursor: 'pointer' })]}
                    onPress={handleAskClara}
                    accessibilityRole="button"
                    accessibilityLabel="Ask Clara to draft a document"
                  >
                    <Ionicons name="sparkles" size={14} color={Colors.accent.cyan} />
                    <Text style={styles.emptyCtaText}>Ask Clara to Draft</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredContracts}
                renderItem={renderCard}
                keyExtractor={keyExtractor}
                numColumns={NUM_COLUMNS}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS !== 'web'}
                initialNumToRender={9}
                maxToRenderPerBatch={6}
                windowSize={5}
              />
            )}
          </View>
        </View>
      </View>
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: 4,
  },
  claraCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  claraCtaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // KPI
  kpiRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    padding: 18,
    overflow: 'hidden',
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '500',
  },

  // Main card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },

  // Filters
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  filterTabActive: {
    borderBottomColor: Colors.accent.cyan,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  filterTabTextActive: {
    color: Colors.accent.cyan,
  },
  tabCount: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  tabCountTextActive: {
    color: Colors.accent.cyan,
  },

  // Search + Sort
  searchSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.03)',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flex: 1,
    maxWidth: 320,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
  },
  sortWrap: {
    flexDirection: 'row',
    gap: 4,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  sortBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  sortBtnTextActive: {
    color: Colors.text.secondary,
  },

  // Content / Grid
  contentArea: {
    minHeight: 300,
  },
  gridContent: {
    padding: 16,
  },
  gridRow: {
    gap: 14,
    marginBottom: 14,
  },
  cardCell: {
    flex: 1,
    maxWidth: '33.33%',
  },

  // States
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  stateText: {
    color: Colors.text.tertiary,
    fontSize: 15,
    marginTop: 12,
  },
  stateSubtext: {
    color: Colors.text.muted,
    fontSize: 13,
    marginTop: 6,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.accent.cyanLight,
  },
  retryBtnText: {
    color: Colors.accent.cyan,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.accent.cyanLight,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  emptyCtaText: {
    color: Colors.accent.cyan,
    fontWeight: '600',
    fontSize: 13,
  },
});
