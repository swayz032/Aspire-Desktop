/**
 * useTenantA2pStatus — Lane E6 (plan §3.9.9).
 *
 * Reads the tenant's A2P registration status. Used to gate the SMS composer
 * + show the warning banner above the thread / compose surface.
 *
 * Status values:
 *   - 'unregistered'  — composer disabled, banner shown with set-up CTA
 *   - 'pending'       — composer disabled, banner shown ("verifying")
 *   - 'registered'    — composer enabled, no banner
 *
 * Lane B may not have exposed `/api/tenant/a2p-status` yet. When the route
 * 404s we fail safe to `'unregistered'` — that keeps the gate closed (Law #3
 * Fail Closed). A TODO in the source notes when Lane B lands the real route
 * we drop the safe-fallback branch.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { fetchTenantA2pStatus, MessagesApiError } from '@/lib/api/messages';
import type { TenantA2pStatus } from '@/components/messages/MessagesThreadView';

// 10 minutes — A2P state changes are slow (hours-to-days for registration).
const STALE_MS = 10 * 60 * 1000;

interface CacheEntry {
  status: TenantA2pStatus;
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry>();

export interface UseTenantA2pStatusResult {
  status: TenantA2pStatus;
  isLoading: boolean;
  isError: boolean;
  /** True iff the route actually responded (vs. 404 stub fallback). */
  isAuthoritative: boolean;
}

export function useTenantA2pStatus(): UseTenantA2pStatusResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';
  const key = officeId || '_';

  const cached = cache.get(key);
  const [status, setStatus] = useState<TenantA2pStatus>(
    () => cached?.status ?? 'unregistered',
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !cached);
  const [isAuthoritative, setIsAuthoritative] = useState<boolean>(
    () => !!cached,
  );
  const [isError, setIsError] = useState(false);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const doFetch = useCallback(async () => {
    if (!officeId) return;
    const existing = cache.get(key);
    const fresh = existing && Date.now() - existing.fetchedAt < STALE_MS;
    if (fresh) {
      if (mountedRef.current) {
        setStatus(existing!.status);
        setIsLoading(false);
        setIsAuthoritative(true);
        setIsError(false);
      }
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!existing && mountedRef.current) setIsLoading(true);
    try {
      const result = await fetchTenantA2pStatus({
        authenticatedFetch,
        officeId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      cache.set(key, { status: result, fetchedAt: Date.now() });
      if (mountedRef.current) {
        setStatus(result);
        setIsLoading(false);
        setIsAuthoritative(true);
        setIsError(false);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      // TODO(lane-b): when `/api/tenant/a2p-status` ships, drop the 404
      // fallback branch and surface the real error.
      const is404 =
        err instanceof MessagesApiError &&
        (err.status === 404 || err.code === 'A2P_STATUS_NOT_AVAILABLE');
      if (mountedRef.current) {
        if (is404) {
          // Fail safe: keep gate closed.
          setStatus('unregistered');
          setIsAuthoritative(false);
          setIsError(false);
        } else {
          setIsError(true);
        }
        setIsLoading(false);
      }
    }
  }, [authenticatedFetch, key, officeId]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  return {
    status,
    isLoading,
    isError,
    isAuthoritative,
  };
}
