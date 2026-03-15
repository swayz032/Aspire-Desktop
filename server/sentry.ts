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

// ---------------------------------------------------------------------------
// Sentry lifecycle
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentryModule: any = null;
let _initialized = false;

/**
 * Initialize Sentry. Call once at startup, before creating Express app.
 * No-op if SENTRY_DSN is not set or @sentry/node is not installed.
 */
export function initSentry(): void {
  const dsn = (process.env.SENTRY_DSN ?? '').trim();
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN not set — Sentry error tracking disabled (no-op)');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node');
    _sentryModule = Sentry;

    const environment = (process.env.NODE_ENV ?? 'development').trim();

    Sentry.init({
      dsn,
      environment,
      release: process.env.ASPIRE_RELEASE ?? process.env.APP_VERSION ?? 'aspire-desktop@1.0.0',
      sendDefaultPii: false,
      tracesSampler: (samplingContext: { name?: string }) => {
        const name = samplingContext.name ?? '';
        if (HEALTH_PATHS.has(name) || name.startsWith('/healthz')) return 0;
        return parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1');
      },
      beforeSend(event: Record<string, unknown>) {
        // Scrub request
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

        // Scrub exception values
        const exception = event.exception as { values?: Array<{ value?: string }> } | undefined;
        if (exception?.values) {
          for (const exc of exception.values) {
            if (typeof exc.value === 'string') {
              exc.value = scrubValue(exc.value);
            }
          }
        }

        // Scrub breadcrumbs
        const breadcrumbs = event.breadcrumbs as Array<{ message?: string; data?: Record<string, unknown> }> | undefined;
        if (breadcrumbs) {
          for (const bc of breadcrumbs) {
            if (typeof bc.message === 'string') bc.message = scrubValue(bc.message);
            if (bc.data && typeof bc.data === 'object') bc.data = scrubDict(bc.data);
          }
        }

        // Scrub extra, contexts, tags
        for (const section of ['extra', 'contexts', 'tags']) {
          const val = event[section];
          if (val && typeof val === 'object') {
            event[section] = scrubDict(val as Record<string, unknown>);
          }
        }

        // Scrub user
        if (event.user && typeof event.user === 'object') {
          event.user = scrubDict(event.user as Record<string, unknown>);
        }

        return event;
      },
      maxBreadcrumbs: 50,
    });

    _initialized = true;
    console.log(`[sentry] Initialized: environment=${environment}`);
  } catch (err) {
    console.warn('[sentry] @sentry/node not installed or init failed — Sentry disabled', err);
  }
}

/**
 * Express request handler middleware. Mount as FIRST middleware.
 * Returns a no-op passthrough if Sentry is not initialized.
 */
export function sentryRequestHandler(): RequestHandler {
  if (_initialized && _sentryModule) {
    try {
      if (_sentryModule.Handlers?.requestHandler) {
        return _sentryModule.Handlers.requestHandler();
      }
    } catch {
      // Fall through to no-op
    }
  }
  return (_req, _res, next) => next();
}

/**
 * Express error handler middleware. Mount as LAST error handler.
 * Returns a no-op passthrough if Sentry is not initialized.
 */
export function sentryErrorHandler(): ErrorRequestHandler {
  if (_initialized && _sentryModule) {
    try {
      if (_sentryModule.Handlers?.errorHandler) {
        return _sentryModule.Handlers.errorHandler();
      }
    } catch {
      // Fall through to no-op
    }
  }
  return (err, _req, _res, next) => next(err);
}
