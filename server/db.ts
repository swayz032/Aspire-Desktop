import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { logger } from './logger';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Max connections: Supabase free tier allows ~60 via pooler.
  // Railway runs 1 container. Leave headroom for backend + admin + migrations.
  max: parseInt(process.env.DB_POOL_MAX || (IS_PRODUCTION ? '20' : '5'), 10),

  // Idle connections released after 30s (default 10s too aggressive under bursty load)
  idleTimeoutMillis: 30_000,

  // Fail fast: if no connection available in 5s, reject (don't queue forever)
  connectionTimeoutMillis: 5_000,

  // Keepalive prevents Supabase pooler from dropping idle connections
  keepAlive: true,

  // Application name for pg_stat_activity debugging
  application_name: 'aspire-desktop',
});

// Surface pool errors instead of crashing silently
pool.on('error', (err) => {
  logger.error('[DB_POOL] Unexpected error on idle client', { error: err.message });
});

export { pool };
export const db = drizzle(pool, { schema });
