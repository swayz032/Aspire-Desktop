/**
 * providerErrorReporter — rate-limited per-provider error reporter.
 *
 * Tracks errors from frontend providers (ElevenLabs, Deepgram, Anam, LiveKit)
 * with dual rate limiting: per-provider (3/min) and total (10/min).
 *
 * Law #2: Receipt for All — provider errors flow to the incidents table.
 */

import { reportError } from '@/lib/errorReporter';

const PER_PROVIDER_LIMIT = 3;
const TOTAL_LIMIT = 10;
const WINDOW_MS = 60_000;

const _providerTimestamps: Record<string, number[]> = {};
let _totalTimestamps: number[] = [];

export interface ProviderErrorOptions {
  provider: string;
  action: string;
  error: unknown;
  correlationId?: string;
  component?: string;
}

/**
 * Report a provider error with dual rate limiting.
 * Fire-and-forget — never throws.
 */
export function reportProviderError(opts: ProviderErrorOptions): void {
  const now = Date.now();

  // Total rate limit across all providers
  _totalTimestamps = _totalTimestamps.filter((t) => now - t < WINDOW_MS);
  if (_totalTimestamps.length >= TOTAL_LIMIT) return;

  // Per-provider rate limit
  if (!_providerTimestamps[opts.provider]) _providerTimestamps[opts.provider] = [];
  _providerTimestamps[opts.provider] = _providerTimestamps[opts.provider].filter(
    (t) => now - t < WINDOW_MS,
  );
  if (_providerTimestamps[opts.provider].length >= PER_PROVIDER_LIMIT) return;

  _providerTimestamps[opts.provider].push(now);
  _totalTimestamps.push(now);

  const errMsg = opts.error instanceof Error ? opts.error.message : String(opts.error);
  const stack = opts.error instanceof Error ? opts.error.stack : undefined;

  reportError({
    title: `Provider error: ${opts.provider} ${opts.action}`,
    severity: 'sev3',
    source: 'desktop_provider',
    component: opts.component || opts.provider,
    stackTrace: stack,
    errorCode: `PROVIDER_${opts.provider.toUpperCase()}_ERROR`,
    message: errMsg.substring(0, 500),
    fingerprint: `desktop:provider:${opts.provider}:${opts.action}:${errMsg.substring(0, 50)}`,
  });
}

/**
 * Reset all rate limiter timestamps (for testing).
 */
export function _resetProviderRateLimiter(): void {
  Object.keys(_providerTimestamps).forEach((k) => delete _providerTimestamps[k]);
  _totalTimestamps = [];
}
