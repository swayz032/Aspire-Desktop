/**
 * Scope UI Store — Wave 12.
 *
 * Module-level listener bus (mirrors `plansPhotosUiStore` + `blueprintUploadStore`)
 * that lets the Scope canvas, the Tim Rail Controls tab, and the Tim Rail Context
 * tab share one piece of cosmetic UI state without prop drilling:
 *
 *   - `activeCard` — which Scope canvas card is showing
 *       ('story' | 'included' | 'not_in_base' | 'missing_inputs'
 *        | 'alternates' | 'tariff' | 'truth')
 *
 * Why a store, not props:
 *   - The Tim Rail Context payload exposes "Jump to Missing Inputs" / "Jump to
 *     Truth" affordances. Without a store these would require lifting state
 *     into <EstimateStudioShell /> and threading it through three children.
 *   - Wave 12 added the 'truth' chip + a TruthDistributionChart panel. The
 *     Context tab's truth-distribution bar deep-links into that panel.
 *
 * Aspire Laws:
 *   - Law #1: store is a render bus only — no decisions, no side effects.
 *   - Law #6: ephemeral session state; reset() wipes on tenant switch.
 */
import { useSyncExternalStore } from 'react';

export type ScopeCardKey =
  | 'story'
  | 'included'
  | 'not_in_base'
  | 'missing_inputs'
  | 'alternates'
  | 'tariff'
  | 'truth';

export interface ScopeUiSnapshot {
  activeCard: ScopeCardKey;
}

const INITIAL: ScopeUiSnapshot = {
  activeCard: 'story',
};

let state: ScopeUiSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function scopeUiActions(): {
  setActiveCard: (k: ScopeCardKey) => void;
  reset: () => void;
} {
  return {
    setActiveCard: (k) => {
      if (state.activeCard === k) return;
      state = { ...state, activeCard: k };
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

function getSnapshot(): ScopeUiSnapshot {
  return state;
}

export function useScopeUi(): ScopeUiSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test/devtool helper — read current snapshot synchronously (no hook). */
export function getScopeUiSnapshot(): ScopeUiSnapshot {
  return state;
}
