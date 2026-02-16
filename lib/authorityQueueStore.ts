import { useState, useEffect } from 'react';
import type { AuthorityItem } from '@/types';

let dynamicItems: AuthorityItem[] = [];
const listeners = new Set<(items: AuthorityItem[]) => void>();

function notify() {
  listeners.forEach(fn => fn([...dynamicItems]));
}

export function addAuthorityItem(item: AuthorityItem) {
  const exists = dynamicItems.some(i => i.id === item.id);
  if (!exists) {
    dynamicItems = [item, ...dynamicItems];
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
    return () => { listeners.delete(listener); };
  }, []);

  return items;
}
