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
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  useMaterialsSearch,
  type UseMaterialsSearchResult,
} from '@/hooks/useMaterialsSearch';
import {
  useMaterialsBundle,
  type UseMaterialsBundleResult,
} from '@/hooks/useMaterialsBundle';

export type MaterialsCanvasView = 'results' | 'route';

interface MaterialsSearchContextValue {
  search: UseMaterialsSearchResult;
  bundle: UseMaterialsBundleResult;
  canvasView: MaterialsCanvasView;
  setCanvasView: (v: MaterialsCanvasView) => void;
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

  // Auto-revert to results when the closest store disappears (e.g. user
  // cleared the search) — keeps the canvas honest.
  useEffect(() => {
    if (canvasView === 'route' && !search.closestStore) {
      setCanvasView('results');
    }
  }, [canvasView, search.closestStore]);

  const value = useMemo(
    () => ({ search, bundle, canvasView, setCanvasView }),
    [search, bundle, canvasView],
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
