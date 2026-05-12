/**
 * Mock data for materials search tests — extracted from useMaterialsSearch.ts (Pass C).
 *
 * Pass B embedded mock data inline in the hook; Pass C moves it here so:
 *   1. The hook can import real API functions without test data in production.
 *   2. Jest tests can import this file for fixture-based assertions.
 *
 * Do NOT import this file in production code.
 */

import type {
  Product,
  ClosestStore,
  SpecialtySupplier,
} from '../hooks/useMaterialsSearch';

export const MOCK_CLOSEST_STORE: ClosestStore = {
  id: '0507',
  name: 'Home Depot - Austin North',
  address: '12506 N Mopac Expy, Austin, TX 78758',
  driveMinutes: 12,
  inTraffic: true,
  city: 'Austin',
  state: 'TX',
  phone: '(512) 832-1644',
};

const PLACEHOLDER_IMG = (seed: string): string =>
  `https://images.weserv.nl/?url=placehold.co/400x400/1a1a1f/fbbf24.png?text=${encodeURIComponent(seed)}`;

export const PAINT_PRODUCTS: Product[] = [
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
    fetchedAt: new Date().toISOString(),
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
    fetchedAt: new Date().toISOString(),
    sku: '648211',
    category: 'paint',
  },
];

export const DRYWALL_PRODUCTS: Product[] = [
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
    fetchedAt: new Date().toISOString(),
    sku: '100321',
    category: 'drywall',
  },
];

export const ROOFING_PRODUCTS: Product[] = [
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
    fetchedAt: new Date().toISOString(),
    sku: '703221',
    category: 'roofing',
  },
];

export const ELECTRICAL_PRODUCTS: Product[] = [
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
    fetchedAt: new Date().toISOString(),
    sku: '503112',
    category: 'electrical',
  },
];

export const SPECIALTY_SUPPLIERS: SpecialtySupplier[] = [
  {
    id: 'spec-paint-1',
    name: 'Austin Paint Supply',
    category: 'paint',
    phone: '(512) 444-1010',
    email: 'orders@austinpaintsupply.com',
    website: 'austinpaintsupply.com',
    distanceMiles: 4.2,
    driveMinutes: 9,
    hours: 'M-F 7a-6p - Sat 8a-4p',
  },
];

export const SUGGESTED_QUERIES: string[] = [
  'paint',
  'drywall sheets',
  'roofing materials',
  'electrical tools',
];
