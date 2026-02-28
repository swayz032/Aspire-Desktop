import crypto from 'crypto';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { createTrustSpineReceipt } from '../receiptService';

// ─── Config from env ───
const GOOGLE_CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = () => process.env.GOOGLE_CLIENT_SECRET || '';
const PUBLIC_BASE_URL = () => process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
const REDIRECT_URI = () => `${PUBLIC_BASE_URL()}/api/mail/oauth/google/callback`;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
];

// ─── Timeout helper (Gate 3: Reliability) ───
const OAUTH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = OAUTH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── State encoding (jobId + suiteId + nonce in OAuth state param) ───
// CSRF nonce prevents replay + state forgery

interface OAuthState {
  jobId: string;
  suiteId: string;
  nonce: string;
}

// In-memory nonce store (short-lived — OAuth flow is <5 min)
const pendingNonces = new Map<string, number>();

// Purge expired nonces every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000;
  for (const [nonce, ts] of pendingNonces) {
    if (ts < cutoff) pendingNonces.delete(nonce);
  }
}, 5 * 60_000);

function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

function decodeState(encoded: string): OAuthState {
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
}

// ─── Public API ───

export function buildAuthUrl(jobId: string, suiteId: string): string {
  const clientId = GOOGLE_CLIENT_ID();
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');

  // CSRF nonce — verified in handleCallback
  const nonce = crypto.randomUUID();
  pendingNonces.set(nonce, Date.now());

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: encodeState({ jobId, suiteId, nonce }),
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function handleCallback(
  code: string,
  stateParam: string,
): Promise<{ email: string; suiteId: string; jobId: string }> {
  const state = decodeState(stateParam);
  const { jobId, suiteId, nonce } = state;

  // CSRF nonce verification — Law #3: Fail Closed
  // Inline age check (fixes interval-only purge window race — THREAT-005)
  const nonceTs = nonce ? pendingNonces.get(nonce) : undefined;
  if (!nonce || nonceTs === undefined || (Date.now() - nonceTs) > 5 * 60_000) {
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.oauth.csrf_rejected',
      status: 'FAILED',
      action: { provider: 'google', jobId },
      result: { error: 'invalid_or_expired_nonce' },
    }).catch(() => {});
    throw new Error('Invalid or expired OAuth state — possible CSRF attempt');
  }
  pendingNonces.delete(nonce); // One-time use

  // Exchange code for tokens (with timeout — Gate 3: Reliability)
  const tokenRes = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID(),
      client_secret: GOOGLE_CLIENT_SECRET(),
      redirect_uri: REDIRECT_URI(),
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    // Failure receipt
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.oauth.exchange_failed',
      status: 'FAILED',
      action: { provider: 'google', jobId },
      result: { error: 'Token exchange failed', statusCode: tokenRes.status },
    });
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in, id_token } = tokens;

  // Decode id_token to get email (JWT payload is base64url-encoded part 1)
  let email = '';
  if (id_token) {
    try {
      const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString());
      email = payload.email || '';
    } catch {
      // Fallback: fetch from userinfo
    }
  }

  if (!email) {
    const userinfoRes = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    }, 10_000);
    if (userinfoRes.ok) {
      const info = await userinfoRes.json();
      email = info.email || '';
    }
  }

  const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

  // UPSERT oauth_tokens
  // Scopes must be formatted as a Postgres array literal — drizzle sql`` expands JS arrays
  // as individual params ($5,$6,...) which breaks ::text[] cast
  const scopesLiteral = `{${SCOPES.join(',')}}`;
  await db.execute(sql`
    INSERT INTO oauth_tokens (suite_id, provider, access_token, refresh_token, email, scopes, token_type, expires_at)
    VALUES (${suiteId}::uuid, 'google', ${access_token}, ${refresh_token || null}, ${email}, ${scopesLiteral}::text[], 'Bearer', ${expiresAt}::timestamptz)
    ON CONFLICT (suite_id, provider)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
      email = EXCLUDED.email,
      scopes = EXCLUDED.scopes,
      token_type = EXCLUDED.token_type,
      expires_at = EXCLUDED.expires_at,
      updated_at = now()
  `);

  // Update onboarding job state
  await db.execute(sql`
    UPDATE app.mail_onboarding_jobs
    SET state = 'GOOGLE_OAUTH_COMPLETE',
        state_updated_at = now(),
        mailbox_email = ${email}
    WHERE id = ${jobId}::uuid
      AND suite_id = ${suiteId}::uuid
      AND state IN ('INIT', 'GOOGLE_OAUTH_PENDING')
  `);

  // YELLOW receipt — external OAuth + data access grant
  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.oauth.google_connected',
    status: 'SUCCEEDED',
    action: { provider: 'google', jobId, scopes: SCOPES },
    result: { email: '<EMAIL_REDACTED>', tokenStored: true },
  });

  return { email, suiteId, jobId };
}

export async function refreshToken(suiteId: string): Promise<string> {
  // Fetch current refresh_token
  const result = await db.execute(sql`
    SELECT refresh_token FROM oauth_tokens
    WHERE suite_id = ${suiteId}::uuid AND provider = 'google'
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length || !rows[0].refresh_token) {
    throw new Error('No Google refresh token found — re-authentication required');
  }

  const refreshTokenValue = rows[0].refresh_token;

  const tokenRes = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID(),
      client_secret: GOOGLE_CLIENT_SECRET(),
      refresh_token: refreshTokenValue,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.oauth.refresh_failed',
      status: 'FAILED',
      action: { provider: 'google' },
      result: { error: 'Token refresh failed', statusCode: tokenRes.status },
    });
    throw new Error(`Google token refresh failed: ${tokenRes.status}`);
  }

  const data = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  await db.execute(sql`
    UPDATE oauth_tokens
    SET access_token = ${data.access_token},
        expires_at = ${expiresAt}::timestamptz,
        updated_at = now()
    WHERE suite_id = ${suiteId}::uuid AND provider = 'google'
  `);

  // Success receipt — Law #2: token refresh is a state change
  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.oauth.token_refreshed',
    status: 'SUCCEEDED',
    action: { provider: 'google', operation: 'refresh_token' },
    result: { tokenRefreshed: true },
  }).catch(() => {});

  return data.access_token;
}

export async function getValidToken(suiteId: string): Promise<string> {
  const result = await db.execute(sql`
    SELECT access_token, expires_at FROM oauth_tokens
    WHERE suite_id = ${suiteId}::uuid AND provider = 'google'
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) {
    throw new Error('No Google OAuth token found — setup required');
  }

  const { access_token, expires_at } = rows[0];

  // Refresh if expiring within 60 seconds
  if (expires_at && new Date(expires_at).getTime() < Date.now() + 60_000) {
    return refreshToken(suiteId);
  }

  return access_token;
}

export async function getConnectedEmail(suiteId: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT email FROM oauth_tokens
    WHERE suite_id = ${suiteId}::uuid AND provider = 'google'
  `);
  const rows = (result.rows || result) as any[];
  return rows.length ? rows[0].email : null;
}
