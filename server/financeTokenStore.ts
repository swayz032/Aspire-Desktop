import { db } from './db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

// Law #3: Fail Closed — no hardcoded fallback key. If TOKEN_ENCRYPTION_KEY is not set,
// token encryption/decryption will fail explicitly rather than using a guessable key.
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.warn('WARNING: TOKEN_ENCRYPTION_KEY not set. Finance token encryption will be unavailable.');
}

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY not set — cannot encrypt tokens (Law #3: Fail Closed)');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY not set — cannot decrypt tokens (Law #3: Fail Closed)');
  }
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface ConnectionRecord {
  id: string;
  suiteId: string;
  officeId: string;
  provider: string;
  externalAccountId: string;
  status: string;
  scopes: any;
  lastSyncAt: Date | null;
  lastWebhookAt: Date | null;
}

function rowToConnection(row: any): ConnectionRecord {
  return {
    id: row.id,
    suiteId: row.suite_id,
    officeId: row.office_id,
    provider: row.provider,
    externalAccountId: row.external_account_id,
    status: row.status,
    scopes: row.scopes,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
    lastWebhookAt: row.last_webhook_at ? new Date(row.last_webhook_at) : null,
  };
}

export async function createConnection(params: {
  suiteId: string;
  officeId: string;
  provider: 'plaid' | 'stripe' | 'qbo' | 'gusto';
  externalAccountId: string;
  scopes?: any;
}): Promise<string> {
  try {
    const result = await db.execute(sql`
      INSERT INTO finance_connections (suite_id, office_id, provider, external_account_id, scopes)
      VALUES (${params.suiteId}, ${params.officeId}, ${params.provider}, ${params.externalAccountId}, ${JSON.stringify(params.scopes || null)})
      RETURNING id
    `);
    const rows = result.rows || result;
    const id = (rows as any)[0].id;
    console.log(`Finance connection created: ${id} for provider ${params.provider}`);
    return id;
  } catch (error: any) {
    console.error('Failed to create finance connection:', error.message);
    throw error;
  }
}

export async function getConnection(connectionId: string): Promise<ConnectionRecord | null> {
  try {
    const result = await db.execute(sql`
      SELECT id, suite_id, office_id, provider, external_account_id, status, scopes, last_sync_at, last_webhook_at
      FROM finance_connections
      WHERE id = ${connectionId}
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      return rowToConnection((rows as any[])[0]);
    }
    return null;
  } catch (error: any) {
    console.error('Failed to get finance connection:', error.message);
    return null;
  }
}

export async function getConnectionsByTenant(suiteId: string, officeId: string): Promise<ConnectionRecord[]> {
  try {
    const result = await db.execute(sql`
      SELECT id, suite_id, office_id, provider, external_account_id, status, scopes, last_sync_at, last_webhook_at
      FROM finance_connections
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
      ORDER BY created_at ASC
    `);
    const rows = (result.rows || result) as any[];
    return rows.map(rowToConnection);
  } catch (error: any) {
    console.error('Failed to get connections by tenant:', error.message);
    return [];
  }
}

export async function getConnectionByProvider(suiteId: string, officeId: string, provider: string): Promise<ConnectionRecord | null> {
  try {
    const result = await db.execute(sql`
      SELECT id, suite_id, office_id, provider, external_account_id, status, scopes, last_sync_at, last_webhook_at
      FROM finance_connections
      WHERE suite_id = ${suiteId} AND office_id = ${officeId} AND provider = ${provider}
      LIMIT 1
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      return rowToConnection((rows as any[])[0]);
    }
    return null;
  } catch (error: any) {
    console.error('Failed to get connection by provider:', error.message);
    return null;
  }
}

export async function updateConnectionStatus(connectionId: string, status: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE finance_connections
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${connectionId}
    `);
    console.log(`Connection ${connectionId} status updated to ${status}`);
  } catch (error: any) {
    console.error('Failed to update connection status:', error.message);
    throw error;
  }
}

export async function updateConnectionSyncTime(connectionId: string, field: 'last_sync_at' | 'last_webhook_at'): Promise<void> {
  try {
    if (field === 'last_sync_at') {
      await db.execute(sql`
        UPDATE finance_connections
        SET last_sync_at = NOW(), updated_at = NOW()
        WHERE id = ${connectionId}
      `);
    } else {
      await db.execute(sql`
        UPDATE finance_connections
        SET last_webhook_at = NOW(), updated_at = NOW()
        WHERE id = ${connectionId}
      `);
    }
    console.log(`Connection ${connectionId} ${field} updated`);
  } catch (error: any) {
    console.error(`Failed to update connection sync time (${field}):`, error.message);
    throw error;
  }
}

export async function saveConnectionToken(connectionId: string, accessToken: string, refreshToken?: string | null, expiresAt?: Date | null): Promise<void> {
  try {
    const accessTokenEnc = encrypt(accessToken);
    const refreshTokenEnc = refreshToken ? encrypt(refreshToken) : null;

    const existing = await db.execute(sql`
      SELECT id FROM finance_tokens WHERE connection_id = ${connectionId} LIMIT 1
    `);
    const existingRows = existing.rows || existing;

    if (existingRows && (existingRows as any[]).length > 0) {
      await db.execute(sql`
        UPDATE finance_tokens
        SET access_token_enc = ${accessTokenEnc},
            refresh_token_enc = COALESCE(${refreshTokenEnc}, refresh_token_enc),
            expires_at = COALESCE(${expiresAt || null}, expires_at),
            updated_at = NOW()
        WHERE connection_id = ${connectionId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO finance_tokens (connection_id, access_token_enc, refresh_token_enc, expires_at)
        VALUES (${connectionId}, ${accessTokenEnc}, ${refreshTokenEnc}, ${expiresAt || null})
      `);
    }
    console.log(`Token saved for connection ${connectionId}`);
  } catch (error: any) {
    console.error('Failed to save connection token:', error.message);
    throw error;
  }
}

export async function loadConnectionToken(connectionId: string): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null; rotationVersion: number } | null> {
  try {
    const result = await db.execute(sql`
      SELECT access_token_enc, refresh_token_enc, expires_at, rotation_version
      FROM finance_tokens
      WHERE connection_id = ${connectionId}
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      const row = (rows as any[])[0];
      return {
        accessToken: decrypt(row.access_token_enc),
        refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
        expiresAt: row.expires_at ? new Date(row.expires_at) : null,
        rotationVersion: row.rotation_version,
      };
    }
    return null;
  } catch (error: any) {
    console.error('Failed to load connection token:', error.message);
    return null;
  }
}

export async function rotateConnectionToken(connectionId: string, newAccessToken: string, newRefreshToken?: string | null, newExpiresAt?: Date | null): Promise<void> {
  try {
    const accessTokenEnc = encrypt(newAccessToken);
    const refreshTokenEnc = newRefreshToken ? encrypt(newRefreshToken) : null;

    await db.execute(sql`
      UPDATE finance_tokens
      SET access_token_enc = ${accessTokenEnc},
          refresh_token_enc = COALESCE(${refreshTokenEnc}, refresh_token_enc),
          expires_at = COALESCE(${newExpiresAt || null}, expires_at),
          rotation_version = rotation_version + 1,
          updated_at = NOW()
      WHERE connection_id = ${connectionId}
    `);
    console.log(`Token rotated for connection ${connectionId}`);
  } catch (error: any) {
    console.error('Failed to rotate connection token:', error.message);
    throw error;
  }
}

export async function deleteConnection(connectionId: string): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM finance_tokens WHERE connection_id = ${connectionId}
    `);
    await db.execute(sql`
      DELETE FROM finance_connections WHERE id = ${connectionId}
    `);
    console.log(`Connection ${connectionId} and associated tokens deleted`);
  } catch (error: any) {
    console.error('Failed to delete connection:', error.message);
    throw error;
  }
}
