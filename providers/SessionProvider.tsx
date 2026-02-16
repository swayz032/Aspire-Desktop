import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Session, SessionState, AuthorityItem, DocumentPreview, TranscriptEntry } from '@/types';

interface SessionContextType {
  session: Session | null;
  isActive: boolean;
  startSession: (type: 'voice' | 'video' | 'conference') => Promise<void>;
  endSession: () => Promise<void>;
  updateState: (state: SessionState) => void;
  addToQueue: (item: AuthorityItem) => void;
  removeFromQueue: (itemId: string) => void;
  addTranscript: (entry: TranscriptEntry) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);

  const startSession = async (type: 'voice' | 'video' | 'conference') => {
    setSession({
      id: `sess_${Date.now()}`,
      type,
      state: 'connecting',
      startedAt: new Date().toISOString(),
      currentContext: [],
      authorityQueue: [],
      riskLevel: 'medium',
      mode: 'listening_only',
      transcript: [],
    } as Session);

    setTimeout(() => {
      setSession(prev => prev ? { ...prev, state: 'listening' } : null);
    }, 1000);
  };

  const endSession = async () => {
    if (session) {
      setSession(prev => prev ? { ...prev, state: 'ended' } : null);
      setTimeout(() => {
        setSession(null);
      }, 500);
    }
  };

  const updateState = (state: SessionState) => {
    setSession(prev => prev ? { ...prev, state } : null);
  };

  const addToQueue = (item: AuthorityItem) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        authorityQueue: [...prev.authorityQueue, item],
      };
    });
  };

  const removeFromQueue = (itemId: string) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        authorityQueue: prev.authorityQueue.filter(item => item.id !== itemId),
      };
    });
  };

  const addTranscript = (entry: TranscriptEntry) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        transcript: [...(prev.transcript || []), entry],
      };
    });
  };

  const value: SessionContextType = {
    session,
    isActive: session !== null && session.state !== 'ended',
    startSession,
    endSession,
    updateState,
    addToQueue,
    removeFromQueue,
    addTranscript,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
