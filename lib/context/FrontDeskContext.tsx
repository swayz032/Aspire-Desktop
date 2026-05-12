/**
 * FrontDeskContext — Pass F shared context.
 *
 * Provides two capabilities to the Front Desk Hub:
 *
 * 1. Cross-link navigation: EventDetailModal can ask InboxRail to
 *    jump to a specific section + open a specific item.
 *    Implemented via a lifted `onCrossLink` callback threaded through
 *    FrontDeskHubSkeleton → InboxRail.
 *
 * 2. Action toast: any workspace can emit a "Verified ✓" toast after
 *    a successful action (Law #2 — receipt_id surfaced in UI).
 *
 * Kept deliberately minimal — no Redux, no heavy state library.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Cross-link
// ---------------------------------------------------------------------------

export type InboxSection =
  | 'sms'
  | 'missed'
  | 'incoming'
  | 'outgoing'
  | 'voicemail'
  | 'contacts'
  | 'callback_queue';

export interface CrossLinkTarget {
  section: InboxSection;
  /** Optional item ID to open detail mode immediately. */
  itemId?: string;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export interface ActionToast {
  id: string;
  receipt_id: string;
  /** Short label shown next to the receipt, e.g. "SMS sent" */
  label: string;
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface FrontDeskContextValue {
  /** Request InboxRail to switch section + optionally open item detail. */
  crossLink: (target: CrossLinkTarget) => void;
  /** Register a handler that InboxRail calls to respond to crossLink. */
  registerCrossLinkHandler: (handler: (target: CrossLinkTarget) => void) => void;
  /** Emit a "Verified ✓" toast. Auto-dismissed after 3s. */
  showActionToast: (toast: Omit<ActionToast, 'id'>) => void;
  /** Active toasts — consumed by the toast renderer in FrontDeskHubSkeleton. */
  toasts: ActionToast[];
  /** Dismiss a specific toast by id. */
  dismissToast: (id: string) => void;
}

const FrontDeskContext = createContext<FrontDeskContextValue | null>(null);

export function FrontDeskProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ActionToast[]>([]);
  const crossLinkHandlerRef = useRef<((target: CrossLinkTarget) => void) | null>(null);

  const registerCrossLinkHandler = useCallback(
    (handler: (target: CrossLinkTarget) => void) => {
      crossLinkHandlerRef.current = handler;
    },
    [],
  );

  const crossLink = useCallback((target: CrossLinkTarget) => {
    crossLinkHandlerRef.current?.(target);
  }, []);

  const showActionToast = useCallback((toast: Omit<ActionToast, 'id'>) => {
    const id = crypto.randomUUID();
    const entry: ActionToast = { ...toast, id };
    setToasts((prev) => [...prev.slice(-4), entry]); // keep max 5
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3_000);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  return (
    <FrontDeskContext.Provider
      value={{
        crossLink,
        registerCrossLinkHandler,
        showActionToast,
        toasts,
        dismissToast,
      }}
    >
      {children}
    </FrontDeskContext.Provider>
  );
}

export function useFrontDeskContext(): FrontDeskContextValue {
  const ctx = useContext(FrontDeskContext);
  if (!ctx) {
    throw new Error('useFrontDeskContext must be used inside FrontDeskProvider');
  }
  return ctx;
}
