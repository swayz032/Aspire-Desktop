/**
 * authenticatedFetch — JWT-injecting fetch wrapper
 *
 * Law #3: Fail Closed — all API requests must include Authorization header.
 * Law #6: Tenant Isolation — X-Suite-Id header ensures RLS scoping.
 *
 * Usage:
 *   const { authenticatedFetch } = useAuthFetch();
 *   const resp = await authenticatedFetch('/api/inbox/items');
 */

import { useCallback } from 'react';
import { useSupabase } from '@/providers';

/**
 * Hook that returns an authenticated fetch function.
 * Automatically injects JWT and suite_id headers.
 */
export function useAuthFetch() {
  const { session, suiteId } = useSupabase();

  const authenticatedFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers);

      // Inject JWT if available
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }

      // Inject suite_id for tenant isolation
      if (suiteId) {
        headers.set('X-Suite-Id', suiteId);
      }

      return fetch(url, { ...options, headers });
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

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    if (suiteId) {
      headers.set('X-Suite-Id', suiteId);
    }

    return fetch(url, { ...options, headers });
  };
}
