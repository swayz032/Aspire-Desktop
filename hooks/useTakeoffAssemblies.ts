/**
 * useTakeoffAssemblies — Wave 8.
 *
 * Fetches Drew-derived assemblies for the project. Degrades gracefully
 * when the Wave 2.7 backend GET endpoint isn't yet wired.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  getTakeoffAssemblies,
  BlueprintsApiError,
  type TakeoffAssembly,
} from '@/lib/api/blueprintsApi';

export interface UseTakeoffAssembliesResult {
  assemblies: TakeoffAssembly[];
  isLoading: boolean;
  error: { code: string; message: string } | null;
  endpointMissing: boolean;
  refresh: () => void;
}

export function useTakeoffAssemblies(projectId: string | null): UseTakeoffAssembliesResult {
  const { authenticatedFetch } = useAuthFetch();
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';
  const [assemblies, setAssemblies] = useState<TakeoffAssembly[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!projectId || !officeId) {
      setAssemblies([]);
      setEndpointMissing(false);
      return () => {
        mountedRef.current = false;
      };
    }
    setIsLoading(true);
    setError(null);
    getTakeoffAssemblies(authenticatedFetch, projectId, officeId)
      .then((res) => {
        if (!mountedRef.current) return;
        setAssemblies(res.assemblies);
        setEndpointMissing(res.endpointMissing);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        if (err instanceof BlueprintsApiError) {
          setError({ code: err.code, message: err.message });
        } else {
          setError({
            code: 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : 'Failed to load assemblies',
          });
        }
        setAssemblies([]);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [authenticatedFetch, projectId, officeId]);

  const refresh = useCallback(() => {
    // No-op Wave 8: useEffect re-runs whenever projectId/officeId change.
    // Wave 9 will add a refresh trigger when persistence lands.
  }, []);

  return { assemblies, isLoading, error, endpointMissing, refresh };
}
