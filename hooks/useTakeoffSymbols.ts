/**
 * useTakeoffSymbols — Wave 8.
 *
 * Fetches Drew-detected symbols for the active sheet (or whole project if
 * `sheetId` is null). Degrades gracefully when the Wave 2.7 backend GET
 * endpoint is not yet wired (`endpointMissing` flag).
 *
 * Law compliance:
 *   Law #6 — officeId from useTenant(); suiteId never set by client.
 *   Law #7 — pure data bridge; no autonomous decisions.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  getTakeoffSymbols,
  BlueprintsApiError,
  type TakeoffSymbol,
  type ListTakeoffSymbolsOptions,
} from '@/lib/api/blueprintsApi';

export interface UseTakeoffSymbolsResult {
  symbols: TakeoffSymbol[];
  isLoading: boolean;
  error: { code: string; message: string } | null;
  /** True when the backend returned 404/501 — Wave 2.7 not yet merged. */
  endpointMissing: boolean;
  refresh: () => void;
}

export function useTakeoffSymbols(
  projectId: string | null,
  opts: ListTakeoffSymbolsOptions = {},
): UseTakeoffSymbolsResult {
  const { authenticatedFetch } = useAuthFetch();
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';
  const [symbols, setSymbols] = useState<TakeoffSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const mountedRef = useRef(true);

  // Stable primitive deps — avoid the infinite loop caused by `opts`
  // being a fresh object on every parent render.
  const sheetIdDep = opts.sheet_id ?? '';
  const confFloorDep = opts.confidence_floor ?? '';
  const classPrefixDep = opts.class_prefix ?? '';

  useEffect(() => {
    mountedRef.current = true;
    if (!projectId || !officeId) {
      setSymbols([]);
      setEndpointMissing(false);
      return () => {
        mountedRef.current = false;
      };
    }
    setIsLoading(true);
    setError(null);
    const reqOpts: ListTakeoffSymbolsOptions = {
      sheet_id: sheetIdDep || undefined,
      confidence_floor: typeof confFloorDep === 'number' ? confFloorDep : undefined,
      class_prefix: classPrefixDep || undefined,
    };
    getTakeoffSymbols(authenticatedFetch, projectId, officeId, reqOpts)
      .then((res) => {
        if (!mountedRef.current) return;
        setSymbols(res.symbols);
        setEndpointMissing(res.endpointMissing);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        if (err instanceof BlueprintsApiError) {
          setError({ code: err.code, message: err.message });
        } else {
          setError({
            code: 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : 'Failed to load symbols',
          });
        }
        setSymbols([]);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [authenticatedFetch, projectId, officeId, sheetIdDep, confFloorDep, classPrefixDep]);

  // `refresh()` re-uses the same effect by forcing a key bump.
  // For simplicity (Wave 8), we expose a no-op that callers can invoke
  // once Wave 9 wires a refresh trigger; the current 404-degrading path
  // does not need one.
  const load = useCallback(() => {
    // Intentionally no-op until Wave 9. The useEffect above keeps state in
    // sync whenever the stable deps change.
  }, []);

  return { symbols, isLoading, error, endpointMissing, refresh: load };
}
