/**
 * usePropertyData — Visuals tab data hook (Service Hub Phase 3, Pass 3.2).
 *
 * Wraps `services/serviceHub/propertyDataApi.fetchPropertyData()` with:
 *   - 300ms debounce on address input (avoid fan-out per keystroke)
 *   - Discriminated state union (`idle | loading | success | partial |
 *     needs_correction | invalid | error`)
 *   - `forceRefresh()` and `retry()` controls
 *   - AbortController per request — stale fetches are cancelled when the
 *     address changes
 *
 * `partial` status bubbles up when the server returned `kind: 'ok'` but at
 * least one underlying source has `status: 'partial' | 'missing' |
 * 'api_failure'` (PropertyData.sources[]). Lets the UI show "Some data
 * still loading…" without flashing an error.
 *
 * Pattern: useState + useEffect (no SWR / react-query in repo). Mirrors
 * the lightweight hooks in `lib/messages/use*.ts`.
 *
 * Aspire Law compliance:
 *   - Law #6: no client-side suite_id manipulation; cookie/JWT carries it.
 *   - Law #7: pure render-layer hook; no autonomous mutations.
 *   - Law #9: never logs the address (could be unit-level PII).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  fetchPropertyData,
  type PropertyData,
  type AddressValidationVerdict,
  type SourceStatus,
} from '@/services/serviceHub/propertyDataApi';

export type PropertyDataStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'partial'
  | 'needs_correction'
  | 'invalid'
  | 'error';

export type UsePropertyDataResult = {
  data?: PropertyData;
  status: PropertyDataStatus;
  verdict?: AddressValidationVerdict;
  suggestedAddress?: string;
  error?: string;
  /** Re-fire the last fetch. */
  retry: () => void;
  /** Re-fire with `forceRefresh: true` (bypass server cache). */
  forceRefresh: () => void;
};

const DEBOUNCE_MS = 300;

function isPartial(data: PropertyData): boolean {
  if (!data.sources || data.sources.length === 0) return false;
  return data.sources.some(
    (s: SourceStatus) =>
      s.status === 'partial' ||
      s.status === 'missing' ||
      s.status === 'api_failure',
  );
}

export function usePropertyData(
  address: string | undefined,
): UsePropertyDataResult {
  const trimmed = (address ?? '').trim();
  const debouncedAddress = useDebouncedValue(trimmed, DEBOUNCE_MS);

  const [data, setData] = useState<PropertyData | undefined>(undefined);
  const [status, setStatus] = useState<PropertyDataStatus>('idle');
  const [verdict, setVerdict] = useState<AddressValidationVerdict | undefined>(
    undefined,
  );
  const [suggestedAddress, setSuggestedAddress] = useState<string | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);
  // Bumped to force re-fetch (retry / forceRefresh).
  const [revalidateKey, setRevalidateKey] = useState(0);

  // Latch tracking the last force-refresh request — paired with revalidateKey
  // so a single retry doesn't permanently flip into bypass-cache mode.
  const forceRefreshRef = useRef(false);

  const run = useCallback(
    async (addr: string, force: boolean, signal: AbortSignal) => {
      setStatus('loading');
      setError(undefined);
      try {
        const resp = await fetchPropertyData(
          { address: addr, forceRefresh: force },
          { signal },
        );
        if (signal.aborted) return;

        switch (resp.kind) {
          case 'ok': {
            setData(resp.data);
            setVerdict(undefined);
            setSuggestedAddress(undefined);
            setStatus(isPartial(resp.data) ? 'partial' : 'success');
            return;
          }
          case 'needs_correction': {
            setData(undefined);
            setSuggestedAddress(resp.suggestedAddress);
            setStatus('needs_correction');
            return;
          }
          case 'invalid': {
            setData(undefined);
            setVerdict(resp.verdict);
            setError(resp.message);
            setStatus('invalid');
            return;
          }
          case 'error': {
            setData(undefined);
            setError(resp.message);
            setStatus('error');
            return;
          }
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setData(undefined);
        setError((err as Error)?.message ?? 'Unknown error');
        setStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    if (!debouncedAddress) {
      setStatus('idle');
      setData(undefined);
      setError(undefined);
      setSuggestedAddress(undefined);
      setVerdict(undefined);
      return;
    }
    const ctrl = new AbortController();
    const force = forceRefreshRef.current;
    forceRefreshRef.current = false;
    void run(debouncedAddress, force, ctrl.signal);
    return () => ctrl.abort();
  }, [debouncedAddress, revalidateKey, run]);

  const retry = useCallback(() => {
    forceRefreshRef.current = false;
    setRevalidateKey((k) => k + 1);
  }, []);

  const forceRefresh = useCallback(() => {
    forceRefreshRef.current = true;
    setRevalidateKey((k) => k + 1);
  }, []);

  return {
    data,
    status,
    verdict,
    suggestedAddress,
    error,
    retry,
    forceRefresh,
  };
}
