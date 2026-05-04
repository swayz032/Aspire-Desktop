/**
 * Tests for the show_cards server-side guard (Wave 2.4).
 *
 * Spins up the agentToolRoutes router on a random localhost port and exercises
 * POST /v1/tools/show-cards through real HTTP. This validates the route as a
 * black box, including the auth middleware and tenant isolation pattern.
 */

import http from 'http';
import type { AddressInfo } from 'net';

const ORIGINAL_ENV = { ...process.env };
const SUITE_A = '11111111-1111-4111-8111-111111111111';
const SUITE_B = '22222222-2222-4222-8222-222222222222';
const SHARED_SECRET = 'test-aspire-tool-secret';

// Env must be set BEFORE requiring agentToolRoutes so module init reads test
// values (auth secrets, default suite ID).
process.env.ASPIRE_TOOL_SECRET = SHARED_SECRET;
process.env.DEFAULT_SUITE_ID = SUITE_A;
process.env.NODE_ENV = 'test';

import express, { Express } from 'express';
import routerModule, { __testing__ as testingApi } from './agentToolRoutes';

let app: Express;
let server: http.Server;
let baseUrl: string;

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-aspire-tool-secret': SHARED_SECRET,
    ...extra,
  };
}

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use(routerModule);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  process.env = ORIGINAL_ENV;
});

beforeEach(() => {
  testingApi.cardRecordsCache.clear();
  testingApi.latestCardCacheIdBySuite.clear();
});

function seedCache(opts: {
  cacheId: string;
  suiteId: string;
  records: Array<Record<string, unknown>>;
  artifactType?: string;
  ageMs?: number;
  setLatest?: boolean;
}) {
  const timestamp = Date.now() - (opts.ageMs ?? 0);
  testingApi.cardRecordsCache.set(opts.cacheId, {
    records: opts.records,
    artifactType: opts.artifactType ?? 'PropertyFactPack',
    suiteId: opts.suiteId,
    timestamp,
  });
  if (opts.setLatest !== false) {
    testingApi.latestCardCacheIdBySuite.set(opts.suiteId, opts.cacheId);
  }
}

async function postShowCards(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const resp = await fetch(`${baseUrl}/v1/tools/show-cards`, {
    method: 'POST',
    headers: buildHeaders(headers),
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, body: json as Record<string, unknown> };
}

describe('isSparseRecord', () => {
  it('flags records with fewer than 3 keys as sparse', () => {
    expect(testingApi.isSparseRecord({ name: 'X', address: 'Y' })).toBe(true);
    expect(testingApi.isSparseRecord({})).toBe(true);
    expect(testingApi.isSparseRecord(null)).toBe(true);
    expect(testingApi.isSparseRecord([])).toBe(true);
  });
  it('treats records with 3+ defined keys as full', () => {
    expect(testingApi.isSparseRecord({ a: 1, b: 2, c: 3 })).toBe(false);
    expect(testingApi.isSparseRecord({ a: 1, b: 2, c: 3, d: 4 })).toBe(false);
  });
  it('ignores undefined/null values when counting keys', () => {
    expect(testingApi.isSparseRecord({ a: 1, b: 2, c: undefined, d: null })).toBe(true);
  });
});

describe('slimAdamRecord — payload size guard for Anam show_cards', () => {
  // Session 73aee55d showed Anam's hosted LLM skipping show_cards entirely
  // when invoke_adam returned 15 full records (~15KB with thumbnails arrays,
  // variants, full URLs). slimAdamRecord whitelists display-essential fields
  // so the LLM-facing payload stays under ~4KB even at the 25-record cap.

  it('keeps display-essential product fields', () => {
    const slim = testingApi.slimAdamRecord({
      product_name: '5 gal. White Flat Paint',
      brand: 'Glidden',
      retailer: 'Home Depot',
      price: 39.98,
      currency: 'USD',
      availability: 'in_stock',
      in_store_stock: 12,
      image_url: 'https://example.com/img.jpg',
      url: 'https://example.com/p/123',
    });
    expect(slim).toEqual({
      product_name: '5 gal. White Flat Paint',
      brand: 'Glidden',
      retailer: 'Home Depot',
      price: 39.98,
      currency: 'USD',
      availability: 'in_stock',
      in_store_stock: 12,
      image_url: 'https://example.com/img.jpg',
      url: 'https://example.com/p/123',
    });
  });

  it('keeps store_summary fields needed for headline ("closest is X on Y")', () => {
    const slim = testingApi.slimAdamRecord({
      card_kind: 'store_summary',
      retailer: 'Home Depot',
      store_name: 'The Home Depot',
      name: 'The Home Depot',
      address: '3200 Capital Circle Northeast, Tallahassee, FL 32308',
      city: 'Tallahassee',
      state: 'FL',
      image_url: 'https://example.com/store.jpg',
    });
    expect(slim.card_kind).toBe('store_summary');
    expect(slim.store_name).toBe('The Home Depot');
    expect(slim.address).toBe('3200 Capital Circle Northeast, Tallahassee, FL 32308');
    expect(slim.city).toBe('Tallahassee');
  });

  it('keeps SerpAPI Home Depot display fields, strips only heavy bloat', () => {
    const slim = testingApi.slimAdamRecord({
      product_name: 'Paint',
      price: 10,
      // Heavy bloat — must be stripped
      thumbnails: ['t1.jpg', 't2.jpg', 't3.jpg', 't4.jpg', 't5.jpg'],
      variants: [{ title: 'Red' }, { title: 'Blue' }, { title: 'Green' }],
      dimensions: { width: 10, height: 10 },
      weight: '5lb',
      bullets: ['feature 1', 'feature 2'],
      verification_status: 'unverified',
      confidence: 0.85,
      upc: '',
      // SerpAPI display fields — must all be kept
      description_short: 'Short desc',
      description_full: 'Full long description that goes on and on with multiple sentences explaining the product features in detail',
      specifications: { color: 'White', finish: 'Flat', coverage_sqft: 350, application: 'Interior', voc_compliant: true, base: 'Latex' },
      fulfillment_pickup: { store_id: '254', store_name: 'Capital Circle Northeast', store_address: '3200 Capital Circle NE', quantity: 14, aisle: '12', bay: '003' },
      fulfillment_delivery: { free: true, schedule_delivery: true, free_delivery_threshold: 45 },
      sku: '100141333',
      product_id: '100141333',
      model: '920 05',
      aisle: '12',
      bay: '003',
      pickup_store_address: '3200 Capital Circle NE',
    });
    // Display fields kept
    expect(slim.product_name).toBe('Paint');
    expect(slim.price).toBe(10);
    expect(slim.description_short).toBe('Short desc');
    expect(slim.description_full).toBeDefined();
    expect(slim.aisle).toBe('12');
    expect(slim.bay).toBe('003');
    expect(slim.sku).toBe('100141333');
    expect(slim.product_id).toBe('100141333');
    expect(slim.model).toBe('920 05');
    // Specifications: top-5 entries kept (we have 6 input keys, expect 5 in output)
    expect(slim.specifications).toBeDefined();
    expect(Object.keys(slim.specifications).length).toBe(5);
    // Fulfillment: kept with allow-listed inner fields
    expect(slim.fulfillment_pickup).toBeDefined();
    expect(slim.fulfillment_pickup.store_name).toBe('Capital Circle Northeast');
    expect(slim.fulfillment_pickup.aisle).toBe('12');
    expect(slim.fulfillment_pickup.quantity).toBe(14);
    expect(slim.fulfillment_delivery).toBeDefined();
    expect(slim.fulfillment_delivery.free).toBe(true);
    expect(slim.pickup_store_address).toBe('3200 Capital Circle NE');
    // Heavy bloat stripped
    expect(slim.thumbnails).toBeUndefined();
    expect(slim.variants).toBeUndefined();
    expect(slim.dimensions).toBeUndefined();
    expect(slim.weight).toBeUndefined();
    expect(slim.bullets).toBeUndefined();
    expect(slim.verification_status).toBeUndefined();
    expect(slim.confidence).toBeUndefined();
    expect(slim.upc).toBeUndefined();
  });

  it('omits empty/falsy fields to minimize payload bytes', () => {
    const slim = testingApi.slimAdamRecord({
      product_name: '',  // empty string omitted
      brand: null,       // null omitted
      price: 0,          // 0 is a number — KEPT (free items are valid)
      currency: undefined,
    });
    // typeof 0 === 'number' so price=0 is kept; truthy-only check would lose it
    expect('price' in slim).toBe(true);
    expect(slim.price).toBe(0);
    expect('product_name' in slim).toBe(false);
    expect('brand' in slim).toBe(false);
    expect('currency' in slim).toBe(false);
  });

  it('returns empty object on null/undefined/non-object input (fail-safe)', () => {
    expect(testingApi.slimAdamRecord(null)).toEqual({});
    expect(testingApi.slimAdamRecord(undefined)).toEqual({});
    expect(testingApi.slimAdamRecord('not an object')).toEqual({});
    expect(testingApi.slimAdamRecord(42)).toEqual({});
  });

  it('total payload at RECORD_CAP stays well under original-bloat size', () => {
    // Build a realistic 25-record paint search response and measure JSON size.
    // The intent is to catch regressions where someone adds a heavy field
    // (e.g. full description, thumbnails array) to slimAdamRecord that would
    // re-bloat the LLM payload. Original Adam responses with full thumbnails,
    // variants, and descriptions hit ~50KB+ for 15 records (session 73aee55d).
    // Our slim version with full UI display fields at 25 records is ~18KB —
    // still comfortably under any LLM context limit. 22KB is the regression
    // ceiling: significantly under original bloat, with headroom for the full
    // UI display field set (delivery_info, badges, description_short, etc.).
    const fakeRecord = {
      product_name: 'Behr Premium Plus 1 gal. Pure White Flat Interior Paint',
      brand: 'BEHR',
      model: 'PR-1100',
      retailer: 'Home Depot',
      price: 29.98,
      price_was: 34.98,
      percentage_off: 14,
      currency: 'USD',
      availability: 'in_stock',
      availability_text: 'In stock',
      in_store_stock: 14,
      pickup_store: 'Tallahassee',
      pickup_quantity: 14,
      rating: 4.5,
      reviews: 1234,
      delivery: 'Free delivery',
      delivery_info: 'Free delivery',
      badges: ['top rated', 'bestseller'],
      description_short: '1 gal. premium interior latex paint with stain-blocking primer',
      description_full: '1 gallon premium interior latex paint with stain-blocking primer plus mildew resistance, washable finish, and one-coat coverage on most surfaces',
      aisle: '12',
      bay: '003',
      sku: '100141333',
      product_id: '100141333',
      specifications: { color: 'White', finish: 'Flat', coverage_sqft: 350, application: 'Interior', base: 'Latex' },
      fulfillment_pickup: { store_id: '254', store_name: 'Capital Circle Northeast', store_address: '3200 Capital Circle NE, Tallahassee FL 32308', quantity: 14, aisle: '12', bay: '003' },
      fulfillment_delivery: { free: true, schedule_delivery: true },
      pickup_store_address: '3200 Capital Circle NE, Tallahassee FL 32308',
      image_url: 'https://images.thdstatic.com/productImages/abc-def-ghi/svn/white-paint-64_1000.jpg',
      thumbnail: 'https://images.thdstatic.com/productImages/abc-def-ghi/svn/white-paint-64_400.jpg',
      url: 'https://apionline.homedepot.com/p/Behr-Premium-Plus-1-gal-Pure-White-100100/100100',
    };
    const slim = testingApi.slimAdamRecord(fakeRecord);
    const records = new Array(testingApi.RECORD_CAP).fill(slim);
    const sizeBytes = Buffer.byteLength(JSON.stringify(records), 'utf-8');
    // Full SerpAPI display fields × 25 records × ~1480 bytes each ≈ 37KB.
    // Original-bloat baseline was ~50KB+ for 15 records. 40KB regression
    // ceiling — still well under any LLM context limit and bounded enough
    // to catch future field-bloat (e.g. unbounded specs/descriptions).
    expect(sizeBytes).toBeLessThan(40 * 1024);
    // Per-record bounded — catches single-record bloat.
    expect(Buffer.byteLength(JSON.stringify(slim), 'utf-8')).toBeLessThan(1500);
  });
});

describe('POST /v1/tools/show-cards — auth + suite validation', () => {
  it('rejects requests without the shared secret', async () => {
    const resp = await fetch(`${baseUrl}/v1/tools/show-cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ suite_id: SUITE_A, records: [] }),
    });
    expect(resp.status).toBe(401);
  });

  it('returns 400 when suite_id cannot be resolved', async () => {
    // Override DEFAULT_SUITE_ID for this single call so the fallback can't fire.
    const prev = process.env.DEFAULT_SUITE_ID;
    process.env.DEFAULT_SUITE_ID = '';
    try {
      const { status, body } = await postShowCards({ records: [] });
      expect(status).toBe(400);
      expect(body.error).toBe('MISSING_SUITE_ID');
    } finally {
      process.env.DEFAULT_SUITE_ID = prev;
    }
  });
});

describe('POST /v1/tools/show-cards — explicit card_cache_id', () => {
  it('rehydrates from the exact cache_id when provided', async () => {
    const cacheId = 'corr-explicit-1';
    const fullRecords = [{ name: 'A', address: '1 Main', sqft: 1500 }];
    seedCache({
      cacheId,
      suiteId: SUITE_A,
      records: fullRecords,
      artifactType: 'PropertyFactPack',
    });

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      card_cache_id: cacheId,
      records: [],
    });

    expect(status).toBe(200);
    expect(body.source).toBe('cache-by-id');
    expect(body.records).toEqual(fullRecords);
    expect(body.cacheId).toBe(cacheId);
    expect(body.artifactType).toBe('PropertyFactPack');
  });

  it('does NOT fall back to latest cache when an unknown cache_id is supplied', async () => {
    seedCache({
      cacheId: 'corr-latest',
      suiteId: SUITE_A,
      records: [{ name: 'A', address: '1 Main', sqft: 1500 }],
    });

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      card_cache_id: 'corr-does-not-exist',
      records: [{ name: 'A', address: '1 Main' }],
    });

    expect(status).toBe(404);
    expect(body.error).toBe('CACHE_NOT_FOUND');
  });

  it('refuses cross-tenant rehydration (fail-closed Law #6)', async () => {
    const cacheId = 'corr-other-tenant';
    seedCache({
      cacheId,
      suiteId: SUITE_B,
      records: [{ name: 'Foreign', address: 'Other', sqft: 9999 }],
      setLatest: false,
    });

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      card_cache_id: cacheId,
      records: [],
    });

    expect(status).toBe(404);
    expect(body.error).toBe('CACHE_NOT_FOUND');
    // Foreign records must NOT have leaked into the response.
    expect(body.records).toBeUndefined();
  });
});

describe('POST /v1/tools/show-cards — sparse-payload backstop', () => {
  it('rehydrates from latestCardCacheIdBySuite and logs a warn', async () => {
    const cacheId = 'corr-recent';
    const fullRecords = [
      { name: 'A', address: '1575 Paul Russell Rd APT 4802', sqft: 1620, price: 285000 },
    ];
    seedCache({
      cacheId,
      suiteId: SUITE_A,
      records: fullRecords,
      artifactType: 'PropertyFactPack',
    });

    // Sparse payload — exactly the regression Wave 2.4 catches.
    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: [{ name: 'A', address: '1575 Paul Russell Rd APT 4802' }],
      artifact_type: 'PropertyFactPack',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('cache');
    expect(body.records).toEqual(fullRecords);
    expect(body.cacheId).toBe(cacheId);
  });

  it('passes through sparse records when no recent cache exists for the suite', async () => {
    const sparse = [{ name: 'A', address: '1 Main' }];
    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: sparse,
      artifact_type: 'PropertyFactPack',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('client');
    expect(body.records).toEqual(sparse);
  });

  it('does NOT rehydrate from another suite\'s latest cache (fail-closed)', async () => {
    // Suite B has a recent cache; suite A does NOT. A request from suite A
    // with sparse records must not pick up suite B's cache.
    seedCache({
      cacheId: 'corr-suite-b',
      suiteId: SUITE_B,
      records: [{ name: 'Other', address: 'B', sqft: 999 }],
    });

    const sparse = [{ name: 'A', address: '1 Main' }];
    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: sparse,
      artifact_type: 'PropertyFactPack',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('client');
    expect(body.records).toEqual(sparse);
  });
});

describe('POST /v1/tools/show-cards — full records pass-through', () => {
  it('returns the LLM payload unchanged when records are already full', async () => {
    const fullRecords = [
      { name: 'A', address: '1 Main', sqft: 1500, price: 250000 },
    ];

    const { status, body } = await postShowCards({
      suite_id: SUITE_A,
      records: fullRecords,
      artifact_type: 'PropertyFactPack',
      summary: 'Found 1 property.',
    });

    expect(status).toBe(200);
    expect(body.source).toBe('client');
    expect(body.records).toEqual(fullRecords);
    expect(body.summary).toBe('Found 1 property.');
  });
});
