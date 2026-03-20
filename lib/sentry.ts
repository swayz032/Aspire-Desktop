/**
 * Sentry SDK configuration for Aspire Desktop.
 *
 * Initializes @sentry/react-native with environment-aware settings.
 * beforeSend hook also fires an incident report to the backend (fire-and-forget).
 *
 * Law #2: Receipt for All — errors flow to both Sentry and the backend incident table.
 * Law #9: Security & Privacy — no secrets logged; PII redaction via Sentry defaults.
 */

import * as Sentry from '@sentry/react-native';
import { reportError } from '@/lib/errorReporter';

let _initialized = false;

function parseRate(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

/**
 * Initialize Sentry SDK. Safe to call multiple times — subsequent calls are no-ops.
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
      // Fire-and-forget backend incident report alongside Sentry
      try {
        const message = event.exception?.values?.[0]?.value || event.message || 'Unknown error';
        const stackFrames = event.exception?.values?.[0]?.stacktrace?.frames;
        const stackTrace = stackFrames
          ? stackFrames.map((f) => `${f.filename}:${f.lineno} ${f.function || ''}`).join('\n')
          : undefined;

        reportError({
          title: `Sentry event: ${message.substring(0, 100)}`,
          severity: 'sev3',
          source: 'desktop_sentry',
          component: 'sentry_bridge',
          stackTrace: stackTrace?.substring(0, 4000),
          message: message.substring(0, 1000),
          fingerprint: `desktop:sentry:${message.substring(0, 50)}`,
        });
      } catch {
        // Best-effort — never block Sentry event delivery
      }
      return event;
    },
  });
}

export { Sentry };
