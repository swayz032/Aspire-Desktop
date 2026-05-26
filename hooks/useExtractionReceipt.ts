/**
 * useExtractionReceipt — DV Pass 3.
 *
 * Lazy-loads a full ExtractionReceipt from the backend ledger endpoint:
 *   GET /v1/blueprints/projects/{projectId}/receipts/{receiptId}
 *
 * Receipts are IMMUTABLE (Law #2) — once minted by the backend the body never
 * changes. So this hook caches every successful fetch in a module-level Map
 * keyed by `receiptId`, FOREVER within the session. Second + subsequent
 * mounts for the same receipt resolve synchronously (no fetch, no loading
 * state).
 *
 * In-flight dedup — if multiple components mount with the same receiptId
 * before the first fetch resolves, only one network call goes out. The
 * second mount awaits the same Promise.
 *
 * No polling, no realtime subscription — receipt bodies don't move once they
 * exist.
 *
 * Law compliance:
 *   Law #2 — receipts are immutable; permanent cache is safe.
 *   Law #6 — `useAuthFetch()` injects `X-Suite-Id`; cache is keyed only by
 *            receipt_id, but receipt_ids are tenant-scoped UUIDs that a
 *            cross-tenant request can't guess.
 *   Law #7 — pure data hook: no decisions, no side effects beyond setState.
 *   Law #9 — only the receipt_id is logged on error, never request bodies.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import type { ExtractionReceipt } from '@/lib/api/blueprintsStoryV2';

// ---------------------------------------------------------------------------
// Custom error — surfaces HTTP status distinctly so callers can branch on
// 401 (auth) vs 404 (missing) vs 500 (server) without parsing message strings.
// ---------------------------------------------------------------------------

export class ReceiptFetchError extends Error {
  public readonly status: number;
  public readonly receiptId: string;
  constructor(message: string, status: number, receiptId: string) {
    super(message);
    this.name = 'ReceiptFetchError';
    this.status = status;
    this.receiptId = receiptId;
  }
}

// ---------------------------------------------------------------------------
// Module-level caches. Receipts are immutable, so once we have one we hold
// it forever within the session.
// ---------------------------------------------------------------------------

const receiptCache = new Map<string, ExtractionReceipt>();
const inFlight = new Map<string, Promise<ExtractionReceipt>>();

type AuthFetch = ReturnType<typeof useAuthFetch>['authenticatedFetch'];

async function fetchReceipt(
  authenticatedFetch: AuthFetch,
  projectId: string,
  receiptId: string,
  signal: AbortSignal,
): Promise<ExtractionReceipt> {
  const cached = receiptCache.get(receiptId);
  if (cached) return cached;

  const existing = inFlight.get(receiptId);
  if (existing) return existing;

  const url = `/v1/blueprints/projects/${encodeURIComponent(projectId)}/receipts/${encodeURIComponent(receiptId)}`;
  const promise = (async (): Promise<ExtractionReceipt> => {
    try {
      const resp = await authenticatedFetch(url, { signal });
      if (!resp.ok) {
        throw new ReceiptFetchError(
          `Receipt fetch failed: ${resp.status}`,
          resp.status,
          receiptId,
        );
      }
      const body = (await resp.json()) as ExtractionReceipt;
      receiptCache.set(receiptId, body);
      return body;
    } finally {
      inFlight.delete(receiptId);
    }
  })();
  inFlight.set(receiptId, promise);
  return promise;
}

/**
 * Test helper — wipe both caches so test cases don't leak state across
 * `describe` blocks. The underscore prefix signals "not for production use".
 */
export function _resetExtractionReceiptCacheForTests(): void {
  receiptCache.clear();
  inFlight.clear();
}

// ---------------------------------------------------------------------------
// React surface
// ---------------------------------------------------------------------------

export interface UseExtractionReceiptResult {
  receipt: ExtractionReceipt | null;
  isLoading: boolean;
  error: Error | null;
}

export function useExtractionReceipt(
  projectId: string | null,
  receiptId: string | null,
): UseExtractionReceiptResult {
  const { authenticatedFetch } = useAuthFetch();

  // Hold authenticatedFetch in a ref — the function reference changes on
  // every session refresh; if it were in the effect dep array we'd re-fetch
  // (and re-loading-flicker) on every tick even with the cache hot.
  const authFetchRef = useRef(authenticatedFetch);
  authFetchRef.current = authenticatedFetch;

  // Seed synchronously from the cache so the first render returns the value
  // without a loading flicker for already-fetched receipts.
  const initialCached = receiptId ? (receiptCache.get(receiptId) ?? null) : null;

  const [receipt, setReceipt] = useState<ExtractionReceipt | null>(initialCached);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Reset state when (projectId, receiptId) change.
    if (!projectId || !receiptId) {
      setReceipt(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = receiptCache.get(receiptId);
    if (cached) {
      setReceipt(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setReceipt(null);
    setError(null);
    setIsLoading(true);

    fetchReceipt(authFetchRef.current, projectId, receiptId, controller.signal)
      .then((r) => {
        if (cancelled) return;
        setReceipt(r);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if ((err as Error)?.name === 'AbortError') return;
        setReceipt(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, receiptId]);

  return { receipt, isLoading, error };
}
