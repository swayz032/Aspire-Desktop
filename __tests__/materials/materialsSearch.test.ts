/**
 * Unit tests for lib/api/materialsApi.ts + the refactored useMaterialsSearch hook.
 *
 * These tests run against mock data only (no network calls). The backend
 * integration is exercised separately by the Python test suite.
 *
 * Pass C contract: searchMaterials() returns mapped Product[] / SpecialtySupplier[]
 * from the BackendProduct[] / BackendSpecialtySupplier[] wire shape.
 */

import { mapServerResponse } from '../../lib/api/materialsApi';
import type { MaterialsSearchResponse } from '../../lib/api/materialsApi';
import {
  PAINT_PRODUCTS,
  MOCK_CLOSEST_STORE,
} from '../materialsSearch.mock';

const MOCK_BACKEND_RESPONSE: MaterialsSearchResponse = {
  success: true,
  products: [
    {
      title: 'Behr Marquee 5-gal Matte',
      brand: 'Behr',
      price: 218.0,
      unit: 'pail',
      rating: 4.7,
      reviews: 1842,
      sku: '305832',
      product_id: 'hd-305832',
      thumbnail: 'https://example.com/img.jpg',
      pickup: { in_stock: true, store_id: '0507', store_name: 'Austin N' },
      delivery: true,
    },
    {
      title: 'Canvas Drop Cloth 9x12',
      brand: 'Trimaco',
      price: 17.48,
      unit: 'ea',
      rating: 4.6,
      reviews: 1102,
      sku: '402117',
      product_id: 'hd-402117',
      thumbnail: null,
      pickup: { in_stock: true },
      delivery: null,
    },
  ],
  specialty_suppliers: [
    {
      id: 'spec-1',
      name: 'Austin Paint Supply',
      category: 'paint',
      phone: '(512) 444-1010',
      distance_miles: 4.2,
      drive_minutes: 9,
    },
  ],
  filters: {
    brands: [{ name: 'Behr', count: 1 }, { name: 'Trimaco', count: 1 }],
    stock: { in_stock_count: 2, total_count: 2 },
    price_buckets: [
      { label: 'Under $100', min: 0, max: 100, count: 1 },
      { label: '$100-$200', min: 100, max: 200, count: 0 },
      { label: 'Over $200', min: 200, max: null, count: 1 },
    ],
  },
  addon_suggestions: [
    { title: '9-in Roller Cover', category: 'paint', reason: 'recommended with paint' },
  ],
  is_cached_only_mode: false,
  from_cache: false,
  receipt_id: '00000000-0000-0000-0000-000000000001',
  query_normalized: 'behr marquee paint',
};

describe('mapServerResponse', () => {
  it('maps BackendProduct[] to Product[]', () => {
    const { products } = mapServerResponse(MOCK_BACKEND_RESPONSE);
    expect(products).toHaveLength(2);
    expect(products[0].brand).toBe('Behr');
    expect(products[0].price).toBe(218.0);
    expect(products[0].store.inStock).toBe(true);
    expect(products[0].store.name).toBe('Austin N');
    expect(products[0].source).toBe('home_depot');
  });

  it('maps BackendSpecialtySupplier[] to SpecialtySupplier[]', () => {
    const { specialtySuppliers } = mapServerResponse(MOCK_BACKEND_RESPONSE);
    expect(specialtySuppliers).toHaveLength(1);
    expect(specialtySuppliers[0].name).toBe('Austin Paint Supply');
    expect(specialtySuppliers[0].distanceMiles).toBe(4.2);
  });

  it('maps filters from BackendFilters to MaterialsFilter[]', () => {
    const { filters } = mapServerResponse(MOCK_BACKEND_RESPONSE);
    const brandFilter = filters.find((f) => f.key === 'brand');
    expect(brandFilter).toBeDefined();
    expect(brandFilter!.options).toHaveLength(2);
    const priceFilter = filters.find((f) => f.key === 'price');
    expect(priceFilter).toBeDefined();
    expect(priceFilter!.options).toHaveLength(3);
  });

  it('passes isCachedOnlyMode through correctly', () => {
    const cached: MaterialsSearchResponse = {
      ...MOCK_BACKEND_RESPONSE,
      is_cached_only_mode: true,
      products: [],
    };
    const { isCachedOnlyMode } = mapServerResponse(cached);
    expect(isCachedOnlyMode).toBe(true);
  });

  it('handles null thumbnail gracefully', () => {
    const { products } = mapServerResponse(MOCK_BACKEND_RESPONSE);
    // Second product has null thumbnail
    expect(products[1].imageUrl).toBe('');
  });

  it('mock data exports from materialsSearch.mock.ts are valid Product arrays', () => {
    // Ensures the mock migration from useMaterialsSearch.ts preserved shapes
    expect(PAINT_PRODUCTS[0].brand).toBe('Behr');
    expect(PAINT_PRODUCTS[0].fetchedAt).toBeTruthy();
    expect(MOCK_CLOSEST_STORE.driveMinutes).toBe(12);
  });
});
