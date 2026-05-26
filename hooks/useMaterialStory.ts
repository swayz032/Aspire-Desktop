/**
 * useMaterialStory — DV Pass 4.
 *
 * Loads the per-project material story from the backend:
 *   GET /v1/blueprints/projects/{projectId}/material-story
 *
 * Unlike receipts (which are immutable, see useExtractionReceipt), material
 * stories CAN re-emit as Drew processes more sheets. So we cache with a
 * 30-second TTL — a request within 30s of the last successful fetch is served
 * from cache synchronously; otherwise we refetch.
 *
 * In-flight dedup: concurrent mounts for the same projectId share one network
 * call (mirrors useExtractionReceipt).
 *
 * Pre-indexing: response materials are bucketed by sheet_id and by chapter key
 * once when the story arrives (useMemo over story identity). SheetView gets
 * O(1) lookups instead of scanning chapters on every render.
 *
 * Law compliance:
 *   Law #2 — chapter materials carry receipt_id back to the immutable receipt.
 *   Law #6 — `useAuthFetch()` injects `X-Suite-Id`; cache key is projectId,
 *            which is tenant-scoped UUID.
 *   Law #7 — pure data hook: no decisions, no side effects beyond setState.
 *   Law #9 — only projectId is logged on error, never request bodies.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import type {
  MaterialInstance,
  MaterialStoryResponse,
} from '@/lib/api/blueprintsStoryV2';

// ---------------------------------------------------------------------------
// Custom error — distinguishes HTTP status for caller branching.
// ---------------------------------------------------------------------------

export class MaterialStoryFetchError extends Error {
  public readonly status: number;
  public readonly projectId: string;
  constructor(message: string, status: number, projectId: string) {
    super(message);
    this.name = 'MaterialStoryFetchError';
    this.status = status;
    this.projectId = projectId;
  }
}

// ---------------------------------------------------------------------------
// Module-level cache (TTL-bounded) + in-flight dedup map.
// ---------------------------------------------------------------------------

interface CacheEntry {
  story: MaterialStoryResponse;
  fetchedAt: number;
}

const TTL_MS = 30_000;

const storyCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<MaterialStoryResponse>>();

type AuthFetch = ReturnType<typeof useAuthFetch>['authenticatedFetch'];

function cacheHit(projectId: string): MaterialStoryResponse | null {
  const entry = storyCache.get(projectId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= TTL_MS) return null;
  return entry.story;
}

async function fetchMaterialStory(
  authenticatedFetch: AuthFetch,
  projectId: string,
  signal: AbortSignal,
): Promise<MaterialStoryResponse> {
  const cached = cacheHit(projectId);
  if (cached) return cached;

  const existing = inFlight.get(projectId);
  if (existing) return existing;

  const url = `/v1/blueprints/projects/${encodeURIComponent(projectId)}/material-story`;
  const promise = (async (): Promise<MaterialStoryResponse> => {
    try {
      const resp = await authenticatedFetch(url, { signal });
      if (!resp.ok) {
        throw new MaterialStoryFetchError(
          `Material story fetch failed: ${resp.status}`,
          resp.status,
          projectId,
        );
      }
      const body = (await resp.json()) as MaterialStoryResponse;
      storyCache.set(projectId, { story: body, fetchedAt: Date.now() });
      return body;
    } finally {
      inFlight.delete(projectId);
    }
  })();
  inFlight.set(projectId, promise);
  return promise;
}

/**
 * Test helper — wipe caches so test cases don't leak state across `describe`
 * blocks. Underscore prefix signals "not for production use".
 */
export function _resetMaterialStoryCacheForTests(): void {
  storyCache.clear();
  inFlight.clear();
}

/**
 * Test helper — backdate a cache entry's fetchedAt so TTL-expiry paths can be
 * exercised without jest.useFakeTimers (which interacts poorly with
 * @testing-library/react-native's async waiters).
 */
export function _expireMaterialStoryCacheEntryForTests(projectId: string): void {
  const entry = storyCache.get(projectId);
  if (entry) {
    storyCache.set(projectId, { ...entry, fetchedAt: 0 });
  }
}

// ---------------------------------------------------------------------------
// React surface
// ---------------------------------------------------------------------------

const EMPTY_BY_SHEET: ReadonlyMap<string, MaterialInstance[]> = new Map();
const EMPTY_BY_CHAPTER: ReadonlyMap<string, MaterialInstance[]> = new Map();

export interface UseMaterialStoryResult {
  story: MaterialStoryResponse | null;
  /** Pre-indexed by sheet_id for O(1) lookup. Same arrays as
   *  `story.chapters[*].materials` — just indexed for fast `SheetView` access. */
  materialsBySheet: Map<string, MaterialInstance[]>;
  /** Pre-indexed by chapter key. */
  materialsByChapter: Map<string, MaterialInstance[]>;
  isLoading: boolean;
  error: Error | null;
}

function indexStory(story: MaterialStoryResponse | null): {
  bySheet: Map<string, MaterialInstance[]>;
  byChapter: Map<string, MaterialInstance[]>;
} {
  const bySheet = new Map<string, MaterialInstance[]>();
  const byChapter = new Map<string, MaterialInstance[]>();
  if (!story) return { bySheet, byChapter };
  for (const chapter of story.chapters) {
    byChapter.set(chapter.key, chapter.materials);
    for (const mat of chapter.materials) {
      const arr = bySheet.get(mat.sheet_id);
      if (arr) {
        arr.push(mat);
      } else {
        bySheet.set(mat.sheet_id, [mat]);
      }
    }
  }
  return { bySheet, byChapter };
}

export function useMaterialStory(projectId: string | null): UseMaterialStoryResult {
  const { authenticatedFetch } = useAuthFetch();

  // Hold authenticatedFetch in a ref — function identity changes on every
  // session refresh; if it were in the effect dep array we'd refetch on
  // every tick even with the cache hot.
  const authFetchRef = useRef(authenticatedFetch);
  authFetchRef.current = authenticatedFetch;

  // Seed synchronously from cache if we have a fresh entry — first render
  // returns immediately without a loading flicker.
  const initialCached = projectId ? cacheHit(projectId) : null;

  const [story, setStory] = useState<MaterialStoryResponse | null>(initialCached);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setStory(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = cacheHit(projectId);
    if (cached) {
      setStory(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setError(null);
    setIsLoading(true);

    fetchMaterialStory(authFetchRef.current, projectId, controller.signal)
      .then((s) => {
        if (cancelled) return;
        setStory(s);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if ((err as Error)?.name === 'AbortError') return;
        setStory(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId]);

  // Pre-index materials once when story identity changes. Stable Map
  // identities are important for downstream useMemo/memo'd children.
  const { bySheet, byChapter } = useMemo(() => {
    if (!story) {
      return {
        bySheet: EMPTY_BY_SHEET as Map<string, MaterialInstance[]>,
        byChapter: EMPTY_BY_CHAPTER as Map<string, MaterialInstance[]>,
      };
    }
    return indexStory(story);
  }, [story]);

  return {
    story,
    materialsBySheet: bySheet,
    materialsByChapter: byChapter,
    isLoading,
    error,
  };
}
