/**
 * authFetchStandalone -- One-shot authenticated fetch for components that
 * cannot use the useAuthFetch hook (e.g., overlay modals invoked from a
 * portal or rendered outside a SupabaseProvider tree).
 *
 * Pulls the current Supabase session lazily via supabase.auth.getSession().
 * Injects:
 *   - Authorization: Bearer <access_token>
 *   - X-Suite-Id: from session.user.user_metadata.suite_id
 *   - X-Correlation-Id: random per call
 *
 * This is a same-origin fetch helper -- it expects the caller to use a
 * relative URL (e.g. '/api/tools/enrich-product'). It never speaks to the
 * orchestrator directly; the Express server proxies to the orchestrator and
 * mints capability tokens server-side (Law #5).
 */

import { supabase } from '@/lib/supabase';
import { buildTraceHeaders } from '@/lib/traceHeaders';

export async function authenticatedFetchStandalone(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const trace = buildTraceHeaders({
    correlationId: headers.get('X-Correlation-Id'),
    traceId: headers.get('X-Trace-Id'),
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  const suiteId = (session?.user?.user_metadata as { suite_id?: string } | undefined)?.suite_id;
  if (suiteId) {
    headers.set('X-Suite-Id', suiteId);
  }

  headers.set('X-Correlation-Id', trace.correlationId);
  headers.set('X-Trace-Id', trace.traceId);

  return fetch(url, { ...options, headers });
}
