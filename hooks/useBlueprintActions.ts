/**
 * useBlueprintActions — Wave 7.
 *
 * Action handlers for the Scope tab — YELLOW-tier mutations that go through
 * the Express proxy (capability-token round-trip).
 *
 * Actions:
 *   - confirmMissingInput(inputId, value): POST /missing_inputs/:id/resolve
 *   - markAlternate(alternateId, choice): Wave 7+ stub (no backend route yet)
 *   - requestRFI(item): Wave 7+ stub (RFI email composer is Wave 8+)
 *
 * Law compliance:
 *   Law #1 — UI never decides; the orchestrator owns the resolve action.
 *   Law #2 — backend writes a blueprint_receipt on success.
 *   Law #5 — capability token minted server-side, scope=resolve_missing_input.
 *   Law #6 — officeId from session context, never user input.
 */
import { useCallback, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers';
import {
  BlueprintsApiError,
  resolveMissingInput,
  type BlueprintMissingInput,
} from '@/lib/api/blueprintsApi';

export type ActionPhase = 'idle' | 'submitting' | 'success' | 'error';

export interface AlternateChoice {
  /** Choose: 'include' to move to base scope, 'exclude' for not-in-base. */
  choice: 'include' | 'exclude';
}

export interface UseBlueprintActionsResult {
  /** Per-action phase state, keyed by inputId / alternateId. */
  phaseFor: (key: string) => ActionPhase;
  errorFor: (key: string) => { code: string; message: string } | null;
  confirmMissingInput: (
    projectId: string,
    inputId: string,
    value: string,
  ) => Promise<BlueprintMissingInput | null>;
  markAlternate: (alternateId: string, choice: AlternateChoice) => Promise<void>;
  requestRFI: (itemKey: string) => Promise<void>;
}

export function useBlueprintActions(): UseBlueprintActionsResult {
  const { authenticatedFetch } = useAuthFetch();
  const tenant = useTenant() as { officeId?: string };
  const officeId = tenant.officeId ?? '';

  const [phases, setPhases] = useState<Record<string, ActionPhase>>({});
  const [errors, setErrors] = useState<Record<string, { code: string; message: string } | null>>(
    {},
  );

  const setPhase = useCallback((key: string, phase: ActionPhase): void => {
    setPhases((prev) => ({ ...prev, [key]: phase }));
  }, []);

  const setError = useCallback(
    (key: string, err: { code: string; message: string } | null): void => {
      setErrors((prev) => ({ ...prev, [key]: err }));
    },
    [],
  );

  const phaseFor = useCallback(
    (key: string): ActionPhase => phases[key] ?? 'idle',
    [phases],
  );

  const errorFor = useCallback(
    (key: string): { code: string; message: string } | null => errors[key] ?? null,
    [errors],
  );

  const confirmMissingInput = useCallback(
    async (
      projectId: string,
      inputId: string,
      value: string,
    ): Promise<BlueprintMissingInput | null> => {
      if (!projectId || !inputId || !officeId) {
        setPhase(inputId, 'error');
        setError(inputId, {
          code: 'INVALID_INPUT',
          message: 'Missing project, input id, or office context.',
        });
        return null;
      }
      setPhase(inputId, 'submitting');
      setError(inputId, null);
      try {
        const result = await resolveMissingInput(
          authenticatedFetch,
          projectId,
          inputId,
          value,
          officeId,
        );
        setPhase(inputId, 'success');
        return result;
      } catch (e) {
        const code = e instanceof BlueprintsApiError ? e.code : 'UNKNOWN_ERROR';
        const message = e instanceof Error ? e.message : 'Unknown error';
        setPhase(inputId, 'error');
        setError(inputId, { code, message });
        return null;
      }
    },
    [authenticatedFetch, officeId, setPhase, setError],
  );

  // Wave 7+ stubs — these are visual handlers only; no backend route yet.
  // Surfaced so callers can wire optimistic state changes today; the actual
  // mutation lands in a follow-up wave alongside the backend endpoint.
  const markAlternate = useCallback(
    async (alternateId: string, _choice: AlternateChoice): Promise<void> => {
      setPhase(alternateId, 'submitting');
      // Defer to next tick so the UI can show the submitting state.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      setPhase(alternateId, 'error');
      setError(alternateId, {
        code: 'NOT_IMPLEMENTED_WAVE_7_PLUS',
        message: 'Marking alternates ships in a follow-up wave.',
      });
    },
    [setPhase, setError],
  );

  const requestRFI = useCallback(
    async (itemKey: string): Promise<void> => {
      setPhase(itemKey, 'submitting');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      setPhase(itemKey, 'error');
      setError(itemKey, {
        code: 'NOT_IMPLEMENTED_WAVE_8_PLUS',
        message: 'RFI drafting ships in Wave 8+.',
      });
    },
    [setPhase, setError],
  );

  return {
    phaseFor,
    errorFor,
    confirmMissingInput,
    markAlternate,
    requestRFI,
  };
}
