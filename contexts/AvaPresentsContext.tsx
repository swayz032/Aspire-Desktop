/**
 * AvaPresentsContext — Shares research card modal state across the app.
 *
 * Mounted at root (_layout.tsx) so both ResearchModal and any response
 * handler can access showCards/dismiss. This is how Adam's structured
 * research results get from the orchestrator response to the visual modal.
 */

import React, { createContext, useContext } from 'react';
import { useAvaPresents, type UseAvaPresentReturn } from '@/hooks/useAvaPresents';

const AvaPresentsContext = createContext<UseAvaPresentReturn | null>(null);

export function AvaPresentsProvider({ children }: { children: React.ReactNode }) {
  const avaPresents = useAvaPresents();

  return (
    <AvaPresentsContext.Provider value={avaPresents}>
      {children}
    </AvaPresentsContext.Provider>
  );
}

/**
 * Access the Ava Presents state and actions from any component.
 *
 * Usage:
 *   const { showCards, dismiss, visible, records } = useAvaPresentsContext();
 */
export function useAvaPresentsContext(): UseAvaPresentReturn {
  const ctx = useContext(AvaPresentsContext);
  if (!ctx) {
    throw new Error('useAvaPresentsContext must be used within AvaPresentsProvider');
  }
  return ctx;
}
