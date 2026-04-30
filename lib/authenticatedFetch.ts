/**
 * authenticatedFetch — JWT-injecting fetch wrapper with 401 retry-once.
 *
 * Law #3: Fail Closed — all API requests must include Authorization header.
 * Law #6: Tenant Isolation — X-Suite-Id header ensures RLS scoping.
 *
 * Pass 18+ hardening: a single 401 triggers a Supabase session refresh and one
 * retry of the original request. If the refresh itself fails (or the second
 * request also returns 401), the response is surfaced to the caller — UI is
 * responsible for redirecting to login. We never retry more than once and we
 * skip retry for authoritative auth errors (`INVALID_SIGNATURE`,
 * `SCOPE_MISMATCH`, `TENANT_ISOLATION_VIOLATION`) where re-issuing the same
 * request would just deny again.
 *
 * Usage:
 *   const { authenticatedFetch } = useAuthFetch();
 *   const resp = await authenticatedFetch('/api/inbox/items');
 */

import { useCallback } from 'react';
import { useSupabase } from '@/providers';
import { buildTraceHeaders } from '@/lib/traceHeaders';
import { supabase } from '@/lib/supabase';

// Error codes where retry is pointless — the second request will deny on the
// same grounds (signature mismatch, scope mismatch, cross-tenant leakage).
const NO_RETRY_AUTH_CODES = new Set<string>([
  'INVALID_SIGNATURE',
  'SCOPE_MISMATCH',
  'TENANT_ISOLATION_VIOLATION',
  'CAPABILITY_DENIED',
]);

async function shouldSkipRetry(resp: Response): Promise<boolean> {
  // Clone so the caller still gets a readable body if we don't retry.
  try {
    const clone = resp.clone();
    const text = await clone.text();
    if (!text) return false;
    const parsed = JSON.parse(text) as { error?: string; code?: string; detail?: { error?: string; code?: string } };
    const code = parsed?.detail?.error ?? parsed?.detail?.code ?? parsed?.error ?? parsed?.code;
    return typeof code === 'string' && NO_RETRY_AUTH_CODES.has(code);
  } catch {
    return false;
  }
}

/**
 * Hook that returns an authenticated fetch function.
 * Automatically injects JWT and suite_id headers, retries once on 401 after
 * refreshing the Supabase session.
 */
export function useAuthFetch() {
  const { session, suiteId } = useSupabase();

  const authenticatedFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const buildHeaders = (token: string | null | undefined): Headers => {
        const headers = new Headers(options.headers);
        const trace = buildTraceHeaders({
          correlationId: headers.get('X-Correlation-Id'),
          traceId: headers.get('X-Trace-Id'),
        });
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        if (suiteId) {
          headers.set('X-Suite-Id', suiteId);
        }
        headers.set('X-Correlation-Id', trace.correlationId);
        headers.set('X-Trace-Id', trace.traceId);
        return headers;
      };

      // First attempt with the current session token.
      const firstHeaders = buildHeaders(session?.access_token);
      const firstResp = await fetch(url, { ...options, headers: firstHeaders });
      if (firstResp.status !== 401) return firstResp;

      // 401 — decide whether to attempt one refresh + retry.
      if (await shouldSkipRetry(firstResp)) {
        return firstResp;
      }

      // Try to refresh the Supabase session once.
      let refreshedToken: string | null = null;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session?.access_token) {
          // Refresh failed — return the original 401; UI handles login flow.
          return firstResp;
        }
        refreshedToken = data.session.access_token;
      } catch {
        return firstResp;
      }

      // Second attempt with the refreshed token. Returned as-is regardless of
      // status — we never retry more than once.
      const secondHeaders = buildHeaders(refreshedToken);
      const secondResp = await fetch(url, { ...options, headers: secondHeaders });
      return secondResp;
    },
    [session?.access_token, suiteId],
  );

  return { authenticatedFetch };
}

/**
 * Standalone authenticated fetch for use outside React components.
 * Requires explicit token and suiteId parameters.
 */
export function createAuthenticatedFetch(accessToken: string | null, suiteId: string | null) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    const trace = buildTraceHeaders({
      correlationId: headers.get('X-Correlation-Id'),
      traceId: headers.get('X-Trace-Id'),
    });

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (suiteId) {
      headers.set('X-Suite-Id', suiteId);
    }

    headers.set('X-Correlation-Id', trace.correlationId);
    headers.set('X-Trace-Id', trace.traceId);

    return fetch(url, { ...options, headers });
  };
}
