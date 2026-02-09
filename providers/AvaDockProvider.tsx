import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type DockState = 'closed' | 'expanded' | 'minimized';
type SessionMode = 'voice' | 'video' | 'conference' | null;

interface AvaDockContextType {
  dockState: DockState;
  sessionMode: SessionMode;
  openDock: (mode?: SessionMode) => void;
  closeDock: () => void;
  minimizeDock: () => void;
  expandDock: () => void;
  toggleDock: () => void;
  setSessionMode: (mode: SessionMode) => void;
}

const AvaDockContext = createContext<AvaDockContextType | undefined>(undefined);

interface AvaDockProviderProps {
  children: ReactNode;
}

export function AvaDockProvider({ children }: AvaDockProviderProps) {
  const [dockState, setDockState] = useState<DockState>('closed');
  const [sessionMode, setSessionMode] = useState<SessionMode>(null);

  const openDock = useCallback((mode: SessionMode = 'voice') => {
    setSessionMode(mode);
    setDockState('expanded');
  }, []);

  const closeDock = useCallback(() => {
    setDockState('closed');
    setSessionMode(null);
  }, []);

  const minimizeDock = useCallback(() => {
    setDockState('minimized');
  }, []);

  const expandDock = useCallback(() => {
    setDockState('expanded');
  }, []);

  const toggleDock = useCallback(() => {
    setDockState(prev => {
      if (prev === 'closed') {
        setSessionMode('voice');
        return 'expanded';
      }
      if (prev === 'expanded') return 'minimized';
      if (prev === 'minimized') return 'expanded';
      return 'closed';
    });
  }, []);

  const value: AvaDockContextType = {
    dockState,
    sessionMode,
    openDock,
    closeDock,
    minimizeDock,
    expandDock,
    toggleDock,
    setSessionMode,
  };

  return (
    <AvaDockContext.Provider value={value}>
      {children}
    </AvaDockContext.Provider>
  );
}

export function useAvaDock(): AvaDockContextType {
  const context = useContext(AvaDockContext);
  if (context === undefined) {
    throw new Error('useAvaDock must be used within an AvaDockProvider');
  }
  return context;
}
