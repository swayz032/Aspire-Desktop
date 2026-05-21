/**
 * MaterialsTab — top-level container for the Materials search engine.
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ MaterialsSearchBar  (always visible)                       │
 *   │   ↳ closest store chip                                     │
 *   ├───────────────────────────────────────────────────────────┤
 *   │ FROM YOUR BLUEPRINT  (when projectId present)              │
 *   │   ↳ Tool mode → BlueprintModeFeed (Drew's curated picks)   │
 *   │   ↳ Supplier mode → blueprint-derived supplier rail (Adam) │
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
 * Wave 18h: Blueprint is no longer a toggle mode. When a project is loaded,
 * Drew's blueprint material picks auto-prepend in Tool mode and Adam's
 * blueprint-derived supplier matches auto-prepend in Supplier mode, both
 * under a "From your blueprint" section header. Toggle is 2-state.
 *
 * Aspire Law compliance:
 *   - Law #7: render layer only — no autonomous decisions.
 *   - Law #6: project address consumed via useProjectAddress (tenant-scoped).
 *   - Law #3: empty query → empty state, never fabricated results.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPredictiveAddons, type Product, type SpecialtySupplier } from '@/hooks/useMaterialsSearch';
import { useMaterialsSearchContext } from './MaterialsSearchContext';
// Wave 18h — blueprint-derived data auto-prepends above generic results.
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import type { TakeoffMaterial } from '@/lib/api/blueprintsApi';
import { BlueprintModeFeed } from './BlueprintModeFeed';
import type { BlueprintTileMaterial } from './BlueprintModeTile';

import { MaterialsEmptyState } from './MaterialsEmptyState';
import { ProductGrid } from './ProductGrid';
import { ProductCompareDrawer } from './ProductCompareDrawer';
import { SupplierMatchesRail } from './SupplierMatchesRail';
import { SupplierGrid } from './SupplierGrid';
import { PredictiveAddons } from './PredictiveAddons';
import { BundleSummaryBar } from './BundleSummaryBar';
import { MaterialsRouteHero } from './MaterialsRouteHero';

/**
 * Thin chooser: picks the canvas view (results | route) from context.
 */
export function MaterialsTab() {
  const { canvasView } = useMaterialsSearchContext();
  if (canvasView === 'route') return <MaterialsRouteHero />;
  return <MaterialsTabResults />;
}

/**
 * Section header for the "From your blueprint" prepend. Premium chrome —
 * matches the locked Visuals tab language (uppercase label, hairline rule,
 * 200ms cross-fade on mount via Web).
 */
function BlueprintSectionHeader({ count }: { count: number }) {
  return (
    <View style={styles.sectionHeader} testID="materials-blueprint-section-header">
      <Ionicons name="hammer-outline" size={12} color="#fbbf24" />
      <Text style={styles.sectionHeaderTitle}>FROM YOUR BLUEPRINT</Text>
      {count > 0 ? (
        <Text style={styles.sectionHeaderCount}>
          {count} pick{count === 1 ? '' : 's'}
        </Text>
      ) : null}
      <View style={styles.sectionHeaderRule} />
    </View>
  );
}

/**
 * Aggregate blueprint materials into supplier matches for the Supplier-mode
 * prepend. Pure projection — no network, no decisions.
 */
function deriveBlueprintSuppliers(materials: TakeoffMaterial[]): SpecialtySupplier[] {
  const by: Map<string, { count: number; total: number; categories: Set<string> }> = new Map();
  for (const m of materials) {
    if (!m.supplier_name) continue;
    const tile = m as TakeoffMaterial & { unit_price?: number | null; discipline?: string | null };
    const cur = by.get(m.supplier_name) ?? { count: 0, total: 0, categories: new Set<string>() };
    cur.count += 1;
    cur.total += (tile.unit_price ?? 0) * (m.quantity || 0);
    if (tile.discipline) cur.categories.add(tile.discipline.toUpperCase());
    by.set(m.supplier_name, cur);
  }
  return Array.from(by.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([name, agg]) => ({
      id: `bp-${name}`,
      name,
      category:
        agg.categories.size > 0
          ? Array.from(agg.categories).join(' · ')
          : `${agg.count} item${agg.count === 1 ? '' : 's'}`,
      phone: '',
      distanceMiles: 0,
      driveMinutes: 0,
    }));
}

function MaterialsTabResults() {
  const { search, bundle: bundleApi, mode } = useMaterialsSearchContext();
  const {
    submitSearch,
    results,
    specialtySuppliers,
    suppliers,
    filters,
    isLoading,
    isCachedOnlyMode,
    suggestedQueries,
    setQuery,
  } = search;

  const {
    bundle,
    addToBundle,
    clearBundle,
    bundleSubtotal,
    bundleSupplierCount,
    bundleItemCount,
    pushToEstimate,
  } = bundleApi;

  // Pass D: bundle is Supabase-persisted — do NOT clear on unmount.

  const [compareProduct, setCompareProduct] = useState<Product | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    { type: 'brand' | 'stock' | 'price'; value: string } | null
  >(null);

  // ───────── Wave 18h: blueprint prepend ─────────
  const blueprintSnap = useBlueprintUploadSnapshot();
  const blueprintProjectId =
    blueprintSnap.projectId ?? blueprintSnap.response?.project_id ?? null;
  const blueprintMaterials = useTakeoffMaterials(blueprintProjectId);
  const hasBlueprintData =
    blueprintProjectId !== null && blueprintMaterials.materials.length > 0;

  // Pass D: BundleItem.product.id replaces Pass B BundleItem.productId
  const bundleIds = useMemo(() => new Set(bundle.map((b) => b.product.id)), [bundle]);

  // Pass E: bundle contains supplier-line items → BundleSummaryBar shows
  // "Draft RFQs" as the primary CTA.
  const hasSupplierLines = useMemo(
    () => bundle.some((b) => b.kind === 'supplier_line'),
    [bundle],
  );

  // Wave 18h: bridge Drew tile → bundle via the same Product projection used
  // by the standalone Blueprint feed previously.
  const handleBlueprintTileAdd = useCallback(
    (m: BlueprintTileMaterial) => {
      const product: Product = {
        id: m.material_id,
        title: m.line_item,
        brand: (m.brand ?? m.supplier_name ?? 'Drew pick') as string,
        imageUrl: m.image_url ?? '',
        price: typeof m.unit_price === 'number' ? m.unit_price : 0,
        unit: m.unit,
        rating: 0,
        reviewCount: 0,
        source: 'specialty',
        fetchedAt: new Date().toISOString(),
        store: {
          id: m.supplier_name ?? 'blueprint',
          name: m.supplier_name ?? 'Drew pick',
          driveMinutes: 0,
          inStock: true,
        },
      };
      addToBundle(product, Math.max(1, Math.round(m.quantity || 1)));
    },
    [addToBundle],
  );

  const blueprintSuppliers = useMemo(
    () => (hasBlueprintData ? deriveBlueprintSuppliers(blueprintMaterials.materials) : []),
    [hasBlueprintData, blueprintMaterials.materials],
  );

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

  const handleUseAlt = useCallback((_sellerId: string) => {
    setCompareProduct(null);
  }, []);

  const handlePushToEstimate = useCallback(() => {
    void pushToEstimate().catch((err) => {
      if (__DEV__) console.warn('[materials] pushToEstimate failed', err);
    });
  }, [pushToEstimate]);

  const handleDraftRfq = useCallback(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[materials] draftRfq (mock)');
    }
  }, []);

  // Predictive add-ons keyed off the most recent bundle addition.
  const predictiveAddons = useMemo(() => {
    if (bundle.length === 0) return [];
    const lastItem = bundle[bundle.length - 1];
    const seed: Product = lastItem.product;
    const addonCandidates = getPredictiveAddons(seed);
    return addonCandidates.filter((p) => !bundleIds.has(p.id));
  }, [bundle, bundleIds]);

  // Mid-price threshold (matches deriveFilters() in useMaterialsSearch).
  const priceMid = useMemo(() => {
    if (!results || results.length === 0) return 0;
    const sorted = results.map((p) => p.price).sort((a, b) => a - b);
    return ((sorted[0] ?? 0) + (sorted[sorted.length - 1] ?? 0)) / 2;
  }, [results]);

  const filteredResults = useMemo(() => {
    if (!results || !activeFilter) return results;
    return results.filter((p) => {
      if (activeFilter.type === 'brand') return p.brand === activeFilter.value;
      if (activeFilter.type === 'stock') {
        if (activeFilter.value === 'in_stock') return p.store.inStock;
        return true;
      }
      if (activeFilter.type === 'price') {
        if (activeFilter.value === 'lo') return p.price < priceMid;
        return p.price >= priceMid;
      }
      return true;
    });
  }, [results, activeFilter, priceMid]);

  // Clear stale filter when a new search arrives with a different result set.
  useEffect(() => {
    setActiveFilter(null);
  }, [results]);

  const handleFilterToggle = useCallback(
    (type: 'brand' | 'stock' | 'price', value: string) => {
      setActiveFilter((prev) =>
        prev && prev.type === type && prev.value === value ? null : { type, value },
      );
    },
    [],
  );

  const hasResults = Array.isArray(filteredResults) && filteredResults.length > 0;
  const hasSpecialty = specialtySuppliers.length > 0;
  const hasSubmittedSupplier = Array.isArray(suppliers);
  const hasSubmittedSearch =
    mode === 'supplier' ? hasSubmittedSupplier : Array.isArray(results);
  const showEmptyState = !hasSubmittedSearch && !hasSpecialty && !isLoading;

  // Show blueprint prepend when project loaded — independent of search state.
  // Tool mode → BlueprintModeFeed. Supplier mode → SupplierMatchesRail bound
  // to blueprint-derived suppliers.
  const showBlueprintPrepend = hasBlueprintData;

  return (
    <View style={styles.tab} testID="materials-tab">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isCachedOnlyMode && (
          <View style={styles.cachedBanner} testID="materials-cached-banner">
            <Ionicons name="cloud-offline-outline" size={12} color="#fbbf24" />
            <Text style={styles.cachedBannerText}>
              Showing cached results — daily live-lookup quota reached. Fresh prices return tomorrow.
            </Text>
          </View>
        )}

        {/* Wave 18h: blueprint findings auto-prepend when a project is loaded. */}
        {showBlueprintPrepend && mode === 'tool' && (
          <View
            style={styles.blueprintPrepend}
            testID="materials-blueprint-prepend-tool"
          >
            <BlueprintSectionHeader count={blueprintMaterials.materials.length} />
            <BlueprintModeFeed
              onAddToBundle={handleBlueprintTileAdd}
              bundleMaterialIds={bundleIds}
            />
          </View>
        )}
        {showBlueprintPrepend && mode === 'supplier' && (
          <View
            style={styles.blueprintPrepend}
            testID="materials-blueprint-prepend-supplier"
          >
            <BlueprintSectionHeader count={blueprintSuppliers.length} />
            {blueprintSuppliers.length > 0 ? (
              <SupplierMatchesRail
                suppliers={blueprintSuppliers}
                onDraftRfq={(s) => {
                  if (__DEV__) {
                    // eslint-disable-next-line no-console
                    console.info('[materials/blueprint-supplier] draft RFQ', s.id);
                  }
                }}
              />
            ) : (
              <View style={styles.blueprintEmpty} testID="materials-blueprint-supplier-empty">
                <Ionicons name="leaf-outline" size={14} color="rgba(255,255,255,0.40)" />
                <Text style={styles.blueprintEmptyText}>
                  No suppliers tagged on this blueprint yet. Search below or wait for Adam to finish matching.
                </Text>
              </View>
            )}
          </View>
        )}

        {showEmptyState && (
          <MaterialsEmptyState suggestions={suggestedQueries} onPick={handleSuggestionPick} />
        )}

        {!showEmptyState && mode === 'supplier' && (
          <SupplierGrid
            suppliers={suppliers}
            isLoading={isLoading && suppliers === null}
            onDraftRfq={(s) => {
              if (__DEV__) {
                // eslint-disable-next-line no-console
                console.info('[materials] draft RFQ for supplier', s.id);
              }
            }}
          />
        )}

        {!showEmptyState && mode === 'tool' && (
          <>
            {filters.length > 0 && (
              <View style={styles.filtersBar} testID="materials-filters-bar">
                {filters.map((f) => (
                  <View key={f.key} style={styles.filterGroup}>
                    <Text style={styles.filterGroupLabel}>{f.label.toUpperCase()}</Text>
                    <View style={styles.filterChipRow}>
                      {f.options.slice(0, 4).map((opt) => {
                        const isActive =
                          activeFilter?.type === (f.key as 'brand' | 'stock' | 'price') &&
                          activeFilter.value === opt.value;
                        return (
                          <Pressable
                            key={opt.value}
                            onPress={() =>
                              handleFilterToggle(
                                f.key as 'brand' | 'stock' | 'price',
                                opt.value,
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Filter by ${f.label}: ${opt.label}`}
                            accessibilityState={{ selected: isActive }}
                            testID={`materials-filter-chip-${f.key}-${opt.value}`}
                            style={[styles.filterChip, isActive && styles.filterChipActive]}
                          >
                            <Text
                              style={[
                                styles.filterChipText,
                                isActive && styles.filterChipTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                            <Text
                              style={[
                                styles.filterChipCount,
                                isActive && styles.filterChipCountActive,
                              ]}
                            >
                              {opt.count}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {hasResults && (
              <ProductGrid
                products={filteredResults!}
                bundleIds={bundleIds}
                onAdd={handleAdd}
                onCompare={handleCompare}
              />
            )}

            {hasSpecialty && (
              <SupplierMatchesRail
                suppliers={specialtySuppliers}
                onDraftRfq={(s) => {
                  if (__DEV__) {
                    // eslint-disable-next-line no-console
                    console.info('[materials] draft RFQ for specialty', s.id);
                  }
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
        hasSupplierLines={hasSupplierLines}
      />

      <ProductCompareDrawer
        visible={compareProduct !== null}
        product={compareProduct}
        onClose={() => setCompareProduct(null)}
        onUseAlt={handleUseAlt}
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

  // Wave 18h: From-your-blueprint prepend section
  blueprintPrepend: {
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'opacity 200ms ease',
        } as unknown as object)
      : {}),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 1.4,
  },
  sectionHeaderCount: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  sectionHeaderRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginLeft: 4,
  },
  blueprintEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  blueprintEmptyText: {
    flex: 1,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 16,
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
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 1.4,
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
  filterChipActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  filterChipText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
    letterSpacing: -0.05,
  },
  filterChipTextActive: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  filterChipCount: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  filterChipCountActive: {
    color: 'rgba(251,191,36,0.85)',
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
