/**
 * useProjectAddress — shared Estimate Studio active project address.
 *
 * Service Hub Phase 3, Pass 3.2.
 *
 * The address bar (`ProjectAddressBar`) and the Visuals tab content
 * (`visuals.tsx`) live in different parts of the route tree, so we lift the
 * active address into a module-level store with listener fan-out (matches
 * the pattern used by `lib/uiStore.ts` and `lib/canvas/immersionStore.ts`).
 *
 * On web we also mirror the value to the URL query param `?address=...` so
 * the project survives a hard refresh and can be deep-linked to teammates.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const URL_PARAM = 'address';

let _address = '';
const _listeners = new Set<(addr: string) => void>();

function notify(): void {
  for (const l of _listeners) {
    try {
      l(_address);
    } catch {
      /* swallow */
    }
  }
}

function readFromUrl(): string {
  if (Platform.OS !== 'web') return '';
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(URL_PARAM) ?? '';
  } catch {
    return '';
  }
}

function writeToUrl(addr: string): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (addr.length === 0) url.searchParams.delete(URL_PARAM);
    else url.searchParams.set(URL_PARAM, addr);
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* swallow */
  }
}

// Hard refresh = clean slate. We DO NOT hydrate the active address from the
// URL on initial load (founder requirement, 2026-05-10): the search bar must
// be empty after a page reload. We still strip the `?address=` query param
// so the URL doesn't show a stale value the user can't see in the input.
// (Within a single session, navigating between Estimate Studio tabs preserves
// the address via the in-memory store + URL writes — only a hard refresh
// resets it.)
if (Platform.OS === 'web') {
  writeToUrl('');
}

export function getProjectAddress(): string {
  return _address;
}

export function setProjectAddress(next: string): void {
  if (next === _address) return;
  _address = next;
  writeToUrl(_address);
  notify();
}

export type UseProjectAddressResult = {
  address: string;
  setAddress: (next: string) => void;
};

export function useProjectAddress(): UseProjectAddressResult {
  const [address, setAddressState] = useState<string>(_address);

  useEffect(() => {
    const listener = (next: string) => setAddressState(next);
    _listeners.add(listener);
    // Sync once in case the module-level value updated before mount.
    if (_address !== address) setAddressState(_address);
    return () => {
      _listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAddress = useCallback((next: string) => {
    setProjectAddress(next);
  }, []);

  return { address, setAddress };
}

/** Test seam — reset module state between cases. */
export function __resetProjectAddressForTests(): void {
  _address = '';
  _listeners.clear();
}
