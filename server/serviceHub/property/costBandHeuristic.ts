/**
 * Cost Band heuristic — Service Hub Phase 3, Pass 3.1.
 *
 * Deterministic sqft × $/sqft band by property type. Returns a structured
 * { low, high, currency: 'USD' } range. UI labels this "Quick Cost Int."
 * — a coarse signal, not a quote.
 *
 * Phase 9 replaces this with the full pricing engine (trade-aware,
 * region-aware, vendor-pulled). For Pass 3.1 we keep the table small and
 * easy to review.
 *
 * Per V7.1 §1.3: never present this as a measured estimate. UI must
 * surface "estimated range" and require manual review before pricing.
 */

export type CostBand = { low: number; high: number; currency: 'USD' };

export type CostBandInput = {
  sqft?: number;
  /** Zillow homeType, e.g. 'WAREHOUSE', 'SINGLE_FAMILY'. Case-insensitive. */
  propertyType?: string;
};

const RATE_TABLE: Record<string, { low: number; high: number }> = {
  INDUSTRIAL: { low: 8, high: 12 },
  COMMERCIAL: { low: 14, high: 22 },
  SINGLE_FAMILY: { low: 80, high: 180 },
  MULTI_FAMILY: { low: 90, high: 200 },
};

const FALLBACK_RATE = { low: 50, high: 150 };

function bucket(propertyType?: string): string | undefined {
  if (!propertyType) return undefined;
  const v = propertyType.trim().toUpperCase();
  if (!v) return undefined;
  if (v.includes('WAREHOUSE') || v.includes('INDUSTRIAL')) return 'INDUSTRIAL';
  if (v.includes('OFFICE') || v.includes('COMMERCIAL') || v.includes('RETAIL')) {
    return 'COMMERCIAL';
  }
  if (v.includes('MULTI') || v.includes('APARTMENT') || v.includes('CONDO')) {
    return 'MULTI_FAMILY';
  }
  if (
    v.includes('SINGLE_FAMILY') ||
    v.includes('SFR') ||
    v.includes('TOWNHOUSE') ||
    v === 'HOME' ||
    v === 'HOUSE'
  ) {
    return 'SINGLE_FAMILY';
  }
  return undefined;
}

export function costBandHeuristic(input: CostBandInput): CostBand {
  const sqft = input.sqft;
  if (typeof sqft !== 'number' || !Number.isFinite(sqft) || sqft <= 0) {
    return { low: 0, high: 0, currency: 'USD' };
  }
  const key = bucket(input.propertyType);
  const rate = (key && RATE_TABLE[key]) || FALLBACK_RATE;
  return {
    low: Math.round(sqft * rate.low),
    high: Math.round(sqft * rate.high),
    currency: 'USD',
  };
}
