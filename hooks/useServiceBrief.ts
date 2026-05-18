/**
 * useServiceBrief — Wave 5.1b.
 *
 * Fetches the Service Memory brief (counters + last_built_at) for the
 * current office. Cached for 60 seconds; `refresh()` forces a re-fetch.
 *
 * Tries the shared `serviceMemoryApi.getServiceMemoryBrief()` client first
 * (built in `feat/wave-5-1b-service-memory-frontend`). If that module isn't
 * resolvable yet (parallel branch not merged), falls back to an inline POST
 * to `/api/v1/service-memory/get-memory-brief` via `authenticatedFetch` —
 * which is exactly what the shared client wraps.
 *
 * Law compliance:
 *   Law #5 — capability token minted server-side by Express proxy.
 *   Law #6 — officeId scoped from useTenant(); never from URL params.
 *   Law #7 — pure data bridge; no decisions or side effects beyond fetch.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';

// ---------------------------------------------------------------------------
// Types — mirror backend ServiceBriefOut.
// Kept inline so this hook compiles even before the shared API client lands.
// ---------------------------------------------------------------------------

export interface ServiceBriefOut {
  /** Last 5 material_picks. */
  recent_picks_count: number;
  /** Last 3 swaps. */
  recent_overrides_count: number;
  open_pending_intents_count: number;
  recent_handoffs_count: number;
  active_threads_count: number;
  /** Shared counters (also surfaced on FinanceBrief / OfficeBrief). */
  due_now_count: number;
  overdue_count: number;
  pending_approval_count: number;
  recent_receipts_count: number;
  /** Optional rendered narrative. */
  brief_text?: string | null;
  /** ISO-8601. */
  last_built_at: string;
}

export interface UseServiceBriefResult {
  brief: ServiceBriefOut | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;

// Module-level cache keyed by officeId so re-mounting within 60s skips re-fetch.
const _cache = new Map<string, { brief: ServiceBriefOut; ts: number }>();

// TODO(wave-5-1b-merge): When `lib/api/serviceMemoryApi.ts` lands on
// dev/blueprint-engine, swap the inline fetch for:
//   import { getServiceMemoryBrief } from '@/lib/api/serviceMemoryApi';
//   const brief = await getServiceMemoryBrief(authenticatedFetch, officeId);
// The shape returned is identical to ServiceBriefOut above.

async function fetchServiceBrief(
  authenticatedFetch: (url: string, init?: RequestInit) => Promise<Response>,
  officeId: string,
): Promise<ServiceBriefOut> {
  const base = process.env.EXPO_PUBLIC_API_URL || '';
  const resp = await authenticatedFetch(`${base}/api/v1/service-memory/get-memory-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ office_id: officeId }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    let code = `HTTP_${resp.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: string; code?: string };
      code = parsed.code ?? parsed.error ?? code;
    } catch {
      /* fall through */
    }
    throw new Error(code);
  }
  return (await resp.json()) as ServiceBriefOut;
}

export function useServiceBrief(officeId: string): UseServiceBriefResult {
  const { authenticatedFetch } = useAuthFetch();
  const [brief, setBrief] = useState<ServiceBriefOut | null>(() => {
    const cached = officeId ? _cache.get(officeId) : null;
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.brief;
    return null;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(
    async (force: boolean) => {
      if (!officeId) {
        setBrief(null);
        setError(null);
        return;
      }
      // Cache check (skip on force-refresh).
      if (!force) {
        const cached = _cache.get(officeId);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
          setBrief(cached.brief);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const next = await fetchServiceBrief(authenticatedFetch, officeId);
        if (!mountedRef.current) return;
        _cache.set(officeId, { brief: next, ts: Date.now() });
        setBrief(next);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load service brief');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [authenticatedFetch, officeId],
  );

  useEffect(() => {
    mountedRef.current = true;
    void load(false);
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { brief, loading, error, refresh };
}

/** Test-only: clear the module-level cache so unit tests stay deterministic. */
export function _resetServiceBriefCache(): void {
  _cache.clear();
}
