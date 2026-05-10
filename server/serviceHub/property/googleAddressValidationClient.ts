/**
 * Google Address Validation API proxy.
 *
 * CRITICAL — this is the FIRST gate in the property data pipeline.
 * Bad addresses never reach downstream paid APIs (Apify, Solar, etc.).
 *
 * Spec: https://developers.google.com/maps/documentation/address-validation/requests-validate-address
 *
 * Aspire Laws:
 *   Law #3 (fail-closed): always returns structured AddressValidationVerdict, never throws.
 *   Law #9 (no secrets logged): API key is never included in log output.
 *
 * Pattern mirrors handleStreetViewProxy in server/routes.ts:8369-8470.
 */

import { resolveGooglePlacesApiKey } from '../../runtimeGuards';
import { logger } from '../../logger';
import type { AddressValidationVerdict } from './propertyTypes';

// Re-export so callers can import the type from either location.
export type { AddressValidationVerdict };

// ─── Input validation ─────────────────────────────────────────────────────────

/** Printable ASCII only; no control chars or injection. Max 500 chars. */
const ADDRESS_RE = /^[A-Za-z0-9\s,.\-#'/]+$/;
const MAX_ADDRESS_LEN = 500;

function sanitizeAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed || trimmed.length > MAX_ADDRESS_LEN) return null;
  if (!ADDRESS_RE.test(trimmed)) return null;
  return trimmed;
}

// ─── Test escape hatch ────────────────────────────────────────────────────────

// Allows unit tests to inject a mock fetch without touching global.
let _fetchOverride: typeof fetch | undefined;

export function __setFetchForTests(mock: typeof fetch | undefined): void {
  _fetchOverride = mock;
}

function getFetch(): typeof fetch {
  return _fetchOverride ?? fetch;
}

// ─── Component extraction helper ──────────────────────────────────────────────

interface RawAddressComponent {
  componentType?: string;
  componentName?: { text?: string };
  confirmationLevel?: string;
  inferred?: boolean;
}

function extractComponents(
  addressComponents: RawAddressComponent[] | undefined,
): AddressValidationVerdict['components'] {
  if (!Array.isArray(addressComponents)) return {};
  const result: AddressValidationVerdict['components'] = {};
  for (const c of addressComponents) {
    const text = c.componentName?.text;
    if (!text) continue;
    switch (c.componentType) {
      case 'street_number':
      case 'route':
        // Combine into street — route is the street name, street_number the number
        result.street = result.street ? `${result.street} ${text}` : text;
        break;
      case 'subpremise':
        result.secondary = text;
        break;
      case 'locality':
        result.city = text;
        break;
      case 'administrative_area_level_1':
        result.state = text;
        break;
      case 'postal_code':
        result.zip = text;
        break;
      case 'country':
        result.country = text;
        break;
      default:
        break;
    }
  }
  return result;
}

// ─── Verdict mapping ──────────────────────────────────────────────────────────

/**
 * Maps the Google Address Validation API response to the internal
 * AddressValidationVerdict discriminated union.
 *
 * Mapping table (from plan §Data source mapping):
 *   addressComplete=true + !inferred + !unconfirmed → 'valid'
 *   hasInferredComponents=true                      → 'needs_correction'
 *   hasUnconfirmedComponents=true                   → 'unconfirmed'
 *   addressComplete=false                           → 'invalid'
 */
function mapVerdict(raw: Record<string, unknown>): AddressValidationVerdict {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (raw as any)?.result ?? {};
  const verdict = result?.verdict ?? {};
  const geocode = result?.geocode ?? {};
  const address = result?.address ?? {};

  const addressComplete: boolean = verdict.addressComplete === true;
  const hasInferred: boolean = verdict.hasInferredComponents === true;
  const hasUnconfirmed: boolean = verdict.hasUnconfirmedComponents === true;

  const formatted: string = address.formattedAddress ?? '';
  const components = extractComponents(address.addressComponents);

  let coords: AddressValidationVerdict['coords'];
  const loc = geocode.location;
  if (
    loc &&
    typeof loc.latitude === 'number' &&
    typeof loc.longitude === 'number'
  ) {
    coords = { lat: loc.latitude, lng: loc.longitude };
  }

  let status: AddressValidationVerdict['status'];
  let suggestedAddress: string | undefined;

  if (!addressComplete) {
    status = 'invalid';
  } else if (hasInferred) {
    status = 'needs_correction';
    suggestedAddress = formatted || undefined;
  } else if (hasUnconfirmed) {
    status = 'unconfirmed';
  } else {
    status = 'valid';
  }

  return {
    status,
    formatted,
    components,
    coords,
    ...(suggestedAddress ? { suggestedAddress } : {}),
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ValidateAddressOptions {
  /** Override timeout in ms — for tests only. Default: 8000. */
  timeoutMs?: number;
}

/**
 * Validate a postal address via the Google Address Validation API.
 *
 * CRITICAL: This function is the FIRST gate in the property data pipeline.
 * Callers MUST check `verdict.status` before proceeding to downstream APIs.
 *
 * Never throws. Returns `status='api_failure'` on any upstream error.
 */
export async function validateAddress(
  address: string,
  opts: ValidateAddressOptions = {},
): Promise<AddressValidationVerdict> {
  const sanitized = sanitizeAddress(address);
  if (!sanitized) {
    logger.warn('[AddressValidation] rejected malformed input', {
      reason: 'failed_sanitization',
      lengthOk: address.trim().length <= MAX_ADDRESS_LEN,
    });
    return {
      status: 'invalid',
      fetchedAt: new Date().toISOString(),
    };
  }

  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    logger.warn('[AddressValidation] GOOGLE_MAPS_API_KEY not configured');
    return {
      status: 'api_failure',
      fetchedAt: new Date().toISOString(),
    };
  }

  const upstreamUrl = `https://addressvalidation.googleapis.com/v1:validateAddress?key=<REDACTED>`;
  const realUrl = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`;

  const timeoutMs = opts.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const _fetch = getFetch();
  try {
    const upstream = await _fetch(realUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: { addressLines: [sanitized] } }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      logger.warn('[AddressValidation] upstream non-2xx', {
        status: upstream.status,
        url: upstreamUrl,
      });
      return {
        status: 'api_failure',
        fetchedAt: new Date().toISOString(),
      };
    }

    const raw = await upstream.json() as Record<string, unknown>;
    return mapVerdict(raw);
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    // Scrub any accidental key appearance from error messages (Law #9)
    const rawMsg = err instanceof Error ? err.message : 'unknown';
    const safeMsg = rawMsg.replace(apiKey, '<REDACTED>');
    logger.warn('[AddressValidation] proxy error', {
      isTimeout,
      reason: safeMsg.slice(0, 120),
      url: upstreamUrl,
    });
    return {
      status: 'api_failure',
      fetchedAt: new Date().toISOString(),
    };
  }
}
