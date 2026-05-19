/**
 * Plans & Photos UI Store — Wave 7 (Canvas Cleanup).
 *
 * Module-level listener bus (mirrors `blueprintUploadStore` + `uiStore`)
 * that lets the canvas, the Tim Rail Controls tab, and the Tim Rail Context
 * tab share two pieces of cosmetic UI state without prop drilling:
 *
 *   - `activeCard`   — which CanvasCardSwitcher card is showing
 *                      ('upload' | 'sheets' | 'disciplines' | 'revisions')
 *   - `filterKey`    — active discipline filter on the SheetThumbnailGrid
 *                      (null = "All", or an AIA discipline slug)
 *
 * Why a store, not props:
 *   - The bottom chip strip moved from the canvas into the Controls tab
 *     (user feedback 2026-05-18 — "BLUEPRINTS ONLY on the canvas").
 *   - The discipline filter chips moved from the canvas into the Context
 *     tab as a compact filter row.
 *   - Both surfaces are mounted as siblings under <EstimateStudioShell />,
 *     so prop-drilling would require lifting state to the shell + threading
 *     through three children. The store keeps each component self-contained.
 *
 * Aspire Laws:
 *   - Law #1: store is a render bus only — no decisions, no side effects.
 *   - Law #6: ephemeral session state, wiped on tenant switch via reset().
 */
import { useSyncExternalStore } from 'react';

export type PlansPhotosCardKey = 'upload' | 'sheets' | 'disciplines' | 'revisions';

export interface PlansPhotosUiSnapshot {
  activeCard: PlansPhotosCardKey;
  /** null = "All"; otherwise a lowercase AIA discipline slug. */
  filterKey: string | null;
}

const INITIAL: PlansPhotosUiSnapshot = {
  activeCard: 'upload',
  filterKey: null,
};

let state: PlansPhotosUiSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function plansPhotosUiActions(): {
  setActiveCard: (k: PlansPhotosCardKey) => void;
  setFilterKey: (k: string | null) => void;
  reset: () => void;
} {
  return {
    setActiveCard: (k) => {
      if (state.activeCard === k) return;
      state = { ...state, activeCard: k };
      emit();
    },
    setFilterKey: (k) => {
      if (state.filterKey === k) return;
      state = { ...state, filterKey: k };
      emit();
    },
    reset: () => {
      state = INITIAL;
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

function getSnapshot(): PlansPhotosUiSnapshot {
  return state;
}

export function usePlansPhotosUi(): PlansPhotosUiSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
