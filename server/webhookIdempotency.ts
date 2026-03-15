/**
 * Webhook idempotency guard — deduplicates webhook deliveries using event IDs.
 *
 * Uses an in-memory Map with TTL (15 min). Prevents reprocessing of replayed
 * or duplicate webhook events from Stripe, Plaid, Gusto, and QuickBooks.
 *
 * Law #2: Receipt for all — idempotent skips are still logged.
 * Law #3: Fail closed — unknown/missing event IDs are rejected, not silently passed.
 */

import { logger } from './logger';

const DEDUP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 5000;
const CLEANUP_THRESHOLD = 1000;

const processedWebhooks = new Map<string, number>();
let insertsSinceCleanup = 0;

/**
 * Check if a webhook event has already been processed.
 * Returns true if the event IS a duplicate (should be skipped).
 * Returns false if the event is new (should be processed).
 */
export function isDuplicateWebhook(eventId: string, provider: string): boolean {
  if (!eventId) {
    logger.warn(`Webhook idempotency: missing event ID from ${provider}`);
    return false; // Let the handler decide — missing ID is not a duplicate
  }

  const key = `${provider}:${eventId}`;

  if (processedWebhooks.has(key)) {
    logger.info(`Webhook idempotency: duplicate skipped`, { provider, eventId });
    return true;
  }

  processedWebhooks.set(key, Date.now());
  insertsSinceCleanup++;

  // Periodic cleanup of expired entries
  if (insertsSinceCleanup >= CLEANUP_THRESHOLD || processedWebhooks.size > MAX_ENTRIES) {
    cleanupExpiredEntries();
    insertsSinceCleanup = 0;
  }

  return false;
}

/**
 * Remove entries older than the TTL window.
 */
function cleanupExpiredEntries(): void {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  let removed = 0;
  for (const [key, timestamp] of processedWebhooks) {
    if (timestamp < cutoff) {
      processedWebhooks.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    logger.info(`Webhook idempotency: cleaned up ${removed} expired entries, ${processedWebhooks.size} remaining`);
  }
}

/**
 * Get current idempotency cache stats (for health checks).
 */
export function getIdempotencyStats(): { size: number; maxEntries: number; ttlMs: number } {
  return {
    size: processedWebhooks.size,
    maxEntries: MAX_ENTRIES,
    ttlMs: DEDUP_TTL_MS,
  };
}
