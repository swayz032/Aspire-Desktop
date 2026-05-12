/**
 * useMaterialsBundle — Pass B (mock implementation).
 *
 * Module-level listener store so the BundleSummaryBar, ProductGrid, and the
 * PredictiveAddons all stay in sync without prop-drilling. Pass D will swap
 * this for Supabase-backed `material_bundles` (RLS, tenant-scoped).
 */
import { useCallback, useEffect, useState } from 'react';
import type { Product } from './useMaterialsSearch';

export interface BundleItem {
  productId: string;
  product: Product;
  quantity: number;
  addedAt: string;
}

let _bundle: BundleItem[] = [];
let _boundAddress: string | null = null;
const _listeners = new Set<(b: BundleItem[]) => void>();

function notify(): void {
  for (const l of _listeners) {
    try {
      l([..._bundle]);
    } catch {
      /* swallow */
    }
  }
}

export function getBundle(): BundleItem[] {
  return [..._bundle];
}

export interface UseMaterialsBundleResult {
  bundle: BundleItem[];
  addToBundle: (product: Product, quantity?: number) => void;
  removeFromBundle: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearBundle: () => void;
  bundleSubtotal: number;
  bundleSupplierCount: number;
  bundleItemCount: number;
  pushToEstimate: () => Promise<void>;
}

export function useMaterialsBundle(projectAddress: string = ''): UseMaterialsBundleResult {
  // Bind the in-memory bundle to a project address. Switching addresses
  // auto-clears the shadow so no cross-project leakage occurs.
  if (_boundAddress !== null && _boundAddress !== projectAddress) {
    _bundle = [];
  }
  _boundAddress = projectAddress;

  const [bundle, setBundle] = useState<BundleItem[]>(_bundle);

  useEffect(() => {
    const listener = (b: BundleItem[]) => setBundle(b);
    _listeners.add(listener);
    setBundle([..._bundle]);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  // Reset the bundle when projectAddress changes after first render.
  useEffect(() => {
    if (_boundAddress !== projectAddress) {
      _bundle = [];
      _boundAddress = projectAddress;
      notify();
    }
  }, [projectAddress]);

  const addToBundle = useCallback((product: Product, quantity: number = 1) => {
    const existingIdx = _bundle.findIndex((b) => b.productId === product.id);
    if (existingIdx >= 0) {
      _bundle = _bundle.map((b, i) =>
        i === existingIdx ? { ...b, quantity: b.quantity + quantity } : b,
      );
    } else {
      _bundle = [
        ..._bundle,
        {
          productId: product.id,
          product,
          quantity,
          addedAt: new Date().toISOString(),
        },
      ];
    }
    notify();
  }, []);

  const removeFromBundle = useCallback((productId: string) => {
    _bundle = _bundle.filter((b) => b.productId !== productId);
    notify();
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      _bundle = _bundle.filter((b) => b.productId !== productId);
    } else {
      _bundle = _bundle.map((b) => (b.productId === productId ? { ...b, quantity } : b));
    }
    notify();
  }, []);

  const clearBundle = useCallback(() => {
    _bundle = [];
    notify();
  }, []);

  const bundleSubtotal = bundle.reduce((sum, b) => sum + b.product.price * b.quantity, 0);
  const supplierIds = new Set(bundle.map((b) => b.product.store.id));
  const bundleSupplierCount = supplierIds.size;
  const bundleItemCount = bundle.reduce((sum, b) => sum + b.quantity, 0);

  const pushToEstimate = useCallback(async () => {
    // Pass D will: POST /v1/estimates/drafts with {items, projectAddress}.
    // Pass B: no-op + log so the click handler is real.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info(
        '[materials] pushToEstimate (mock)',
        _bundle.map((b) => ({ id: b.productId, qty: b.quantity })),
      );
    }
  }, []);

  return {
    bundle,
    addToBundle,
    removeFromBundle,
    updateQuantity,
    clearBundle,
    bundleSubtotal,
    bundleSupplierCount,
    bundleItemCount,
    pushToEstimate,
  };
}

/** Test seam — clear module state between cases. */
export function __resetMaterialsBundleForTests(): void {
  _bundle = [];
  _boundAddress = null;
  _listeners.clear();
}
