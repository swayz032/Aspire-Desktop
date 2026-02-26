/**
 * AWS Secrets Manager bootstrap for Aspire Desktop server.
 *
 * Architecture:
 *   - On startup: fetch all secrets from SM, inject into process.env
 *   - 5-minute cache TTL (AWS best practice)
 *   - On auth failure: invalidate cache → re-fetch → retry once
 *   - In local dev without AWS creds: fall through to .env.local
 *   - Fail-closed: if SM fetch fails in production, server refuses to start (Law #3)
 *
 * Services only need 3 env vars from Railway:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 * Everything else comes from SM.
 */

import { logger } from './logger';

// Dynamic import — @aws-sdk/client-secrets-manager is loaded lazily so the
// server doesn't crash when the package isn't installed (e.g., Railway where
// secrets are set as env vars directly, not via AWS SM).

// SM key name → process.env variable name
const KEY_MAP: Record<string, string> = {
  // Stripe
  restricted_key: 'STRIPE_RESTRICTED_KEY',
  secret_key: 'STRIPE_SECRET_KEY',
  publishable_key: 'STRIPE_PUBLISHABLE_KEY',
  webhook_secret: 'STRIPE_WEBHOOK_SECRET',
  // Supabase
  service_role_key: 'SUPABASE_SERVICE_ROLE_KEY',
  jwt_secret: 'SUPABASE_JWT_SECRET',
  // OpenAI + Twilio "api_key" collision handled by GROUP_KEY_MAP below
  // Twilio
  account_sid: 'TWILIO_ACCOUNT_SID',
  api_secret: 'TWILIO_API_SECRET',
  auth_token: 'TWILIO_AUTH_TOKEN',
  // Internal
  token_signing_secret: 'TOKEN_SIGNING_SECRET',
  token_encryption_key: 'TOKEN_ENCRYPTION_KEY',
  n8n_hmac_secret: 'N8N_WEBHOOK_SECRET',
  n8n_eli_webhook_secret: 'N8N_ELI_WEBHOOK_SECRET',
  n8n_sarah_webhook_secret: 'N8N_SARAH_WEBHOOK_SECRET',
  n8n_nora_webhook_secret: 'N8N_NORA_WEBHOOK_SECRET',
  domain_rail_hmac_secret: 'DOMAIN_RAIL_HMAC_SECRET',
  gateway_internal_key: 'GATEWAY_INTERNAL_KEY',
  // Providers
  elevenlabs_key: 'ELEVENLABS_API_KEY',
  deepgram_key: 'DEEPGRAM_API_KEY',
  livekit_key: 'LIVEKIT_API_KEY',
  livekit_secret: 'LIVEKIT_SECRET',
  anam_key: 'ANAM_API_KEY',
  pandadoc_api_key: 'ASPIRE_PANDADOC_API_KEY',
  pandadoc_webhook_secret: 'PANDADOC_WEBHOOK_SECRET',
  tavily_key: 'TAVILY_API_KEY',
  brave_key: 'BRAVE_API_KEY',
  google_maps_key: 'GOOGLE_MAPS_API_KEY',
  // Google OAuth (Eli inbox — Gmail integration)
  google_client_id: 'GOOGLE_CLIENT_ID',
  google_client_secret: 'GOOGLE_CLIENT_SECRET',
  // PolarisM (Aspire Business Email provisioning)
  polaris_username: 'POLARIS_USERNAME',
  polaris_password: 'POLARIS_PASSWORD',
  polaris_base_url: 'POLARIS_BASE_URL',
};

// Per-group key mappings (some SM groups have colliding key names like "api_key")
const GROUP_KEY_MAP: Record<string, Record<string, string>> = {
  openai: { api_key: 'OPENAI_API_KEY' },
  twilio: {
    account_sid: 'TWILIO_ACCOUNT_SID',
    api_key: 'TWILIO_API_KEY',
    api_secret: 'TWILIO_API_SECRET',
    auth_token: 'TWILIO_AUTH_TOKEN',
  },
};

let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let smClient: any = null;

async function getClient(): Promise<any> {
  if (!smClient) {
    const { SecretsManagerClient } = await import('@aws-sdk/client-secrets-manager');
    smClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return smClient;
}

/**
 * Load all secrets from AWS Secrets Manager into process.env.
 *
 * Behavior:
 *   - production + no AWS creds → FATAL (fail-closed, Law #3)
 *   - local dev + no AWS creds → skip, use .env.local
 *   - cache fresh → skip (5-min TTL)
 *   - SM fetch failure in production → throw (server won't start)
 */
export async function loadSecrets(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasAwsCreds = !!process.env.AWS_SECRET_ACCESS_KEY;

  // Local dev without AWS creds — use .env.local
  if (!isProduction && !hasAwsCreds) {
    logger.info('[secrets] Local dev mode — using .env.local (no AWS creds)');
    return;
  }

  // Production without AWS creds — check if secrets are set directly (Railway env vars)
  if (isProduction && !hasAwsCreds) {
    const hasCriticalEnvVars = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (hasCriticalEnvVars) {
      logger.info('[secrets] Production mode — using Railway env vars (no AWS SM needed)');
      return;
    }
    // No AWS creds AND no direct env vars — fail closed (Law #3)
    throw new Error(
      '[secrets] FATAL: Production mode requires either AWS credentials or direct env vars. ' +
      'Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, or set secrets directly in Railway.'
    );
  }

  // Cache still fresh — skip
  if (Date.now() - lastFetch < CACHE_TTL) {
    return;
  }

  const client = await getClient();
  const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
  const env = isProduction ? 'prod' : 'dev';

  const groups = [
    { path: `aspire/${env}/stripe`, name: 'stripe' },
    { path: `aspire/${env}/supabase`, name: 'supabase' },
    { path: `aspire/${env}/openai`, name: 'openai' },
    { path: `aspire/${env}/twilio`, name: 'twilio' },
    { path: `aspire/${env}/internal`, name: 'internal' },
    { path: `aspire/${env}/providers`, name: 'providers' },
  ];

  let loadedCount = 0;

  for (const { path, name } of groups) {
    try {
      const result = await client.send(
        new GetSecretValueCommand({ SecretId: path })
      );

      if (!result.SecretString) {
        logger.warn('[secrets] Empty secret string', { path });
        continue;
      }

      const secrets = JSON.parse(result.SecretString);

      for (const [k, v] of Object.entries(secrets)) {
        // Skip internal rotation metadata keys
        if (k.startsWith('_')) continue;

        // Use group-specific mapping if available (handles "api_key" collisions)
        const groupMap = GROUP_KEY_MAP[name];
        const envVar = groupMap?.[k] ?? KEY_MAP[k] ?? k.toUpperCase();

        process.env[envVar] = v as string;
        loadedCount++;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'unknown';
      const criticalGroups = ['stripe', 'supabase', 'internal'];
      const isCritical = criticalGroups.includes(name);

      if (isProduction || isCritical) {
        // Fail closed — critical groups required even in dev (Law #3)
        logger.error('[secrets] Failed to fetch secret group', { path, error: errMsg });
        throw new Error(`Secrets Manager fetch failed for ${path} — cannot start without credentials`);
      } else {
        // Dev mode non-critical group — warn and continue
        logger.warn('[secrets] Failed to fetch secret group', { path, error: errMsg });
      }
    }
  }

  lastFetch = Date.now();
  logger.info('[secrets] Secrets loaded from SM', { loadedCount, groupCount: groups.length, env });
}

/**
 * Invalidate the secrets cache — forces next loadSecrets() call to re-fetch.
 *
 * Call this when you detect an authentication error from a provider
 * (e.g., Stripe AuthenticationError) — the key may have been rotated
 * and the service is still using the cached old value.
 *
 * Usage:
 *   import { invalidateSecretsCache, loadSecrets } from './secrets';
 *   catch (err) {
 *     if (err.type === 'StripeAuthenticationError') {
 *       invalidateSecretsCache();
 *       await loadSecrets(); // re-fetch from SM
 *       // retry the operation once
 *     }
 *   }
 */
export function invalidateSecretsCache(): void {
  lastFetch = 0;
  smClient = null; // Force new client (picks up any credential rotation)
  logger.info('[secrets] Cache invalidated — next loadSecrets() will re-fetch from SM');
}

/**
 * Check if secrets were loaded from SM (vs .env.local fallback).
 */
export function isSecretsManagerActive(): boolean {
  return lastFetch > 0;
}

/**
 * Handle provider authentication errors by invalidating secrets cache and reloading.
 *
 * Call this from any catch block where a provider returns an auth error
 * (e.g., Stripe AuthenticationError, Twilio 401, OpenAI 401).
 * After calling this, retry the operation ONCE — if it fails again, the key
 * is genuinely invalid (not just stale from rotation).
 *
 * Returns true if secrets were reloaded (caller should retry), false otherwise.
 */
export async function handleProviderAuthError(
  provider: string,
  error: any
): Promise<boolean> {
  // Only act on authentication-type errors
  const isAuthError =
    error?.type === 'StripeAuthenticationError' ||
    error?.type === 'authentication_error' ||
    error?.statusCode === 401 ||
    error?.status === 401 ||
    (error?.message && /authentication|unauthorized|invalid.*key/i.test(error.message));

  if (!isAuthError) return false;

  // Only reload if SM is active (otherwise there's nothing to reload)
  if (!isSecretsManagerActive()) return false;

  logger.warn('[secrets] Provider auth error — invalidating cache and reloading from SM', { provider });
  invalidateSecretsCache();

  try {
    await loadSecrets();
    logger.info('[secrets] Secrets reloaded after auth error — caller should retry once', { provider });
    return true;
  } catch (reloadErr: unknown) {
    logger.error('[secrets] Failed to reload secrets after auth error', { provider, error: reloadErr instanceof Error ? reloadErr.message : 'unknown' });
    return false;
  }
}
