/**
 * MaterialsSearchContext — shared state for the Materials tab.
 *
 * Exposes:
 *   - search   : useMaterialsSearch() instance
 *   - bundle   : useMaterialsBundle() instance
 *   - canvasView / setCanvasView : which view the BIG canvas is rendering.
 *       'results' = product grid + filters + bundle (default)
 *       'route'   = full-bleed LiveRouteHero (premium canvas-swap; entered
 *                   from the Tim Rail "Today's Route" card, exited from the
 *                   back pill floating over the hero).
 *
 * Aspire Law #7: pure render — hooks own all state. The shell wraps the
 * tree in MaterialsSearchProvider when the active route is Materials.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  useMaterialsSearch,
  type UseMaterialsSearchResult,
} from '@/hooks/useMaterialsSearch';
import {
  useMaterialsBundle,
  type UseMaterialsBundleResult,
} from '@/hooks/useMaterialsBundle';

export type MaterialsCanvasView = 'results' | 'route';

/**
 * Pass E: search mode.
 *   - 'tool'     — default. Retail product search (Home Depot / Lowe's / etc).
 *   - 'supplier' — B2B specialty-supplier search (precast, wholesale lumber,
 *                  rebar, MEP, etc). Backend query uses `mode=supplier`.
 * Mode persists per session via this context.
 */
export type MaterialsMode = 'tool' | 'supplier';

/**
 * Pass E: keywords that trigger auto-flip from Tool → Supplier mode when the
 * user submits a search that clearly targets specialty/wholesale suppliers.
 * Keep the list lowercase; matching is substring-based.
 */
export const SUPPLIER_AUTO_KEYWORDS: readonly string[] = [
  'precast',
  'manhole',
  'concrete by yard',
  'wholesale',
  'bulk',
  'mep',
  'prestress',
  'structural steel',
  'dimensional lumber',
  'commercial grade',
  'lumber yard',
  'rebar',
  'lift station',
  'grease trap',
  'transformer',
] as const;

export function detectSupplierKeyword(query: string): string | null {
  const q = query.toLowerCase();
  if (!q.trim()) return null;
  for (const kw of SUPPLIER_AUTO_KEYWORDS) {
    if (q.includes(kw)) return kw;
  }
  return null;
}

interface MaterialsSearchContextValue {
  search: UseMaterialsSearchResult;
  bundle: UseMaterialsBundleResult;
  canvasView: MaterialsCanvasView;
  setCanvasView: (v: MaterialsCanvasView) => void;
  mode: MaterialsMode;
  setMode: (m: MaterialsMode) => void;
  /**
   * Pass E: when set, indicates the last auto-flip from Tool → Supplier mode
   * was triggered by the matched keyword. UI shows a one-line chip with a
   * tap-target to revert. Null when no auto-flip is active or user has
   * dismissed it.
   */
  autoFlipKeyword: string | null;
  clearAutoFlip: () => void;
}

export const MaterialsSearchContext = createContext<MaterialsSearchContextValue | null>(null);

/**
 * Null-tolerant reader for cross-tab consumers (e.g. the Tim Rail's Context
 * tab is mounted for ALL Estimate Studio tabs — only Materials wraps the
 * tree in the provider). Returns null off-route instead of throwing.
 */
export function useMaterialsSearchContextOptional(): MaterialsSearchContextValue | null {
  return useContext(MaterialsSearchContext);
}

interface ProviderProps {
  children: React.ReactNode;
  projectAddress?: string;
}

export function MaterialsSearchProvider({ children, projectAddress }: ProviderProps) {
  const search = useMaterialsSearch();
  const bundle = useMaterialsBundle(projectAddress);
  const [canvasView, setCanvasView] = useState<MaterialsCanvasView>('results');
  const [mode, setModeRaw] = useState<MaterialsMode>('tool');
  const [autoFlipKeyword, setAutoFlipKeyword] = useState<string | null>(null);

  // Auto-revert to results when the closest store disappears (e.g. user
  // cleared the search) — keeps the canvas honest.
  useEffect(() => {
    if (canvasView === 'route' && !search.closestStore) {
      setCanvasView('results');
    }
  }, [canvasView, search.closestStore]);

  // Pass E: client-side mode auto-detect. When the user submits a Tool-mode
  // search containing a supplier keyword (e.g. "precast"), flip to Supplier
  // mode and surface a one-line revertable chip below the slot bar.
  useEffect(() => {
    if (mode !== 'tool') return;
    if (!search.query) return;
    const kw = detectSupplierKeyword(search.query);
    if (kw) {
      setModeRaw('supplier');
      setAutoFlipKeyword(kw);
    }
  }, [search.query, mode]);

  const setMode = useCallback((m: MaterialsMode) => {
    setModeRaw(m);
    setAutoFlipKeyword(null); // any explicit mode change clears the auto-flip chip
  }, []);

  const clearAutoFlip = useCallback(() => {
    setModeRaw('tool');
    setAutoFlipKeyword(null);
  }, []);

  const value = useMemo(
    () => ({
      search,
      bundle,
      canvasView,
      setCanvasView,
      mode,
      setMode,
      autoFlipKeyword,
      clearAutoFlip,
    }),
    [search, bundle, canvasView, mode, setMode, autoFlipKeyword, clearAutoFlip],
  );

  return (
    <MaterialsSearchContext.Provider value={value}>
      {children}
    </MaterialsSearchContext.Provider>
  );
}

export function useMaterialsSearchContext(): MaterialsSearchContextValue {
  const v = useContext(MaterialsSearchContext);
  if (!v) {
    throw new Error(
      'useMaterialsSearchContext must be used inside <MaterialsSearchProvider>',
    );
  }
  return v;
}
