/**
 * Estimate UI Store — Wave 15.
 *
 * Module-level listener bus (mirrors `plansPhotosUiStore` + `uiStore`) that
 * lets the Estimate canvas, the bottom chip strip, and the Tim Rail Context
 * tab share two pieces of cosmetic UI state without prop drilling:
 *
 *   - `activeCard`  — which Estimate canvas card is showing
 *                     ('bid_summary' | 'line_items' | 'markup_margins' |
 *                      'tariff_exposure' | 'alternates_bundles' | 'export_send')
 *   - `markup`      — live markup rules the contractor is dialing in:
 *                       laborPct / materialsPct / contingencyPct /
 *                       tariffAbsorb (boolean)
 *
 * The markup state is intentionally NOT persisted to localStorage. v1 ships
 * with hardcoded defaults; the "Save markup rules to office memory" button
 * in MarkupMarginsCanvas is a stub. When the office-memory backend lands the
 * read path will become this store's `init`, and the write path becomes the
 * Save button's real implementation.
 *
 * Aspire Laws:
 *   - Law #1: store is a render bus only — no decisions, no side effects.
 *   - Law #6: ephemeral session state, wiped on tenant switch via reset().
 *   - Law #7: pure render layer — no autonomous money decisions live here.
 */
import { useSyncExternalStore } from 'react';

export type EstimateCardKey =
  | 'bid_summary'
  | 'line_items'
  | 'markup_margins'
  | 'tariff_exposure'
  | 'alternates_bundles'
  | 'export_send';

export interface EstimateMarkupRules {
  /** Labor markup %, default 18, clamped 0..100. */
  laborPct: number;
  /** Materials markup %, default 22, clamped 0..100. */
  materialsPct: number;
  /** Contingency %, default 5, clamped 0..20. */
  contingencyPct: number;
  /**
   * True = absorb tariff add-on into our margin (no client-visible line).
   * False = pass-through (added to the bid total as a labeled line).
   */
  tariffAbsorb: boolean;
}

export interface EstimateUiSnapshot {
  activeCard: EstimateCardKey;
  markup: EstimateMarkupRules;
  /** Per-material override of absorb/pass-through. Material id → absorb? */
  perMaterialAbsorb: Record<string, boolean>;
  /** Line items the contractor has soft-deleted (strikethrough). */
  hiddenLineItemIds: Set<string>;
  /** Inline quantity edits keyed by line-item id. */
  qtyOverrides: Record<string, number>;
  /** Inline unit-price edits keyed by line-item id. */
  priceOverrides: Record<string, number>;
}

const INITIAL_MARKUP: EstimateMarkupRules = {
  laborPct: 18,
  materialsPct: 22,
  contingencyPct: 5,
  tariffAbsorb: false,
};

const INITIAL: EstimateUiSnapshot = {
  activeCard: 'bid_summary',
  markup: INITIAL_MARKUP,
  perMaterialAbsorb: {},
  hiddenLineItemIds: new Set<string>(),
  qtyOverrides: {},
  priceOverrides: {},
};

let state: EstimateUiSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export function estimateUiActions(): {
  setActiveCard: (k: EstimateCardKey) => void;
  setLaborPct: (pct: number) => void;
  setMaterialsPct: (pct: number) => void;
  setContingencyPct: (pct: number) => void;
  setTariffAbsorb: (absorb: boolean) => void;
  toggleMaterialAbsorb: (materialId: string) => void;
  hideLineItem: (id: string) => void;
  unhideLineItem: (id: string) => void;
  setQtyOverride: (id: string, qty: number) => void;
  setPriceOverride: (id: string, price: number) => void;
  resetMarkup: () => void;
  reset: () => void;
} {
  return {
    setActiveCard: (k) => {
      if (state.activeCard === k) return;
      state = { ...state, activeCard: k };
      emit();
    },
    setLaborPct: (pct) => {
      const next = clamp(pct, 0, 100);
      if (state.markup.laborPct === next) return;
      state = { ...state, markup: { ...state.markup, laborPct: next } };
      emit();
    },
    setMaterialsPct: (pct) => {
      const next = clamp(pct, 0, 100);
      if (state.markup.materialsPct === next) return;
      state = { ...state, markup: { ...state.markup, materialsPct: next } };
      emit();
    },
    setContingencyPct: (pct) => {
      const next = clamp(pct, 0, 20);
      if (state.markup.contingencyPct === next) return;
      state = { ...state, markup: { ...state.markup, contingencyPct: next } };
      emit();
    },
    setTariffAbsorb: (absorb) => {
      if (state.markup.tariffAbsorb === absorb) return;
      state = { ...state, markup: { ...state.markup, tariffAbsorb: absorb } };
      emit();
    },
    toggleMaterialAbsorb: (materialId) => {
      const current = state.perMaterialAbsorb[materialId];
      // Default falls back to the global tariffAbsorb when not set per-item.
      const nextVal = current === undefined ? !state.markup.tariffAbsorb : !current;
      state = {
        ...state,
        perMaterialAbsorb: { ...state.perMaterialAbsorb, [materialId]: nextVal },
      };
      emit();
    },
    hideLineItem: (id) => {
      if (state.hiddenLineItemIds.has(id)) return;
      const next = new Set(state.hiddenLineItemIds);
      next.add(id);
      state = { ...state, hiddenLineItemIds: next };
      emit();
    },
    unhideLineItem: (id) => {
      if (!state.hiddenLineItemIds.has(id)) return;
      const next = new Set(state.hiddenLineItemIds);
      next.delete(id);
      state = { ...state, hiddenLineItemIds: next };
      emit();
    },
    setQtyOverride: (id, qty) => {
      const next = clamp(qty, 0, 1_000_000);
      if (state.qtyOverrides[id] === next) return;
      state = { ...state, qtyOverrides: { ...state.qtyOverrides, [id]: next } };
      emit();
    },
    setPriceOverride: (id, price) => {
      const next = clamp(price, 0, 1_000_000);
      if (state.priceOverrides[id] === next) return;
      state = {
        ...state,
        priceOverrides: { ...state.priceOverrides, [id]: next },
      };
      emit();
    },
    resetMarkup: () => {
      state = { ...state, markup: INITIAL_MARKUP };
      emit();
    },
    reset: () => {
      state = {
        activeCard: 'bid_summary',
        markup: INITIAL_MARKUP,
        perMaterialAbsorb: {},
        hiddenLineItemIds: new Set<string>(),
        qtyOverrides: {},
        priceOverrides: {},
      };
      emit();
    },
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): EstimateUiSnapshot {
  return state;
}

export function useEstimateUi(): EstimateUiSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test seam — reset module state between cases. */
export function __resetEstimateUiForTests(): void {
  state = {
    activeCard: 'bid_summary',
    markup: INITIAL_MARKUP,
    perMaterialAbsorb: {},
    hiddenLineItemIds: new Set<string>(),
    qtyOverrides: {},
    priceOverrides: {},
  };
  listeners.clear();
}
