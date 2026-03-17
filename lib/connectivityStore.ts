/**
 * connectivityStore — S3-M8: Backend connectivity state
 *
 * Lightweight reactive store for backend connectivity status.
 * Updated by useBackendConnectivity hook, consumed by any component.
 */
import { useState, useEffect } from 'react';

let isBackendConnected = true;
const listeners = new Set<(connected: boolean) => void>();

function notify() {
  listeners.forEach(fn => fn(isBackendConnected));
}

export function setBackendConnected(connected: boolean) {
  if (isBackendConnected !== connected) {
    isBackendConnected = connected;
    notify();
  }
}

export function getBackendConnected(): boolean {
  return isBackendConnected;
}

/** React hook that subscribes to connectivity changes. */
export function useBackendConnected(): boolean {
  const [connected, setConnected] = useState(isBackendConnected);

  useEffect(() => {
    const listener = (value: boolean) => setConnected(value);
    listeners.add(listener);
    setConnected(isBackendConnected);
    return () => { listeners.delete(listener); };
  }, []);

  return connected;
}
