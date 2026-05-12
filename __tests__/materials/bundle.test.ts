/**
 * Unit + contract tests for lib/api/materialBundlesApi.ts — Pass D.
 *
 * These tests run against mocked fetch — no network calls.
 * Backend integration is exercised separately by the Python test suite.
 *
 * Covers:
 *   API-01: fetchBundle maps snake_case wire response to camelCase BundleResult
 *   API-02: addToBundle sends correct payload + maps response
 *   API-03: addToBundle same product twice → idempotencyKey carried in body
 *   API-04: removeFromBundle sends bundle_item_id
 *   API-05: updateBundleQuantity sends quantity
 *   API-06: clearBundle sends project_id + maps empty response
 *   API-07: pushToEstimate maps to { estimateDraftId, ... }
 *   ERR-01: fetchBundle non-2xx throws MaterialsBundleApiError
 *   ERR-02: pushToEstimate 400 BUNDLE_EMPTY throws with correct code
 *   ISOLATION-01: addToBundle includes storeId from product.store.id
 */

import {
  fetchBundle,
  addToBundle,
  removeFromBundle,
  updateBundleQuantity,
  clearBundle,
  pushToEstimate,
  MaterialsBundleApiError,
} from '../../lib/api/materialBundlesApi';
import type { BundleListResponse, PushToEstimateResponse } from '../../lib/api/materialBundlesApi';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PRODUCT = {
  id: 'hd-305832',
  title: 'Behr Marquee 5-gal Matte',
  brand: 'Behr',
  imageUrl: 'https://example.com/img.jpg',
  price: 218.0,
  unit: 'pail',
  store: { id: 'hd-0507', name: 'Home Depot Austin N', driveMinutes: 12, inStock: true },
  rating: 4.7,
  reviewCount: 1842,
  source: 'home_depot' as const,
  fetchedAt: '2026-05-12T00:00:00.000Z',
  sku: '305832',
  category: 'paint',
};

function _wireItem(overrides?: Partial<{
  id: string;
  quantity: number;
  pushed: boolean;
}>) {
  return {
    id: overrides?.id ?? 'row-uuid-1234',
    project_id: '123-main-st-austin-tx',
    product: {
      id: MOCK_PRODUCT.id,
      title: MOCK_PRODUCT.title,
      brand: MOCK_PRODUCT.brand,
      price: MOCK_PRODUCT.price,
      unit: MOCK_PRODUCT.unit,
      sku: MOCK_PRODUCT.sku,
      imageUrl: MOCK_PRODUCT.imageUrl,
      store: MOCK_PRODUCT.store,
      rating: MOCK_PRODUCT.rating,
      reviewCount: MOCK_PRODUCT.reviewCount,
      source: MOCK_PRODUCT.source,
      fetchedAt: MOCK_PRODUCT.fetchedAt,
      fetched_at: MOCK_PRODUCT.fetchedAt,
    },
    store_id: 'hd-0507',
    category_hint: 'paint',
    quantity: overrides?.quantity ?? 1,
    unit_price: 218.0,
    fetched_at: '2026-05-12T00:00:00.000Z',
    pushed_to_estimate: overrides?.pushed ?? false,
    estimate_draft_id: null,
    created_at: '2026-05-12T00:00:00.000Z',
  };
}

function _listResp(items: ReturnType<typeof _wireItem>[]): BundleListResponse {
  return {
    success: true,
    items,
    bundle_subtotal: items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
    bundle_supplier_count: 1,
    receipt_id: 'receipt-uuid-abc',
  };
}

function _mockFetch(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

const PROJECT = '123-main-st-austin-tx';

// ---------------------------------------------------------------------------
// API-01: fetchBundle maps wire response to BundleResult
// ---------------------------------------------------------------------------

describe('fetchBundle', () => {
  it('API-01: maps snake_case wire response to camelCase BundleResult', async () => {
    const mock = _mockFetch(200, _listResp([_wireItem()]));
    const result = await fetchBundle(mock, PROJECT);

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.id).toBe('row-uuid-1234');
    expect(item.projectId).toBe(PROJECT);
    expect(item.product.id).toBe('hd-305832');
    expect(item.product.title).toBe('Behr Marquee 5-gal Matte');
    expect(item.product.price).toBe(218.0);
    expect(item.product.store.id).toBe('hd-0507');
    expect(item.quantity).toBe(1);
    expect(item.pushedToEstimate).toBe(false);
    expect(result.bundleSubtotal).toBe(218.0);
    expect(result.bundleSupplierCount).toBe(1);
    expect(result.receiptId).toBe('receipt-uuid-abc');
  });

  it('API-01b: appends project_id query param', async () => {
    const mock = _mockFetch(200, _listResp([]));
    await fetchBundle(mock, PROJECT);
    const calls = mock.mock.calls as any[];
    expect(calls[0][0]).toContain(`project_id=${encodeURIComponent(PROJECT)}`);
  });
});

// ---------------------------------------------------------------------------
// API-02: addToBundle sends correct payload
// ---------------------------------------------------------------------------

describe('addToBundle', () => {
  it('API-02: sends product + project_id + quantity in body', async () => {
    const mock = _mockFetch(200, _listResp([_wireItem()]));
    await addToBundle(mock, MOCK_PRODUCT, PROJECT, { quantity: 2 });

    const calls = mock.mock.calls as any[];
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.project_id).toBe(PROJECT);
    expect(body.product.id).toBe('hd-305832');
    expect(body.quantity).toBe(2);
    expect(body.store_id).toBe('hd-0507');
  });

  it('API-03: carries idempotency_key in body when provided', async () => {
    const mock = _mockFetch(200, _listResp([_wireItem()]));
    await addToBundle(mock, MOCK_PRODUCT, PROJECT, { idempotencyKey: 'test-idem-key' });

    const calls = mock.mock.calls as any[];
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.idempotency_key).toBe('test-idem-key');
  });

  it('ISOLATION-01: store_id comes from product.store.id', async () => {
    const mock = _mockFetch(200, _listResp([_wireItem()]));
    await addToBundle(mock, MOCK_PRODUCT, PROJECT);

    const calls = mock.mock.calls as any[];
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.store_id).toBe('hd-0507'); // from MOCK_PRODUCT.store.id
  });
});

// ---------------------------------------------------------------------------
// API-04: removeFromBundle sends bundle_item_id
// ---------------------------------------------------------------------------

describe('removeFromBundle', () => {
  it('API-04: sends bundle_item_id + project_id', async () => {
    const mock = _mockFetch(200, _listResp([]));
    await removeFromBundle(mock, 'row-uuid-1234', PROJECT);

    const calls = mock.mock.calls as any[];
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.bundle_item_id).toBe('row-uuid-1234');
    expect(body.project_id).toBe(PROJECT);
  });
});

// ---------------------------------------------------------------------------
// API-05: updateBundleQuantity sends quantity
// ---------------------------------------------------------------------------

describe('updateBundleQuantity', () => {
  it('API-05: sends bundle_item_id + quantity', async () => {
    const mock = _mockFetch(200, _listResp([_wireItem({ quantity: 5 })]));
    const result = await updateBundleQuantity(mock, 'row-uuid-1234', 5, PROJECT);

    const calls = mock.mock.calls as any[];
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.bundle_item_id).toBe('row-uuid-1234');
    expect(body.quantity).toBe(5);
    expect(result.items[0].quantity).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// API-06: clearBundle sends project_id + maps empty response
// ---------------------------------------------------------------------------

describe('clearBundle', () => {
  it('API-06: sends project_id + returns empty items', async () => {
    const mock = _mockFetch(200, {
      success: true,
      items: [],
      bundle_subtotal: 0,
      bundle_supplier_count: 0,
      receipt_id: 'receipt-clear',
    });
    const result = await clearBundle(mock, PROJECT);

    const calls = mock.mock.calls as any[];
    const body = JSON.parse(calls[0][1].body as string);
    expect(body.project_id).toBe(PROJECT);
    expect(result.items).toHaveLength(0);
    expect(result.bundleSubtotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// API-07: pushToEstimate maps to { estimateDraftId, ... }
// ---------------------------------------------------------------------------

describe('pushToEstimate', () => {
  it('API-07: maps response to camelCase + returns estimateDraftId', async () => {
    const wireResp: PushToEstimateResponse = {
      success: true,
      estimate_draft_id: 'draft-uuid-xyz',
      bundle_subtotal: 436.0,
      bundle_supplier_count: 1,
      item_count: 2,
      receipt_id: 'receipt-push',
    };
    const mock = _mockFetch(200, wireResp);
    const result = await pushToEstimate(mock, PROJECT);

    expect(result.estimateDraftId).toBe('draft-uuid-xyz');
    expect(result.bundleSubtotal).toBe(436.0);
    expect(result.bundleSupplierCount).toBe(1);
    expect(result.itemCount).toBe(2);
    expect(result.receiptId).toBe('receipt-push');
  });

  it('shows Push to Estimate calls correct endpoint', async () => {
    const mock = _mockFetch(200, {
      success: true, estimate_draft_id: 'x', bundle_subtotal: 0,
      bundle_supplier_count: 0, item_count: 0, receipt_id: 'r',
    });
    await pushToEstimate(mock, PROJECT);

    const calls = mock.mock.calls as any[];
    expect(calls[0][0]).toContain('/api/v1/materials/bundles/push-to-estimate');
  });
});

// ---------------------------------------------------------------------------
// ERR-01: fetchBundle non-2xx throws MaterialsBundleApiError
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('ERR-01: fetchBundle 401 throws MaterialsBundleApiError', async () => {
    const mock = _mockFetch(401, { detail: { error: 'MISSING_CAPABILITY_TOKEN' } });
    await expect(fetchBundle(mock, PROJECT)).rejects.toThrow(MaterialsBundleApiError);
    await expect(fetchBundle(mock, PROJECT)).rejects.toMatchObject({
      status: 401,
      code: 'MISSING_CAPABILITY_TOKEN',
    });
  });

  it('ERR-02: pushToEstimate 400 BUNDLE_EMPTY throws correct code', async () => {
    const mock = _mockFetch(400, {
      detail: { error: 'BUNDLE_EMPTY', message: 'Cannot push an empty bundle' },
    });
    await expect(pushToEstimate(mock, PROJECT)).rejects.toMatchObject({
      status: 400,
      code: 'BUNDLE_EMPTY',
    });
  });
});
