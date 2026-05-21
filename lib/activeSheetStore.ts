/**
 * activeSheetStore — Wave 16 (per-sheet premium Context).
 *
 * Tiny module-level listener store (mirrors `blueprintUploadStore` +
 * `plansPhotosUiStore`) that publishes the *currently focused* sheet on the
 * Plans & Photos canvas so the Tim Rail Context tab can render a
 * premium, sheet-specific payload without a prop-drilled provider.
 *
 *   SheetCanvasView (publisher)  →  activeSheetStore  →  SheetContextPayload
 *                                                          (subscriber)
 *
 * Ephemeral session state — intentionally NOT persisted to localStorage.
 * Active sheet resets on page reload (the canvas auto-selects the first
 * sheet on mount, so persisting would just create a stale selection that
 * disagrees with what the canvas actually shows).
 *
 * Aspire Laws:
 *   - Law #1: render bus only — no decisions, no side effects.
 *   - Law #7: setters are direct; no derivations, no backend calls.
 */
import { useSyncExternalStore } from 'react';

let activeSheetId: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/**
 * Set (or clear, when passing null) the currently focused sheet id.
 * No-ops when the value is unchanged so subscribers don't re-render
 * on identity-only updates from the canvas's useEffect.
 */
export function setActiveSheetId(id: string | null): void {
  if (activeSheetId === id) return;
  activeSheetId = id;
  emit();
}

/** Synchronous read — used by tests and non-React consumers. */
export function getActiveSheetId(): string | null {
  return activeSheetId;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | null {
  return activeSheetId;
}

/**
 * Reactive hook. Returns the current active sheet id and re-renders the
 * caller whenever it changes. Server snapshot returns the same value so
 * SSR/RSC paths don't trip the cross-render hydration check.
 */
export function useActiveSheetId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test/teardown hook — wipes state without emitting cross-tenant leak. */
export function _resetActiveSheetStoreForTests(): void {
  activeSheetId = null;
  listeners.clear();
}
