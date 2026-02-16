import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MicState {
  isListening: boolean;
  isAvaSpeaking: boolean;
  toggleListening: () => void;
  setAvaSpeaking: (speaking: boolean) => void;
}

const MicStateContext = createContext<MicState | undefined>(undefined);

export function MicStateProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [isAvaSpeaking, setIsAvaSpeaking] = useState(false);

  const toggleListening = useCallback(() => {
    setIsListening(prev => !prev);
    if (isListening) {
      setIsAvaSpeaking(false);
    }
  }, [isListening]);

  const setAvaSpeaking = useCallback((speaking: boolean) => {
    setIsAvaSpeaking(speaking);
  }, []);

  return (
    <MicStateContext.Provider value={{ isListening, isAvaSpeaking, toggleListening, setAvaSpeaking }}>
      {children}
    </MicStateContext.Provider>
  );
}

export function useMicState() {
  const context = useContext(MicStateContext);
  if (!context) {
    throw new Error('useMicState must be used within a MicStateProvider');
  }
  return context;
}
