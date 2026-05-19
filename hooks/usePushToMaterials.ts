/**
 * usePushToMaterials — Wave 8.
 *
 * Encapsulates the YELLOW push-to-materials capability flow. The caller is
 * responsible for presenting the user confirmation modal BEFORE calling
 * `push()`. This hook exposes the staging step (`request()`) so callers can
 * gate on `pendingMaterialIds`.
 *
 * Flow:
 *   1) User selects materials → caller calls `request(ids)` → state = 'confirming'
 *   2) User confirms in modal → caller calls `commit()` → state = 'pushing'
 *   3) Server returns → state = 'success' | 'error'
 *   4) Caller calls `reset()` to clear state for next round
 *
 * Law compliance:
 *   Law #4 — YELLOW tier UX gate (modal) enforced at call-site; server scope
 *           enforces the real gate.
 *   Law #5 — capability token minted server-side by Express proxy.
 *   Law #7 — pure data bridge; no autonomous retry or downgrade.
 */
import { useCallback, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  pushToMaterialsBundle,
  BlueprintsApiError,
  type PushToMaterialsResult,
} from '@/lib/api/blueprintsApi';

export type PushPhase = 'idle' | 'confirming' | 'pushing' | 'success' | 'error';

export interface UsePushToMaterialsResult {
  phase: PushPhase;
  pendingMaterialIds: string[];
  result: PushToMaterialsResult | null;
  error: { code: string; message: string } | null;
  /** Stage a push — moves to 'confirming' so caller can show modal. */
  request: (materialIds: string[]) => void;
  /** Cancel the staged push (user dismissed modal). */
  cancel: () => void;
  /** User confirmed the modal — fire the network call. */
  commit: () => Promise<void>;
  /** Reset to idle for the next round. */
  reset: () => void;
}

export function usePushToMaterials(projectId: string | null): UsePushToMaterialsResult {
  const { authenticatedFetch } = useAuthFetch();
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';

  const [phase, setPhase] = useState<PushPhase>('idle');
  const [pendingMaterialIds, setPendingMaterialIds] = useState<string[]>([]);
  const [result, setResult] = useState<PushToMaterialsResult | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const request = useCallback((materialIds: string[]) => {
    if (!Array.isArray(materialIds) || materialIds.length === 0) return;
    setPendingMaterialIds(materialIds);
    setResult(null);
    setError(null);
    setPhase('confirming');
  }, []);

  const cancel = useCallback(() => {
    setPendingMaterialIds([]);
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    setPendingMaterialIds([]);
    setResult(null);
    setError(null);
    setPhase('idle');
  }, []);

  const commit = useCallback(async () => {
    if (!projectId) {
      setError({ code: 'NO_PROJECT', message: 'No active project' });
      setPhase('error');
      return;
    }
    if (pendingMaterialIds.length === 0) {
      setError({ code: 'NO_SELECTION', message: 'No materials selected' });
      setPhase('error');
      return;
    }
    setPhase('pushing');
    try {
      const res = await pushToMaterialsBundle(
        authenticatedFetch,
        projectId,
        pendingMaterialIds,
        officeId,
      );
      setResult(res);
      setPhase(res.success ? 'success' : 'error');
      if (!res.success) {
        setError({
          code: 'PUSH_PARTIAL_FAILURE',
          message:
            res.rejected.length > 0
              ? `${res.rejected.length} rejected: ${res.rejected[0]?.reason ?? 'unknown'}`
              : 'Push failed',
        });
      }
    } catch (err) {
      if (err instanceof BlueprintsApiError) {
        setError({ code: err.code, message: err.message });
      } else {
        setError({
          code: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'Push failed',
        });
      }
      setPhase('error');
    }
  }, [authenticatedFetch, projectId, pendingMaterialIds, officeId]);

  return { phase, pendingMaterialIds, result, error, request, cancel, commit, reset };
}
