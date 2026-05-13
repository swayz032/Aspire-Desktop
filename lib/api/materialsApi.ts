/**
 * Materials Search API client — Pass C + Pass F.
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
 *
 * Pass F additions:
 *   BackendClosestStore extended with phone, hours_open_now, hours_today,
 *   current_status from Google Places enrichment (enrich_store_with_places).
 *   _mapClosestStore preserves all new fields through to ClosestStore domain type.
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
  /** Full project address (street + city + state). Backend resolves to
   *  lat/lng → closest HD store (Tool mode) or Yelp `find_loc` (Supplier
   *  mode). This is the project address from the Visuals tab address bar. */
  address?: string;
  /** ZIP code for local store lookup */
  zip_code?: string;
  /** Home Depot store ID override */
  store_id?: string;
  /** Include Google Shopping results */
  include_shopping?: boolean;
  /** 'tool' (default — Home Depot retail) or 'supplier' (Yelp B2B). */
  mode?: 'tool' | 'supplier';
  /** Client-generated UUID for dedup */
  idempotency_key?: string;
  /** X-Office-Id injected by the hook via headers */
  officeId: string;
}

/**
 * BackendProduct — raw wire shape from the Python orchestrator.
 *
 * Bug A fix (2026-05-13): The backend now emits a top-level `pickup` object
 * with `in_stock` (boolean), `store_id`, `store_name`, `quantity`, and
 * `drive_minutes` (int|null, filled by Distance Matrix). Before this fix,
 * `pickup` was always absent and `in_stock` defaulted to false.
 *
 * Pass F: additional raw fields forwarded from SerpApi for premium card display.
 */
export interface BackendProduct {
  title: string;
  brand?: string | null;
  price?: number | null;
  unit?: string | null;
  rating?: number | null;
  reviews?: number | null;
  sku?: string | null;
  model_number?: string | null;
  link?: string | null;
  thumbnail?: string | null;
  /**
   * Bug A fix: pickup object now emitted by normalize_from_serpapi_homedepot.
   * drive_minutes is null until Distance Matrix resolves (Bug C fix).
   */
  pickup?: {
    in_stock?: boolean;
    store_id?: string | null;
    store_name?: string | null;
    store_address?: string | null;
    quantity?: number | null;
    /** Null when Distance Matrix did not resolve (fail-soft). */
    drive_minutes?: number | null;
    delivery_zip?: string | null;
  } | null;
  delivery?: boolean | null;
  description?: string | null;
  specifications?: Record<string, string | number | boolean | null> | null;
  product_id?: string | null;
  /** Pass F: SerpApi badges array */
  badges?: string[] | null;
  /** Pass F: price badge string (e.g. "Sale") */
  price_badge?: string | null;
  /** Pass F: availability text ("Pickup today", "Ships in 3 days") */
  availability_text?: string | null;
  /** Pass F: in-store bay number */
  bay?: number | string | null;
  /** Pass F: in-store aisle number */
  aisle?: number | string | null;
  /** Pass F: number of variants */
  variant_count?: number | null;
  /** Pass F: variant type label ("colors"|"sizes"|"options") */
  variant_type?: string | null;
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

/**
 * Backend Yelp supplier shape (snake_case).
 */
export interface BackendSupplier {
  id?: string;
  business_id?: string;
  name: string;
  category?: string;
  categories?: string[];
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  distance_miles?: number;
  drive_minutes?: number;
  rating?: number;
  review_count?: number;
  hours?: string;
  hours_open_now?: boolean;
}

/**
 * Backend closest-store shape (snake_case).
 *
 * Pass F additions: phone, hours_open_now, hours_today, current_status
 * from Google Places enrichment in enrich_store_with_places().
 */
export interface BackendClosestStore {
  id?: string;
  store_id?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** Pass F: E.164 or formatted phone (public HD number). */
  phone?: string | null;
  lat?: number;
  lng?: number;
  /** Bug B fix: populated by Distance Matrix. Null = not yet resolved. */
  drive_minutes?: number | null;
  in_traffic?: boolean;
  /** Pass F: true when store is currently open per Google Places. */
  hours_open_now?: boolean | null;
  /** Pass F: today’s hours string, e.g. "6 AM - 10 PM". */
  hours_today?: string | null;
  /** Pass F: OPEN | CLOSING_SOON | CLOSED */
  current_status?: 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | null;
}

export interface MaterialsSearchResponse {
  success: boolean;
  /** Home Depot products — populated when mode='tool'. */
  products: BackendProduct[];
  /** Inline specialty fallback rail (mode='tool' only). */
  specialty_suppliers: BackendSpecialtySupplier[];
  /** Yelp suppliers — populated when mode='supplier' (PR #57). */
  suppliers?: BackendSupplier[];
  filters: BackendFilters;
  addon_suggestions: BackendAddon[];
  /** Real closest Home Depot resolved via address ZIP (PR #58). */
  closest_store?: BackendClosestStore | null;
  is_cached_only_mode: boolean;
  from_cache: boolean;
  receipt_id: string;
  query_normalized: string;
  mode?: 'tool' | 'supplier';
  suggested_mode?: 'tool' | 'supplier' | null;
}

// ---------------------------------------------------------------------------
// Mapper: backend shape -> hook domain types
// ---------------------------------------------------------------------------

function _mapProduct(p: BackendProduct, idx: number): Product {
  const pickup = p.pickup ?? {};
  const inStock = pickup.in_stock === true;
  const driveMinutes: number = typeof pickup.drive_minutes === 'number'
    ? pickup.drive_minutes
    : 0;

  const store: import('../../hooks/useMaterialsSearch').ProductStore = {
    id: pickup.store_id ?? 'hd',
    name: pickup.store_name ?? 'Home Depot',
    driveMinutes,
    inStock,
  };

  // Pass F: extended product fields for premium card display
  const extended: Record<string, unknown> = {};
  if (Array.isArray(p.badges) && p.badges.length > 0) extended.badges = p.badges;
  if (p.price_badge) extended.priceBadge = p.price_badge;
  if (p.availability_text) extended.availabilityText = p.availability_text;
  if (p.bay !== null && p.bay !== undefined) extended.bay = p.bay;
  if (p.aisle !== null && p.aisle !== undefined) extended.aisle = p.aisle;
  if (p.model_number) extended.modelNumber = p.model_number;
  if (typeof p.variant_count === 'number' && p.variant_count > 0) {
    extended.variantCount = p.variant_count;
    extended.variantType = p.variant_type ?? 'options';
  }
  if (pickup.store_address) extended.storeAddress = pickup.store_address;

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
    ...extended,
  } as Product;
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

function _mapSupplierFull(
  s: BackendSupplier,
  idx: number,
): import('../../hooks/useMaterialsSearch').Supplier {
  return {
    id: s.business_id ?? s.id ?? `supplier-${idx}`,
    name: s.name,
    category: s.category ?? s.categories?.[0] ?? 'SUPPLIER',
    tags: s.categories ?? undefined,
    address: s.address ?? '',
    city: s.city,
    state: s.state,
    phone: s.phone,
    email: s.email,
    website: s.website,
    distanceMiles: s.distance_miles ?? 0,
    driveMinutes: s.drive_minutes ?? 0,
    rating: s.rating,
    reviewCount: s.review_count,
    hours: s.hours,
  };
}

function _mapClosestStore(
  s: BackendClosestStore | null | undefined,
): import('../../hooks/useMaterialsSearch').ClosestStore | null {
  if (!s) return null;
  if (!s.address && !s.name) return null;
  return {
    id: s.store_id ?? s.id ?? '',
    name: s.name ?? 'Home Depot',
    address: s.address ?? '',
    driveMinutes: typeof s.drive_minutes === 'number' ? s.drive_minutes : 0,
    inTraffic: Boolean(s.in_traffic),
    city: s.city,
    state: s.state,
    // Pass F: preserve enrichment fields through to ClosestStore domain type.
    // These are typed as unknown on ClosestStore (open-ended) so no type widening needed.
    ...(s.phone !== undefined && s.phone !== null ? { phone: s.phone } : {}),
    ...(s.hours_open_now !== undefined && s.hours_open_now !== null
      ? { hours_open_now: s.hours_open_now }
      : {}),
    ...(s.hours_today !== undefined && s.hours_today !== null
      ? { hours_today: s.hours_today }
      : {}),
    ...(s.current_status !== undefined && s.current_status !== null
      ? { current_status: s.current_status }
      : {}),
  } as import('../../hooks/useMaterialsSearch').ClosestStore;
}

export function mapServerResponse(
  resp: MaterialsSearchResponse,
): {
  products: Product[];
  specialtySuppliers: SpecialtySupplier[];
  suppliers: import('../../hooks/useMaterialsSearch').Supplier[] | null;
  filters: MaterialsFilter[];
  isCachedOnlyMode: boolean;
  closestStore: import('../../hooks/useMaterialsSearch').ClosestStore | null;
} {
  return {
    products: resp.products.map(_mapProduct),
    specialtySuppliers: resp.specialty_suppliers.map(_mapSupplier),
    suppliers: Array.isArray(resp.suppliers)
      ? resp.suppliers.map(_mapSupplierFull)
      : null,
    filters: _mapFilters(resp.filters),
    isCachedOnlyMode: resp.is_cached_only_mode,
    closestStore: _mapClosestStore(resp.closest_store),
  };
}

// ---------------------------------------------------------------------------
// API function
// ---------------------------------------------------------------------------

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

export async function searchMaterials(
  authenticatedFetch: FetchFn,
  params: MaterialsSearchParams,
  signal?: AbortSignal,
): Promise<MaterialsSearchResponse> {
  const qs = new URLSearchParams();
  qs.set('q', params.q);
  if (params.address) qs.set('address', params.address);
  if (params.zip_code) qs.set('zip_code', params.zip_code);
  if (params.store_id) qs.set('store_id', params.store_id);
  if (params.include_shopping) qs.set('include_shopping', 'true');
  if (params.mode) qs.set('mode', params.mode);
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
