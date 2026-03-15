import {
  CircuitBreakerPolicy,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  wrap,
  circuitBreaker,
  SamplingBreaker,
} from 'cockatiel';
import { logger } from './logger';

/**
 * Circuit breaker + retry policies for external service calls.
 * Uses cockatiel (Law #10: circuit breakers, idempotent retries, exponential backoff).
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

// Circuit breaker: opens after 5 consecutive failures, half-opens after 30s
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

// Named breakers for each external service
export const breakers = {
  backend: createBreaker('backend', 5, 30_000),
  supabase: createBreaker('supabase', 5, 30_000),
  stripe: createBreaker('stripe', 3, 120_000),
  plaid: createBreaker('plaid', 3, 120_000),
  quickbooks: createBreaker('quickbooks', 3, 120_000),
  gusto: createBreaker('gusto', 3, 120_000),
} as const;

// Wrapped policies: retry + circuit breaker
export const policies = {
  backend: wrap(retryPolicy, breakers.backend),
  supabase: wrap(retryPolicy, breakers.supabase),
  stripe: wrap(retryPolicy, breakers.stripe),
  plaid: wrap(retryPolicy, breakers.plaid),
  quickbooks: wrap(retryPolicy, breakers.quickbooks),
  gusto: wrap(retryPolicy, breakers.gusto),
} as const;

/**
 * Execute a function with circuit breaker + retry protection.
 * @example
 * const data = await withBreaker('backend', () => fetch('http://localhost:8000/api/...'));
 */
export async function withBreaker<T>(
  service: keyof typeof policies,
  fn: () => Promise<T>,
): Promise<T> {
  return policies[service].execute(fn);
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
