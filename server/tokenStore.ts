import { db } from './db';
import { sql } from 'drizzle-orm';
import { getDefaultSuiteId } from './suiteContext';

export interface StoredToken {
  access_token: string;
  refresh_token?: string | null;
  realm_id?: string | null;
  company_uuid?: string | null;
  item_id?: string | null;
  expires_at?: Date | null;
}

export async function saveToken(provider: string, token: StoredToken): Promise<void> {
  try {
    const suiteId = getDefaultSuiteId();
    const expiresAt = token.expires_at || null;
    await db.execute(sql`
      INSERT INTO oauth_tokens (suite_id, provider, access_token, refresh_token, realm_id, company_uuid, item_id, expires_at, updated_at)
      VALUES (${suiteId}, ${provider}, ${token.access_token}, ${token.refresh_token || null}, ${token.realm_id || null}, ${token.company_uuid || null}, ${token.item_id || null}, ${expiresAt}, NOW())
      ON CONFLICT (suite_id, provider)
      DO UPDATE SET
        access_token = ${token.access_token},
        refresh_token = COALESCE(${token.refresh_token || null}, oauth_tokens.refresh_token),
        realm_id = COALESCE(${token.realm_id || null}, oauth_tokens.realm_id),
        company_uuid = COALESCE(${token.company_uuid || null}, oauth_tokens.company_uuid),
        item_id = COALESCE(${token.item_id || null}, oauth_tokens.item_id),
        expires_at = COALESCE(${expiresAt}, oauth_tokens.expires_at),
        updated_at = NOW()
    `);
    console.log(`Token saved for provider: ${provider}`);
  } catch (error: any) {
    console.error(`Failed to save token for ${provider}:`, error.message);
  }
}

export async function loadToken(provider: string): Promise<StoredToken | null> {
  try {
    const suiteId = getDefaultSuiteId();
    const result = await db.execute(sql`
      SELECT access_token, refresh_token, realm_id, company_uuid, item_id, expires_at
      FROM oauth_tokens
      WHERE suite_id = ${suiteId} AND provider = ${provider}
    `);
    const rows = result.rows || result;
    if (rows && rows.length > 0) {
      const row = rows[0] as any;
      console.log(`Token loaded for provider: ${provider}`);
      return {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        realm_id: row.realm_id,
        company_uuid: row.company_uuid,
        item_id: row.item_id,
        expires_at: row.expires_at ? new Date(row.expires_at) : null,
      };
    }
    return null;
  } catch (error: any) {
    console.error(`Failed to load token for ${provider}:`, error.message);
    return null;
  }
}

export async function deleteToken(provider: string): Promise<void> {
  try {
    const suiteId = getDefaultSuiteId();
    await db.execute(sql`DELETE FROM oauth_tokens WHERE suite_id = ${suiteId} AND provider = ${provider}`);
    console.log(`Token deleted for provider: ${provider}`);
  } catch (error: any) {
    console.error(`Failed to delete token for ${provider}:`, error.message);
  }
}

export async function loadAllTokens(providerPrefix: string): Promise<StoredToken[]> {
  try {
    const suiteId = getDefaultSuiteId();
    const result = await db.execute(sql`
      SELECT access_token, refresh_token, realm_id, company_uuid, item_id, expires_at, provider
      FROM oauth_tokens
      WHERE suite_id = ${suiteId} AND provider LIKE ${providerPrefix + '%'}
      ORDER BY created_at ASC
    `);
    const rows = (result.rows || result) as any[];
    if (rows && rows.length > 0) {
      return rows.map((row: any) => ({
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        realm_id: row.realm_id,
        company_uuid: row.company_uuid,
        item_id: row.item_id,
        expires_at: row.expires_at ? new Date(row.expires_at) : null,
      }));
    }
    return [];
  } catch (error: any) {
    console.error(`Failed to load tokens for ${providerPrefix}:`, error.message);
    return [];
  }
}

export async function deleteAllTokens(providerPrefix: string): Promise<void> {
  try {
    const suiteId = getDefaultSuiteId();
    await db.execute(sql`DELETE FROM oauth_tokens WHERE suite_id = ${suiteId} AND provider LIKE ${providerPrefix + '%'}`);
    console.log(`All tokens deleted for prefix: ${providerPrefix}`);
  } catch (error: any) {
    console.error(`Failed to delete tokens for ${providerPrefix}:`, error.message);
  }
}
