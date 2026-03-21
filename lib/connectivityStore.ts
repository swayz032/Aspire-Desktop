/**
 * connectivityStore — S3-M8: Backend + Device connectivity state
 *
 * Lightweight reactive store for connectivity status.
 * - isDeviceOnline: device has network access (navigator.onLine / expo-network)
 * - isBackendConnected: /api/health responds OK
 *
 * Updated by useBackendConnectivity hook, consumed by any component.
 */
import { useState, useEffect } from 'react';

// --- Device online state ---
let isDeviceOnline = true;
const deviceListeners = new Set<(online: boolean) => void>();

function notifyDevice() {
  deviceListeners.forEach(fn => fn(isDeviceOnline));
}

export function setDeviceOnline(online: boolean) {
  if (isDeviceOnline !== online) {
    isDeviceOnline = online;
    notifyDevice();
  }
}

export function getDeviceOnline(): boolean {
  return isDeviceOnline;
}

/** React hook that subscribes to device online/offline changes. */
export function useDeviceOnline(): boolean {
  const [online, setOnline] = useState(isDeviceOnline);

  useEffect(() => {
    const listener = (value: boolean) => setOnline(value);
    deviceListeners.add(listener);
    setOnline(isDeviceOnline);
    return () => { deviceListeners.delete(listener); };
  }, []);

  return online;
}

// --- Backend connected state ---
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

/** React hook that subscribes to backend connectivity changes. */
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
