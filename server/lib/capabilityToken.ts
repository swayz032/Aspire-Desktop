/**
 * Capability Token Mint Helper — Pass 18+ frontend production hardening.
 *
 * Mints a short-lived (default 45s, max 59s per Law #5) capability token in
 * the canonical shape the orchestrator's `validate_token()` expects:
 *   - HMAC-SHA256 over JSON.stringify(canonical sorted-key payload)
 *   - The signed payload includes: token_id, suite_id, office_id, tool, scopes
 *     (sorted), issued_at, expires_at, correlation_id
 *
 * Mirrors the proven `/api/tools/enrich-product` implementation in routes.ts
 * (see `server/routes.ts` near `enrich-product` for the reference pattern).
 *
 * Law compliance:
 *   Law #5 — TTL <60s, scoped (tenant + tool + action), server-only mint.
 *   Law #6 — suite_id and office_id bound from JWT-derived scope, not headers.
 *   Law #9 — never log signing keys or token signatures.
 */
import crypto from 'crypto';

export interface MintCapabilityTokenInput {
  /** Required scope for the action (e.g. `front_desk:config_save`). */
  scope: string;
  /** Optional canonical "tool" name for token binding. Defaults to scope. */
  tool?: string;
  /** Tenant ID — in this single-tenant-per-suite codebase, falls back to suite_id. */
  tenant_id: string;
  suite_id: string;
  office_id: string;
  /** TTL in seconds. Capped at 59 per Law #5; defaults to 45. */
  ttl_seconds?: number;
  /** Optional resource binding for write-tier tokens (e.g. record id). */
  resource_id?: string;
  /** Correlation ID — generates a fresh UUID if absent. */
  correlation_id?: string;
}

export interface MintedCapabilityToken {
  /** Full token object to send in the orchestrator request body. */
  token: Record<string, unknown>;
  expires_at: string;
  token_id: string;
  correlation_id: string;
}

/**
 * Resolve the signing key from env. Returns null if missing or weak (<32 chars).
 * Callers must surface a 503 SIGNING_KEY_UNAVAILABLE response on null.
 */
export function resolveSigningKey(): string | null {
  const key = (process.env.TOKEN_SIGNING_SECRET || process.env.ASPIRE_TOKEN_SIGNING_KEY || '').trim();
  if (!key || key.length < 32) return null;
  return key;
}

/**
 * Mint a capability token. Returns null if the signing key is missing/weak —
 * caller must respond with 503 SIGNING_KEY_UNAVAILABLE so the orchestrator never
 * receives an unsigned/weak request (Law #3 fail-closed).
 */
export function mintCapabilityToken(input: MintCapabilityTokenInput): MintedCapabilityToken | null {
  const signingKey = resolveSigningKey();
  if (!signingKey) return null;

  const ttl = Math.min(Math.max(input.ttl_seconds ?? 45, 5), 59);
  const tokenId = crypto.randomUUID();
  const correlationId = input.correlation_id || `corr_${crypto.randomUUID()}`;
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttl * 1000);
  const tool = input.tool || input.scope;
  const scopes = [input.scope].sort();

  // Canonical payload — keys MUST be sorted-key serialized for the HMAC to
  // match validate_token() on the Python side (json.dumps sort_keys=True,
  // separators=(',',':')).
  const payloadForSigning: Record<string, unknown> = {
    token_id: tokenId,
    suite_id: input.suite_id,
    office_id: input.office_id,
    tool,
    scopes,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    correlation_id: correlationId,
  };
  if (input.resource_id) {
    payloadForSigning.resource_id = input.resource_id;
  }

  const sortedKeys = Object.keys(payloadForSigning).sort();
  const canonicalObj: Record<string, unknown> = {};
  for (const k of sortedKeys) canonicalObj[k] = payloadForSigning[k];
  const canonical = JSON.stringify(canonicalObj);
  const signature = crypto.createHmac('sha256', signingKey).update(canonical).digest('hex');

  const fullToken: Record<string, unknown> = {
    ...payloadForSigning,
    signature,
    revoked: false,
  };

  return {
    token: fullToken,
    expires_at: expiresAt.toISOString(),
    token_id: tokenId,
    correlation_id: correlationId,
  };
}
