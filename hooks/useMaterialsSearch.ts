/**
 * useMaterialsSearch — Pass C (real API wiring).
 *
 * Replaces the Pass B mock setTimeout with a real call to
 * `searchMaterials()` via the Express proxy at `/api/v1/materials/search`.
 *
 * Mock data has been moved to `__tests__/materialsSearch.mock.ts` so Jest
 * tests continue to work. The component tree consumes this hook untouched.
 *
 * Pass C — dev mode fallback:
 *   When `?mock=1` is in the URL (or EXPO_PUBLIC_FORCE_MOCK=1 env var is set)
 *   the hook reverts to the inline resolveMockSearch() path. This lets
 *   engineers develop UI without a live backend.
 *
 * Aspire Law compliance:
 *   - Law #3 (fail closed): empty query → empty results; PII rejected server-side.
 *   - Law #5 (capability tokens): token minted by Express proxy server-side.
 *   - Law #7 (tools are hands): hook is a data bridge only — no autonomous decisions.
 *   - Law #9 (no PII): query is normalised + PII-checked server-side before caching.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import {
  searchMaterials,
  mapServerResponse,
  MaterialsApiError,
} from '@/lib/api/materialsApi';

// ---------------------------------------------------------------------------
// Domain types (locked at Pass B; shape preserved for Pass C compatibility)
// ---------------------------------------------------------------------------

export type ProductSource = 'home_depot' | 'lowes' | 'amazon' | 'specialty' | 'google_shopping';

export interface ProductStore {
  id: string;
  name: string;
  driveMinutes: number;
  inStock: boolean;
  inTraffic?: boolean;
}

/** Coverage rule for a single product. */
export interface ProductCoverage {
  value: number;
  unit: string;
  source: 'rule' | 'inferred' | 'product_spec';
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  imageUrl: string;
  price: number;
  unit: string; // "ea", "gal", "sheet", "ft", "yd"
  store: ProductStore;
  rating: number; // 0-5
  reviewCount: number;
  source: ProductSource;
  fetchedAt: string; // ISO
  sku?: string;
  category?: string;
  coverage?: ProductCoverage;
  availabilityNote?: string;
}

export interface ClosestStore {
  id: string;
  name: string;
  address: string;
  driveMinutes: number;
  inTraffic: boolean;
  city?: string;
  state?: string;
  phone?: string;
}

export interface SpecialtySupplier {
  id: string;
  name: string;
  category: string;
  phone: string;
  email?: string;
  website?: string;
  distanceMiles: number;
  driveMinutes: number;
  hours?: string;
}

/**
 * Supplier — Pass E B2B specialty-supplier shape returned when the materials
 * search runs in `mode='supplier'`. Richer than SpecialtySupplier (which is the
 * inline-rail variant). Backend ships this from `mode=supplier` query in Pass E.
 *
 * Backward compat: SpecialtySupplier is retained for the existing
 * SupplierMatchesRail (rendered inline in tool-mode results).
 */
export interface Supplier {
  id: string;
  name: string;
  /** Primary category chip (e.g. "BUILDING SUPPLIES") */
  category: string;
  /** Secondary tags (e.g. ["LUMBER", "PRECAST"]) */
  tags?: string[];
  /** Display address (single line) */
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  distanceMiles: number;
  driveMinutes: number;
  /** 0-5 rating */
  rating?: number;
  reviewCount?: number;
  hours?: string;
  /** Ionicon hint for the left tile (default 'storefront-outline') */
  iconHint?: string;
}

export interface MaterialsFilter {
  key: string;
  label: string;
  options: { value: string; label: string; count: number }[];
}

export interface CompareSeller {
  sellerId: string;
  sellerName: string;
  price: number;
  delta: number; // vs HD baseline
  inStock: boolean;
  shippingDays?: number;
  url?: string;
}

export interface UseMaterialsSearchResult {
  query: string;
  setQuery: (q: string) => void;
  submitSearch: (explicitQuery?: string) => void;
  clearSearch: () => void;
  results: Product[] | null;
  closestStore: ClosestStore | null;
  specialtySuppliers: SpecialtySupplier[];
  /**
   * Pass E: primary result set when `mode === 'supplier'`. Backend wires this
   * via `mode=supplier` query param. Hook returns `null` until a supplier-mode
   * search has been submitted; `[]` means search returned zero hits.
   */
  suppliers: Supplier[] | null;
  filters: MaterialsFilter[];
  isLoading: boolean;
  isCachedOnlyMode: boolean;
  error: string | null;
  suggestedQueries: string[];
}

// ---------------------------------------------------------------------------
// Dev-mode mock fallback (only used when ?mock=1 or env var set)
// ---------------------------------------------------------------------------

const _FORCE_MOCK =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_FORCE_MOCK === '1') ||
  (typeof window !== 'undefined' &&
    typeof window.location !== 'undefined' &&
    window.location.search.includes('mock=1'));

const PLACEHOLDER_IMG = (seed: string): string =>
  `https://images.weserv.nl/?url=placehold.co/400x400/1a1a1f/fbbf24.png?text=${encodeURIComponent(seed)}`;

const MOCK_STORE: ClosestStore = {
  id: '0507',
  name: 'Home Depot - Austin North',
  address: '12506 N Mopac Expy, Austin, TX 78758',
  driveMinutes: 12,
  inTraffic: true,
  city: 'Austin',
  state: 'TX',
  phone: '(512) 832-1644',
};

const MOCK_PAINT: Product[] = [
  {
    id: 'hd-pp-marquee-5gal', title: 'Marquee 5-gal Matte Interior Paint & Primer',
    brand: 'Behr', imageUrl: PLACEHOLDER_IMG('Behr Marquee'), price: 218.0, unit: 'pail',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true, inTraffic: true },
    rating: 4.7, reviewCount: 1842, source: 'home_depot', fetchedAt: '', sku: '305832', category: 'paint',
  },
  {
    id: 'hd-pp-roller-3pk', title: '9-in Microfiber Roller Cover (3-pack)',
    brand: 'HDX', imageUrl: PLACEHOLDER_IMG('9in Roller 3pk'), price: 12.97, unit: 'pack',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.4, reviewCount: 308, source: 'home_depot', fetchedAt: '', sku: '301885', category: 'paint',
  },
];

function _resolveMock(q: string): { products: Product[]; specialty: SpecialtySupplier[] } {
  const lq = q.toLowerCase();
  if (!lq) return { products: [], specialty: [] };
  const now = new Date().toISOString();
  const stamp = (ps: Product[]) => ps.map((p) => ({ ...p, fetchedAt: now }));
  if (lq.includes('paint') || lq.includes('primer') || lq.includes('roller')) {
    return { products: stamp(MOCK_PAINT), specialty: [] };
  }
  return { products: stamp(MOCK_PAINT.slice(0, 2)), specialty: [] };
}

// ---------------------------------------------------------------------------
// Filter derivation (local — matches Pass B behaviour for mock mode)
// ---------------------------------------------------------------------------

function _deriveFilters(products: Product[]): MaterialsFilter[] {
  if (products.length === 0) return [];
  const brandCounts = new Map<string, number>();
  for (const p of products) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const brandOptions = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([brand, count]) => ({ value: brand, label: brand, count }));
  const inStockCount = products.filter((p) => p.store.inStock).length;
  return [
    { key: 'brand', label: 'Brand', options: brandOptions },
    { key: 'stock', label: 'Stock', options: [
      { value: 'in_stock', label: 'In stock', count: inStockCount },
      { value: 'all', label: 'All', count: products.length },
    ]},
  ];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const SUGGESTED_QUERIES = ['paint', 'drywall sheets', 'roofing materials', 'electrical tools'];

interface UseMaterialsSearchOptions {
  /** 'tool' (Home Depot retail, default) or 'supplier' (Yelp B2B). */
  mode?: 'tool' | 'supplier';
}

export function useMaterialsSearch(
  opts: UseMaterialsSearchOptions = {},
): UseMaterialsSearchResult {
  const { mode = 'tool' } = opts;
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const [specialtySuppliers, setSpecialtySuppliers] = useState<SpecialtySupplier[]>([]);
  const [filters, setFilters] = useState<MaterialsFilter[]>([]);
  const [isCachedOnlyMode, setIsCachedOnlyMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth + tenant context
  const { authenticatedFetch } = useAuthFetch();
  const { officeId } = useTenant();
  // Project address from Visuals tab — flows through to backend so the
  // search route can resolve closest HD store (Tool mode) or Yelp
  // `find_loc` (Supplier mode).
  const { address: projectAddress } = useProjectAddress();

  // Abort controller ref so we can cancel in-flight requests on new search
  const abortRef = useRef<AbortController | null>(null);

  const submitSearch = useCallback(
    async (explicitQuery?: string) => {
      const q = (explicitQuery ?? query).trim();
      if (!q) {
        setResults(null);
        setError(null);
        return;
      }

      // Cancel prior in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      // Dev-mode mock fallback
      if (_FORCE_MOCK) {
        setTimeout(() => {
          const { products: mockProducts, specialty } = _resolveMock(q);
          setResults(mockProducts);
          setSpecialtySuppliers(specialty);
          setFilters(_deriveFilters(mockProducts));
          setIsCachedOnlyMode(false);
          setIsLoading(false);
        }, 250);
        return;
      }

      // Real API call via Express proxy
      try {
        const resp = await searchMaterials(
          authenticatedFetch,
          {
            q,
            mode,
            address: projectAddress || undefined,
            officeId: officeId ?? '',
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;

        const mapped = mapServerResponse(resp);
        setResults(mapped.products);
        setSpecialtySuppliers(mapped.specialtySuppliers);
        setFilters(mapped.filters);
        setIsCachedOnlyMode(mapped.isCachedOnlyMode);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (err instanceof MaterialsApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Materials search failed');
        }
        setResults(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [query, authenticatedFetch, officeId, mode, projectAddress],
  );

  const clearSearch = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setQuery('');
    setResults(null);
    setError(null);
    setIsCachedOnlyMode(false);
  }, []);

  return {
    query,
    setQuery,
    submitSearch,
    clearSearch,
    results,
    closestStore: MOCK_STORE,
    specialtySuppliers,
    // Pass E: backend wiring (mode=supplier) is owned by the parallel
    // mcp-toolsmith agent. Until that ships, expose `null` so the UI knows
    // no supplier-mode search has been submitted yet.
    suppliers: null,
    filters,
    isLoading,
    isCachedOnlyMode,
    error,
    suggestedQueries: SUGGESTED_QUERIES,
  };
}

// ---------------------------------------------------------------------------
// Backward-compat mock helpers (consumed by ProductCompareDrawer, Pass B tests)
// ---------------------------------------------------------------------------

export function getMockCompareSellers(product: Product): CompareSeller[] {
  const base = product.price;
  return [
    { sellerId: 'home_depot', sellerName: 'Home Depot', price: base, delta: 0, inStock: true, shippingDays: 0 },
    { sellerId: 'lowes', sellerName: "Lowe's", price: +(base * 1.04).toFixed(2), delta: +(base * 0.04).toFixed(2), inStock: true, shippingDays: 2 },
    { sellerId: 'amazon', sellerName: 'Amazon Business', price: +(base * 0.97).toFixed(2), delta: +(base * -0.03).toFixed(2), inStock: true, shippingDays: 1 },
  ];
}

export function getPredictiveAddons(seedProduct: Product): Product[] {
  return _resolveMock(seedProduct.category ?? '').products
    .filter((p) => p.id !== seedProduct.id)
    .slice(0, 3);
}
