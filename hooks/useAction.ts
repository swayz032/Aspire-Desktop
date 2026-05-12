/**
 * useAction — Pass F action execution hook.
 *
 * Wraps any `() => Promise<ActionResult>` with:
 *   - `pending` state (drives inline spinner)
 *   - success: emits "Verified ✓" toast via FrontDeskContext
 *   - failure: returns the error for inline ErrorState rendering
 *
 * Usage:
 *   const [run, pending, lastError] = useAction('Call back');
 *   const onClick = () => run(() => callBack(phone));
 */

import { useCallback, useState } from 'react';
import type { ActionResult } from '@/lib/actions/frontDeskActions';
import { useFrontDeskContext } from '@/lib/context/FrontDeskContext';

type ActionFn = () => Promise<ActionResult>;
type RunFn = (action: ActionFn) => Promise<ActionResult>;

export function useAction(label: string): [RunFn, boolean, string | null] {
  const { showActionToast } = useFrontDeskContext();
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const run = useCallback(
    async (action: ActionFn): Promise<ActionResult> => {
      if (pending) return { ok: false, error: 'Already in progress' };
      setPending(true);
      setLastError(null);
      try {
        const result = await action();
        if (result.ok && result.receipt_id) {
          showActionToast({ receipt_id: result.receipt_id, label });
        } else if (!result.ok) {
          setLastError(result.error ?? 'Action failed');
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        setLastError(msg);
        return { ok: false, error: msg };
      } finally {
        setPending(false);
      }
    },
    [pending, label, showActionToast],
  );

  return [run, pending, lastError];
}
