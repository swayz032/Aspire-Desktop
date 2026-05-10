/**
 * Property Data API client — Service Hub Phase 3, Pass 3.2.
 *
 * Typed wrapper around `POST /api/service-hub/property-data` (Pass 3.1).
 *
 * Auth: uses `authenticatedFetchStandalone` which pulls the current Supabase
 * session and injects `Authorization: Bearer <jwt>` + `X-Suite-Id`. The server
 * resolves suite_id from the JWT (Law #6).
 */
import { authenticatedFetchStandalone } from '@/lib/authFetchStandalone';
// ---------------------------------------------------------------------------
// Wire types — duplicated here from `server/serviceHub/property/propertyTypes`
// (Pass 3.1) so that the Visuals tab data layer can ship independently of
// the server module being on the same branch. When Pass 3.1 lands, these
// stay in lockstep with the server source-of-truth (any divergence shows
// up in the propertyDataApi.test.ts contract assertions).
// ---------------------------------------------------------------------------

export type PhotoLane = {
  count: number;
  thumbnailUrl?: string;
  photos: {
    id: string;
    url: string;
    caption?: string;
    source: 'zillow' | 'streetview' | 'upload' | 'adam';
  }[];
};

export type SourceStatus = {
  name:
    | 'addressValidation'
    | 'geocoding'
    | 'streetView'
    | 'solar'
    | 'adam'
    | 'places';
  fetchedAt: string;
  status: 'ok' | 'partial' | 'missing' | 'api_failure';
  confidence?: 'high' | 'medium' | 'low';
};

export type AddressValidationVerdict = {
  status: 'valid' | 'needs_correction' | 'unconfirmed' | 'invalid' | 'api_failure';
  formatted?: string;
  components?: {
    street?: string;
    secondary?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  coords?: { lat: number; lng: number };
  suggestedAddress?: string;
  reason?: string;
  fetchedAt: string;
};

export type PropertyData = {
  address: {
    formatted: string;
    street?: string;
    secondary?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  coords: { lat: number; lng: number };
  hero: {
    streetViewProxyUrl?: string;
  };
  facts: {
    sqft?: number;
    yearBuilt?: number;
    zoning?: string;
    propertyType?: string;
    lotSqft?: number;
    stories?: number;
    bedrooms?: number;
    bathrooms?: number;
    constructionFrame?: string;
    quality?: string;
    ownerName?: string;
    ownerOccupied?: boolean;
    estimatedValue?: number;
    estimatedValueLow?: number;
    estimatedValueHigh?: number;
    lastSaleDate?: string;
    lastSaleAmount?: number;
    annualTax?: number;
    taxYear?: number;
  };
  photos: {
    interior: PhotoLane;
    exterior: PhotoLane;
    roof: PhotoLane;
    streetView: PhotoLane;
  };
  signals: {
    materials: { name: string; confidence: 'high' | 'medium' | 'low' }[];
    roofType?: string;
    accessRisk?: 'low' | 'medium' | 'high';
  };
  costBand: { low: number; high: number; currency: 'USD' };
  evidenceGaps: string[];
  fetchedAt: string;
  sources: SourceStatus[];
};

export type PropertyCorrectionResponse = {
  suggestedAddress: string;
  components?: AddressValidationVerdict['components'];
  propertyData: null;
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FetchPropertyDataArgs = {
  address: string;
  forceRefresh?: boolean;
};

export type PropertyDataResponse =
  | { kind: 'ok'; data: PropertyData; cacheHit?: boolean }
  | {
      kind: 'needs_correction';
      suggestedAddress: string;
      components?: AddressValidationVerdict['components'];
      propertyData: null;
    }
  | {
      kind: 'invalid';
      verdict: AddressValidationVerdict;
      message: string;
    }
  | {
      kind: 'error';
      status: number;
      message: string;
    };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PropertyDataApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PropertyDataApiError';
  }
}

// ---------------------------------------------------------------------------
// Fetch seam — replaceable in tests
// ---------------------------------------------------------------------------

type FetchFn = typeof fetch;
let _fetch: FetchFn = (...args) => authenticatedFetchStandalone(args[0] as string, args[1]);

export function __setFetchForTests(impl: FetchFn | null): void {
  _fetch = impl ?? ((...args) => authenticatedFetchStandalone(args[0] as string, args[1]));
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

// In dev, Metro proxies /api/* to Express (see metro.config.js).
// In prod, the Express server serves both API + static, so same-origin works.
// Setting EXPO_PUBLIC_API_URL is only needed for unusual deploys.
const API_BASE: string = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const ENDPOINT = '/api/service-hub/property-data';

/**
 * POST /api/service-hub/property-data
 *
 * Returns a discriminated union — never throws on application-level errors
 * (422 / 5xx); only network-level errors (no response, abort) bubble.
 */
export async function fetchPropertyData(
  args: FetchPropertyDataArgs,
  init?: { signal?: AbortSignal },
): Promise<PropertyDataResponse> {
  const url = `${API_BASE}${ENDPOINT}`;

  let resp: Response;
  try {
    resp = await _fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: args.address,
        forceRefresh: args.forceRefresh ?? false,
      }),
      signal: init?.signal,
    });
  } catch (err) {
    // Abort propagates as-is so callers can detect cancel.
    if ((err as Error)?.name === 'AbortError') throw err;
    return {
      kind: 'error',
      status: 0,
      message: (err as Error)?.message ?? 'Network request failed',
    };
  }

  // 422 — Address Validation rejected the input (Stage 1 fail-closed gate).
  if (resp.status === 422) {
    let verdict: AddressValidationVerdict | undefined;
    let message = 'Address could not be validated';
    try {
      const body = (await resp.json()) as {
        verdict?: AddressValidationVerdict;
        message?: string;
        error?: string;
      };
      verdict = body?.verdict;
      message = body?.message ?? body?.error ?? message;
    } catch {
      /* fall through */
    }
    return {
      kind: 'invalid',
      verdict:
        verdict ?? {
          status: 'invalid',
          fetchedAt: new Date().toISOString(),
          reason: message,
        },
      message,
    };
  }

  // Server-side errors / unexpected statuses.
  if (!resp.ok) {
    let message = `Property data request failed (${resp.status})`;
    try {
      const body = (await resp.json()) as { error?: string; message?: string };
      message = body?.message ?? body?.error ?? message;
    } catch {
      /* fall through */
    }
    return { kind: 'error', status: resp.status, message };
  }

  // 200 — either PropertyData or PropertyCorrectionResponse.
  const json = (await resp.json()) as
    | (PropertyData & { cacheHit?: boolean })
    | PropertyCorrectionResponse;

  if (json && 'propertyData' in json && json.propertyData === null) {
    return {
      kind: 'needs_correction',
      suggestedAddress: json.suggestedAddress,
      components: json.components,
      propertyData: null,
    };
  }

  const data = json as PropertyData & { cacheHit?: boolean };
  return {
    kind: 'ok',
    data,
    cacheHit: Boolean(data.cacheHit),
  };
}
