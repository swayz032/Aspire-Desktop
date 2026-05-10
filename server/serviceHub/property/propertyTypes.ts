/**
 * Property types — Service Hub Phase 3, Pass 3.1.
 *
 * Shared TypeScript shapes between the property aggregator orchestrator,
 * the upstream client modules (Apify Zillow + 4 Google APIs), the express
 * router, and the Visuals tab UI.
 *
 * Design notes:
 *   - Source-status enum mirrors the V7.1 plan: 'ok' | 'partial' | 'missing'
 *     | 'api_failure'. The aggregator never throws — every upstream is
 *     reflected in PropertyData.sources[] with a structured status.
 *   - All measurement / classification fields carry an evidence label
 *     ('observed' | 'measured' | 'inferred' | 'estimated' | 'missing')
 *     elsewhere in the pipeline; here we only carry the raw fact + a
 *     confidence enum on signals.
 *   - Aspire Law #3 (fail-closed): missing data is explicit, never invented.
 */

/** Photo lane shown as one of the four image columns in the Visuals tab. */
export type PhotoLane = {
  /** Number of photos in this lane (>= photos.length when truncated for the grid thumbnail). */
  count: number;
  /** Optional thumbnail to render before the user expands the lane. */
  thumbnailUrl?: string;
  /** Individual photos with provenance. */
  photos: {
    id: string;
    url: string;
    caption?: string;
    source: 'zillow' | 'streetview' | 'upload' | 'adam';
  }[];
};

/** Per-source health record reflected in PropertyData.sources[]. */
export type SourceStatus = {
  name:
    | 'addressValidation'
    | 'geocoding'
    | 'streetView'
    | 'solar'
    | 'adam'
    | 'places'
    | 'aerialView';    // added: Google Aerial View API
  fetchedAt: string;
  status: 'ok' | 'partial' | 'missing' | 'api_failure';
  confidence?: 'high' | 'medium' | 'low';
};

/** Address Validation API verdict surfaced from googleAddressValidationClient. */
export type AddressValidationVerdict = {
  status: 'valid' | 'needs_correction' | 'unconfirmed' | 'invalid' | 'api_failure';
  /** USPS-grade canonical address string (formattedAddress from upstream). */
  formatted?: string;
  /** Component breakdown (street, city, state, zip, country, secondary). */
  components?: {
    street?: string;
    secondary?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  /** Coordinates if upstream returned them — saves a separate Geocoding call. */
  coords?: { lat: number; lng: number };
  /** Suggested address text when status === 'needs_correction'. */
  suggestedAddress?: string;
  /** Optional human-readable reason for invalid / api_failure. */
  reason?: string;
  fetchedAt: string;
};

/** Cached Google Aerial View API data stored in property_snapshots.aerial_video_data. */
export type AerialVideoData = {
  videoUrl:     string;
  videoH265Url?: string;
  thumbnailUrl?: string;
  fetched_at:   string;
};

/** PropertyData = the aggregated, fully-shaped payload returned from
 *  POST /api/service-hub/property-data. */
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
    /**
     * Server-side proxy URL — fallback static Street View image. Primary
     * hero is the live Maps JS panorama loaded client-side from address/coords.
     * Aerial view is served by GET /api/property/aerial-video (separate endpoint).
     */
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
  /** List of fact keys we couldn't resolve (e.g. 'sqft', 'yearBuilt'). */
  evidenceGaps: string[];
  fetchedAt: string;
  sources: SourceStatus[];
};

/** Response when address validation says the address needs correction. */
export type PropertyCorrectionResponse = {
  suggestedAddress: string;
  components?: AddressValidationVerdict['components'];
  propertyData: null;
};

/** Wire response from POST /api/service-hub/property-data. */
export type PropertyDataResponse = PropertyData | PropertyCorrectionResponse;
