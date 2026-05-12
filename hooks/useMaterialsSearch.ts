/**
 * useMaterialsSearch — Pass B (UI shell with mock data).
 *
 * Mock implementation. Same return shape Pass C will provide when wiring the
 * real `/v1/materials/search` endpoint. The component tree consumes this hook
 * untouched between Pass B and Pass C.
 *
 * Aspire Law compliance:
 *   - Law #7 (tools are hands): pure mock data; no provider calls in this pass.
 *   - Law #3 (fail closed): empty query → empty results, never fabricated rows.
 */
import { useCallback, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Domain types (locked at Pass B; Pass C MUST match this shape)
// ---------------------------------------------------------------------------

export type ProductSource = 'home_depot' | 'lowes' | 'amazon' | 'specialty' | 'google_shopping';

export interface ProductStore {
  id: string;
  name: string;
  driveMinutes: number;
  inStock: boolean;
  inTraffic?: boolean;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  imageUrl: string;
  price: number;
  unit: string; // "ea", "gal", "sheet", "ft", "yd"
  store: ProductStore;
  rating: number; // 0–5
  reviewCount: number;
  source: ProductSource;
  fetchedAt: string; // ISO
  sku?: string;
  category?: string;
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
  filters: MaterialsFilter[];
  isLoading: boolean;
  isCachedOnlyMode: boolean;
  error: string | null;
  suggestedQueries: string[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CLOSEST_STORE: ClosestStore = {
  id: '0507',
  name: 'Home Depot · Austin North',
  address: '12506 N Mopac Expy, Austin, TX 78758',
  driveMinutes: 12,
  inTraffic: true,
  city: 'Austin',
  state: 'TX',
  phone: '(512) 832-1644',
};

const PLACEHOLDER_IMG = (seed: string): string =>
  `https://images.weserv.nl/?url=placehold.co/400x400/1a1a1f/fbbf24.png?text=${encodeURIComponent(seed)}`;

const ISO_NOW = new Date().toISOString();

// Paint set ---------------------------------------------------------------
const PAINT_PRODUCTS: Product[] = [
  {
    id: 'hd-pp-marquee-5gal',
    title: 'Marquee 5-gal Matte Interior Paint & Primer',
    brand: 'Behr',
    imageUrl: PLACEHOLDER_IMG('Behr Marquee'),
    price: 218.0,
    unit: 'pail',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true, inTraffic: true },
    rating: 4.7,
    reviewCount: 1842,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '305832',
    category: 'paint',
  },
  {
    id: 'hd-pp-promar-1gal',
    title: 'ProMar 200 1-gal Eggshell',
    brand: 'Sherwin-Williams',
    imageUrl: PLACEHOLDER_IMG('ProMar 200'),
    price: 48.5,
    unit: 'gal',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.5,
    reviewCount: 612,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '648211',
    category: 'paint',
  },
  {
    id: 'hd-pp-roller-3pk',
    title: '9-in Microfiber Roller Cover (3-pack)',
    brand: 'HDX',
    imageUrl: PLACEHOLDER_IMG('9in Roller 3pk'),
    price: 12.97,
    unit: 'pack',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.4,
    reviewCount: 308,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '301885',
    category: 'paint',
  },
  {
    id: 'hd-pp-dropcloth',
    title: '9 ft x 12 ft Canvas Drop Cloth',
    brand: 'Trimaco',
    imageUrl: PLACEHOLDER_IMG('Drop Cloth'),
    price: 17.48,
    unit: 'ea',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.6,
    reviewCount: 1102,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '402117',
    category: 'paint',
  },
];

const DRYWALL_PRODUCTS: Product[] = [
  {
    id: 'hd-dw-12sheet',
    title: '1/2 in x 4 ft x 8 ft Standard Drywall Sheet',
    brand: 'USG Sheetrock',
    imageUrl: PLACEHOLDER_IMG('1/2 Drywall'),
    price: 13.98,
    unit: 'sheet',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true, inTraffic: true },
    rating: 4.6,
    reviewCount: 982,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '100321',
    category: 'drywall',
  },
  {
    id: 'hd-dw-mud-5gal',
    title: 'All-Purpose Joint Compound 4.5-gal',
    brand: 'USG Sheetrock',
    imageUrl: PLACEHOLDER_IMG('Joint Compound'),
    price: 17.62,
    unit: 'pail',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.7,
    reviewCount: 540,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '203116',
    category: 'drywall',
  },
  {
    id: 'hd-dw-tape',
    title: 'Drywall Paper Tape 500 ft',
    brand: 'FibaTape',
    imageUrl: PLACEHOLDER_IMG('Drywall Tape'),
    price: 6.97,
    unit: 'roll',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.5,
    reviewCount: 411,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '203099',
    category: 'drywall',
  },
  {
    id: 'hd-dw-corner',
    title: 'Metal Corner Bead 1 1/4 in x 8 ft',
    brand: 'ClarkDietrich',
    imageUrl: PLACEHOLDER_IMG('Corner Bead'),
    price: 2.18,
    unit: 'ea',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.4,
    reviewCount: 142,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '316218',
    category: 'drywall',
  },
];

const ROOFING_PRODUCTS: Product[] = [
  {
    id: 'hd-rf-shingle-tl',
    title: 'Timberline HDZ Charcoal Shingles (33.3 sq ft)',
    brand: 'GAF',
    imageUrl: PLACEHOLDER_IMG('Timberline HDZ'),
    price: 38.97,
    unit: 'bundle',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.8,
    reviewCount: 2104,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '703221',
    category: 'roofing',
  },
  {
    id: 'hd-rf-felt-30',
    title: '30 lb Roofing Felt 432 sq ft',
    brand: 'Owens Corning',
    imageUrl: PLACEHOLDER_IMG('30lb Felt'),
    price: 31.97,
    unit: 'roll',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.5,
    reviewCount: 318,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '702118',
    category: 'roofing',
  },
];

const ELECTRICAL_PRODUCTS: Product[] = [
  {
    id: 'hd-el-romex-250',
    title: '12/2 Romex NM-B Cable 250 ft',
    brand: 'Southwire',
    imageUrl: PLACEHOLDER_IMG('12/2 Romex'),
    price: 184.0,
    unit: 'roll',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true, inTraffic: true },
    rating: 4.7,
    reviewCount: 487,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '503112',
    category: 'electrical',
  },
  {
    id: 'hd-el-multi-tool',
    title: '11-in-1 Linesman Screwdriver',
    brand: 'Klein Tools',
    imageUrl: PLACEHOLDER_IMG('Klein 11-in-1'),
    price: 24.97,
    unit: 'ea',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.9,
    reviewCount: 3210,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '301804',
    category: 'tools',
  },
  {
    id: 'hd-el-outlet-tester',
    title: 'GFCI Outlet Tester',
    brand: 'Klein Tools',
    imageUrl: PLACEHOLDER_IMG('GFCI Tester'),
    price: 17.97,
    unit: 'ea',
    store: { id: '0507', name: 'Austin N', driveMinutes: 12, inStock: true },
    rating: 4.7,
    reviewCount: 1502,
    source: 'home_depot',
    fetchedAt: ISO_NOW,
    sku: '301921',
    category: 'electrical',
  },
];

// Specialty suppliers (used when HD has <3 results) ----------------------
const SPECIALTY_SUPPLIERS: SpecialtySupplier[] = [
  {
    id: 'spec-paint-1',
    name: 'Austin Paint Supply',
    category: 'paint',
    phone: '(512) 444-1010',
    email: 'orders@austinpaintsupply.com',
    website: 'austinpaintsupply.com',
    distanceMiles: 4.2,
    driveMinutes: 9,
    hours: 'M-F 7a–6p · Sat 8a–4p',
  },
  {
    id: 'spec-concrete-1',
    name: 'Lone Star Precast',
    category: 'concrete',
    phone: '(512) 555-2090',
    email: 'sales@lonestarprecast.com',
    website: 'lonestarprecast.com',
    distanceMiles: 8.7,
    driveMinutes: 18,
    hours: 'M-F 6a–4p',
  },
  {
    id: 'spec-electric-1',
    name: 'Capital Electric Supply',
    category: 'electrical',
    phone: '(512) 612-7700',
    website: 'capitalelectric.com',
    distanceMiles: 6.1,
    driveMinutes: 14,
    hours: 'M-F 7a–5:30p · Sat 8a–noon',
  },
];

const SUGGESTED_QUERIES: string[] = [
  'paint',
  'drywall sheets',
  'roofing materials',
  'electrical tools',
];

// ---------------------------------------------------------------------------
// Mock search resolver
// ---------------------------------------------------------------------------

interface MockSearchHit {
  products: Product[];
  specialty: SpecialtySupplier[];
}

function resolveMockSearch(rawQuery: string): MockSearchHit {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return { products: [], specialty: [] };

  // Specialty trigger — niche request returns thin HD + specialty suppliers
  if (q.includes('concrete') || q.includes('4000 psi') || q.includes('by yard')) {
    return {
      products: [],
      specialty: SPECIALTY_SUPPLIERS.filter((s) => s.category === 'concrete'),
    };
  }

  if (q.includes('paint') || q.includes('primer') || q.includes('roller') || q.includes('brush')) {
    return { products: PAINT_PRODUCTS, specialty: [] };
  }
  if (q.includes('drywall') || q.includes('sheetrock') || q.includes('joint')) {
    return { products: DRYWALL_PRODUCTS, specialty: [] };
  }
  if (q.includes('roof') || q.includes('shingle') || q.includes('felt')) {
    return { products: ROOFING_PRODUCTS, specialty: [] };
  }
  if (
    q.includes('electric') ||
    q.includes('wire') ||
    q.includes('romex') ||
    q.includes('outlet') ||
    q.includes('tool')
  ) {
    return { products: ELECTRICAL_PRODUCTS, specialty: [] };
  }

  // Fallback — mixed bag
  return {
    products: [
      ...PAINT_PRODUCTS.slice(0, 2),
      ...DRYWALL_PRODUCTS.slice(0, 2),
      ...ELECTRICAL_PRODUCTS.slice(0, 2),
    ],
    specialty: [],
  };
}

function deriveFilters(products: Product[]): MaterialsFilter[] {
  if (products.length === 0) return [];

  // Brand
  const brandCounts = new Map<string, number>();
  for (const p of products) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const brandOptions = Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([brand, count]) => ({ value: brand, label: brand, count }));

  // Stock
  const inStockCount = products.filter((p) => p.store.inStock).length;
  const stockOptions = [
    { value: 'in_stock', label: 'In stock', count: inStockCount },
    { value: 'all', label: 'All', count: products.length },
  ];

  // Price band — three bands
  const prices = products.map((p) => p.price).sort((a, b) => a - b);
  const low = prices[0] ?? 0;
  const high = prices[prices.length - 1] ?? 0;
  const mid = (low + high) / 2;
  const priceOptions = [
    { value: 'lo', label: `Under $${Math.round(mid)}`, count: products.filter((p) => p.price < mid).length },
    { value: 'hi', label: `Over $${Math.round(mid)}`, count: products.filter((p) => p.price >= mid).length },
  ];

  return [
    { key: 'brand', label: 'Brand', options: brandOptions },
    { key: 'stock', label: 'Stock', options: stockOptions },
    { key: 'price', label: 'Price', options: priceOptions },
  ];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMaterialsSearch(): UseMaterialsSearchResult {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submitSearch = useCallback(
    (explicitQuery?: string) => {
      const q = (explicitQuery ?? query).trim();
      if (q.length === 0) {
        setSubmitted(null);
        return;
      }
      setIsLoading(true);
      // Mock "network" cycle — 250ms feels alive, not instant-fake.
      setTimeout(() => {
        setSubmitted(q);
        setIsLoading(false);
      }, 250);
    },
    [query],
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    setSubmitted(null);
  }, []);

  const { products, specialty } = useMemo(() => {
    if (!submitted) return { products: null as Product[] | null, specialty: [] };
    const hit = resolveMockSearch(submitted);
    return { products: hit.products, specialty: hit.specialty };
  }, [submitted]);

  const filters = useMemo(() => deriveFilters(products ?? []), [products]);

  return {
    query,
    setQuery,
    submitSearch,
    clearSearch,
    results: products,
    closestStore: MOCK_CLOSEST_STORE,
    specialtySuppliers: specialty,
    filters,
    isLoading,
    isCachedOnlyMode: false,
    error: null,
    suggestedQueries: SUGGESTED_QUERIES,
  };
}

/** Mock compare sellers — used by ProductCompareDrawer in Pass B. */
export function getMockCompareSellers(product: Product): CompareSeller[] {
  const base = product.price;
  return [
    {
      sellerId: 'home_depot',
      sellerName: 'Home Depot',
      price: base,
      delta: 0,
      inStock: true,
      shippingDays: 0,
    },
    {
      sellerId: 'lowes',
      sellerName: "Lowe's",
      price: +(base * 1.04).toFixed(2),
      delta: +(base * 0.04).toFixed(2),
      inStock: true,
      shippingDays: 2,
    },
    {
      sellerId: 'amazon',
      sellerName: 'Amazon Business',
      price: +(base * 0.97).toFixed(2),
      delta: +(base * -0.03).toFixed(2),
      inStock: true,
      shippingDays: 1,
    },
  ];
}

/** Mock predictive add-ons — Pass D will replace with real predictions. */
export function getPredictiveAddons(seedProduct: Product): Product[] {
  if (seedProduct.category === 'paint') {
    return PAINT_PRODUCTS.filter((p) => p.id !== seedProduct.id).slice(0, 3);
  }
  if (seedProduct.category === 'drywall') {
    return DRYWALL_PRODUCTS.filter((p) => p.id !== seedProduct.id).slice(0, 3);
  }
  if (seedProduct.category === 'roofing') {
    return ROOFING_PRODUCTS.filter((p) => p.id !== seedProduct.id).slice(0, 3);
  }
  if (seedProduct.category === 'electrical' || seedProduct.category === 'tools') {
    return ELECTRICAL_PRODUCTS.filter((p) => p.id !== seedProduct.id).slice(0, 3);
  }
  return [];
}
