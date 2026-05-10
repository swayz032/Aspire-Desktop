/**
 * Material Signals heuristic — Service Hub Phase 3, Pass 3.1.
 *
 * Deterministic, rules-based classifier that maps a Zillow propertyType
 * (homeType) and an optional Solar API roofType into a list of likely
 * building materials with high / medium / low confidence labels.
 *
 * Per V7.1 §1.3 + §5.6 (Roofing Claim Firewall analog):
 *   - All output rows carry a confidence enum so the UI can label them
 *     auto-detected, not measured/exact.
 *   - When solar.roofType is present, we override the roof material with
 *     a high-confidence row sourced from the Solar API (a real
 *     observation, not a heuristic guess).
 *
 * Phase 3.1 scope: small, reviewable rule table. Phase 9 replaces with a
 * trade-aware pricing + materials engine.
 */

export type MaterialSignal = {
  name: string;
  confidence: 'high' | 'medium' | 'low';
};

export type MaterialSignalInput = {
  /** Zillow homeType, e.g. 'WAREHOUSE', 'SINGLE_FAMILY'. Case-insensitive. */
  propertyType?: string;
  /** Solar API roofType — when present, overrides the heuristic roof row. */
  roofType?: string;
};

/** Normalize Zillow homeType to a stable bucket name. */
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

const TABLE: Record<string, MaterialSignal[]> = {
  INDUSTRIAL: [
    { name: 'Metal Wall Panels', confidence: 'high' },
    { name: 'TPO Roofing', confidence: 'high' },
    { name: 'Concrete Slab', confidence: 'medium' },
  ],
  COMMERCIAL: [
    { name: 'Glass Curtain Wall', confidence: 'medium' },
    { name: 'Built-up Roofing', confidence: 'medium' },
    { name: 'Concrete Slab', confidence: 'high' },
  ],
  SINGLE_FAMILY: [
    { name: 'Vinyl Siding', confidence: 'medium' },
    { name: 'Asphalt Shingles', confidence: 'high' },
    { name: 'Wood Frame', confidence: 'medium' },
  ],
  MULTI_FAMILY: [
    { name: 'Stucco', confidence: 'medium' },
    { name: 'Asphalt Shingles', confidence: 'medium' },
    { name: 'Wood Frame', confidence: 'high' },
  ],
};

/** Detect whether a material name describes the roof — used so the
 *  Solar API override can replace the right row. */
function isRoofMaterial(name: string): boolean {
  const v = name.toLowerCase();
  return (
    v.includes('roof') ||
    v.includes('shingle') ||
    v.includes('tpo') ||
    v.includes('built-up') ||
    v.includes('membrane')
  );
}

function prettyRoofMaterial(roofType: string): string {
  const v = roofType.trim();
  if (!v) return 'Roof Material';
  // Title-case simple values like "ASPHALT_SHINGLES" -> "Asphalt Shingles".
  return v
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function materialSignalsHeuristic(input: MaterialSignalInput): MaterialSignal[] {
  const key = bucket(input.propertyType);
  const base: MaterialSignal[] = key && TABLE[key] ? [...TABLE[key]] : [];

  const solarRoof = input.roofType?.trim();
  if (solarRoof) {
    const roofRow: MaterialSignal = {
      name: prettyRoofMaterial(solarRoof),
      confidence: 'high',
    };
    const idx = base.findIndex((row) => isRoofMaterial(row.name));
    if (idx >= 0) {
      base[idx] = roofRow;
    } else {
      base.push(roofRow);
    }
  }

  return base;
}
