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
import { CARD_BG, CARD_BORDER, svgPatterns, cardWithPattern } from '@/constants/cardPatterns';
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
      @keyframes docHeroEntrance {
        0% { opacity: 0; transform: translateY(24px) scale(0.98); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes docSparkleOrbit {
        0% { transform: rotate(0deg) scale(1); }
        25% { transform: rotate(8deg) scale(1.08); }
        50% { transform: rotate(0deg) scale(1); }
        75% { transform: rotate(-8deg) scale(1.08); }
        100% { transform: rotate(0deg) scale(1); }
      }
      @keyframes docIconFloat {
        0% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
        100% { transform: translateY(0); }
      }
      @keyframes docIconRingPulse {
        0% { opacity: 0.4; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.06); }
        100% { opacity: 0.4; transform: scale(1); }
      }
      @keyframes docChipFadeIn {
        0% { opacity: 0; transform: translateY(8px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes docCtaGlow {
        0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3), 0 4px 16px rgba(59,130,246,0.15); }
        50% { box-shadow: 0 0 0 6px rgba(59,130,246,0.08), 0 4px 24px rgba(59,130,246,0.25); }
        100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.3), 0 4px 16px rgba(59,130,246,0.15); }
      }
      @keyframes docBorderShimmer {
        0% { border-color: rgba(59,130,246,0.08); }
        50% { border-color: rgba(59,130,246,0.18); }
        100% { border-color: rgba(59,130,246,0.08); }
      }
      @keyframes docRadialPulse {
        0% { opacity: 0.25; }
        50% { opacity: 0.45; }
        100% { opacity: 0.25; }
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

const PREMIUM_FEATURES = [
  { icon: 'create-outline' as const, label: 'Draft contracts' },
  { icon: 'shield-checkmark-outline' as const, label: 'E-signatures' },
  { icon: 'folder-outline' as const, label: 'Template library' },
] as const;

export default function DocumentLibraryPage() {
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();

  const [contracts, setContracts] = useState<ContractCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const filters = activeTab !== 'all' ? { status: activeTab } : {};
      const data = await getContracts(authenticatedFetch, filters);

      // Server returns { configured: false } when contracts table is not yet available.
      // Treat this as an intentional empty state, not an error.
      if (data && typeof data === 'object' && !Array.isArray(data) && (data as Record<string, unknown>).configured === false) {
        setNotConfigured(true);
        setContracts([]);
        return;
      }

      // Normalize API response to ContractCardData shape.
      // Server may return { contracts: [...] } object or a raw array.
      const rawList = Array.isArray(data) ? data : (Array.isArray((data as Record<string, unknown>)?.contracts) ? (data as Record<string, unknown>).contracts as Record<string, unknown>[] : []);
      const normalized: ContractCardData[] = (rawList as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({
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

  // ── Premium empty state (feature not yet launched) ───────────────────────
  // Shown when server responds with configured: false. Replaces KPIs/filters/grid
  // with an intentional, designed hero state that makes users excited about the feature.
  const renderNotConfiguredState = () => (
    <View
      style={[
        styles.premiumCard,
        Platform.OS === 'web'
          ? {
              ...cardWithPattern(svgPatterns.shieldCheck('rgba(59,130,246,0.035)'), 'bottom-right', '38%') as Record<string, unknown>,
              animation: 'docHeroEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
              animationDelay: '0.1s',
            } as Record<string, unknown>
          : {},
      ]}
      accessibilityRole="summary"
      accessibilityLabel="Document hub is being prepared. Ask Clara to draft your first document."
    >
      {/* Luminous accent gradient along top edge */}
      <View
        style={[
          styles.premiumAccentLine,
          Platform.OS === 'web'
            ? {
                background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.5) 30%, rgba(59,130,246,0.7) 50%, rgba(59,130,246,0.5) 70%, transparent 100%)',
                height: 1.5,
              } as Record<string, unknown>
            : {},
        ]}
      />

      <View style={styles.premiumContent}>
        {/* Radial glow behind icon -- web only */}
        {Platform.OS === 'web' && (
          <View
            style={{
              position: 'absolute',
              top: 20,
              width: 240,
              height: 240,
              borderRadius: 120,
              background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 50%, transparent 70%)',
              animation: 'docRadialPulse 5s ease-in-out infinite',
              pointerEvents: 'none',
            } as unknown as Record<string, unknown>}
          />
        )}

        {/* Icon composition: dramatic layered document + sparkle micro-art */}
        <View
          style={[
            styles.premiumIconGroup,
            Platform.OS === 'web'
              ? { animation: 'docIconFloat 6s ease-in-out infinite' } as Record<string, unknown>
              : {},
          ]}
        >
          {/* Outermost luminous ring */}
          <View
            style={[
              styles.premiumIconRing,
              Platform.OS === 'web'
                ? { animation: 'docIconRingPulse 4s ease-in-out infinite' } as Record<string, unknown>
                : {},
            ]}
          >
            {/* Outer shell */}
            <View style={styles.premiumIconOuter}>
              {/* Inner icon surface */}
              <View
                style={[
                  styles.premiumIconInner,
                  Platform.OS === 'web'
                    ? {
                        background: 'linear-gradient(145deg, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.06) 100%)',
                        backdropFilter: 'blur(8px)',
                      } as Record<string, unknown>
                    : {},
                ]}
              >
                <Ionicons name="document-text-outline" size={36} color={Colors.accent.cyan} />
              </View>
            </View>
          </View>
          {/* Sparkle badge, offset top-right with orbit animation */}
          <View
            style={[
              styles.premiumSparkle,
              Platform.OS === 'web'
                ? {
                    animation: 'docSparkleOrbit 4s ease-in-out infinite',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 2px 12px rgba(59,130,246,0.25)',
                  } as Record<string, unknown>
                : {},
            ]}
          >
            <Ionicons name="sparkles" size={14} color={Colors.accent.cyan} />
          </View>
        </View>

        {/* Typography hierarchy -- editorial premium */}
        <Text
          style={[
            styles.premiumLabel,
            Platform.OS === 'web'
              ? { animation: 'docChipFadeIn 0.5s ease both', animationDelay: '0.3s' } as Record<string, unknown>
              : {},
          ]}
        >
          COMING SOON
        </Text>
        <Text
          style={[
            styles.premiumHeading,
            Platform.OS === 'web'
              ? { animation: 'docChipFadeIn 0.6s ease both', animationDelay: '0.4s' } as Record<string, unknown>
              : {},
          ]}
        >
          Your Document Hub
        </Text>
        <Text
          style={[
            styles.premiumBody,
            Platform.OS === 'web'
              ? { animation: 'docChipFadeIn 0.6s ease both', animationDelay: '0.5s' } as Record<string, unknown>
              : {},
          ]}
        >
          Contracts, proposals, and agreements will live here.{'\n'}
          Clara can draft, review, and manage your legal{'\n'}
          documents end-to-end.
        </Text>

        {/* Feature chips -- staggered entrance, frosted glass */}
        <View
          style={[
            styles.premiumFeatures,
            Platform.OS === 'web'
              ? { animation: 'docChipFadeIn 0.5s ease both', animationDelay: '0.65s' } as Record<string, unknown>
              : {},
          ]}
        >
          {PREMIUM_FEATURES.map((feat, idx) => (
            <View
              key={idx}
              style={[
                styles.premiumFeatureChip,
                Platform.OS === 'web'
                  ? {
                      animation: `docChipFadeIn 0.45s ease both`,
                      animationDelay: `${0.7 + idx * 0.1}s`,
                      backdropFilter: 'blur(12px)',
                      transition: 'border-color 0.3s ease, background-color 0.3s ease',
                    } as Record<string, unknown>
                  : {},
              ]}
              accessibilityElementsHidden
            >
              <View style={styles.premiumFeatureIconWrap}>
                <Ionicons name={feat.icon} size={13} color={Colors.accent.cyan} />
              </View>
              <Text style={styles.premiumFeatureText}>{feat.label}</Text>
            </View>
          ))}
        </View>

        {/* Subtle spatial separator -- gradient line */}
        <View
          style={[
            styles.premiumDivider,
            Platform.OS === 'web'
              ? {
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
                  height: 1,
                  width: 80,
                } as Record<string, unknown>
              : {},
          ]}
          accessibilityElementsHidden
        />

        {/* Clara CTA -- premium button with glow */}
        <Pressable
          style={({ pressed }) => [
            styles.premiumCta,
            Platform.OS === 'web'
              ? {
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  animation: 'docCtaGlow 3s ease-in-out infinite, docChipFadeIn 0.6s ease both',
                  animationDelay: '0s, 0.9s',
                  background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                  boxShadow: '0 4px 16px rgba(59,130,246,0.25), 0 1px 3px rgba(0,0,0,0.3)',
                } as Record<string, unknown>
              : {},
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleAskClara}
          accessibilityRole="button"
          accessibilityLabel="Ask Clara to draft a document"
        >
          <Ionicons name="sparkles" size={16} color="#fff" />
          <Text style={styles.premiumCtaText}>Ask Clara to Draft</Text>
          <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.65)" />
        </Pressable>

        {/* Subtle note beneath CTA */}
        <Text
          style={[
            styles.premiumFootnote,
            Platform.OS === 'web'
              ? { animation: 'docChipFadeIn 0.5s ease both', animationDelay: '1.1s' } as Record<string, unknown>
              : {},
          ]}
        >
          Clara will guide you through the entire process
        </Text>
      </View>
    </View>
  );

  return (
    <FinanceHubShell>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Documents</Text>
            <Text style={styles.pageSubtitle}>Contracts, agreements, and legal documents</Text>
          </View>
          {!notConfigured && (
            <Pressable
              style={[styles.claraCta, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}
              onPress={handleAskClara}
              accessibilityRole="button"
              accessibilityLabel="Ask Clara to draft a document"
            >
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.claraCtaText}>Ask Clara to Draft</Text>
            </Pressable>
          )}
        </View>

        {/* Premium not-configured state replaces all content below header */}
        {loading ? (
          <View style={styles.card}>
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={Colors.accent.cyan} />
              <Text style={styles.stateText}>Loading documents...</Text>
            </View>
          </View>
        ) : notConfigured ? (
          renderNotConfiguredState()
        ) : (
          <>
            {/* KPI row */}
            <View style={styles.kpiRow}>
              {[
                { label: 'Total', value: String(contracts.length), icon: 'folder-outline' as const, color: Colors.accent.cyan },
                { label: 'Awaiting Signature', value: String(statusCounts['sent'] ?? 0), icon: 'create-outline' as const, color: Colors.accent.amber },
                { label: 'Signed', value: String(statusCounts['signed'] ?? 0), icon: 'checkmark-circle-outline' as const, color: Colors.semantic.success },
                { label: 'Expired', value: String(statusCounts['expired'] ?? 0), icon: 'alert-circle-outline' as const, color: Colors.semantic.error },
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
                {error ? (
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
          </>
        )}
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

  // ── Premium not-configured state ─────────────────────────────────────────
  premiumCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.10)',
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },
  premiumAccentLine: {
    height: 1.5,
    backgroundColor: Colors.accent.cyan,
    opacity: 0.4,
  },
  premiumContent: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 64,
    paddingHorizontal: 48,
    position: 'relative',
    overflow: 'hidden',
  },

  // Icon composition -- dramatic 3-layer design
  premiumIconGroup: {
    position: 'relative',
    marginBottom: 36,
  },
  premiumIconRing: {
    width: 112,
    height: 112,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  premiumIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: 'rgba(59,130,246,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumIconInner: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumSparkle: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Typography -- editorial premium
  premiumLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: Colors.accent.cyan,
    textAlign: 'center',
    marginBottom: 14,
    opacity: 0.7,
  },
  premiumHeading: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  premiumBody: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: 36,
    letterSpacing: 0.1,
  },

  // Feature chips -- frosted glass
  premiumFeatures: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
  },
  premiumFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.08)',
  },
  premiumFeatureIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumFeatureText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.1,
  },

  // Divider -- gradient line
  premiumDivider: {
    width: 64,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 36,
  },

  // CTA button -- premium gradient with glow
  premiumCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 220,
    justifyContent: 'center',
    minHeight: 48,
  },
  premiumCtaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // Footnote beneath CTA
  premiumFootnote: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.disabled,
    marginTop: 16,
    letterSpacing: 0.2,
  },
});
