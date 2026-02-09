import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

const SIDEBAR_STORAGE_KEY = 'aspire_sidebar_expanded';

function getStoredSidebarState(): boolean {
  if (Platform.OS !== 'web') return true;
  
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function setStoredSidebarState(expanded: boolean): void {
  if (Platform.OS !== 'web') return;
  
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded));
  } catch {
  }
}

let sidebarState = true;
const listeners = new Set<(expanded: boolean) => void>();

export function useSidebarState() {
  const [expanded, setExpanded] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      sidebarState = getStoredSidebarState();
    }
    return sidebarState;
  });

  useEffect(() => {
    const listener = (newState: boolean) => {
      setExpanded(newState);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    const newState = !sidebarState;
    sidebarState = newState;
    setStoredSidebarState(newState);
    listeners.forEach(listener => listener(newState));
  }, []);

  const setSidebarExpanded = useCallback((newExpanded: boolean) => {
    sidebarState = newExpanded;
    setStoredSidebarState(newExpanded);
    listeners.forEach(listener => listener(newExpanded));
  }, []);

  return {
    sidebarExpanded: expanded,
    toggleSidebar,
    setSidebarExpanded,
  };
}
