/**
 * useMessageThread — Lane E6 (plan §3.9.9).
 *
 * Fetches the chat-bubble stream for a single SMS thread. Cursor-paginated
 * (most-recent first → owner scrolls up to load older). Backed by
 * `GET /api/messages/threads/{threadId}/messages?before=...`.
 *
 * Pattern matches `useMessageThreads.ts` — module-level cache + listener
 * fan-out. Disabled when `threadId === null`.
 *
 * Sort order:
 *   - Backend returns messages NEWEST-FIRST per cursor page (matches plan
 *     §3.9.9 — "ordered by sent_at ASC … cursor pagination" → we read newest
 *     first by passing `before=<oldest visible>` to walk backwards).
 *   - The component renders ASC (oldest top, newest bottom). We sort here.
 *   - Optimistic appends from `useSendMessage` go through `appendMessageToThread`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  fetchThreadMessages,
  MessagesApiError,
} from '@/lib/api/messages';
import type { ThreadMessage } from '@/components/messages/MessagesThreadView';

// ---------------------------------------------------------------------------
// Module-level cache — keyed by `${officeId}:${threadId}`
// ---------------------------------------------------------------------------

interface CacheEntry {
  messages: ThreadMessage[];
  /** `undefined` once we've reached the oldest message (no more pages). */
  nextCursor: string | undefined;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(officeId: string, threadId: string): string {
  return `${officeId || '_'}:${threadId}`;
}

// ---------------------------------------------------------------------------
// Listener registry
// ---------------------------------------------------------------------------

type Listener = (key: string) => void;
const listeners = new Set<Listener>();
function notify(key: string) {
  listeners.forEach((l) => {
    try {
      l(key);
    } catch {
      // swallow
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortAsc(msgs: ThreadMessage[]): ThreadMessage[] {
  return [...msgs].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
  );
}

function dedupe(msgs: ThreadMessage[]): ThreadMessage[] {
  const seen = new Set<string>();
  const out: ThreadMessage[] = [];
  for (const m of msgs) {
    if (seen.has(m.message_id)) continue;
    seen.add(m.message_id);
    out.push(m);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseMessageThreadResult {
  messages: ThreadMessage[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** True when there are still older pages to fetch. */
  hasMore: boolean;
  /** Fetch the next older page. No-op when `hasMore === false`. */
  fetchMore: () => Promise<void>;
  /** Force a fresh first-page fetch. */
  refetch: () => Promise<void>;
}

const PAGE_SIZE = 50;

export function useMessageThread(
  threadId: string | null,
): UseMessageThreadResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';

  const enabled = !!threadId;
  const key = threadId ? cacheKey(officeId, threadId) : null;

  // Hydrate from cache when we have one — instant render on thread re-select.
  const initial = key ? cache.get(key) : undefined;
  const [messages, setMessages] = useState<ThreadMessage[]>(
    () => initial?.messages ?? [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => enabled && !initial,
  );
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(
    () => initial ? !!initial.nextCursor : true,
  );

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Cross-instance cache notifications
  useEffect(() => {
    if (!key) return;
    const listener: Listener = (changedKey) => {
      if (changedKey !== key) return;
      const entry = cache.get(key);
      if (entry && mountedRef.current) {
        setMessages(entry.messages);
        setHasMore(!!entry.nextCursor);
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);

  // ── Fetch first page ────────────────────────────────────────────────────
  const doFetchFirstPage = useCallback(
    async (force: boolean) => {
      if (!enabled || !threadId || !key || !officeId) return;

      const existing = cache.get(key);
      if (!force && existing) {
        if (mountedRef.current) {
          setMessages(existing.messages);
          setHasMore(!!existing.nextCursor);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (mountedRef.current) {
        setIsLoading(!existing);
      }
      try {
        const result = await fetchThreadMessages({
          authenticatedFetch,
          officeId,
          threadId,
          limit: PAGE_SIZE,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const sorted = sortAsc(dedupe(result.messages));
        const entry: CacheEntry = {
          messages: sorted,
          nextCursor: result.nextCursor,
          fetchedAt: Date.now(),
        };
        cache.set(key, entry);
        if (mountedRef.current) {
          setMessages(sorted);
          setHasMore(!!result.nextCursor);
          setIsLoading(false);
          setError(null);
        }
        notify(key);
      } catch (err) {
        if (controller.signal.aborted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(e);
          setIsLoading(false);
        }
      }
    },
    [authenticatedFetch, enabled, key, officeId, threadId],
  );

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      setHasMore(false);
      setIsLoading(false);
      setError(null);
      return;
    }
    void doFetchFirstPage(false);
  }, [doFetchFirstPage, enabled]);

  // ── Fetch more (older) ──────────────────────────────────────────────────
  const fetchMore = useCallback(async () => {
    if (!enabled || !threadId || !key || !officeId) return;
    const entry = cache.get(key);
    if (!entry || !entry.nextCursor) return;
    if (loadingMoreRef.current) return; // de-dupe overlapping calls
    loadingMoreRef.current = true;
    try {
      const result = await fetchThreadMessages({
        authenticatedFetch,
        officeId,
        threadId,
        before: entry.nextCursor,
        limit: PAGE_SIZE,
      });
      const merged = sortAsc(dedupe([...result.messages, ...entry.messages]));
      const next: CacheEntry = {
        messages: merged,
        nextCursor: result.nextCursor,
        fetchedAt: entry.fetchedAt,
      };
      cache.set(key, next);
      if (mountedRef.current) {
        setMessages(merged);
        setHasMore(!!result.nextCursor);
      }
      notify(key);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) setError(e);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [authenticatedFetch, enabled, key, officeId, threadId]);

  const refetch = useCallback(() => doFetchFirstPage(true), [doFetchFirstPage]);

  return {
    messages,
    isLoading,
    isError: !!error,
    error,
    hasMore,
    fetchMore,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// Internal escape hatches — used by useSendMessage for optimistic updates
// ---------------------------------------------------------------------------

/**
 * Append (or replace by `message_id`) a message to a thread cache. Used by
 * `useSendMessage` to surface the optimistic outbound bubble immediately,
 * then replace it with the server-confirmed row when the response lands.
 */
export function appendMessageToThread(
  officeId: string,
  threadId: string,
  message: ThreadMessage,
): void {
  const key = cacheKey(officeId, threadId);
  const entry = cache.get(key);
  if (!entry) {
    // Initialize a fresh thread cache so a brand-new conversation shows up
    // instantly without waiting for the first GET.
    cache.set(key, {
      messages: [message],
      nextCursor: undefined,
      fetchedAt: Date.now(),
    });
    notify(key);
    return;
  }
  const next: ThreadMessage[] = [];
  let replaced = false;
  for (const m of entry.messages) {
    if (m.message_id === message.message_id) {
      next.push(message);
      replaced = true;
    } else {
      next.push(m);
    }
  }
  if (!replaced) next.push(message);
  cache.set(key, {
    messages: sortAsc(dedupe(next)),
    nextCursor: entry.nextCursor,
    fetchedAt: entry.fetchedAt,
  });
  notify(key);
}

/**
 * Replace one message id with another — used after `useSendMessage` confirms
 * the server-assigned `message_id` to swap out the synthetic temp id.
 */
export function replaceMessageId(
  officeId: string,
  threadId: string,
  oldId: string,
  newMessage: ThreadMessage,
): void {
  const key = cacheKey(officeId, threadId);
  const entry = cache.get(key);
  if (!entry) return;
  const next = entry.messages.map((m) =>
    m.message_id === oldId ? newMessage : m,
  );
  cache.set(key, {
    messages: next,
    nextCursor: entry.nextCursor,
    fetchedAt: entry.fetchedAt,
  });
  notify(key);
}

/**
 * Remove a message by id (used when an optimistic send fails and the user
 * dismisses the failed bubble).
 */
export function removeMessageFromThread(
  officeId: string,
  threadId: string,
  messageId: string,
): void {
  const key = cacheKey(officeId, threadId);
  const entry = cache.get(key);
  if (!entry) return;
  cache.set(key, {
    messages: entry.messages.filter((m) => m.message_id !== messageId),
    nextCursor: entry.nextCursor,
    fetchedAt: entry.fetchedAt,
  });
  notify(key);
}

/** Invalidate the cache for one thread. */
export function invalidateMessageThreadCache(
  officeId: string,
  threadId: string,
): void {
  const key = cacheKey(officeId, threadId);
  if (cache.has(key)) {
    cache.delete(key);
    notify(key);
  }
}

// Re-export so callers don't need to import from two files.
export { MessagesApiError };
