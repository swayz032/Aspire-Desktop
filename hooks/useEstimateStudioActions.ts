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
import { resetBlueprintUpload } from '@/lib/blueprintUploadStore';
import { setActiveSheetId } from '@/lib/activeSheetStore';
import { clearBlueprintProjectPollCache } from '@/hooks/useBlueprintProjectPoll';

interface EstimateStudioActions {
  onUpload: () => void;
  onNewProject: () => void;
  onRemoveProject: () => void;
}

/**
 * Wave 17: NewProject + RemoveProject both clear the active blueprint state
 * from the canvas. Projects auto-persist to Service Memory (Wave 9), so
 * "removing" never deletes — it just gets the in-flight state out of the way
 * so the next upload starts fresh. Without this clear, localStorage held the
 * old project forever and the rest of the tabs kept reading stale state.
 */
export function useEstimateStudioActions(): EstimateStudioActions {
  const onUpload = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('estimate-studio:upload'));
      } catch {
        /* noop */
      }
    }
  }, []);

  const clearActiveBlueprint = useCallback(() => {
    // Wave 17: reset the module store (also wipes the localStorage snapshot)
    // and drop the active-sheet selection so per-sheet Context payload
    // doesn't hold a dangling reference.
    try {
      resetBlueprintUpload();
    } catch {
      /* noop */
    }
    try {
      setActiveSheetId(null);
    } catch {
      /* noop */
    }
    // 2026-05-26 — Also drop the project poll cache so a remove-then-upload
    // sequence on the same project_id can't surface stale sheets while the
    // new ingest runs.
    try {
      clearBlueprintProjectPollCache();
    } catch {
      /* noop */
    }
  }, []);

  const onNewProject = useCallback(() => {
    clearActiveBlueprint();
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('estimate-studio:new-project'));
      } catch {
        /* noop */
      }
    }
  }, [clearActiveBlueprint]);

  const onRemoveProject = useCallback(() => {
    clearActiveBlueprint();
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('estimate-studio:remove-project'));
      } catch {
        /* noop */
      }
    }
  }, [clearActiveBlueprint]);

  return { onUpload, onNewProject, onRemoveProject };
}
