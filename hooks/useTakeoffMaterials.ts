/**
 * useTakeoffMaterials — Wave 8.
 *
 * Fetches Drew/PROCURE-derived materials for the project. Supports
 * optimistic `in_bundle` updates after `usePushToMaterials` succeeds.
 *
 * Law compliance:
 *   Law #7 — pure data bridge; in_bundle mutation is purely local optimistic
 *           state, the real state lives in the materials bundle (Pass D).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  getTakeoffMaterials,
  BlueprintsApiError,
  type TakeoffMaterial,
} from '@/lib/api/blueprintsApi';

export interface UseTakeoffMaterialsResult {
  materials: TakeoffMaterial[];
  isLoading: boolean;
  error: { code: string; message: string } | null;
  endpointMissing: boolean;
  refresh: () => void;
  /** Optimistic local update after a successful push-to-materials. */
  markInBundle: (materialIds: string[]) => void;
}

export function useTakeoffMaterials(projectId: string | null): UseTakeoffMaterialsResult {
  const { authenticatedFetch } = useAuthFetch();
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';
  const [materials, setMaterials] = useState<TakeoffMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!projectId || !officeId) {
      setMaterials([]);
      setEndpointMissing(false);
      return () => {
        mountedRef.current = false;
      };
    }
    setIsLoading(true);
    setError(null);
    getTakeoffMaterials(authenticatedFetch, projectId, officeId)
      .then((res) => {
        if (!mountedRef.current) return;
        setMaterials(res.materials);
        setEndpointMissing(res.endpointMissing);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        if (err instanceof BlueprintsApiError) {
          setError({ code: err.code, message: err.message });
        } else {
          setError({
            code: 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : 'Failed to load materials',
          });
        }
        setMaterials([]);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [authenticatedFetch, projectId, officeId]);

  const refresh = useCallback(() => {
    // No-op Wave 8: useEffect re-runs on projectId/officeId change.
  }, []);

  const markInBundle = useCallback((materialIds: string[]) => {
    const idSet = new Set(materialIds);
    setMaterials((prev) =>
      prev.map((m) => (idSet.has(m.material_id) ? { ...m, in_bundle: true } : m)),
    );
  }, []);

  return { materials, isLoading, error, endpointMissing, refresh, markInBundle };
}
