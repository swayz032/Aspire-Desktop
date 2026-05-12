/**
 * MaterialsTab — top-level container for the Materials search engine.
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ MaterialsSearchBar  (always visible)                       │
 *   │   ↳ closest store chip                                     │
 *   ├───────────────────────────────────────────────────────────┤
 *   │ EMPTY STATE  (no query submitted)                          │
 *   │   ↳ Tim-suggested queries                                  │
 *   │ — OR —                                                     │
 *   │ ClosestStoreCard  (when results)                           │
 *   │ FiltersBar        (chips, mock)                            │
 *   │ ProductGrid       (when products)                          │
 *   │ SupplierMatchesRail (when specialty)                       │
 *   │ PredictiveAddons  (when bundle has items)                  │
 *   ├───────────────────────────────────────────────────────────┤
 *   │ BundleSummaryBar  (sticky, when bundle has items)          │
 *   └───────────────────────────────────────────────────────────┘
 *
 * Aspire Law compliance:
 *   - Law #7: render layer only — no autonomous decisions.
 *   - Law #6: project address consumed via useProjectAddress (tenant-scoped).
 *   - Law #3: empty query → empty state, never fabricated results.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import {
  useMaterialsSearch,
  getPredictiveAddons,
  type Product,
} from '@/hooks/useMaterialsSearch';
import { useMaterialsBundle } from '@/hooks/useMaterialsBundle';

import { MaterialsSearchBar } from './MaterialsSearchBar';
import { MaterialsEmptyState } from './MaterialsEmptyState';
import { ClosestStoreCard } from './ClosestStoreCard';
import { ProductGrid } from './ProductGrid';
import { ProductCompareDrawer } from './ProductCompareDrawer';
import { SupplierMatchesRail } from './SupplierMatchesRail';
import { PredictiveAddons } from './PredictiveAddons';
import { BundleSummaryBar } from './BundleSummaryBar';
import { RouteMapModal } from './RouteMapModal';

export function MaterialsTab() {
  const { address } = useProjectAddress();
  const {
    query,
    setQuery,
    submitSearch,
    clearSearch,
    results,
    closestStore,
    specialtySuppliers,
    filters,
    isLoading,
    isCachedOnlyMode,
    suggestedQueries,
  } = useMaterialsSearch();

  const {
    bundle,
    addToBundle,
    removeFromBundle: _removeFromBundle,
    clearBundle,
    bundleSubtotal,
    bundleSupplierCount,
    bundleItemCount,
    pushToEstimate,
  } = useMaterialsBundle(address);

  // Clear the in-memory bundle when the Materials tab unmounts so it does not
  // persist past tab navigation. (Pass D will store this in Supabase.)
  useEffect(() => {
    return () => {
      clearBundle();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [compareProduct, setCompareProduct] = useState<Product | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);

  const bundleIds = useMemo(() => new Set(bundle.map((b) => b.productId)), [bundle]);

  const handleSuggestionPick = useCallback(
    (q: string) => {
      setQuery(q);
      submitSearch(q);
    },
    [setQuery, submitSearch],
  );

  const handleAdd = useCallback(
    (p: Product) => {
      addToBundle(p, 1);
    },
    [addToBundle],
  );

  const handleCompare = useCallback((p: Product) => {
    setCompareProduct(p);
  }, []);

  const handleUseAlt = useCallback(
    (_sellerId: string) => {
      // Pass F: real swap. Pass B: close drawer.
      setCompareProduct(null);
    },
    [],
  );

  const handlePushToEstimate = useCallback(() => {
    void pushToEstimate();
  }, [pushToEstimate]);

  const handleDraftRfq = useCallback(() => {
    // Pass G: open RFQDraftModal. Pass B: noop.
    // eslint-disable-next-line no-console
    console.info('[materials] draftRfq (mock)');
  }, []);

  // Predictive add-ons keyed off the most recent bundle addition.
  const predictiveAddons = useMemo(() => {
    if (bundle.length === 0) return [];
    const seed = bundle[bundle.length - 1].product;
    const addonCandidates = getPredictiveAddons(seed);
    return addonCandidates.filter((p) => !bundleIds.has(p.id));
  }, [bundle, bundleIds]);

  const hasResults = Array.isArray(results) && results.length > 0;
  const hasSpecialty = specialtySuppliers.length > 0;
  const showEmptyState = !hasResults && !hasSpecialty && !isLoading;

  return (
    <View style={styles.tab} testID="materials-tab">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        {isCachedOnlyMode && (
          <View style={styles.cachedBanner} testID="materials-cached-banner">
            <Ionicons name="cloud-offline-outline" size={12} color="#fbbf24" />
            <Text style={styles.cachedBannerText}>
              Showing cached results — daily live-lookup quota reached. Fresh prices return tomorrow.
            </Text>
          </View>
        )}

        <MaterialsSearchBar
          value={query}
          onChange={setQuery}
          onSubmit={submitSearch}
          onClear={clearSearch}
          closestStore={closestStore}
          onClosestStorePress={() => setRouteOpen(true)}
          isLoading={isLoading}
        />

        {showEmptyState && (
          <MaterialsEmptyState suggestions={suggestedQueries} onPick={handleSuggestionPick} />
        )}

        {!showEmptyState && (
          <>
            {closestStore && hasResults && (
              <ClosestStoreCard
                store={closestStore}
                onRoutePress={() => setRouteOpen(true)}
              />
            )}

            {filters.length > 0 && (
              <View style={styles.filtersBar} testID="materials-filters-bar">
                {filters.map((f) => (
                  <View key={f.key} style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>{f.label.toUpperCase()}</Text>
                    <View style={styles.filterChipRow}>
                      {f.options.slice(0, 4).map((opt) => (
                        <View key={opt.value} style={styles.filterChip}>
                          <Text style={styles.filterChipText}>{opt.label}</Text>
                          <Text style={styles.filterChipCount}>{opt.count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {hasResults && (
              <ProductGrid
                products={results!}
                bundleIds={bundleIds}
                onAdd={handleAdd}
                onCompare={handleCompare}
              />
            )}

            {hasSpecialty && (
              <SupplierMatchesRail
                suppliers={specialtySuppliers}
                onDraftRfq={(s) => {
                  // eslint-disable-next-line no-console
                  console.info('[materials] draft RFQ for specialty', s.id);
                }}
              />
            )}

            {bundle.length > 0 && predictiveAddons.length > 0 && (
              <PredictiveAddons addons={predictiveAddons} onAdd={handleAdd} />
            )}

            {!hasResults && !hasSpecialty && (
              <View style={styles.noResults} testID="materials-no-results">
                <Ionicons name="leaf-outline" size={20} color="rgba(255,255,255,0.40)" />
                <Text style={styles.noResultsTitle}>No matches in stock</Text>
                <Text style={styles.noResultsSub}>
                  Try a different keyword or check specialty suppliers via a niche query.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <BundleSummaryBar
        itemCount={bundleItemCount}
        supplierCount={bundleSupplierCount}
        subtotal={bundleSubtotal}
        onPushToEstimate={handlePushToEstimate}
        onDraftRfq={handleDraftRfq}
        onClear={clearBundle}
      />

      <ProductCompareDrawer
        visible={compareProduct !== null}
        product={compareProduct}
        onClose={() => setCompareProduct(null)}
        onUseAlt={handleUseAlt}
      />

      <RouteMapModal
        visible={routeOpen}
        onClose={() => setRouteOpen(false)}
        projectAddress={address}
        store={closestStore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 22,
    paddingBottom: 96, // leave room for sticky BundleSummaryBar
  },
  cachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  cachedBannerText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(251,191,36,0.92)',
    letterSpacing: -0.05,
  },

  // Filters
  filtersBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingVertical: 4,
  },
  filterGroup: {
    gap: 5,
  },
  filterGroupLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.1,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  filterChipCount: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },

  // No results inline
  noResults: {
    alignItems: 'center',
    padding: 28,
    gap: 6,
  },
  noResultsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  noResultsSub: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 16,
  },
});
