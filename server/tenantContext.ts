import { db } from './db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

/**
 * Apply tenant context safely for RLS-backed queries.
 * Uses session-level set_config to avoid transaction-local errors on pooled connections.
 */
export async function applyTenantContext(
  suiteId: string,
  officeId?: string,
): Promise<boolean> {
  if (!suiteId) return false;
  try {
    await db.execute(sql`SELECT set_config('app.current_suite_id', ${suiteId}, false)`);
    if (officeId) {
      await db.execute(sql`SELECT set_config('app.current_office_id', ${officeId}, false)`);
    }
    return true;
  } catch (error) {
    logger.error('Tenant context apply failed', {
      suite_id: suiteId,
      office_id: officeId || null,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}

