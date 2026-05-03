/**
 * Sentry error tracking for Aspire Desktop server (Express).
 *
 * Optional — no-op if SENTRY_DSN is not set.
 * PII is stripped from all events before sending (Law #9).
 *
 * Usage in server/index.ts:
 *   import { initSentry, sentryRequestHandler, sentryErrorHandler } from './sentry';
 *   initSentry();
 *   app.use(sentryRequestHandler());   // FIRST middleware
 *   // ... all routes ...
 *   app.use(sentryErrorHandler());     // LAST error handler
 */

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// PII scrubbing (Law #9)
// ---------------------------------------------------------------------------

const PII_FIELDS = new Set([
  'email', 'phone', 'ssn', 'password', 'passwd',
  'secret', 'token', 'key', 'authorization',
  'credit_card', 'card_number', 'cvv', 'api_key',
  'apikey', 'access_token', 'refresh_token', 'session_id',
  'social_security',
]);

const PII_VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/sk[-_](?:test|live|prod)[-_]\w+/g, 'sk-***'],
  [/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***JWT***'],
  [/:\/\/\w+:[^@]+@/g, '://***:***@'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***'],
  [/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '***-***-****'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****'],
  [/Bearer\s+\S+/gi, 'Bearer ***'],
];

const HEALTH_PATHS = new Set(['/api/health', '/api/sandbox/health', '/healthz', '/readyz', '/metrics']);

function isPiiField(name: string): boolean {
  return PII_FIELDS.has(name.toLowerCase());
}

function scrubValue(value: string): string {
  let result = value;
  for (const [pattern, replacement] of PII_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

function scrubDict(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (isPiiField(k)) {
      result[k] = '[Filtered]';
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = scrubDict(v as Record<string, unknown>);
    } else if (typeof v === 'string') {
      result[k] = scrubValue(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function cleanContextValue(value: unknown, maxLength = 160): string {
  if (typeof value !== 'string') return '';
  return scrubValue(value.replace(/[\r\n]/g, '').trim()).slice(0, maxLength);
}

function buildRequestContext(req: any): Record<string, unknown> {
  const correlationId =
    cleanContextValue(req?.headers?.['x-correlation-id']) ||
    cleanContextValue(req?.correlationId) ||
    `corr_${randomUUID()}`;
  const traceId =
    cleanContextValue(req?.headers?.['x-trace-id']) ||
    cleanContextValue(req?.traceId) ||
    correlationId;
  const suiteId =
    cleanContextValue(req?.authenticatedSuiteId) ||
    cleanContextValue(req?.headers?.['x-suite-id']) ||
    cleanContextValue(req?.query?.suite_id);
  const officeId =
    cleanContextValue(req?.authenticatedOfficeId) ||
    cleanContextValue(req?.headers?.['x-office-id']) ||
    cleanContextValue(req?.query?.office_id);
  const actorId =
    cleanContextValue(req?.authenticatedUserId) ||
    cleanContextValue(req?.headers?.['x-actor-id']);

  req.correlationId = correlationId;
  req.traceId = traceId;
  req.headers['x-correlation-id'] = correlationId;
  req.headers['x-trace-id'] = traceId;

  return {
    service: 'aspire-desktop-server',
    surface: 'desktop-server',
    method: req?.method,
    path: req?.path || req?.url,
    route_family: typeof req?.path === 'string' && req.path.startsWith('/api') ? 'api' : 'web',
    suite_id: suiteId,
    office_id: officeId,
    actor_id: actorId,
    correlation_id: correlationId,
    trace_id: traceId,
  };
}

function applyScopeContext(scope: any, context: Record<string, unknown>): void {
  const tags: Record<string, string> = {
    service: 'aspire-desktop-server',
    surface: 'desktop-server',
    route_family: String(context.route_family || 'web'),
    http_method: String(context.method || ''),
    suite_id: String(context.suite_id || 'unscoped'),
    office_id: String(context.office_id || 'unscoped'),
    correlation_id: String(context.correlation_id || ''),
    trace_id: String(context.trace_id || ''),
  };

  for (const [key, value] of Object.entries(tags)) {
    if (value) scope.setTag?.(key, value.slice(0, 200));
  }
  if (context.actor_id) {
    scope.setUser?.({ id: String(context.actor_id) });
  }
  scope.setContext?.('aspire_request', scrubDict(context));
}

// ---------------------------------------------------------------------------
// Sentry lifecycle
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentryModule: any = null;
let _initialized = false;

type ManualSentryConfig = {
  storeUrl: string;
  publicKey: string;
  environment: string;
  release: string;
};

let _manualConfig: ManualSentryConfig | null = null;

function resolveDsn(): string {
  const candidates = [
    process.env.SENTRY_DSN,
    process.env.SENTRY_DESKTOP_SERVER_DSN,
  ];

  for (const candidate of candidates) {
    const value = (candidate ?? '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function _parseDsn(dsn: string): { storeUrl: string; publicKey: string } | null {
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    if (!publicKey) return null;
    const pathParts = u.pathname.split('/').filter(Boolean);
    const projectId = pathParts[pathParts.length - 1];
    if (!projectId) return null;
    const storeUrl = `${u.protocol}//${u.host}/api/${projectId}/store/`;
    return { storeUrl, publicKey };
  } catch {
    return null;
  }
}

async function _sendManualEvent(err: unknown, req: any): Promise<void> {
  if (!_manualConfig) return;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const stack = err instanceof Error ? err.stack : undefined;
  const message = err instanceof Error ? (err.message || err.name) : String(err ?? 'Unknown error');

  const event: Record<string, unknown> = {
    event_id: randomUUID().replace(/-/g, ''),
    timestamp: nowSeconds,
    level: 'error',
    platform: 'node',
    logger: 'aspire-desktop-server',
    environment: _manualConfig.environment,
    release: _manualConfig.release,
    message: scrubValue(message).slice(0, 1000),
    exception: {
      values: [
        {
          type: err instanceof Error ? err.name : 'Error',
          value: scrubValue(message).slice(0, 1000),
          stacktrace: stack ? { frames: [] } : undefined,
        },
      ],
    },
    request: req ? {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: scrubDict((req.headers || {}) as Record<string, unknown>),
      data: undefined,
    } : undefined,
    tags: {
      component: 'desktop-server',
      service: 'aspire-desktop-server',
      runtime: 'node',
    },
  };

  const authHeader = [
    'Sentry sentry_version=7',
    'sentry_client=aspire-desktop-manual/1.0',
    `sentry_timestamp=${nowSeconds}`,
    `sentry_key=${_manualConfig.publicKey}`,
  ].join(', ');

  await fetch(_manualConfig.storeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': authHeader,
    },
    body: JSON.stringify(event),
  });
}

/**
 * Initialize Sentry. Call once at startup, before creating Express app.
 * No-op if SENTRY_DSN is not set.
 */
export function initSentry(): void {
  if (_initialized) {
    return;
  }

  const dsn = resolveDsn();
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN/SENTRY_DESKTOP_SERVER_DSN not set — Sentry error tracking disabled (no-op)');
    return;
  }

  const environment = (process.env.ASPIRE_ENV ?? process.env.NODE_ENV ?? 'development').trim();
  const release = process.env.ASPIRE_RELEASE ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? process.env.APP_VERSION ?? 'aspire-desktop@1.0.0';
  const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1');

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node');
    _sentryModule = Sentry;

    Sentry.init({
      dsn,
      environment,
      release,
      sendDefaultPii: false,
      integrations: [
        ...(typeof Sentry.expressIntegration === 'function' ? [Sentry.expressIntegration()] : []),
      ],
      initialScope: {
        tags: {
          service: 'aspire-desktop-server',
          runtime: 'node',
        },
      },
      tracesSampler: (samplingContext: { name?: string }) => {
        const name = samplingContext.name ?? '';
        if (HEALTH_PATHS.has(name) || name.startsWith('/healthz')) return 0;
        return tracesSampleRate;
      },
      beforeSend(event: Record<string, unknown>) {
        const request = event.request as Record<string, unknown> | undefined;
        if (request) {
          if (request.headers && typeof request.headers === 'object') {
            request.headers = scrubDict(request.headers as Record<string, unknown>);
          }
          if (request.data && typeof request.data === 'object') {
            request.data = scrubDict(request.data as Record<string, unknown>);
          }
          if (typeof request.query_string === 'string') {
            request.query_string = scrubValue(request.query_string);
          }
          if (request.cookies) {
            request.cookies = '[Filtered]';
          }
        }

        const exception = event.exception as Record<string, unknown> | undefined;
        const values = exception?.values as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(values)) {
          for (const ex of values) {
            if (typeof ex.value === 'string') {
              ex.value = scrubValue(ex.value);
            }
          }
        }

        if (event.user && typeof event.user === 'object') {
          event.user = scrubDict(event.user as Record<string, unknown>);
        }

        return event;
      },
      maxBreadcrumbs: 50,
    });

    _initialized = true;
    console.log(`[sentry] Initialized: environment=${environment}`);
    return;
  } catch (err) {
    console.warn('[sentry] @sentry/node not installed or init failed — using manual transport fallback', err);
  }

  const parsed = _parseDsn(dsn);
  if (!parsed) {
    console.warn('[sentry] Invalid DSN; manual fallback disabled');
    return;
  }

  _manualConfig = {
    storeUrl: parsed.storeUrl,
    publicKey: parsed.publicKey,
    environment,
    release,
  };
  _initialized = true;
  console.log('[sentry] Manual transport fallback initialized');
}

/**
 * Express request handler middleware. Mount as FIRST middleware.
 * Returns a no-op passthrough if Sentry is not initialized.
 */
export function sentryRequestHandler(): RequestHandler {
  return (req, res, next) => {
    const context = buildRequestContext(req as any);
    res.setHeader('X-Correlation-Id', String(context.correlation_id || ''));
    res.setHeader('X-Trace-Id', String(context.trace_id || ''));

    if (!_initialized || !_sentryModule) {
      next();
      return;
    }

    const attach = (scope: any) => {
      applyScopeContext(scope, context);
      _sentryModule.addBreadcrumb?.({
        category: 'http.request',
        message: `${req.method} ${req.path || req.url}`,
        level: 'info',
        data: {
          correlation_id: context.correlation_id,
          trace_id: context.trace_id,
          suite_id: context.suite_id || 'unscoped',
          office_id: context.office_id || 'unscoped',
        },
      });
    };

    try {
      if (typeof _sentryModule.withIsolationScope === 'function') {
        _sentryModule.withIsolationScope((scope: any) => {
          attach(scope);
          next();
        });
        return;
      }

      const scope = _sentryModule.getCurrentScope?.();
      if (scope) attach(scope);
    } catch {
      // Sentry context must never block request handling.
    }
    next();
  };
}

/**
 * Express error handler middleware. Mount as LAST error handler.
 * Returns a passthrough that forwards the error after capture.
 */
export function sentryErrorHandler(): ErrorRequestHandler {
  if (_initialized && _sentryModule) {
    try {
      if (typeof _sentryModule.expressErrorHandler === 'function') {
        return _sentryModule.expressErrorHandler();
      }
      if (_sentryModule.Handlers?.errorHandler) {
        return _sentryModule.Handlers.errorHandler();
      }
    } catch {
      // Fall through to fallback
    }
  }

  return (err, req, _res, next) => {
    if (_manualConfig) {
      void _sendManualEvent(err, req).catch((captureErr) => {
        console.warn('[sentry] Manual fallback capture failed', captureErr);
      });
    }
    next(err);
  };
}

export function setupSentryExpressErrorHandler(app: any): void {
  if (_initialized && _sentryModule && typeof _sentryModule.setupExpressErrorHandler === 'function') {
    _sentryModule.setupExpressErrorHandler(app);
    return;
  }
  app.use(sentryErrorHandler());
}

/**
 * Capture an exception via Sentry (server-side). No-op if Sentry not initialized.
 */
export function captureServerException(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (!_sentryModule) return;
  try {
    _sentryModule.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
    });
  } catch {
    // Sentry capture failed — don't crash the server
  }
}
