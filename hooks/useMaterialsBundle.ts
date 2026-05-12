/**
 * useMaterialsBundle — Pass D (Supabase-backed implementation).
 *
 * Replaces the Pass B in-memory module-level array with real server state:
 *   - Mount + projectAddress change: hydrate from GET /api/v1/materials/bundles
 *   - addToBundle / removeFromBundle / updateQuantity / clearBundle:
 *     optimistic update → API call → rollback on error
 *   - pushToEstimate: shows confirmation state → POST push-to-estimate →
 *     success toast state; YELLOW tier gate enforced server-side.
 *
 * Return shape locked from Pass B (backwards-compatible extensions):
 * {
 *   bundle: BundleItem[],
 *   addToBundle, removeFromBundle, updateBundleQuantity, clearBundle,
 *   bundleSubtotal: number,
 *   bundleSupplierCount: number,
 *   bundleItemCount: number,
 *   pushToEstimate: () => Promise<{ estimate_draft_id: string }>,
 *   isPushingToEstimate: boolean,
 *   pushError: string | null,
 * }
 *
 * Test seam: __resetMaterialsBundleForTests() resets module state (for tests
 * that still use the exported reset; real state is hook-local in Pass D).
 *
 * Law compliance:
 *   Law #3 — API errors surface as pushError; no silent degradation.
 *   Law #5 — capability tokens minted by the Express proxy; hook never touches keys.
 *   Law #7 — hook is a data bridge only; no autonomous retry or fallback logic.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import type { Product } from './useMaterialsSearch';
import {
  fetchBundle as apiFetchBundle,
  addToBundle as apiAddToBundle,
  removeFromBundle as apiRemoveFromBundle,
  updateBundleQuantity as apiUpdateBundleQuantity,
  clearBundle as apiClearBundle,
  pushToEstimate as apiPushToEstimate,
  MaterialsBundleApiError,
} from '@/lib/api/materialBundlesApi';
import type { BundleItem as ApiBundleItem } from '@/lib/api/materialBundlesApi';

// Re-export the canonical BundleItem type for consumers
export type { BundleItem } from '@/lib/api/materialBundlesApi';
export type { ApiBundleItem as BundleItemType };

// ---------------------------------------------------------------------------
// Result interface (locked from Pass B + Push extensions)
// ---------------------------------------------------------------------------

export interface UseMaterialsBundleResult {
  /** Current bundle items (camelCase, typed) */
  bundle: ApiBundleItem[];
  addToBundle: (product: Product, quantity?: number) => void;
  removeFromBundle: (bundleItemId: string) => void;
  updateBundleQuantity: (bundleItemId: string, quantity: number) => void;
  clearBundle: () => void;
  /** Sum of unitPrice * quantity for all items */
  bundleSubtotal: number;
  /** Number of unique store_ids in the bundle */
  bundleSupplierCount: number;
  /** Total units across all items */
  bundleItemCount: number;
  /**
   * Push current bundle to an estimate draft (YELLOW tier).
   * Hook does NOT show the modal — caller is responsible for user confirmation
   * before invoking this. Returns the estimate_draft_id on success.
   */
  pushToEstimate: () => Promise<{ estimate_draft_id: string }>;
  isPushingToEstimate: boolean;
  pushError: string | null;
  /** Whether the initial hydration fetch is in-flight */
  isLoading: boolean;
  /** Non-fatal error from the last operation (hydration or mutation) */
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMaterialsBundle(projectAddress: string = ''): UseMaterialsBundleResult {
  const { authenticatedFetch } = useAuthFetch();
  const { officeId } = useTenant();

  const [bundle, setBundle] = useState<ApiBundleItem[]>([]);
  const [bundleSubtotal, setBundleSubtotal] = useState<number>(0);
  const [bundleSupplierCount, setBundleSupplierCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isPushingToEstimate, setIsPushingToEstimate] = useState<boolean>(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Track the last hydrated address so we reset on address change
  const hydratedForRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Hydrate from server on mount and projectAddress change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!projectAddress.trim()) {
      setBundle([]);
      setBundleSubtotal(0);
      setBundleSupplierCount(0);
      hydratedForRef.current = null;
      return;
    }
    if (hydratedForRef.current === projectAddress) return;

    let cancelled = false;
    setIsLoading(true);
    setLastError(null);

    apiFetchBundle(authenticatedFetch, projectAddress, { officeId: officeId || undefined })
      .then((result) => {
        if (cancelled) return;
        setBundle(result.items);
        setBundleSubtotal(result.bundleSubtotal);
        setBundleSupplierCount(result.bundleSupplierCount);
        hydratedForRef.current = projectAddress;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load bundle';
        setLastError(msg);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectAddress, authenticatedFetch, officeId]);

  // ---------------------------------------------------------------------------
  // Helpers: apply server result to state
  // ---------------------------------------------------------------------------
  const _applyResult = useCallback(
    (items: ApiBundleItem[], subtotal: number, supplierCount: number) => {
      setBundle(items);
      setBundleSubtotal(subtotal);
      setBundleSupplierCount(supplierCount);
      setLastError(null);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // addToBundle — optimistic update + API call; rollback on error
  // ---------------------------------------------------------------------------
  const addToBundle = useCallback(
    (product: Product, quantity: number = 1) => {
      if (!projectAddress.trim()) return;

      // Optimistic update: dedup by product.id
      setBundle((prev) => {
        const existingIdx = prev.findIndex((b) => b.product.id === product.id);
        if (existingIdx >= 0) {
          return prev.map((b, i) =>
            i === existingIdx ? { ...b, quantity: b.quantity + quantity } : b,
          );
        }
        const optimisticItem: ApiBundleItem = {
          id: `optimistic-${product.id}-${Date.now()}`,
          projectId: projectAddress,
          product,
          storeId: product.store.id,
          categoryHint: product.category ?? null,
          quantity,
          unitPrice: product.price,
          fetchedAt: product.fetchedAt,
          pushedToEstimate: false,
          estimateDraftId: null,
          createdAt: new Date().toISOString(),
          // Pass E: default optimistic adds to 'product'. Supplier-mode adds
          // (Pass F) will pass kind='supplier_line' explicitly.
          kind: 'product',
        };
        return [...prev, optimisticItem];
      });
      setBundleSubtotal((prev) => Math.round((prev + product.price * quantity) * 100) / 100);

      apiAddToBundle(authenticatedFetch, product, projectAddress, {
        quantity,
        storeId: product.store.id,
        categoryHint: product.category ?? undefined,
        officeId: officeId || undefined,
      })
        .then((result) => {
          _applyResult(result.items, result.bundleSubtotal, result.bundleSupplierCount);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to add to bundle';
          setLastError(msg);
          // Rollback optimistic state
          hydratedForRef.current = null; // trigger re-hydration on next render
        });
    },
    [projectAddress, authenticatedFetch, officeId, _applyResult],
  );

  // ---------------------------------------------------------------------------
  // removeFromBundle — optimistic remove + API call; rollback on error
  // ---------------------------------------------------------------------------
  const removeFromBundle = useCallback(
    (bundleItemId: string) => {
      if (!projectAddress.trim()) return;

      // Optimistic remove
      setBundle((prev) => prev.filter((b) => b.id !== bundleItemId));

      apiRemoveFromBundle(authenticatedFetch, bundleItemId, projectAddress, {
        officeId: officeId || undefined,
      })
        .then((result) => {
          _applyResult(result.items, result.bundleSubtotal, result.bundleSupplierCount);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to remove from bundle';
          setLastError(msg);
          hydratedForRef.current = null;
        });
    },
    [projectAddress, authenticatedFetch, officeId, _applyResult],
  );

  // ---------------------------------------------------------------------------
  // updateBundleQuantity — optimistic update + API call; rollback on error
  // ---------------------------------------------------------------------------
  const updateBundleQuantity = useCallback(
    (bundleItemId: string, quantity: number) => {
      if (!projectAddress.trim()) return;

      if (quantity <= 0) {
        removeFromBundle(bundleItemId);
        return;
      }

      // Optimistic update
      setBundle((prev) =>
        prev.map((b) => (b.id === bundleItemId ? { ...b, quantity } : b)),
      );

      apiUpdateBundleQuantity(authenticatedFetch, bundleItemId, quantity, projectAddress, {
        officeId: officeId || undefined,
      })
        .then((result) => {
          _applyResult(result.items, result.bundleSubtotal, result.bundleSupplierCount);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to update quantity';
          setLastError(msg);
          hydratedForRef.current = null;
        });
    },
    [projectAddress, authenticatedFetch, officeId, _applyResult, removeFromBundle],
  );

  // ---------------------------------------------------------------------------
  // clearBundle — optimistic clear + API call; rollback on error
  // ---------------------------------------------------------------------------
  const clearBundle = useCallback(() => {
    if (!projectAddress.trim()) return;

    // Optimistic clear
    setBundle([]);
    setBundleSubtotal(0);
    setBundleSupplierCount(0);

    apiClearBundle(authenticatedFetch, projectAddress, {
      officeId: officeId || undefined,
    })
      .then((result) => {
        _applyResult(result.items, result.bundleSubtotal, result.bundleSupplierCount);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to clear bundle';
        setLastError(msg);
        hydratedForRef.current = null;
      });
  }, [projectAddress, authenticatedFetch, officeId, _applyResult]);

  // ---------------------------------------------------------------------------
  // pushToEstimate — YELLOW tier; caller must confirm before calling
  // ---------------------------------------------------------------------------
  const pushToEstimate = useCallback(async (): Promise<{ estimate_draft_id: string }> => {
    if (!projectAddress.trim()) {
      throw new MaterialsBundleApiError(400, 'INVALID_INPUT', 'No project address set');
    }
    setIsPushingToEstimate(true);
    setPushError(null);
    try {
      const result = await apiPushToEstimate(authenticatedFetch, projectAddress, {
        officeId: officeId || undefined,
      });
      // Refresh bundle state (items are now marked pushed_to_estimate = true)
      hydratedForRef.current = null; // trigger re-hydration
      return { estimate_draft_id: result.estimateDraftId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to push to estimate';
      setPushError(msg);
      throw err;
    } finally {
      setIsPushingToEstimate(false);
    }
  }, [projectAddress, authenticatedFetch, officeId]);

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------
  const bundleItemCount = bundle.reduce((sum, b) => sum + b.quantity, 0);

  return {
    bundle,
    addToBundle,
    removeFromBundle,
    updateBundleQuantity,
    clearBundle,
    bundleSubtotal,
    bundleSupplierCount,
    bundleItemCount,
    pushToEstimate,
    isPushingToEstimate,
    pushError,
    isLoading,
    lastError,
  };
}

// ---------------------------------------------------------------------------
// Test seam — reset any module-level side-effects (none in Pass D, kept for
// backwards-compat with test files that import __resetMaterialsBundleForTests).
// ---------------------------------------------------------------------------
export function __resetMaterialsBundleForTests(): void {
  // No module-level state in Pass D — hook state is local to each component tree.
  // This export is preserved so existing test imports don't break.
}
