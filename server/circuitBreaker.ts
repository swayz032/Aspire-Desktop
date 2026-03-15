import {
  CircuitBreakerPolicy,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  wrap,
  circuitBreaker,
  SamplingBreaker,
  TimeoutPolicy,
  timeout,
  TimeoutStrategy,
} from 'cockatiel';
import { logger } from './logger';

/**
 * Circuit breaker + retry + timeout policies for external service calls.
 * Uses cockatiel (Law #10: circuit breakers, idempotent retries, exponential backoff).
 *
 * Timeout tiers (aligned with SLI/SLO doc):
 *   - Read operations: 5s
 *   - Action/orchestrator calls: 30s
 */

// Retry with exponential backoff + jitter (max 3 attempts)
const retryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({
    initialDelay: 500,
    maxDelay: 10_000,
  }),
});

retryPolicy.onRetry(({ delay }) => {
  logger.warn(`Retrying after ${delay}ms`);
});

// ─── Timeout policies ───────────────────────────────────────────────────────
// Cooperative timeouts — cancels the underlying operation when exceeded.

/** 5s timeout for read/query operations */
export const readTimeout: TimeoutPolicy = timeout(5_000, TimeoutStrategy.Cooperative);
readTimeout.onTimeout(() => logger.warn('Read operation timed out (5s limit)'));

/** 30s timeout for orchestrator/action calls */
export const actionTimeout: TimeoutPolicy = timeout(30_000, TimeoutStrategy.Cooperative);
actionTimeout.onTimeout(() => logger.warn('Action operation timed out (30s limit)'));

// Circuit breaker: opens after N consecutive failures, half-opens after cooldown
function createBreaker(name: string, threshold = 5, halfOpenAfter = 30_000): CircuitBreakerPolicy {
  const breaker = circuitBreaker(handleAll, {
    breaker: new ConsecutiveBreaker(threshold),
    halfOpenAfter,
  });

  breaker.onBreak(() => logger.error(`Circuit OPEN: ${name}`));
  breaker.onReset(() => logger.info(`Circuit CLOSED: ${name}`));
  breaker.onHalfOpen(() => logger.info(`Circuit HALF-OPEN: ${name}`));

  return breaker;
}

// Named breakers for each external service (thresholds per SLI_SLO.md)
export const breakers = {
  backend: createBreaker('backend', 5, 30_000),
  supabase: createBreaker('supabase', 5, 60_000),
  stripe: createBreaker('stripe', 3, 120_000),
  plaid: createBreaker('plaid', 3, 120_000),
  quickbooks: createBreaker('quickbooks', 3, 120_000),
  gusto: createBreaker('gusto', 3, 120_000),
} as const;

// ─── Composed policies ──────────────────────────────────────────────────────
// Order: timeout → retry → circuit breaker (outermost → innermost)

// Read policies: 5s timeout + retry + breaker
export const readPolicies = {
  backend: wrap(readTimeout, retryPolicy, breakers.backend),
  supabase: wrap(readTimeout, retryPolicy, breakers.supabase),
  stripe: wrap(readTimeout, retryPolicy, breakers.stripe),
  plaid: wrap(readTimeout, retryPolicy, breakers.plaid),
  quickbooks: wrap(readTimeout, retryPolicy, breakers.quickbooks),
  gusto: wrap(readTimeout, retryPolicy, breakers.gusto),
} as const;

// Action policies: 30s timeout + retry + breaker
export const actionPolicies = {
  backend: wrap(actionTimeout, retryPolicy, breakers.backend),
  supabase: wrap(actionTimeout, retryPolicy, breakers.supabase),
  stripe: wrap(actionTimeout, retryPolicy, breakers.stripe),
  plaid: wrap(actionTimeout, retryPolicy, breakers.plaid),
  quickbooks: wrap(actionTimeout, retryPolicy, breakers.quickbooks),
  gusto: wrap(actionTimeout, retryPolicy, breakers.gusto),
} as const;

// Legacy alias — retry + breaker without explicit timeout (backward compat)
export const policies = {
  backend: wrap(retryPolicy, breakers.backend),
  supabase: wrap(retryPolicy, breakers.supabase),
  stripe: wrap(retryPolicy, breakers.stripe),
  plaid: wrap(retryPolicy, breakers.plaid),
  quickbooks: wrap(retryPolicy, breakers.quickbooks),
  gusto: wrap(retryPolicy, breakers.gusto),
} as const;

export type ServiceName = keyof typeof policies;

/**
 * Execute a function with circuit breaker + retry protection (no timeout).
 * For timeout-aware calls, use withBreakerRead or withBreakerAction.
 */
export async function withBreaker<T>(
  service: ServiceName,
  fn: () => Promise<T>,
): Promise<T> {
  return policies[service].execute(fn);
}

/**
 * Execute a read operation with 5s timeout + retry + circuit breaker.
 * The fn receives a context with an AbortSignal for cooperative cancellation.
 * The signal parameter is optional — functions that don't need it can ignore it.
 */
export async function withBreakerRead<T>(
  service: ServiceName,
  fn: (context: { signal: AbortSignal }) => Promise<T>,
): Promise<T> {
  return readPolicies[service].execute(fn);
}

/**
 * Execute an action operation with 30s timeout + retry + circuit breaker.
 * The fn receives a context with an AbortSignal for cooperative cancellation.
 * The signal parameter is optional — functions that don't need it can ignore it.
 */
export async function withBreakerAction<T>(
  service: ServiceName,
  fn: (() => Promise<T>) | ((context: { signal: AbortSignal }) => Promise<T>),
): Promise<T> {
  return actionPolicies[service].execute(fn as (context: { signal: AbortSignal }) => Promise<T>);
}

/**
 * Get circuit breaker states for health checks.
 */
export function getBreakerStates(): Record<string, string> {
  const states: Record<string, string> = {};
  for (const [name, breaker] of Object.entries(breakers)) {
    states[name] = String(breaker.state);
  }
  return states;
}
