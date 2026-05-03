/**
 * Sentry SDK configuration for Aspire Desktop.
 *
 * Errors flow to both Sentry and the backend incident table. The SDK is a no-op
 * without EXPO_PUBLIC_SENTRY_DSN, but route/request context still stays local.
 */

import * as Sentry from '@sentry/react-native';
import { reportError } from '@/lib/errorReporter';
import { buildTraceHeaders } from '@/lib/traceHeaders';

let _initialized = false;

type AspireSentryContext = {
  route?: string;
  suiteId?: string | null;
  officeId?: string | null;
  actorId?: string | null;
  surface?: string;
  businessName?: string | null;
};

const PII_FIELDS = new Set([
  'email',
  'phone',
  'password',
  'passwd',
  'secret',
  'token',
  'key',
  'authorization',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'session_id',
]);

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/sk[-_](?:test|live|prod)[-_]\w+/g, 'sk-***'],
  [/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***JWT***'],
  [/:\/\/\w+:[^@]+@/g, '://***:***@'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***'],
  [/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****'],
  [/Bearer\s+\S+/gi, 'Bearer ***'],
];

let _currentContext: AspireSentryContext = {};

function parseRate(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function scrubString(value: string): string {
  return PII_PATTERNS.reduce((result, [pattern, replacement]) => {
    pattern.lastIndex = 0;
    return result.replace(pattern, replacement);
  }, value);
}

function isPiiField(key: string): boolean {
  const lower = key.toLowerCase();
  return Array.from(PII_FIELDS).some((field) => lower.includes(field));
}

function scrubData<T>(value: T): T {
  if (typeof value === 'string') {
    return scrubString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubData(item)) as T;
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = isPiiField(key) ? '[Filtered]' : scrubData(item);
    }
    return next as T;
  }
  return value;
}

function scrubEvent(event: Record<string, any>) {
  if (event.request) {
    if (event.request.headers) event.request.headers = scrubData(event.request.headers);
    if (event.request.data) event.request.data = scrubData(event.request.data);
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubString(event.request.query_string);
    }
    if (event.request.cookies) event.request.cookies = '[Filtered]';
  }
  if (event.extra) event.extra = scrubData(event.extra);
  if (event.contexts) event.contexts = scrubData(event.contexts);
  if (event.tags) event.tags = scrubData(event.tags);
  if (event.user) event.user = scrubData(event.user);

  const values = event.exception?.values;
  if (Array.isArray(values)) {
    for (const exception of values) {
      if (typeof exception.value === 'string') {
        exception.value = scrubString(exception.value);
      }
    }
  }

  return event;
}

function describeFetchInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input && typeof input === 'object' && 'url' in input) {
    return String((input as Request).url);
  }
  return String(input);
}

function isTrackedApiUrl(rawUrl: string): boolean {
  if (rawUrl.startsWith('/api/') || rawUrl.startsWith('/v1/') || rawUrl.startsWith('/admin/')) {
    return true;
  }

  const apiBase = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  return !!apiBase && rawUrl.startsWith(apiBase);
}

function isIncidentReportUrl(rawUrl: string): boolean {
  return rawUrl.includes('/admin/ops/incidents/report');
}

function patchFetchForTelemetry(): void {
  const globalAny = globalThis as typeof globalThis & {
    __aspireSentryFetchPatched?: boolean;
    __aspireOriginalFetch?: typeof fetch;
  };
  if (globalAny.__aspireSentryFetchPatched || typeof globalThis.fetch !== 'function') {
    return;
  }

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalAny.__aspireOriginalFetch = originalFetch;
  globalAny.__aspireSentryFetchPatched = true;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = describeFetchInput(input);
    const tracked = isTrackedApiUrl(rawUrl);
    const start = Date.now();
    let nextInit = init;
    let correlationId = '';
    let traceId = '';

    if (tracked) {
      const inputHeaders =
        input && typeof input === 'object' && 'headers' in input
          ? (input as Request).headers
          : undefined;
      const headers = new Headers(init?.headers ?? inputHeaders);
      const trace = buildTraceHeaders({
        correlationId: headers.get('X-Correlation-Id'),
        traceId: headers.get('X-Trace-Id'),
      });
      correlationId = trace.correlationId;
      traceId = trace.traceId;
      headers.set('X-Correlation-Id', correlationId);
      headers.set('X-Trace-Id', traceId);
      headers.set('X-Client-Surface', 'aspire-desktop');
      if (_currentContext.suiteId && !headers.has('X-Suite-Id')) {
        headers.set('X-Suite-Id', _currentContext.suiteId);
      }
      if (_currentContext.officeId && !headers.has('X-Office-Id')) {
        headers.set('X-Office-Id', _currentContext.officeId);
      }
      if (_currentContext.actorId && !headers.has('X-Actor-Id')) {
        headers.set('X-Actor-Id', _currentContext.actorId);
      }
      nextInit = { ...init, headers };

      Sentry.addBreadcrumb({
        category: 'http.client',
        message: `fetch ${rawUrl}`,
        level: 'info',
        data: scrubData({
          url: rawUrl,
          route: _currentContext.route,
          suite_id: _currentContext.suiteId,
          office_id: _currentContext.officeId,
          correlation_id: correlationId,
          trace_id: traceId,
        }),
      });
    }

    try {
      const response = await originalFetch(input as any, nextInit as any);
      if (tracked) {
        const durationMs = Date.now() - start;
        Sentry.addBreadcrumb({
          category: 'http.client',
          message: `fetch ${response.status} ${rawUrl}`,
          level: response.ok ? 'info' : response.status >= 500 ? 'error' : 'warning',
          data: {
            status: response.status,
            duration_ms: durationMs,
            correlation_id: correlationId,
            trace_id: traceId,
          },
        });

        if (response.status >= 500 && !isIncidentReportUrl(rawUrl)) {
          captureDesktopException(new Error(`API ${response.status} for ${rawUrl}`), {
            tags: {
              source: 'desktop_fetch',
              http_status: String(response.status),
            },
            extra: {
              url: rawUrl,
              status: response.status,
              duration_ms: durationMs,
              correlation_id: correlationId,
              trace_id: traceId,
            },
          });
        }
      }
      return response;
    } catch (error) {
      if (tracked && !isIncidentReportUrl(rawUrl)) {
        captureDesktopException(error instanceof Error ? error : new Error(String(error)), {
          tags: {
            source: 'desktop_fetch',
            failure_kind: 'network',
          },
          extra: {
            url: rawUrl,
            duration_ms: Date.now() - start,
            correlation_id: correlationId,
            trace_id: traceId,
          },
        });
      }
      throw error;
    }
  };
}

/**
 * Initialize Sentry SDK. Safe to call multiple times; subsequent calls are no-ops.
 */
export function configureSentry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
  const tracesSampleRate = parseRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.2);
  const profilesSampleRate = parseRate(process.env.EXPO_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE, 0.0);
  const environment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production');
  const release =
    process.env.EXPO_PUBLIC_ASPIRE_RELEASE ||
    process.env.ASPIRE_RELEASE ||
    process.env.EXPO_PUBLIC_APP_VERSION ||
    'aspire-desktop@1.0.0';

  Sentry.init({
    dsn,
    enabled: !!dsn,
    tracesSampleRate,
    profilesSampleRate,
    environment,
    release,
    attachStacktrace: true,
    initialScope: {
      tags: {
        service: 'aspire-desktop-client',
        runtime: 'react-native',
      },
    },
    beforeSend(event) {
      const scrubbedEvent = scrubEvent(event as Record<string, any>);
      try {
        const message = scrubbedEvent.exception?.values?.[0]?.value || scrubbedEvent.message || 'Unknown error';
        const stackFrames = scrubbedEvent.exception?.values?.[0]?.stacktrace?.frames;
        const stackTrace = stackFrames
          ? stackFrames.map((f: any) => `${f.filename}:${f.lineno} ${f.function || ''}`).join('\n')
          : undefined;

        reportError({
          title: `Sentry event: ${String(message).substring(0, 100)}`,
          severity: 'sev3',
          source: 'desktop_sentry',
          component: 'sentry_bridge',
          stackTrace: stackTrace?.substring(0, 4000),
          message: String(message).substring(0, 1000),
          suiteId: _currentContext.suiteId || undefined,
          fingerprint: `desktop:sentry:${String(message).substring(0, 50)}`,
        });
      } catch {
        // Best-effort; never block Sentry delivery.
      }
      return scrubbedEvent as any;
    },
  });

  patchFetchForTelemetry();
}

export function setAspireSentryContext(context: AspireSentryContext): void {
  _currentContext = { ..._currentContext, ...context };
  try {
    const tags: Record<string, string> = {
      service: 'aspire-desktop-client',
      surface: _currentContext.surface || 'desktop-client',
      route: _currentContext.route || 'unknown',
      suite_id: _currentContext.suiteId || 'unscoped',
      office_id: _currentContext.officeId || 'unscoped',
    };

    for (const [key, value] of Object.entries(tags)) {
      Sentry.setTag(key, scrubString(value).slice(0, 200));
    }
    Sentry.setContext('aspire_desktop', scrubData(_currentContext));
    Sentry.setUser(_currentContext.actorId ? { id: _currentContext.actorId } : null);
  } catch {
    // Context tagging must never break rendering.
  }
}

export function captureDesktopException(
  error: Error,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  try {
    Sentry.captureException(error, {
      tags: {
        service: 'aspire-desktop-client',
        surface: 'desktop-client',
        route: _currentContext.route || 'unknown',
        suite_id: _currentContext.suiteId || 'unscoped',
        office_id: _currentContext.officeId || 'unscoped',
        ...context?.tags,
      },
      extra: scrubData({
        ..._currentContext,
        ...context?.extra,
      }),
    });
  } catch {
    // Sentry may be disabled or unavailable; never crash the app.
  }
}

export { Sentry };
