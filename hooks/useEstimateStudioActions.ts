/**
 * useEstimateStudioActions
 *
 * Shared action handlers for the Estimate Studio chrome (Upload evidence,
 * New Project). Lives as a single hook so both the in-canvas
 * `ProjectAddressBar` and the Tim Rail Controls tab call identical
 * handlers — no copy-pasted business logic.
 *
 * Today the handlers are intentional stubs: file pickers and the
 * project-creation flow are wired by downstream waves. Centralizing them
 * here means future wiring updates ONE place.
 *
 * Aspire Law #7: pure UI plumbing — no autonomous state mutations beyond
 * what user actions explicitly request.
 */
import { useCallback } from 'react';

interface EstimateStudioActions {
  onUpload: () => void;
  onNewProject: () => void;
}

export function useEstimateStudioActions(): EstimateStudioActions {
  const onUpload = useCallback(() => {
    // Future: open evidence upload sheet (photos, PDFs, plans).
    // Today: emit a benign event so the click is observable in dev.
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('estimate-studio:upload'));
      } catch {
        /* noop */
      }
    }
  }, []);

  const onNewProject = useCallback(() => {
    // Future: open the new-project flow (address + service + scope).
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('estimate-studio:new-project'));
      } catch {
        /* noop */
      }
    }
  }, []);

  return { onUpload, onNewProject };
}
