/**
 * Materials Search API client — Pass C.
 *
 * Typed client wrapping `GET /api/v1/materials/search` (Express proxy that
 * mints a capability token + forwards to the Python orchestrator).
 *
 * Law compliance:
 *   Law #5 — capability token minted server-side by the Express proxy; the
 *             browser never sees the signing key.
 *   Law #3 — empty/PII queries rejected server-side before any budget is spent;
 *             client surfaces the rejection code to the hook.
 *   Law #9 — no raw secrets or PII in error messages surfaced to the client.
 */

import { API_BASE } from './officeMemory';
import type {
  Product,
  ClosestStore,
  SpecialtySupplier,
  MaterialsFilter,
  UseMaterialsSearchResult,
} from '../../hooks/useMaterialsSearch';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MaterialsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MaterialsApiError';
  }
}

// ---------------------------------------------------------------------------
// Wire types (backend response shape)
// ---------------------------------------------------------------------------

export interface MaterialsSearchParams {
  /** Normalised search query (max 500 chars, no PII) */
  q: string;
  /** ZIP code for local store lookup */
  zip_code?: string;
  /** Home Depot store ID override */
  store_id?: string;
  /** Include Google Shopping results */
  include_shopping?: boolean;
  /** Client-generated UUID for dedup */
  idempotency_key?: string;
  /** X-Office-Id injected by the hook via headers */
  officeId: string;
}

export interface BackendProduct {
  title: string;
  brand?: string | null;
  price?: number | null;
  unit?: string | null;
  rating?: number | null;
  reviews?: number | null;
  sku?: string | null;
  link?: string | null;
  thumbnail?: string | null;
  pickup?: { in_stock?: boolean; store_id?: string; store_name?: string; quantity?: number } | null;
  delivery?: boolean | null;
  description?: string | null;
  specifications?: Record<string, string | number | boolean | null> | null;
  model_number?: string | null;
  product_id?: string | null;
  [key: string]: unknown;
}

export interface BackendSpecialtySupplier {
  id?: string;
  name: string;
  category?: string;
  phone?: string;
  address?: string;
  distance_miles?: number;
  drive_minutes?: number;
  hours?: string;
  website?: string;
  email?: string;
}

export interface BackendPriceBucket {
  label: string;
  min: number;
  max: number | null;
  count: number;
}

export interface BackendFilters {
  brands?: { name: string; count: number }[];
  stock?: { in_stock_count: number; total_count: number };
  price_buckets?: BackendPriceBucket[];
}

export interface BackendAddon {
  title: string;
  category?: string;
  reason?: string;
}

export interface MaterialsSearchResponse {
  success: boolean;
  products: BackendProduct[];
  specialty_suppliers: BackendSpecialtySupplier[];
  filters: BackendFilters;
  addon_suggestions: BackendAddon[];
  is_cached_only_mode: boolean;
  from_cache: boolean;
  receipt_id: string;
  query_normalized: string;
}

// ---------------------------------------------------------------------------
// Mapper: backend shape -> hook domain types
// ---------------------------------------------------------------------------

function _mapProduct(p: BackendProduct, idx: number): Product {
  const pickup = p.pickup ?? {};
  const store: import('../../hooks/useMaterialsSearch').ProductStore = {
    id: pickup.store_id ?? 'hd',
    name: pickup.store_name ?? 'Home Depot',
    driveMinutes: 0,
    inStock: pickup.in_stock ?? false,
  };
  return {
    id: p.product_id ?? p.sku ?? `mat-${idx}`,
    title: p.title ?? '',
    brand: p.brand ?? '',
    imageUrl: p.thumbnail ?? '',
    price: typeof p.price === 'number' ? p.price : 0,
    unit: p.unit ?? 'ea',
    store,
    rating: typeof p.rating === 'number' ? p.rating : 0,
    reviewCount: typeof p.reviews === 'number' ? p.reviews : 0,
    source: 'home_depot',
    fetchedAt: new Date().toISOString(),
    sku: p.sku ?? undefined,
    category: typeof p.description === 'string' ? undefined : undefined,
  };
}

function _mapSupplier(
  s: BackendSpecialtySupplier,
  idx: number,
): SpecialtySupplier {
  return {
    id: s.id ?? `spec-${idx}`,
    name: s.name,
    category: s.category ?? 'specialty',
    phone: s.phone ?? '',
    email: s.email,
    website: s.website,
    distanceMiles: s.distance_miles ?? 0,
    driveMinutes: s.drive_minutes ?? 0,
    hours: s.hours,
  };
}

function _mapFilters(f: BackendFilters): MaterialsFilter[] {
  const filters: MaterialsFilter[] = [];

  // Brand filter
  if (f.brands && f.brands.length > 0) {
    filters.push({
      key: 'brand',
      label: 'Brand',
      options: f.brands.map((b) => ({
        value: b.name,
        label: b.name,
        count: b.count,
      })),
    });
  }

  // Stock filter
  if (f.stock) {
    filters.push({
      key: 'stock',
      label: 'Stock',
      options: [
        { value: 'in_stock', label: 'In stock', count: f.stock.in_stock_count },
        { value: 'all', label: 'All', count: f.stock.total_count },
      ],
    });
  }

  // Price buckets
  if (f.price_buckets && f.price_buckets.length > 0) {
    filters.push({
      key: 'price',
      label: 'Price',
      options: f.price_buckets.map((b) => ({
        value: b.label,
        label: b.label,
        count: b.count,
      })),
    });
  }

  return filters;
}

export function mapServerResponse(
  resp: MaterialsSearchResponse,
): {
  products: Product[];
  specialtySuppliers: SpecialtySupplier[];
  filters: MaterialsFilter[];
  isCachedOnlyMode: boolean;
} {
  return {
    products: resp.products.map(_mapProduct),
    specialtySuppliers: resp.specialty_suppliers.map(_mapSupplier),
    filters: _mapFilters(resp.filters),
    isCachedOnlyMode: resp.is_cached_only_mode,
  };
}

// ---------------------------------------------------------------------------
// API function
// ---------------------------------------------------------------------------

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Call GET /api/v1/materials/search via the Express proxy.
 *
 * The proxy:
 *   1. Validates the caller's JWT (extracts suite_id)
 *   2. Mints a capability token (scope = materials:search)
 *   3. Injects X-Tenant-Id / X-Suite-Id / X-Office-Id
 *   4. Forwards to the Python orchestrator with an 11s budget
 *
 * Throws `MaterialsApiError` on non-2xx responses.
 */
export async function searchMaterials(
  authenticatedFetch: FetchFn,
  params: MaterialsSearchParams,
  signal?: AbortSignal,
): Promise<MaterialsSearchResponse> {
  const qs = new URLSearchParams();
  qs.set('q', params.q);
  if (params.zip_code) qs.set('zip_code', params.zip_code);
  if (params.store_id) qs.set('store_id', params.store_id);
  if (params.include_shopping) qs.set('include_shopping', 'true');
  if (params.idempotency_key) qs.set('idempotency_key', params.idempotency_key);

  const url = `${API_BASE}/api/v1/materials/search?${qs.toString()}`;

  const resp = await authenticatedFetch(url, {
    method: 'GET',
    headers: {
      'X-Office-Id': params.officeId,
    },
    signal,
  });

  if (!resp.ok) {
    let code = 'MATERIALS_SEARCH_FAILED';
    let message = `Materials search failed (${resp.status})`;
    try {
      const body = await resp.json();
      code = body?.detail?.error ?? body?.error ?? code;
      message = body?.detail?.message ?? body?.message ?? message;
    } catch {
      // non-JSON error body
    }
    throw new MaterialsApiError(resp.status, code, message);
  }

  return (await resp.json()) as MaterialsSearchResponse;
}
