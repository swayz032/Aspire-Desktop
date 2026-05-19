/**
 * Service Memory detail hook — Wave 5.1b-7.
 *
 * Mirror of `lib/memory/useMemoryDetail.ts` wired to the service-hub backend
 * route `/api/v1/service-memory/{memoryId}`. Express proxy mints the
 * capability token + injects Gateway-trusted scope headers and forwards to
 * the Python orchestrator (`MemoryService.get(memory_id)`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  API_BASE,
  MemoryApiError,
  mapMemoryDetail,
  SERVICE_MEMORY_DETAIL_PATH,
  type BackendMemoryObject,
} from '@/lib/api/serviceMemory';
import type { MemoryDetail } from '@/components/office-memory/types';

export interface UseServiceMemoryDetailResult {
  memory: MemoryDetail | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useServiceMemoryDetail(
  memoryId: string | undefined,
): UseServiceMemoryDetailResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId;

  const [memory, setMemory] = useState<MemoryDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!memoryId) {
      setMemory(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!officeId) {
      setLoading(true);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let cancelled = false;

    setLoading(true);
    setError(null);

    const url = `${API_BASE}${SERVICE_MEMORY_DETAIL_PATH(memoryId)}`;

    (async () => {
      try {
        const resp = await authenticatedFetch(url, {
          method: 'GET',
          headers: { 'X-Office-Id': officeId },
          signal: ctrl.signal,
        });

        if (resp.status === 404) {
          if (cancelled) return;
          setMemory(null);
          setLoading(false);
          return;
        }

        if (!resp.ok) {
          let code = 'SERVICE_MEMORY_DETAIL_FAILED';
          try {
            const errBody = await resp.json();
            code = errBody?.detail?.code ?? errBody?.error ?? code;
          } catch {
            // ignore parse errors
          }
          throw new MemoryApiError(
            resp.status,
            code,
            `Service memory detail failed (${resp.status})`,
          );
        }

        const json = (await resp.json()) as
          | BackendMemoryObject
          | { memory: BackendMemoryObject };
        if (cancelled) return;
        const obj =
          'memory_id' in json
            ? json
            : (json as { memory: BackendMemoryObject }).memory;
        setMemory(mapMemoryDetail(obj));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setMemory(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [authenticatedFetch, officeId, memoryId, refetchTick]);

  const refetch = useCallback(() => {
    setRefetchTick((t) => t + 1);
  }, []);

  return { memory, loading, error, refetch };
}
