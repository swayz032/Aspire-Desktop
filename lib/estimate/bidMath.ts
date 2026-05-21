/**
 * Bid Math — Wave 15.
 *
 * Pure functions that turn the blueprint story (assemblies + materials)
 * into a flat list of bid line items + a final money stack. Zero React,
 * zero side-effects, deterministic.
 *
 * Used by every canvas in the Estimate tab so the totals shown in the
 * Bid Summary, Line Items table, Markup sliders, Tariff drill-down, and
 * Alternates bundles are always consistent (single source of truth).
 *
 * Aspire Laws:
 *   - Law #7: pure math layer — no fetch, no decisions, no side-effects.
 *   - NEVER returns NaN or negative totals. When inputs are malformed,
 *     returns `null` for the offending field and the caller renders "—".
 */
import type {
  BlueprintAssembly,
  BlueprintMaterial,
  TruthClass,
} from '@/lib/api/blueprintsApi';
import type { EstimateMarkupRules } from '@/lib/estimateUiStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Trade classification. Drives the trade-section grouping on the Bid Summary
 * canvas. Derived heuristically from the material / assembly label when the
 * backend doesn't tag it explicitly (Drew's classify stage doesn't always
 * emit a trade — Wave 4 will tighten this).
 */
export type Trade =
  | 'civil'
  | 'demolition'
  | 'structural'
  | 'framing'
  | 'plumbing'
  | 'electrical'
  | 'lighting'
  | 'hvac'
  | 'finishes'
  | 'specialty'
  | 'general';

export interface BidLineItem {
  /** Stable id — material_id or assembly_id from the backend. */
  id: string;
  /** Human-readable description rendered in tables / proposal. */
  description: string;
  /** Grouped trade — drives section headers on Bid Summary. */
  trade: Trade;
  /** Numeric quantity (always >= 0). */
  quantity: number;
  /** Display unit (sf, sheet, ea, etc.). */
  unit: string;
  /**
   * Unit price in USD. `null` means "RFQ needed" — line excluded from
   * subtotal, counted as a missing-input ship-blocker.
   */
  unitPrice: number | null;
  /** quantity × unitPrice in USD, or `null` when unitPrice is null. */
  lineTotal: number | null;
  /** Truth class (drives the inline truth chip). */
  truth: TruthClass;
  /** True when this line carries a tariff exposure. */
  tariffFlagged: boolean;
  /** Optional tariff $ impact (Wave 5 PROCURE), null when unknown. */
  tariffImpactUsd: number | null;
  /** Optional tariff note ("Section 232 steel", "Softwood lumber"...). */
  tariffNote: string | null;
  /** Source category — used for the "Source" column in Line Items. */
  source: 'material' | 'assembly';
  /** Optional supplier hint from PROCURE. */
  supplierHint: string | null;
}

export interface MoneyStack {
  /** Sum of every line where unitPrice is non-null and not hidden. */
  subtotal: number;
  /** Subtotal of lines flagged as labor (assemblies) only. */
  laborSubtotal: number;
  /** Subtotal of lines flagged as materials only. */
  materialsSubtotal: number;
  /** Subtotal × laborMarkupPct (applied to laborSubtotal only). */
  laborMarkup: number;
  /** Subtotal × materialsMarkupPct (applied to materialsSubtotal only). */
  materialsMarkup: number;
  /** Total tariff $ exposure for pass-through items. */
  tariffPassThrough: number;
  /** Contingency = (subtotal + markups) × contingencyPct. */
  contingency: number;
  /** Final total. NEVER negative — clamped to 0 on bad inputs. */
  total: number;
  /** Lines with `unitPrice === null` — these block ship-readiness. */
  rfqNeededCount: number;
}

// ---------------------------------------------------------------------------
// Trade classification heuristic
// ---------------------------------------------------------------------------

const TRADE_PATTERNS: Array<{ trade: Trade; pattern: RegExp }> = [
  { trade: 'demolition', pattern: /\b(demo|demolit|remov|tear[- ]out)\b/i },
  { trade: 'civil', pattern: /\b(civil|earth|excavat|grad|site work|sitework)\b/i },
  { trade: 'structural', pattern: /\b(steel|rebar|concrete|footing|foundation|column|beam|slab|joist)\b/i },
  { trade: 'framing', pattern: /\b(framing|stud|partition|drywall|gyp|sheathing|plywood|lumber|2x|wood)\b/i },
  { trade: 'plumbing', pattern: /\b(plumb|pipe|toilet|sink|faucet|drain|water heater|valve|fixture)\b/i },
  { trade: 'electrical', pattern: /\b(electric|outlet|breaker|panel|conduit|wire|gauge|romex|circuit)\b/i },
  { trade: 'lighting', pattern: /\b(light|lamp|fixture|led|sconce|chandelier|recess|track)\b/i },
  { trade: 'hvac', pattern: /\b(hvac|duct|ac|air handler|furnace|return|supply|register|vent|thermostat)\b/i },
  { trade: 'finishes', pattern: /\b(paint|tile|carpet|floor|ceiling|trim|moulding|cabinet|counter)\b/i },
  { trade: 'specialty', pattern: /\b(elevator|sprinkler|fire|alarm|security|av|low[- ]voltage)\b/i },
];

export function classifyTrade(label: string, assemblyType?: string): Trade {
  const haystack = `${label} ${assemblyType ?? ''}`.toLowerCase();
  for (const { trade, pattern } of TRADE_PATTERNS) {
    if (pattern.test(haystack)) return trade;
  }
  return 'general';
}

export const TRADE_DISPLAY: Record<Trade, { label: string; order: number }> = {
  demolition: { label: 'Demolition', order: 1 },
  civil: { label: 'Civil / Sitework', order: 2 },
  structural: { label: 'Structural', order: 3 },
  framing: { label: 'Framing & Drywall', order: 4 },
  plumbing: { label: 'Plumbing', order: 5 },
  electrical: { label: 'Electrical', order: 6 },
  lighting: { label: 'Lighting', order: 7 },
  hvac: { label: 'HVAC', order: 8 },
  finishes: { label: 'Finishes', order: 9 },
  specialty: { label: 'Specialty', order: 10 },
  general: { label: 'General', order: 99 },
};

// ---------------------------------------------------------------------------
// Line item builder
// ---------------------------------------------------------------------------

function safeNumber(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Convert a BlueprintMaterial to a BidLineItem. Materials don't carry a
 * price field today (Wave 5 PROCURE will add one); we use `tariff_impact_usd`
 * as a price hint when present and otherwise mark the line "RFQ needed".
 */
function materialToLine(mat: BlueprintMaterial): BidLineItem {
  // Synthetic unit price heuristic: when PROCURE gave us tariff_impact_usd
  // we know the line is priced internally; absent that, ship as RFQ-needed.
  // This keeps v1 honest — we don't invent prices the backend never returned.
  const explicitPrice = (mat as unknown as { unit_price_usd?: number }).unit_price_usd;
  const unitPrice =
    typeof explicitPrice === 'number' && explicitPrice >= 0 ? explicitPrice : null;

  const qty = safeNumber(mat.quantity);
  const lineTotal = unitPrice != null ? qty * unitPrice : null;

  return {
    id: mat.material_id,
    description: mat.label,
    trade: classifyTrade(mat.label),
    quantity: qty,
    unit: mat.unit,
    unitPrice,
    lineTotal,
    truth: mat.truth,
    tariffFlagged: mat.tariff_flagged,
    tariffImpactUsd:
      typeof mat.tariff_impact_usd === 'number' ? mat.tariff_impact_usd : null,
    tariffNote: mat.tariff_note ?? null,
    source: 'material',
    supplierHint: mat.supplier_hint ?? null,
  };
}

/**
 * Convert a BlueprintAssembly to a BidLineItem. Assemblies are labor-leaning
 * (they describe work, not goods). v1 has no labor-rate backend yet, so the
 * unit price is null and the line surfaces as "RFQ needed" until a follow-up
 * Wave wires labor rates from office memory.
 */
function assemblyToLine(asm: BlueprintAssembly): BidLineItem {
  const explicitPrice = (asm as unknown as { unit_price_usd?: number }).unit_price_usd;
  const unitPrice =
    typeof explicitPrice === 'number' && explicitPrice >= 0 ? explicitPrice : null;
  const qty = safeNumber(asm.quantity);
  const lineTotal = unitPrice != null ? qty * unitPrice : null;
  return {
    id: asm.assembly_id,
    description: asm.label,
    trade: classifyTrade(asm.label, asm.assembly_type),
    quantity: qty,
    unit: asm.unit,
    unitPrice,
    lineTotal,
    truth: asm.truth,
    tariffFlagged: false,
    tariffImpactUsd: null,
    tariffNote: null,
    source: 'assembly',
    supplierHint: null,
  };
}

export interface BuildLineItemsInput {
  materials: BlueprintMaterial[];
  assemblies: BlueprintAssembly[];
  /** Lines marked included in base scope only — when true, drops alternates. */
  baseScopeOnly?: boolean;
  /** Inline quantity edits from estimateUiStore. */
  qtyOverrides?: Record<string, number>;
  /** Inline price edits from estimateUiStore. */
  priceOverrides?: Record<string, number>;
  /** Soft-deleted line ids — included in returned list, marked hidden=true. */
  hiddenLineItemIds?: ReadonlySet<string>;
}

export interface BuiltLineItems {
  /** All lines (including soft-deleted, with hidden=true flag). */
  all: Array<BidLineItem & { hidden: boolean }>;
  /** Lines grouped by trade in display order. */
  byTrade: Array<{ trade: Trade; lines: Array<BidLineItem & { hidden: boolean }> }>;
}

export function buildLineItems(input: BuildLineItemsInput): BuiltLineItems {
  const {
    materials,
    assemblies,
    baseScopeOnly = false,
    qtyOverrides = {},
    priceOverrides = {},
    hiddenLineItemIds = new Set<string>(),
  } = input;

  const matLines = materials.map(materialToLine);
  const asmLines = assemblies
    .filter((a) => (baseScopeOnly ? a.in_base_scope : true))
    .map(assemblyToLine);

  const merged: Array<BidLineItem & { hidden: boolean }> = [...matLines, ...asmLines].map(
    (line) => {
      // Apply per-line overrides + recompute lineTotal so the table is the
      // single source of truth for displayed numbers.
      const qty = qtyOverrides[line.id] != null ? safeNumber(qtyOverrides[line.id]) : line.quantity;
      const price =
        priceOverrides[line.id] != null
          ? safeNumber(priceOverrides[line.id])
          : line.unitPrice;
      const total = price != null ? qty * price : null;
      return {
        ...line,
        quantity: qty,
        unitPrice: price,
        lineTotal: total,
        hidden: hiddenLineItemIds.has(line.id),
      };
    },
  );

  // Group by trade, ordered.
  const groups = new Map<Trade, Array<BidLineItem & { hidden: boolean }>>();
  for (const line of merged) {
    const list = groups.get(line.trade) ?? [];
    list.push(line);
    groups.set(line.trade, list);
  }
  const byTrade = Array.from(groups.entries())
    .map(([trade, lines]) => ({ trade, lines }))
    .sort((a, b) => TRADE_DISPLAY[a.trade].order - TRADE_DISPLAY[b.trade].order);

  return { all: merged, byTrade };
}

// ---------------------------------------------------------------------------
// Money stack
// ---------------------------------------------------------------------------

export interface ComputeMoneyStackInput {
  lines: Array<BidLineItem & { hidden: boolean }>;
  markup: EstimateMarkupRules;
  /** Per-material absorb override. Material id → true=absorb, false=pass-through. */
  perMaterialAbsorb?: Record<string, boolean>;
}

export function computeMoneyStack(input: ComputeMoneyStackInput): MoneyStack {
  const { lines, markup, perMaterialAbsorb = {} } = input;
  try {
    let laborSubtotal = 0;
    let materialsSubtotal = 0;
    let tariffPassThrough = 0;
    let rfqNeededCount = 0;
    let subtotal = 0;

    for (const line of lines) {
      if (line.hidden) continue;
      if (line.lineTotal == null) {
        rfqNeededCount += 1;
        continue;
      }
      subtotal += line.lineTotal;
      if (line.source === 'assembly') {
        laborSubtotal += line.lineTotal;
      } else {
        materialsSubtotal += line.lineTotal;
      }
      // Tariff pass-through: per-material override wins over global default.
      if (line.tariffFlagged && line.tariffImpactUsd != null) {
        const override = perMaterialAbsorb[line.id];
        const absorb = override === undefined ? markup.tariffAbsorb : override;
        if (!absorb) tariffPassThrough += line.tariffImpactUsd;
      }
    }

    const laborMarkup = laborSubtotal * (markup.laborPct / 100);
    const materialsMarkup = materialsSubtotal * (markup.materialsPct / 100);
    const preContingency =
      subtotal + laborMarkup + materialsMarkup + tariffPassThrough;
    const contingency = preContingency * (markup.contingencyPct / 100);
    const total = preContingency + contingency;

    if (!Number.isFinite(total) || total < 0) {
      console.warn('[bidMath] non-finite total computed, returning zeros', {
        subtotal,
        laborMarkup,
        materialsMarkup,
        tariffPassThrough,
        contingency,
      });
      return {
        subtotal: 0,
        laborSubtotal: 0,
        materialsSubtotal: 0,
        laborMarkup: 0,
        materialsMarkup: 0,
        tariffPassThrough: 0,
        contingency: 0,
        total: 0,
        rfqNeededCount,
      };
    }

    return {
      subtotal,
      laborSubtotal,
      materialsSubtotal,
      laborMarkup,
      materialsMarkup,
      tariffPassThrough,
      contingency,
      total,
      rfqNeededCount,
    };
  } catch (err) {
    console.warn('[bidMath] computeMoneyStack threw, returning zeros', err);
    return {
      subtotal: 0,
      laborSubtotal: 0,
      materialsSubtotal: 0,
      laborMarkup: 0,
      materialsMarkup: 0,
      tariffPassThrough: 0,
      contingency: 0,
      total: 0,
      rfqNeededCount: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Bid health (red / yellow / green)
// ---------------------------------------------------------------------------

export type BidHealth = 'green' | 'yellow' | 'red';

export interface BidHealthResult {
  level: BidHealth;
  /** 0..1 average confidence across non-hidden lines. */
  confidence: number;
  /** Lines marked `assumed` or `missing` (non-hidden). */
  assumedCount: number;
  /** Lines with no price — blocks send. */
  rfqNeededCount: number;
  /** Lines marked `missing` (ship-blockers). */
  missingCount: number;
}

const TRUTH_RANK: Record<TruthClass, number> = {
  field_confirmed: 1,
  vendor_confirmed: 1,
  permit_confirmed: 1,
  observed: 0.95,
  derived: 0.78,
  assumed: 0.45,
  missing: 0.1,
};

const DERIVED_OR_BETTER: ReadonlySet<TruthClass> = new Set<TruthClass>([
  'observed',
  'derived',
  'field_confirmed',
  'vendor_confirmed',
  'permit_confirmed',
]);

export function computeBidHealth(
  lines: Array<BidLineItem & { hidden: boolean }>,
): BidHealthResult {
  let total = 0;
  let count = 0;
  let assumedCount = 0;
  let rfqNeededCount = 0;
  let missingCount = 0;
  let allDerivedOrBetter = true;

  for (const line of lines) {
    if (line.hidden) continue;
    count += 1;
    total += TRUTH_RANK[line.truth] ?? 0.5;
    if (line.truth === 'assumed') assumedCount += 1;
    if (line.truth === 'missing') {
      missingCount += 1;
      allDerivedOrBetter = false;
    }
    if (!DERIVED_OR_BETTER.has(line.truth)) allDerivedOrBetter = false;
    if (line.lineTotal == null) rfqNeededCount += 1;
  }

  const confidence = count === 0 ? 0 : total / count;

  let level: BidHealth;
  if (missingCount > 0 || rfqNeededCount > 0) {
    level = 'red';
  } else if (allDerivedOrBetter && assumedCount === 0) {
    level = 'green';
  } else {
    level = 'yellow';
  }

  return { level, confidence, assumedCount, rfqNeededCount, missingCount };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatUsd(n: number | null | undefined, opts?: { sign?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = opts?.sign && n > 0 ? '+' : '';
  return `${sign}$${Math.round(n).toLocaleString('en-US')}`;
}

export function formatUsdCents(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}
