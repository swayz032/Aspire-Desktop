/**
 * useMessageThreads — Lane E6 (plan §3.9.9).
 *
 * Fetches the SMS thread list for a given filter tab. Backed by
 * `GET /api/messages/threads?filter=...&cursor=...` (capability scope
 * `telephony:sms_read`, server-minted).
 *
 * Pattern: matches the project's existing custom-hook approach
 * (`hooks/useSmsThreads.ts`) — `useState` + `useEffect` + `useAuthFetch`.
 * The codebase does NOT use React Query (no `QueryClient` mounted in
 * `app/_layout.tsx`); introducing it here would add a dep + provider for one
 * file. The plan's "React Query" wording is honored conceptually via:
 *
 *   - per-filter caching (filter swaps don't refetch what we have)
 *   - 30s stale window (re-fetch only if data is older)
 *   - optimistic mutations for pin/archive/markRead with rollback on error
 *
 * Mutations return promises so the caller can await server confirmation; the
 * UI optimistically applies the change immediately and rolls back on error.
 *
 * Concurrent-fetch safety: every fetch carries an `AbortController`; if the
 * filter changes mid-flight the in-flight request is cancelled before the
 * new one starts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import {
  fetchThreads,
  markThreadRead,
  togglePinThread,
  toggleArchiveThread,
  MessagesApiError,
  type MessageThreadsFilter,
} from '@/lib/api/messages';
import type { MessageThreadSummary } from '@/components/messages/fixtures';

// ---------------------------------------------------------------------------
// Module-level cache — keyed by `${officeId}:${filter}`. Survives unmount
// (React StrictMode double-mounts; we don't want to refetch).
// ---------------------------------------------------------------------------

interface CacheEntry {
  threads: MessageThreadSummary[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(officeId: string, filter: MessageThreadsFilter): string {
  return `${officeId || '_'}:${filter}`;
}

// ---------------------------------------------------------------------------
// Listener registry — when one hook instance mutates the cache (e.g. via a
// pin/archive optimistic update) we notify ALL hook instances so the active
// page + the right pane re-render together.
// ---------------------------------------------------------------------------

type Listener = (key: string) => void;
const listeners = new Set<Listener>();
function notify(key: string) {
  listeners.forEach((l) => {
    try {
      l(key);
    } catch {
      // Swallow listener errors — a bad subscriber must not poison others.
    }
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseMessageThreadsResult {
  threads: MessageThreadSummary[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Force a re-fetch ignoring stale window. */
  refetch: () => Promise<void>;
  /** Optimistically toggle pin; rolls back on server error. */
  togglePin: (threadId: string) => Promise<void>;
  /** Optimistically toggle archive; rolls back on server error. */
  toggleArchive: (threadId: string) => Promise<void>;
  /** Optimistically zero the unread_count + clear last_drafter='contact'
   *  highlight; rolls back on server error. */
  markRead: (threadId: string) => Promise<void>;
}

export function useMessageThreads(
  filter: MessageThreadsFilter,
): UseMessageThreadsResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';

  const key = cacheKey(officeId, filter);

  // Hydrate from cache synchronously so filter swaps are instant.
  const cached = cache.get(key);
  const [threads, setThreads] = useState<MessageThreadSummary[]>(
    () => cached?.threads ?? [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !cached);
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // ── Subscribe to cross-instance cache notifications ────────────────────
  useEffect(() => {
    const listener: Listener = (changedKey) => {
      // Re-read this hook's slice when ANY filter changes for our office,
      // because mutations (pin/archive/markRead) update multiple slices at
      // once (a thread that's pinned both belongs to "all" and "pinned").
      if (!changedKey.startsWith(`${officeId || '_'}:`)) return;
      const entry = cache.get(key);
      if (entry && mountedRef.current) {
        setThreads(entry.threads);
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key, officeId]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const doFetch = useCallback(
    async (force: boolean) => {
      if (!officeId) {
        // Office id not yet hydrated — keep loading state, don't fail.
        return;
      }

      const existing = cache.get(key);
      const fresh =
        existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS;
      if (!force && fresh) {
        if (mountedRef.current) {
          setThreads(existing.threads);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      // Cancel any in-flight fetch for this key
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!existing && mountedRef.current) {
        setIsLoading(true);
      }
      try {
        const result = await fetchThreads({
          authenticatedFetch,
          officeId,
          filter,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        cache.set(key, { threads: result.threads, fetchedAt: Date.now() });
        if (mountedRef.current) {
          setThreads(result.threads);
          setIsLoading(false);
          setError(null);
        }
        notify(key);
      } catch (err) {
        if (controller.signal.aborted) return;
        // 404 on first deploy — keep last-known data, mark error.
        const e = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(e);
          setIsLoading(false);
        }
      }
    },
    [authenticatedFetch, officeId, key, filter],
  );

  // Refetch on filter change + officeId hydration
  useEffect(() => {
    void doFetch(false);
  }, [doFetch]);

  // Public refetch (force)
  const refetch = useCallback(() => doFetch(true), [doFetch]);

  // ── Optimistic mutations ─────────────────────────────────────────────────

  const writeAcrossSlices = useCallback(
    (mutator: (t: MessageThreadSummary) => MessageThreadSummary | null) => {
      // Apply the mutation to every cache slice for this office that holds
      // the affected thread. `null` means remove (e.g. archive should make
      // the thread vanish from the "all" / "unread" slices).
      const filters: MessageThreadsFilter[] = ['all', 'unread', 'pinned', 'archived'];
      const touched: string[] = [];
      for (const f of filters) {
        const k = cacheKey(officeId, f);
        const entry = cache.get(k);
        if (!entry) continue;
        const next: MessageThreadSummary[] = [];
        let changed = false;
        for (const t of entry.threads) {
          const out = mutator(t);
          if (out === null) {
            changed = true;
            continue;
          }
          if (out !== t) changed = true;
          next.push(out);
        }
        if (changed) {
          cache.set(k, { threads: next, fetchedAt: entry.fetchedAt });
          touched.push(k);
        }
      }
      // Notify listeners after all slices are updated to avoid intermediate
      // renders. One pass per touched key; cheap.
      touched.forEach(notify);
    },
    [officeId],
  );

  const togglePin = useCallback(
    async (threadId: string) => {
      // Capture rollback snapshots BEFORE mutating
      const snapshots = new Map<string, CacheEntry | undefined>();
      const filters: MessageThreadsFilter[] = ['all', 'unread', 'pinned', 'archived'];
      for (const f of filters) {
        const k = cacheKey(officeId, f);
        const entry = cache.get(k);
        snapshots.set(k, entry ? { ...entry, threads: [...entry.threads] } : undefined);
      }

      // Optimistic — flip is_pinned across all slices that hold this thread.
      // The "pinned" slice gets it added/removed accordingly.
      let nextPinned: boolean | null = null;
      writeAcrossSlices((t) => {
        if (t.thread_id !== threadId) return t;
        nextPinned = !t.is_pinned;
        return { ...t, is_pinned: nextPinned };
      });

      // The "pinned" slice may not contain this thread when pinning — add it
      // there from the "all" slice if so (and remove when unpinning).
      const pinnedKey = cacheKey(officeId, 'pinned');
      const pinnedEntry = cache.get(pinnedKey);
      if (nextPinned !== null && pinnedEntry) {
        const exists = pinnedEntry.threads.some((t) => t.thread_id === threadId);
        if (nextPinned && !exists) {
          // Pull the thread from the "all" slice
          const allEntry = cache.get(cacheKey(officeId, 'all'));
          const found = allEntry?.threads.find((t) => t.thread_id === threadId);
          if (found) {
            cache.set(pinnedKey, {
              threads: [{ ...found, is_pinned: true }, ...pinnedEntry.threads],
              fetchedAt: pinnedEntry.fetchedAt,
            });
            notify(pinnedKey);
          }
        } else if (!nextPinned && exists) {
          cache.set(pinnedKey, {
            threads: pinnedEntry.threads.filter((t) => t.thread_id !== threadId),
            fetchedAt: pinnedEntry.fetchedAt,
          });
          notify(pinnedKey);
        }
      }

      // Server commit
      try {
        await togglePinThread({
          authenticatedFetch,
          officeId,
          threadId,
        });
      } catch (err) {
        // Rollback
        for (const [k, snap] of snapshots) {
          if (snap) cache.set(k, snap);
          else cache.delete(k);
          notify(k);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [authenticatedFetch, officeId, writeAcrossSlices],
  );

  const toggleArchive = useCallback(
    async (threadId: string) => {
      // Snapshot for rollback
      const snapshots = new Map<string, CacheEntry | undefined>();
      const filters: MessageThreadsFilter[] = ['all', 'unread', 'pinned', 'archived'];
      for (const f of filters) {
        const k = cacheKey(officeId, f);
        const entry = cache.get(k);
        snapshots.set(k, entry ? { ...entry, threads: [...entry.threads] } : undefined);
      }

      // Determine current archive state from any slice
      const allEntry = cache.get(cacheKey(officeId, 'all'));
      const archivedEntry = cache.get(cacheKey(officeId, 'archived'));
      const found =
        allEntry?.threads.find((t) => t.thread_id === threadId) ||
        archivedEntry?.threads.find((t) => t.thread_id === threadId);
      if (!found) {
        // Nothing to optimistically update — fall through to server call.
      }
      const nextArchived = found ? !found.is_archived : true;

      // Move thread between active slices (all/unread/pinned) ↔ archived slice.
      // - Archiving: remove from all/unread/pinned, add to archived
      // - Unarchiving: remove from archived, add to all (+ pinned if is_pinned)
      writeAcrossSlices((t) => {
        if (t.thread_id !== threadId) return t;
        // The mutator returns `null` to drop the row from that slice.
        return null;
      });
      if (found) {
        const updated: MessageThreadSummary = { ...found, is_archived: nextArchived };
        if (nextArchived) {
          // Add to archived slice
          const ae = cache.get(cacheKey(officeId, 'archived'));
          if (ae) {
            cache.set(cacheKey(officeId, 'archived'), {
              threads: [updated, ...ae.threads],
              fetchedAt: ae.fetchedAt,
            });
            notify(cacheKey(officeId, 'archived'));
          }
        } else {
          // Add back to "all" + (if pinned) "pinned"
          const allK = cacheKey(officeId, 'all');
          const ae = cache.get(allK);
          if (ae) {
            cache.set(allK, {
              threads: [updated, ...ae.threads],
              fetchedAt: ae.fetchedAt,
            });
            notify(allK);
          }
          if (updated.is_pinned) {
            const pk = cacheKey(officeId, 'pinned');
            const pe = cache.get(pk);
            if (pe) {
              cache.set(pk, {
                threads: [updated, ...pe.threads],
                fetchedAt: pe.fetchedAt,
              });
              notify(pk);
            }
          }
          if (updated.unread_count > 0) {
            const uk = cacheKey(officeId, 'unread');
            const ue = cache.get(uk);
            if (ue) {
              cache.set(uk, {
                threads: [updated, ...ue.threads],
                fetchedAt: ue.fetchedAt,
              });
              notify(uk);
            }
          }
        }
      }

      try {
        await toggleArchiveThread({
          authenticatedFetch,
          officeId,
          threadId,
        });
      } catch (err) {
        for (const [k, snap] of snapshots) {
          if (snap) cache.set(k, snap);
          else cache.delete(k);
          notify(k);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [authenticatedFetch, officeId, writeAcrossSlices],
  );

  const markRead = useCallback(
    async (threadId: string) => {
      const snapshots = new Map<string, CacheEntry | undefined>();
      const filters: MessageThreadsFilter[] = ['all', 'unread', 'pinned', 'archived'];
      for (const f of filters) {
        const k = cacheKey(officeId, f);
        const entry = cache.get(k);
        snapshots.set(k, entry ? { ...entry, threads: [...entry.threads] } : undefined);
      }

      // Optimistic: zero unread_count in all slices; remove from "unread" slice.
      writeAcrossSlices((t) => {
        if (t.thread_id !== threadId) return t;
        return { ...t, unread_count: 0 };
      });
      const ue = cache.get(cacheKey(officeId, 'unread'));
      if (ue) {
        cache.set(cacheKey(officeId, 'unread'), {
          threads: ue.threads.filter((t) => t.thread_id !== threadId),
          fetchedAt: ue.fetchedAt,
        });
        notify(cacheKey(officeId, 'unread'));
      }

      try {
        await markThreadRead({
          authenticatedFetch,
          officeId,
          threadId,
        });
      } catch (err) {
        for (const [k, snap] of snapshots) {
          if (snap) cache.set(k, snap);
          else cache.delete(k);
          notify(k);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [authenticatedFetch, officeId, writeAcrossSlices],
  );

  // Type guard for "not just network errors" — we want callers to be able
  // to distinguish "no permission" from "transient" eventually. For V1 we
  // surface the boolean uniformly.
  const isError = useMemo<boolean>(() => {
    if (!error) return false;
    if (error instanceof MessagesApiError) {
      return true;
    }
    return true;
  }, [error]);

  return {
    threads,
    isLoading,
    isError,
    error,
    refetch,
    togglePin,
    toggleArchive,
    markRead,
  };
}

/**
 * Internal escape hatch — invalidate all cache slices for the active office.
 * Used by `useSendMessage` after a successful send so the next thread-list
 * read gets fresh data.
 */
export function invalidateMessageThreadsCache(officeId: string): void {
  const filters: MessageThreadsFilter[] = ['all', 'unread', 'pinned', 'archived'];
  for (const f of filters) {
    const k = cacheKey(officeId, f);
    if (cache.has(k)) {
      cache.delete(k);
      notify(k);
    }
  }
}

/**
 * Internal escape hatch — append (or upsert) a thread into the active-office
 * "all" slice. Used by `useSendMessage` after a successful first send so the
 * UI doesn't need to wait for the next refetch to show the new thread.
 */
export function upsertThreadIntoAllSlice(
  officeId: string,
  thread: MessageThreadSummary,
): void {
  const k = cacheKey(officeId, 'all');
  const entry = cache.get(k);
  if (!entry) return;
  const next = [thread, ...entry.threads.filter((t) => t.thread_id !== thread.thread_id)];
  cache.set(k, { threads: next, fetchedAt: entry.fetchedAt });
  notify(k);
}
