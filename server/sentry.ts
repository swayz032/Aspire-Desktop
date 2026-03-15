/**
 * Sentry integration for Aspire Desktop (Express).
 * Optional: no-op if SENTRY_DSN is not set. Strips PII per Law #9.
 */

const PII_FIELDS = new Set([
  'email', 'phone', 'ssn', 'password', 'secret', 'token',
  'key', 'api_key', 'apikey', 'authorization', 'credit_card',
  'card_number', 'cvv', 'social_security',
]);

function stripPii(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...data };
  for (const key of Object.keys(cleaned)) {
    if (PII_FIELDS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    }
  }
  return cleaned;
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    console.log('SENTRY_DSN not set — Sentry disabled');
    return;
  }

  try {
    // Dynamic import to avoid crash if @sentry/node not installed
    const Sentry = require('@sentry/node');

    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || 'unknown',
      beforeSend(event: Record<string, unknown>) {
        // Strip PII from request body
        const request = event.request as Record<string, unknown> | undefined;
        if (request?.data && typeof request.data === 'object') {
          request.data = stripPii(request.data as Record<string, unknown>);
        }
        return event;
      },
      ignoreTransactions: ['/health', '/healthz', '/readyz'],
    });

    console.log('Sentry initialized (traces_sample_rate=0.1)');
  } catch (err) {
    console.warn('Failed to initialize Sentry:', err);
  }
}
