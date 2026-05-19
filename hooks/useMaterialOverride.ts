/**
 * useMaterialOverride — Wave 5.1a-5.
 *
 * Encapsulates the YELLOW material-override + skip + confirm flows for Drew-
 * sourced material picks surfaced in the "From Blueprint" canvas card.
 *
 * Three actions:
 *   - confirm(material_id)            — accepts Drew's suggestion as-is (no
 *                                       state mutation server-side; just a
 *                                       local "user confirmed" marker the
 *                                       FromBlueprintCard uses to hide the row
 *                                       from the unreviewed queue).
 *   - override(material_id, payload)  — rewrites the material_pick memory
 *                                       entry. YELLOW; emits receipt.
 *   - skip(material_id, reason?)      — marks the pick as user-skipped.
 *                                       YELLOW; emits receipt.
 *
 * Law compliance:
 *   Law #4 — confirm is GREEN (local-only). override + skip are YELLOW; the
 *           caller MUST present a confirmation gesture (panel CTA / two-tap
 *           skip) BEFORE invoking. Server-side capability scope is the real
 *           gate.
 *   Law #5 — capability token minted server-side by Express proxy.
 *   Law #7 — pure data bridge; no autonomous retry or downgrade.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  overrideMaterial,
  skipMaterial,
  BlueprintsApiError,
  type MaterialOverridePayload,
  type MaterialOverrideReason,
} from '@/lib/api/blueprintsApi';

export type OverrideStatus = 'idle' | 'pending' | 'success' | 'error';

export interface UseMaterialOverrideResult {
  /** Per-material status map (material_id → status). Lets the row render its
   *  own spinner / confirmed pill independently of the panel state. */
  statusById: Record<string, OverrideStatus>;
  /** Per-material error map for inline error states. */
  errorById: Record<string, { code: string; message: string } | null>;
  /** Set of material_ids the user has locally confirmed in this session. */
  confirmedIds: Set<string>;
  /** Set of material_ids the user has skipped in this session. */
  skippedIds: Set<string>;
  /** Set of material_ids the user has overridden in this session. */
  overriddenIds: Set<string>;
  /** Locally mark a material as user-confirmed (no server call). */
  confirm: (materialId: string) => void;
  /** Push an override to the server. Yellow tier; caller has gated UI. */
  override: (
    materialId: string,
    payload: MaterialOverridePayload,
    reason?: MaterialOverrideReason,
  ) => Promise<boolean>;
  /** Push a skip to the server. Yellow tier; caller has gated UI. */
  skip: (materialId: string, reason?: string) => Promise<boolean>;
  /** Reset row state (used when re-opening override panel after success). */
  reset: (materialId: string) => void;
}

export function useMaterialOverride(
  projectId: string | null,
): UseMaterialOverrideResult {
  const { authenticatedFetch } = useAuthFetch();
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';
  const mountedRef = useRef(true);

  const [statusById, setStatusById] = useState<Record<string, OverrideStatus>>({});
  const [errorById, setErrorById] = useState<
    Record<string, { code: string; message: string } | null>
  >({});
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [overriddenIds, setOverriddenIds] = useState<Set<string>>(new Set());

  const setRowStatus = useCallback(
    (id: string, status: OverrideStatus) =>
      setStatusById((prev) => ({ ...prev, [id]: status })),
    [],
  );
  const setRowError = useCallback(
    (id: string, err: { code: string; message: string } | null) =>
      setErrorById((prev) => ({ ...prev, [id]: err })),
    [],
  );

  const confirm = useCallback(
    (materialId: string) => {
      if (!materialId) return;
      setConfirmedIds((prev) => {
        if (prev.has(materialId)) return prev;
        const next = new Set(prev);
        next.add(materialId);
        return next;
      });
      setRowStatus(materialId, 'success');
      setRowError(materialId, null);
    },
    [setRowStatus, setRowError],
  );

  const override = useCallback(
    async (
      materialId: string,
      payload: MaterialOverridePayload,
      reason: MaterialOverrideReason = 'other',
    ): Promise<boolean> => {
      if (!projectId) {
        setRowError(materialId, { code: 'NO_PROJECT', message: 'No active project' });
        setRowStatus(materialId, 'error');
        return false;
      }
      setRowStatus(materialId, 'pending');
      setRowError(materialId, null);
      try {
        await overrideMaterial(
          authenticatedFetch,
          projectId,
          materialId,
          payload,
          reason,
          officeId,
        );
        if (!mountedRef.current) return true;
        setOverriddenIds((prev) => {
          const next = new Set(prev);
          next.add(materialId);
          return next;
        });
        setRowStatus(materialId, 'success');
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        if (err instanceof BlueprintsApiError) {
          setRowError(materialId, { code: err.code, message: err.message });
        } else {
          setRowError(materialId, {
            code: 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : 'Override failed',
          });
        }
        setRowStatus(materialId, 'error');
        return false;
      }
    },
    [authenticatedFetch, projectId, officeId, setRowStatus, setRowError],
  );

  const skip = useCallback(
    async (materialId: string, reason: string = 'user_skipped'): Promise<boolean> => {
      if (!projectId) {
        setRowError(materialId, { code: 'NO_PROJECT', message: 'No active project' });
        setRowStatus(materialId, 'error');
        return false;
      }
      setRowStatus(materialId, 'pending');
      setRowError(materialId, null);
      try {
        await skipMaterial(authenticatedFetch, projectId, materialId, officeId, reason);
        if (!mountedRef.current) return true;
        setSkippedIds((prev) => {
          const next = new Set(prev);
          next.add(materialId);
          return next;
        });
        setRowStatus(materialId, 'success');
        return true;
      } catch (err) {
        if (!mountedRef.current) return false;
        if (err instanceof BlueprintsApiError) {
          setRowError(materialId, { code: err.code, message: err.message });
        } else {
          setRowError(materialId, {
            code: 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : 'Skip failed',
          });
        }
        setRowStatus(materialId, 'error');
        return false;
      }
    },
    [authenticatedFetch, projectId, officeId, setRowStatus, setRowError],
  );

  const reset = useCallback(
    (materialId: string) => {
      setRowStatus(materialId, 'idle');
      setRowError(materialId, null);
    },
    [setRowStatus, setRowError],
  );

  return useMemo(
    () => ({
      statusById,
      errorById,
      confirmedIds,
      skippedIds,
      overriddenIds,
      confirm,
      override,
      skip,
      reset,
    }),
    [
      statusById,
      errorById,
      confirmedIds,
      skippedIds,
      overriddenIds,
      confirm,
      override,
      skip,
      reset,
    ],
  );
}
