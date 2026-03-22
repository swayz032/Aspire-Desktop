/**
 * errorReporter — rate-limited incident reporter for the admin portal.
 *
 * Sends error reports to POST /admin/ops/incidents/report on the backend.
 * Rate-limited to 5 reports per 60 seconds to avoid flooding.
 * Best-effort: never crashes the app for reporting failures.
 *
 * Law #2: Receipt for All — errors are recorded as incidents.
 * Law #3: Fail Closed — reporting failure is silently ignored (best-effort telemetry).
 */

import { buildTraceHeaders } from '@/lib/traceHeaders';
import { supabase } from '@/lib/supabase';

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
let _timestamps: number[] = [];

export interface ErrorReportOptions {
  title: string;
  severity?: 'sev1' | 'sev2' | 'sev3' | 'sev4';
  source?: string;
  component?: string;
  stackTrace?: string;
  errorCode?: string;
  message?: string;
  suiteId?: string;
  fingerprint?: string;
}

/**
 * Report an error to the backend incident table.
 * Rate-limited to RATE_LIMIT reports per RATE_WINDOW_MS.
 * Returns silently on failure — never throws.
 */
export async function reportError(opts: ErrorReportOptions): Promise<void> {
  const now = Date.now();
  _timestamps = _timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (_timestamps.length >= RATE_LIMIT) return;
  _timestamps.push(now);

  try {
    const trace = buildTraceHeaders();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Correlation-Id': trace.correlationId,
      'X-Trace-Id': trace.traceId,
    };

    // Inject auth token if available (Law #3: Fail Closed)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // Best-effort auth — report without token if session unavailable
    }

    await fetch('/admin/ops/incidents/report', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: opts.title,
        severity: opts.severity || 'sev3',
        source: opts.source || 'desktop',
        component: opts.component,
        stack_trace: opts.stackTrace?.substring(0, 4000),
        error_code: opts.errorCode,
        message: opts.message?.substring(0, 1000),
        suite_id: opts.suiteId,
        fingerprint: opts.fingerprint,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        evidence_pack: {
          source: opts.source || 'desktop',
          component: opts.component,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          stack_trace: opts.stackTrace?.substring(0, 4000),
        },
      }),
    });
  } catch {
    // Best-effort — never crash the app for reporting
  }
}

/**
 * Reset rate limiter timestamps (for testing).
 */
export function _resetRateLimiter(): void {
  _timestamps = [];
}
