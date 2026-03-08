import { useState, useEffect } from 'react';
import type { AuthorityItem } from '@/types';

const MAX_ITEMS = 50;

let dynamicItems: AuthorityItem[] = [];
const listeners = new Set<(items: AuthorityItem[]) => void>();

function notify() {
  listeners.forEach(fn => fn([...dynamicItems]));
}

/** Sort by timestamp descending, cap at MAX_ITEMS */
function sortAndCap(items: AuthorityItem[]): AuthorityItem[] {
  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_ITEMS);
}

export function addAuthorityItem(item: AuthorityItem) {
  const exists = dynamicItems.some(i => i.id === item.id);
  if (!exists) {
    dynamicItems = sortAndCap([item, ...dynamicItems]);
    notify();
  }
}

export function removeAuthorityItem(id: string) {
  dynamicItems = dynamicItems.filter(i => i.id !== id);
  notify();
}

export function updateAuthorityItemStatus(id: string, status: AuthorityItem['status']) {
  dynamicItems = dynamicItems.map(i => i.id === id ? { ...i, status } : i);
  notify();
}

/** Bulk replace all items (for initial hydration + polling refresh) */
export function setAuthorityItems(items: AuthorityItem[]) {
  dynamicItems = sortAndCap(items);
  notify();
}

/** Get current snapshot (non-reactive) */
export function getAuthorityItems(): AuthorityItem[] {
  return [...dynamicItems];
}

export function getDynamicAuthorityItems(): AuthorityItem[] {
  return [...dynamicItems];
}

export function useDynamicAuthorityQueue(): AuthorityItem[] {
  const [items, setItems] = useState<AuthorityItem[]>(() => [...dynamicItems]);

  useEffect(() => {
    const listener = (newItems: AuthorityItem[]) => {
      setItems(newItems);
    };
    listeners.add(listener);
    // Sync with current state on mount (in case store updated before listener attached)
    setItems([...dynamicItems]);
    return () => { listeners.delete(listener); };
  }, []);

  return items;
}
