/**
 * MaterialsSearchContext — shared state for the Materials tab's search + bundle.
 *
 * Why this exists: the Materials search bar and closest-store card live in the
 * EstimateStudio SHELL's contextual slot (where the project address bar lives
 * on other tabs). The product grid, filters, and bundle bar live in the
 * MATERIALS CANVAS (Slot child). Both halves need the same `useMaterialsSearch`
 * + `useMaterialsBundle` hook instance — otherwise typing in the bar wouldn't
 * update the grid.
 *
 * This provider wraps the EstimateStudio tree when the active route is the
 * Materials tab, mounts the hooks once, and exposes them via context to:
 *   - The shell's contextual slot (MaterialsSearchBar + ClosestStoreCard)
 *   - The canvas (MaterialsTab body)
 *
 * Aspire Law #7: pure render — hooks own all state.
 */
import React, { createContext, useContext } from 'react';
import {
  useMaterialsSearch,
  type UseMaterialsSearchResult,
} from '@/hooks/useMaterialsSearch';
import {
  useMaterialsBundle,
  type UseMaterialsBundleResult,
} from '@/hooks/useMaterialsBundle';

interface MaterialsSearchContextValue {
  search: UseMaterialsSearchResult;
  bundle: UseMaterialsBundleResult;
}

const MaterialsSearchContext = createContext<MaterialsSearchContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  projectAddress?: string;
}

export function MaterialsSearchProvider({ children, projectAddress }: ProviderProps) {
  const search = useMaterialsSearch();
  const bundle = useMaterialsBundle(projectAddress);
  return (
    <MaterialsSearchContext.Provider value={{ search, bundle }}>
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
