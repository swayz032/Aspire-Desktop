/**
 * Material Bundles API client — Pass D.
 *
 * Typed client wrapping all 6 bundle endpoints on the Express proxy:
 *   GET  /api/v1/materials/bundles
 *   POST /api/v1/materials/bundles/add
 *   POST /api/v1/materials/bundles/remove
 *   POST /api/v1/materials/bundles/update-quantity
 *   POST /api/v1/materials/bundles/clear
 *   POST /api/v1/materials/bundles/push-to-estimate
 *
 * Law compliance:
 *   Law #5 — capability tokens minted server-side; client never touches signing key.
 *   Law #3 — empty project_id / server errors surface as MaterialsBundleApiError.
 *   Law #9 — no raw secrets in error messages; product snapshots are PII-free retail data.
 *
 * Snake_case server response → camelCase BundleItem mapping per Aspire convention.
 */

import { API_BASE } from './officeMemory';
import type { Product } from '../../hooks/useMaterialsSearch';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MaterialsBundleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MaterialsBundleApiError';
  }
}

// ---------------------------------------------------------------------------
// Wire types (backend response shape — snake_case)
// ---------------------------------------------------------------------------

export interface WireBundleItem {
  id: string;
  project_id: string;
  product: Record<string, unknown>;
  store_id: string | null;
  category_hint: string | null;
  quantity: number;
  unit_price: number;
  fetched_at: string | null;
  pushed_to_estimate: boolean;
  estimate_draft_id: string | null;
  created_at: string | null;
}

export interface BundleListResponse {
  success: boolean;
  items: WireBundleItem[];
  bundle_subtotal: number;
  bundle_supplier_count: number;
  receipt_id: string;
}

export interface PushToEstimateResponse {
  success: boolean;
  estimate_draft_id: string;
  bundle_subtotal: number;
  bundle_supplier_count: number;
  item_count: number;
  receipt_id: string;
}

// ---------------------------------------------------------------------------
// Domain types (camelCase — matches useMaterialsBundle hook)
// ---------------------------------------------------------------------------

export interface BundleItem {
  /** DB row ID */
  id: string;
  projectId: string;
  /** Full Product snapshot (from search result) */
  product: Product;
  storeId: string | null;
  categoryHint: string | null;
  quantity: number;
  unitPrice: number;
  fetchedAt: string | null;
  pushedToEstimate: boolean;
  estimateDraftId: string | null;
  createdAt: string | null;
}

export interface BundleResult {
  items: BundleItem[];
  bundleSubtotal: number;
  bundleSupplierCount: number;
  receiptId: string;
}

// ---------------------------------------------------------------------------
// Mapper: wire shape → domain
// ---------------------------------------------------------------------------

function _mapWireProduct(raw: Record<string, unknown>): Product {
  const store = (raw.store as Record<string, unknown> | undefined) ?? {};
  const pickup = (raw.pickup as Record<string, unknown> | undefined) ?? {};
  return {
    id: (raw.id as string | undefined) ?? `bundle-${Math.random().toString(36).slice(2)}`,
    title: (raw.title as string | undefined) ?? '',
    brand: (raw.brand as string | undefined) ?? '',
    imageUrl: (raw.imageUrl as string | undefined) ?? (raw.thumbnail as string | undefined) ?? '',
    price: typeof raw.price === 'number' ? raw.price : 0,
    unit: (raw.unit as string | undefined) ?? 'ea',
    store: {
      id: (store.id as string | undefined) ?? (pickup.store_id as string | undefined) ?? 'hd',
      name: (store.name as string | undefined) ?? (pickup.store_name as string | undefined) ?? 'Home Depot',
      driveMinutes: typeof store.driveMinutes === 'number' ? store.driveMinutes : 0,
      inStock: typeof store.inStock === 'boolean' ? store.inStock : (pickup.in_stock as boolean | undefined) ?? false,
    },
    rating: typeof raw.rating === 'number' ? raw.rating : 0,
    reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : (typeof raw.reviews === 'number' ? raw.reviews : 0),
    source: (raw.source as string | undefined) ?? 'home_depot',
    fetchedAt: (raw.fetchedAt as string | undefined) ?? (raw.fetched_at as string | undefined) ?? new Date().toISOString(),
    sku: (raw.sku as string | undefined),
    category: (raw.category as string | undefined),
  };
}

function _mapWireItem(w: WireBundleItem): BundleItem {
  return {
    id: w.id,
    projectId: w.project_id,
    product: _mapWireProduct(w.product),
    storeId: w.store_id,
    categoryHint: w.category_hint,
    quantity: w.quantity,
    unitPrice: w.unit_price,
    fetchedAt: w.fetched_at,
    pushedToEstimate: w.pushed_to_estimate,
    estimateDraftId: w.estimate_draft_id,
    createdAt: w.created_at,
  };
}

function _mapListResponse(resp: BundleListResponse): BundleResult {
  return {
    items: resp.items.map(_mapWireItem),
    bundleSubtotal: resp.bundle_subtotal,
    bundleSupplierCount: resp.bundle_supplier_count,
    receiptId: resp.receipt_id,
  };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

async function _handleResponse<T>(resp: Response, context: string): Promise<T> {
  if (!resp.ok) {
    let code = `${context.toUpperCase()}_FAILED`;
    let message = `${context} failed (${resp.status})`;
    try {
      const body = await resp.json();
      code = body?.detail?.error ?? body?.error ?? code;
      message = body?.detail?.message ?? body?.message ?? message;
    } catch {
      // non-JSON body
    }
    throw new MaterialsBundleApiError(resp.status, code, message);
  }
  return (await resp.json()) as T;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the current bundle for a project.
 */
export async function fetchBundle(
  authenticatedFetch: FetchFn,
  projectAddress: string,
  options?: { officeId?: string; signal?: AbortSignal },
): Promise<BundleResult> {
  const qs = new URLSearchParams({ project_id: projectAddress });
  const url = `${API_BASE}/api/v1/materials/bundles?${qs.toString()}`;
  const resp = await authenticatedFetch(url, {
    method: 'GET',
    headers: options?.officeId ? { 'X-Office-Id': options.officeId } : {},
    signal: options?.signal,
  });
  const data = await _handleResponse<BundleListResponse>(resp, 'bundle_list');
  return _mapListResponse(data);
}

/**
 * Add a product to the bundle. Deduplicates by product.id (increments quantity).
 */
export async function addToBundle(
  authenticatedFetch: FetchFn,
  product: Product,
  projectAddress: string,
  options?: {
    quantity?: number;
    storeId?: string;
    categoryHint?: string;
    idempotencyKey?: string;
    officeId?: string;
    signal?: AbortSignal;
  },
): Promise<BundleResult> {
  const resp = await authenticatedFetch(`${API_BASE}/api/v1/materials/bundles/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.officeId ? { 'X-Office-Id': options.officeId } : {}),
    },
    body: JSON.stringify({
      project_id: projectAddress,
      product: {
        id: product.id,
        title: product.title,
        brand: product.brand,
        price: product.price,
        unit: product.unit,
        sku: product.sku,
        imageUrl: product.imageUrl,
        store: product.store,
        rating: product.rating,
        reviewCount: product.reviewCount,
        source: product.source,
        fetchedAt: product.fetchedAt,
        fetched_at: product.fetchedAt,
        category: product.category,
      },
      quantity: options?.quantity ?? 1,
      store_id: options?.storeId ?? product.store.id,
      category_hint: options?.categoryHint ?? product.category ?? null,
      idempotency_key: options?.idempotencyKey ?? null,
    }),
    signal: options?.signal,
  });
  const data = await _handleResponse<BundleListResponse>(resp, 'bundle_add');
  return _mapListResponse(data);
}

/**
 * Remove one item from the bundle by its DB row ID.
 */
export async function removeFromBundle(
  authenticatedFetch: FetchFn,
  bundleItemId: string,
  projectAddress: string,
  options?: { officeId?: string; signal?: AbortSignal },
): Promise<BundleResult> {
  const resp = await authenticatedFetch(`${API_BASE}/api/v1/materials/bundles/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.officeId ? { 'X-Office-Id': options.officeId } : {}),
    },
    body: JSON.stringify({
      project_id: projectAddress,
      bundle_item_id: bundleItemId,
    }),
    signal: options?.signal,
  });
  const data = await _handleResponse<BundleListResponse>(resp, 'bundle_remove');
  return _mapListResponse(data);
}

/**
 * Update the quantity of one bundle item.
 * quantity === 0 removes the item.
 */
export async function updateBundleQuantity(
  authenticatedFetch: FetchFn,
  bundleItemId: string,
  quantity: number,
  projectAddress: string,
  options?: { officeId?: string; signal?: AbortSignal },
): Promise<BundleResult> {
  const resp = await authenticatedFetch(`${API_BASE}/api/v1/materials/bundles/update-quantity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.officeId ? { 'X-Office-Id': options.officeId } : {}),
    },
    body: JSON.stringify({
      project_id: projectAddress,
      bundle_item_id: bundleItemId,
      quantity,
    }),
    signal: options?.signal,
  });
  const data = await _handleResponse<BundleListResponse>(resp, 'bundle_update_quantity');
  return _mapListResponse(data);
}

/**
 * Clear all non-pushed items from the bundle for a project.
 */
export async function clearBundle(
  authenticatedFetch: FetchFn,
  projectAddress: string,
  options?: { officeId?: string; signal?: AbortSignal },
): Promise<BundleResult> {
  const resp = await authenticatedFetch(`${API_BASE}/api/v1/materials/bundles/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.officeId ? { 'X-Office-Id': options.officeId } : {}),
    },
    body: JSON.stringify({ project_id: projectAddress }),
    signal: options?.signal,
  });
  const data = await _handleResponse<BundleListResponse>(resp, 'bundle_clear');
  return _mapListResponse(data);
}

/**
 * Push the current bundle to an estimate draft (YELLOW tier).
 *
 * The caller MUST show a confirmation modal before calling this function.
 * The server enforces the Yellow-scope gate via capability token.
 */
export async function pushToEstimate(
  authenticatedFetch: FetchFn,
  projectAddress: string,
  options?: { officeId?: string; signal?: AbortSignal },
): Promise<{ estimateDraftId: string; bundleSubtotal: number; bundleSupplierCount: number; itemCount: number; receiptId: string }> {
  const resp = await authenticatedFetch(`${API_BASE}/api/v1/materials/bundles/push-to-estimate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.officeId ? { 'X-Office-Id': options.officeId } : {}),
    },
    body: JSON.stringify({ project_id: projectAddress }),
    signal: options?.signal,
  });
  const data = await _handleResponse<PushToEstimateResponse>(resp, 'bundle_push_to_estimate');
  return {
    estimateDraftId: data.estimate_draft_id,
    bundleSubtotal: data.bundle_subtotal,
    bundleSupplierCount: data.bundle_supplier_count,
    itemCount: data.item_count,
    receiptId: data.receipt_id,
  };
}
