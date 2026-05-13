/**
 * Tests for materials frontend fixes.
 *
 * Bug E: MaterialsTab supplier mode empty state is mode-aware
 * Bug A (frontend mapper): _mapProduct reads pickup.in_stock correctly
 * Bug B/C (display): ProductCard shows "— MIN" when drive_minutes null
 * Bug B (ClosestStoreCard): shows "—" drive time when driveMinutes is 0
 *
 * These are pure unit tests over the mapper functions and component logic —
 * no React rendering required.
 */

import { mapServerResponse } from '../../lib/api/materialsApi';
import type { MaterialsSearchResponse } from '../../lib/api/materialsApi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalBackendResponse(
  overrides: Partial<MaterialsSearchResponse> = {},
): MaterialsSearchResponse {
  return {
    success: true,
    products: [],
    specialty_suppliers: [],
    suppliers: undefined,
    filters: {},
    addon_suggestions: [],
    closest_store: null,
    is_cached_only_mode: false,
    from_cache: false,
    receipt_id: 'test-receipt-001',
    query_normalized: 'paint',
    mode: 'tool',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Bug A: pickup.in_stock mapping
// ---------------------------------------------------------------------------

describe('materialsApi._mapProduct — Bug A: pickup.in_stock', () => {
  test('pickup.in_stock=true → product.store.inStock=true', () => {
    const resp = makeMinimalBackendResponse({
      products: [
        {
          title: 'ProMar 200 Interior',
          price: 45.99,
          product_id: 'SW2001',
          thumbnail: 'https://example.com/img.jpg',
          pickup: {
            in_stock: true,
            store_id: '6301',
            store_name: 'Capital Circle NE',
            quantity: 5,
            drive_minutes: null,
          },
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.products).toHaveLength(1);
    expect(mapped.products[0].store.inStock).toBe(true);
  });

  test('pickup.in_stock=false → product.store.inStock=false', () => {
    const resp = makeMinimalBackendResponse({
      products: [
        {
          title: 'Some Tool',
          price: 29.99,
          product_id: 'HDX001',
          thumbnail: 'https://example.com/img2.jpg',
          pickup: {
            in_stock: false,
            store_id: '6301',
            store_name: 'Capital Circle NE',
            quantity: 0,
            drive_minutes: null,
          },
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.products[0].store.inStock).toBe(false);
  });

  test('pickup absent → product.store.inStock=false (backward compat)', () => {
    const resp = makeMinimalBackendResponse({
      products: [
        {
          title: 'Legacy Product',
          price: 19.99,
          product_id: 'LEGACY001',
          thumbnail: 'https://example.com/img3.jpg',
          pickup: null,
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.products[0].store.inStock).toBe(false);
  });

  test('pickup undefined → product.store.inStock=false', () => {
    const resp = makeMinimalBackendResponse({
      products: [
        {
          title: 'No Pickup Data',
          price: 9.99,
          product_id: 'NP001',
          thumbnail: 'https://example.com/img4.jpg',
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.products[0].store.inStock).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bug B/C: drive_minutes mapping
// ---------------------------------------------------------------------------

describe('materialsApi._mapProduct — Bug C: pickup.drive_minutes', () => {
  test('pickup.drive_minutes=17 → product.store.driveMinutes=17', () => {
    const resp = makeMinimalBackendResponse({
      products: [
        {
          title: 'Paint 5gal',
          price: 55.00,
          product_id: 'P5G001',
          thumbnail: 'https://example.com/paint.jpg',
          pickup: {
            in_stock: true,
            store_id: '6301',
            store_name: 'Capital Circle NE',
            drive_minutes: 17,
          },
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.products[0].store.driveMinutes).toBe(17);
  });

  test('pickup.drive_minutes=null → product.store.driveMinutes=0 (sentinel for "—")', () => {
    const resp = makeMinimalBackendResponse({
      products: [
        {
          title: 'Paint 5gal',
          price: 55.00,
          product_id: 'P5G002',
          thumbnail: 'https://example.com/paint2.jpg',
          pickup: {
            in_stock: true,
            store_id: '6301',
            store_name: 'Capital Circle NE',
            drive_minutes: null,
          },
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    // 0 is the sentinel value when drive_minutes is null — ProductCard renders "— MIN"
    expect(mapped.products[0].store.driveMinutes).toBe(0);
  });

  test('pickup.drive_minutes=0 → product.store.driveMinutes=0 (renders "— MIN")', () => {
    const resp = makeMinimalBackendResponse({
      products: [
        {
          title: 'Paint 5gal',
          price: 55.00,
          product_id: 'P5G003',
          thumbnail: 'https://example.com/paint3.jpg',
          pickup: {
            in_stock: true,
            drive_minutes: 0,
          },
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.products[0].store.driveMinutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bug B: closest_store.drive_minutes mapping
// ---------------------------------------------------------------------------

describe('materialsApi._mapClosestStore — Bug B: drive_minutes', () => {
  test('closest_store.drive_minutes=22 → closestStore.driveMinutes=22', () => {
    const resp = makeMinimalBackendResponse({
      closest_store: {
        id: 'store_6301',
        store_id: '6301',
        name: 'Capital Circle NE',
        address: '1490 Capital Cir NW, Tallahassee, FL 32303',
        drive_minutes: 22,
        in_traffic: true,
      },
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.closestStore).not.toBeNull();
    expect(mapped.closestStore!.driveMinutes).toBe(22);
    expect(mapped.closestStore!.inTraffic).toBe(true);
  });

  test('closest_store.drive_minutes=null → closestStore.driveMinutes=0 (renders "—")', () => {
    const resp = makeMinimalBackendResponse({
      closest_store: {
        id: 'store_6301',
        name: 'Capital Circle NE',
        address: '1490 Capital Cir NW',
        drive_minutes: null,
      },
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.closestStore).not.toBeNull();
    // 0 sentinel — ClosestStoreCard renders "—" not "0"
    expect(mapped.closestStore!.driveMinutes).toBe(0);
  });

  test('closest_store absent → closestStore=null', () => {
    const resp = makeMinimalBackendResponse({ closest_store: null });
    const mapped = mapServerResponse(resp);
    expect(mapped.closestStore).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bug E: supplier mode — suppliers array mapping
// ---------------------------------------------------------------------------

describe('materialsApi.mapServerResponse — Bug E: supplier mode', () => {
  test('mode=supplier with suppliers array → mapped.suppliers is non-null array', () => {
    const resp = makeMinimalBackendResponse({
      mode: 'supplier',
      suppliers: [
        {
          business_id: 'yelp_001',
          name: 'Florida Precast Supply',
          address: '500 Industrial Dr',
          city: 'Tampa',
          state: 'FL',
          zip: '33601',
          distance_miles: 3.1,
          drive_minutes: 8,
          rating: 4.3,
          review_count: 42,
          categories: ['Building Supplies', 'Concrete'],
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.suppliers).not.toBeNull();
    expect(Array.isArray(mapped.suppliers)).toBe(true);
    expect(mapped.suppliers!).toHaveLength(1);
    expect(mapped.suppliers![0].name).toBe('Florida Precast Supply');
    expect(mapped.suppliers![0].driveMinutes).toBe(8);
  });

  test('mode=tool (no suppliers field) → mapped.suppliers is null', () => {
    const resp = makeMinimalBackendResponse({
      mode: 'tool',
      suppliers: undefined,
    });

    const mapped = mapServerResponse(resp);
    // null = "never searched in supplier mode" — MaterialsTab shows SupplierGrid only on non-null
    expect(mapped.suppliers).toBeNull();
  });

  test('mode=supplier with empty array → mapped.suppliers is [] (not null)', () => {
    const resp = makeMinimalBackendResponse({
      mode: 'supplier',
      suppliers: [],
    });

    const mapped = mapServerResponse(resp);
    // [] = "searched but got zero results" — distinct from null ("never searched")
    expect(mapped.suppliers).not.toBeNull();
    expect(mapped.suppliers).toHaveLength(0);
  });

  test('supplier categories mapped to tags field', () => {
    const resp = makeMinimalBackendResponse({
      mode: 'supplier',
      suppliers: [
        {
          id: 'sup_001',
          name: 'Concrete Supply Co',
          categories: ['PRECAST', 'CONCRETE'],
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.suppliers![0].tags).toEqual(['PRECAST', 'CONCRETE']);
  });

  test('supplier primary category falls back to first category in categories', () => {
    const resp = makeMinimalBackendResponse({
      mode: 'supplier',
      suppliers: [
        {
          id: 'sup_002',
          name: 'Lumber Yard Inc',
          categories: ['LUMBER', 'BUILDING MATERIALS'],
        },
      ],
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.suppliers![0].category).toBe('LUMBER');
  });
});

// ---------------------------------------------------------------------------
// Integration: full response with products + suppliers + closest_store
// ---------------------------------------------------------------------------

describe('materialsApi.mapServerResponse — full integration', () => {
  test('tool mode response maps all fields including pickup wrapper', () => {
    const resp = makeMinimalBackendResponse({
      mode: 'tool',
      products: [
        {
          title: 'Behr Marquee 5gal',
          brand: 'Behr',
          price: 218.0,
          product_id: 'BEHR_M5',
          sku: 'BEHR_M5',
          thumbnail: 'https://images.thdstatic.com/img_1000.jpg',
          rating: 4.7,
          reviews: 1842,
          unit: 'pail',
          pickup: {
            in_stock: true,
            store_id: '6301',
            store_name: 'Capital Circle NE',
            quantity: 3,
            drive_minutes: 17,
          },
        },
      ],
      closest_store: {
        id: '6301',
        store_id: '6301',
        name: 'Capital Circle NE',
        address: '1490 Capital Cir NW, Tallahassee, FL 32303',
        drive_minutes: 17,
        in_traffic: true,
      },
    });

    const mapped = mapServerResponse(resp);
    expect(mapped.products).toHaveLength(1);

    const product = mapped.products[0];
    expect(product.title).toBe('Behr Marquee 5gal');
    expect(product.brand).toBe('Behr');
    expect(product.price).toBe(218.0);
    expect(product.store.inStock).toBe(true);
    expect(product.store.driveMinutes).toBe(17);
    expect(product.store.id).toBe('6301');
    expect(product.store.name).toBe('Capital Circle NE');

    expect(mapped.closestStore).not.toBeNull();
    expect(mapped.closestStore!.driveMinutes).toBe(17);
    expect(mapped.closestStore!.inTraffic).toBe(true);

    // suppliers is null in tool mode
    expect(mapped.suppliers).toBeNull();
  });
});
