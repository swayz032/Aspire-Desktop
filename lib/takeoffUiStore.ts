/**
 * Takeoff UI Store — Wave 13.
 *
 * Listener-based module store (mirrors `plansPhotosUiStore` + `uiStore`)
 * that shares Takeoff tab UI state across:
 *   - Canvas surface (TakeoffTab, SheetViewerWithOverlay, AssemblyTable,
 *     QuantityTable, SymbolLegendPanel)
 *   - Tim Rail Context tab (TakeoffContextPayload — current-sheet meta,
 *     selected-symbol detail, confidence stats)
 *   - Tim Rail Controls tab (mode switcher echo when the user wants a
 *     compact rail-side mode picker — Wave 14)
 *
 * State shape:
 *   activeMode      — Commercial | Residential | Smart Room (soon) | Roofing (soon)
 *   activeCard      — Sheet Viewer | Assemblies | Quantities | Symbol Legend
 *   activeSheetId   — currently-selected blueprint sheet (or null)
 *   selectedSymbolId — currently-clicked bbox (drives the side-panel)
 *   overlayVisible  — global "show bounding boxes" toggle
 *   hiddenSymbolDisciplines — per-discipline hide set (driven by SymbolLegendPanel
 *                              toggles; SheetViewerWithOverlay reads to filter
 *                              the overlay layer)
 *   highlightedSheetIds — set used by AssemblyTable → "click row to highlight
 *                          source sheets on the chip strip"
 *
 * Aspire Laws:
 *   - Law #1: store is a render bus — no decisions, no side effects.
 *   - Law #6: ephemeral per-session state; reset on tenant switch via reset().
 *   - Law #7: pure UI bridge; backend writes (Confirm/RFI/Save) are stubs
 *     elsewhere that go through the orchestrator, not this store.
 */
import { useSyncExternalStore } from 'react';
import type { SymbolDiscipline } from '@/components/service-hub/estimate-studio/takeoff/symbolClasses';

// ---------------------------------------------------------------------------
// Public types — spec uses snake_case for chip keys; aliasing kebab is OK
// internally as long as the public surface matches.
// ---------------------------------------------------------------------------

export type TakeoffMode = 'commercial' | 'residential' | 'smart_room' | 'roofing';

export type TakeoffCard =
  | 'sheet_viewer'
  | 'assemblies'
  | 'quantities'
  | 'symbol_legend';

export interface TakeoffUiSnapshot {
  activeMode: TakeoffMode;
  activeCard: TakeoffCard;
  activeSheetId: string | null;
  selectedSymbolId: string | null;
  overlayVisible: boolean;
  /** Disciplines toggled off in the legend → hidden in the overlay. */
  hiddenSymbolDisciplines: ReadonlySet<SymbolDiscipline>;
  /** Sheet ids that AssemblyTable wants highlighted on the chip strip. */
  highlightedSheetIds: ReadonlySet<string>;
}

const INITIAL: TakeoffUiSnapshot = {
  activeMode: 'commercial',
  activeCard: 'sheet_viewer',
  activeSheetId: null,
  selectedSymbolId: null,
  overlayVisible: true,
  hiddenSymbolDisciplines: new Set(),
  highlightedSheetIds: new Set(),
};

let state: TakeoffUiSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TakeoffUiSnapshot {
  return state;
}

export function useTakeoffUi(): TakeoffUiSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface TakeoffUiActions {
  setActiveMode: (mode: TakeoffMode) => void;
  setActiveCard: (card: TakeoffCard) => void;
  setActiveSheetId: (id: string | null) => void;
  setSelectedSymbolId: (id: string | null) => void;
  setOverlayVisible: (visible: boolean) => void;
  toggleOverlayVisible: () => void;
  toggleSymbolDiscipline: (d: SymbolDiscipline) => void;
  setHighlightedSheetIds: (ids: readonly string[]) => void;
  clearHighlightedSheetIds: () => void;
  reset: () => void;
}

export function takeoffUiActions(): TakeoffUiActions {
  return {
    setActiveMode: (mode) => {
      if (state.activeMode === mode) return;
      state = { ...state, activeMode: mode };
      emit();
    },
    setActiveCard: (card) => {
      if (state.activeCard === card) return;
      state = { ...state, activeCard: card };
      emit();
    },
    setActiveSheetId: (id) => {
      if (state.activeSheetId === id) return;
      // Reset selected symbol when sheet changes — symbols are sheet-scoped.
      state = { ...state, activeSheetId: id, selectedSymbolId: null };
      emit();
    },
    setSelectedSymbolId: (id) => {
      if (state.selectedSymbolId === id) return;
      state = { ...state, selectedSymbolId: id };
      emit();
    },
    setOverlayVisible: (visible) => {
      if (state.overlayVisible === visible) return;
      state = { ...state, overlayVisible: visible };
      emit();
    },
    toggleOverlayVisible: () => {
      state = { ...state, overlayVisible: !state.overlayVisible };
      emit();
    },
    toggleSymbolDiscipline: (d) => {
      const next = new Set(state.hiddenSymbolDisciplines);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      state = { ...state, hiddenSymbolDisciplines: next };
      emit();
    },
    setHighlightedSheetIds: (ids) => {
      state = { ...state, highlightedSheetIds: new Set(ids) };
      emit();
    },
    clearHighlightedSheetIds: () => {
      if (state.highlightedSheetIds.size === 0) return;
      state = { ...state, highlightedSheetIds: new Set() };
      emit();
    },
    reset: () => {
      state = {
        ...INITIAL,
        hiddenSymbolDisciplines: new Set(),
        highlightedSheetIds: new Set(),
      };
      emit();
    },
  };
}

// ---------------------------------------------------------------------------
// Test-only helper — never used in production code.
// ---------------------------------------------------------------------------

/** @internal */
export function _resetTakeoffUiForTests(): void {
  state = {
    ...INITIAL,
    hiddenSymbolDisciplines: new Set(),
    highlightedSheetIds: new Set(),
  };
  emit();
}
