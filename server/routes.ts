import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getDefaultSuiteId, getDefaultOfficeId } from './suiteContext';
import { logger } from './logger';
import { captureServerException } from './sentry';
import { reportAdminIncident } from './incidentReporter';

// Supabase admin client for bootstrap operations (user_metadata updates)
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const router = Router();
const CANONICAL_ANAM_AVA_PERSONA_ID = '58f82b89-8ae7-43cc-930d-be8def14dff3';
const CONFIGURED_ANAM_AVA_PERSONA_ID = process.env.ANAM_AVA_PERSONA_ID?.trim() || CANONICAL_ANAM_AVA_PERSONA_ID;
const CANONICAL_ANAM_AVA_TOOL_NAMES = [
  'ava_get_context',
  'ava_search',
  'ava_create_draft',
  'ava_request_approval',
  'invoke_quinn',
  'invoke_adam',
  'invoke_tec',
  'invoke_clara',
  'save_office_note',
  'show_cards',
] as const;
const CANONICAL_ANAM_AVA_KNOWLEDGE_TOOL_NAMES = ['Knowledge_Ava', 'ava_knowledge_search'] as const;

type AnamPersonaTool = {
  name?: string;
  type?: string;
  subtype?: string;
  method?: string;
  url?: string;
  awaitResponse?: boolean;
  headers?: Record<string, string>;
  parameters?: unknown;
  config?: {
    method?: string;
    url?: string;
    awaitResponse?: boolean;
    headers?: Record<string, string>;
    parameters?: unknown;
  };
};

function validateAnamAvaPromptAndConfig(prompt: string, personaId: string): string[] {
  const errors: string[] = [];
  const normalizedPrompt = String(prompt || '').toLowerCase();

  if (personaId !== CANONICAL_ANAM_AVA_PERSONA_ID) {
    errors.push(`Ava personaId drift detected: expected ${CANONICAL_ANAM_AVA_PERSONA_ID}, got ${personaId}`);
  }

  const hasSearch = normalizedPrompt.includes('## search');
  const hasAvaSearch = normalizedPrompt.includes('## ava_search');
  if (!hasSearch && !hasAvaSearch) {
    errors.push('Anam Ava prompt missing search tool section (expected ## search or ## ava_search).');
  }
  if (normalizedPrompt.includes('transfer to specialist agents immediately')) {
    errors.push('Anam Ava prompt contains transfer language incompatible with video tool-only routing.');
  }
  if (normalizedPrompt.includes('switch to voice mode')) {
    errors.push('Anam Ava prompt contains voice-mode handoff language incompatible with Anam routing.');
  }

  return errors;
}

function validateAnamAvaToolset(tools: AnamPersonaTool[]): string[] {
  const issues: string[] = [];
  const expectedWebhookPathByTool: Record<string, string> = {
    ava_get_context: '/v1/tools/context',
    ava_search: '/v1/tools/search',
    ava_create_draft: '/v1/tools/draft',
    ava_request_approval: '/v1/tools/approve',
    save_office_note: '/v1/tools/office-note',
    invoke_adam: '/v1/tools/invoke',
    invoke_quinn: '/v1/tools/invoke',
    invoke_tec: '/v1/tools/invoke',
    invoke_clara: '/v1/tools/invoke',
  };
  const names = tools.map((tool) => String(tool?.name || '').trim()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  for (const [name, count] of counts.entries()) {
    if (count > 1) issues.push(`Duplicate Anam Ava tool attached: ${name} x${count}`);
  }

  for (const required of CANONICAL_ANAM_AVA_TOOL_NAMES) {
    if (!counts.has(required)) issues.push(`Missing required Anam Ava tool: ${required}`);
  }
  if (!CANONICAL_ANAM_AVA_KNOWLEDGE_TOOL_NAMES.some((name) => counts.has(name))) {
    issues.push('Missing knowledge tool: expected Knowledge_Ava or ava_knowledge_search');
  }

  for (const tool of tools) {
    const name = String(tool?.name || '');
    if (!name || !CANONICAL_ANAM_AVA_TOOL_NAMES.includes(name as (typeof CANONICAL_ANAM_AVA_TOOL_NAMES)[number])) {
      continue;
    }
    if (name === 'show_cards') continue;
    if (tool.type !== 'server' || tool.subtype !== 'webhook') {
      issues.push(`Tool ${name} must be server webhook`);
      continue;
    }
    const url = String(tool.url || tool.config?.url || '');
    const method = String(tool.method || tool.config?.method || '').toUpperCase();
    const awaitResponse = typeof tool.awaitResponse === 'boolean' ? tool.awaitResponse : tool.config?.awaitResponse;
    const parameters = tool.parameters ?? tool.config?.parameters;
    const headers = tool.headers || tool.config?.headers || {};
    if (!url || !url.startsWith('http')) issues.push(`Tool ${name} missing webhook url`);
    const expectedPath = expectedWebhookPathByTool[name];
    if (expectedPath && !url.includes(expectedPath)) {
      issues.push(`Tool ${name} endpoint drift: expected ${expectedPath}, got ${url}`);
    }
    if (method !== 'POST') issues.push(`Tool ${name} must use POST`);
    if (awaitResponse !== true) issues.push(`Tool ${name} must set awaitResponse=true`);
    if (!parameters || typeof parameters !== 'object') issues.push(`Tool ${name} missing parameters schema`);
    if (!headers['x-aspire-tool-secret']) issues.push(`Tool ${name} missing x-aspire-tool-secret header`);
  }

  return issues;
}

async function fetchAnamPersonaToolsForValidation(
  personaId: string,
  anamApiKey: string,
): Promise<{ tools: AnamPersonaTool[]; issues: string[] }> {
  try {
    const apiResp: any = await fetch(`https://api.anam.ai/v1/personas/${personaId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${anamApiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!apiResp.ok) {
      const body = await apiResp.text().catch(() => '');
      return { tools: [], issues: [`Unable to fetch Anam persona tools (${apiResp.status}): ${body.slice(0, 180)}`] };
    }
    const data = await apiResp.json().catch(() => ({}));
    const tools = Array.isArray(data?.tools) ? (data.tools as AnamPersonaTool[]) : [];
    return { tools, issues: validateAnamAvaToolset(tools) };
  } catch (error: unknown) {
    return {
      tools: [],
      issues: [
        `Unable to fetch Anam persona tools: ${error instanceof Error ? error.message : 'unknown error'}`,
      ],
    };
  }
}

type SupportedAgent =
  | 'ava'
  | 'finn'
  | 'eli'
  | 'nora'
  | 'sarah'
  | 'adam'
  | 'quinn'
  | 'tec'
  | 'teressa'
  | 'milo'
  | 'clara'
  | 'mail_ops';

const SUPPORTED_AGENTS = new Set<SupportedAgent>([
  'ava', 'finn', 'eli', 'nora', 'sarah', 'adam',
  'quinn', 'tec', 'teressa', 'milo', 'clara', 'mail_ops',
]);
const ENABLE_INTENT_SSE_PROXY = process.env.ENABLE_INTENT_SSE_PROXY !== 'false';
const STRICT_AGENT_VALIDATION = process.env.STRICT_AGENT_VALIDATION !== 'false';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_TTS_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';

function resolveOrchestratorUrl(): string | null {
  const configured = process.env.ORCHESTRATOR_URL?.trim();
  if (configured) return configured;
  if (IS_PRODUCTION) return null;
  return 'http://localhost:8000';
}

function parseRequestedAgent(raw: unknown): { value: SupportedAgent; provided: boolean; valid: boolean } {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { value: 'ava', provided: false, valid: true };
  }
  const normalized = raw.trim().toLowerCase() as SupportedAgent;
  if (SUPPORTED_AGENTS.has(normalized)) {
    return { value: normalized, provided: true, valid: true };
  }
  return { value: 'ava', provided: true, valid: false };
}

function resolveTraceId(req: Request, fallback?: string): string {
  const fromHeader = (req.headers['x-trace-id'] as string) || '';
  const fromCorr = (req.headers['x-correlation-id'] as string) || '';
  return fromHeader || fromCorr || fallback || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type FetchRetryOptions = {
  timeoutMs: number;
  retries: number;
  retryOnStatuses?: number[];
  backoffMs?: number;
};

type TraceStage = 'session' | 'mic' | 'stt' | 'orchestrator' | 'tts' | 'playback';
type TraceStatus = 'start' | 'ok' | 'error';
let traceTableEnsured = false;

async function ensureTraceTable(): Promise<void> {
  if (traceTableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS trace_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trace_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        suite_id TEXT NULL,
        agent TEXT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NULL,
        error_code TEXT NULL,
        latency_ms INTEGER NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    traceTableEnsured = true;
  } catch {
    // Best effort only; never block request path on telemetry.
  }
}

function emitTraceEvent(event: {
  traceId: string;
  correlationId: string;
  suiteId?: string | null;
  agent?: string | null;
  stage: TraceStage;
  status: TraceStatus;
  message?: string;
  errorCode?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}): void {
  void (async () => {
    try {
      await ensureTraceTable();
      await db.execute(sql`
        INSERT INTO trace_events (
          trace_id, correlation_id, suite_id, agent, stage, status, message, error_code, latency_ms, metadata
        ) VALUES (
          ${event.traceId},
          ${event.correlationId},
          ${event.suiteId ?? null},
          ${event.agent ?? null},
          ${event.stage},
          ${event.status},
          ${event.message ?? null},
          ${event.errorCode ?? null},
          ${typeof event.latencyMs === 'number' ? event.latencyMs : null},
          ${JSON.stringify(event.metadata ?? {})}::jsonb
        )
      `);
    } catch (e) {
      // Telemetry must not fail user requests, but log for observability
      console.error('[Trace] Event insert failed:', e);
    }
  })();
}

async function reportPipelineIncident(details: {
  title: string;
  severity?: 'sev1' | 'sev2' | 'sev3' | 'sev4';
  correlationId: string;
  traceId: string;
  suiteId?: string | null;
  component: string;
  fingerprint: string;
  agent?: string | null;
  errorCode?: string | null;
  statusCode?: number | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const orchestratorUrl = resolveOrchestratorUrl();
  await reportAdminIncident(orchestratorUrl, {
    title: details.title,
    severity: details.severity || 'sev2',
    correlationId: details.correlationId,
    traceId: details.traceId,
    suiteId: details.suiteId || null,
    source: 'aspire_desktop',
    component: details.component,
    fingerprint: details.fingerprint,
    agent: details.agent || null,
    errorCode: details.errorCode || null,
    statusCode: typeof details.statusCode === 'number' ? details.statusCode : null,
    message: details.message || null,
    metadata: details.metadata,
  });
}

async function fetchWithTimeoutAndRetry(
  url: string,
  init: RequestInit,
  options: FetchRetryOptions,
): Promise<globalThis.Response> {
  const retryStatuses = new Set(options.retryOnStatuses || [429, 500, 502, 503, 504]);
  const baseBackoffMs = options.backoffMs ?? 250;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (attempt < options.retries && retryStatuses.has(response.status)) {
        // Exponential backoff with jitter: base * 2^attempt + random jitter
        const expDelay = baseBackoffMs * Math.pow(2, attempt);
        const jitter = Math.random() * expDelay * 0.5;
        await new Promise((resolve) => setTimeout(resolve, expDelay + jitter));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      if (attempt >= options.retries) break;
      // Exponential backoff with jitter on network errors
      const expDelay = baseBackoffMs * Math.pow(2, attempt);
      const jitter = Math.random() * expDelay * 0.5;
      await new Promise((resolve) => setTimeout(resolve, expDelay + jitter));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Upstream request failed');
}

function secureTokenEquals(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left || '', 'utf8');
  const rightBuf = Buffer.from(right || '', 'utf8');
  if (!leftBuf.length || !rightBuf.length) return false;
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function shortCorrelationRef(correlationId: string): string {
  const compact = String(correlationId || '').replace(/[^a-zA-Z0-9]/g, '');
  if (!compact) return 'UNKNOWN';
  return compact.slice(0, 10).toUpperCase();
}

function humanizeUserError(message: string | null | undefined, correlationId: string): string {
  const base = (message || '').trim() || 'I hit a temporary issue while handling that. Please try again in a moment.';
  return `${base} (ref ${shortCorrelationRef(correlationId)})`;
}

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

router.get('/api/stripe/publishable-key', async (req: Request, res: Response) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    res.status(500).json({ error: msg });
  }
});

// ─── Input Sanitization (Law #9: strip XSS vectors) ───
function sanitizeText(text: string | undefined | null): string | null {
  if (!text || typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').trim() || null;
}

function sanitizeArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((s: any) => typeof s === 'string').map((s: string) => sanitizeText(s) || '').filter(Boolean);
}

// Validate enum field — returns value if valid, null otherwise
function validateEnum(value: any, allowed: string[]): string | null {
  if (typeof value !== 'string') return null;
  return allowed.includes(value) ? value : null;
}

function isValidIsoDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function isAdultDate(value: string | null): boolean {
  if (!isValidIsoDate(value)) return false;
  const dob = new Date(value as string);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age >= 18;
}

/**
 * Deterministic hash from seed string. Returns unsigned 32-bit integer.
 */
/**
 * Allocate the next unique suite display ID from Postgres sequence.
 * Race-safe — sequences are concurrency-safe. Returns "122", "123", etc.
 * Each company gets a globally unique number. Admin portal uses this to
 * identify and track companies.
 */
async function allocateSuiteDisplayId(): Promise<string> {
  const result = await db.execute(sql`SELECT nextval('suite_display_id_seq')::text AS id`);
  const row = ((result.rows || result) as any[])[0];
  if (!row?.id) throw new Error('Failed to allocate suite display ID from sequence');
  return row.id;
}

/**
 * Allocate the next office display ID within a suite.
 * Owner = A01, next member = A02, etc. Unique within each suite.
 * Admin portal uses this to identify team members within a company.
 */
async function allocateOfficeDisplayId(suiteId: string): Promise<string> {
  const result = await db.execute(sql`SELECT allocate_office_display_id(${suiteId}::uuid) AS id`);
  const row = ((result.rows || result) as any[])[0];
  if (!row?.id) throw new Error('Failed to allocate office display ID');
  return row.id;
}

async function resolveSuiteOfficeIdentity(suiteId: string): Promise<{
  suiteDisplayId: string;
  officeDisplayId: string;
  businessName?: string | null;
}> {
  let suiteDisplayId: string | null = null;
  let officeDisplayId: string | null = null;
  let businessName: string | null = null;

  // 1) suite_profiles cache (fast path)
  try {
    if (supabaseAdmin) {
      const { data: profileData } = await supabaseAdmin
        .from('suite_profiles')
        .select('display_id, office_display_id, business_name')
        .eq('suite_id', suiteId)
        .single();
      suiteDisplayId = profileData?.display_id || null;
      officeDisplayId = profileData?.office_display_id || null;
      businessName = profileData?.business_name || null;
    }
  } catch {
    // best effort
  }

  // 2) canonical app schema (source of truth for premium display ids)
  try {
    const identityResult = await db.execute(sql`
      SELECT
        s.display_id AS suite_display_id,
        o.display_id AS office_display_id
      FROM app.suites s
      LEFT JOIN app.offices o ON o.suite_id = s.suite_id
      WHERE s.suite_id = ${suiteId}
      ORDER BY o.created_at ASC NULLS LAST
      LIMIT 1
    `);
    const identityRow = ((identityResult.rows || identityResult) as any[])[0];
    if (!suiteDisplayId) suiteDisplayId = identityRow?.suite_display_id || null;
    if (!officeDisplayId) officeDisplayId = identityRow?.office_display_id || null;
  } catch {
    // best effort
  }

  // If no display IDs found in DB, allocate new unique ones from sequences
  if (!suiteDisplayId) {
    suiteDisplayId = await allocateSuiteDisplayId();
  }
  if (!officeDisplayId) {
    officeDisplayId = await allocateOfficeDisplayId(suiteId);
  }

  return {
    suiteDisplayId,
    officeDisplayId,
    businessName,
  };
}

// Canonical JSON: sort object keys recursively for deterministic HMAC signatures
// Must match n8n receiver sortKeys() — both sides produce identical canonical JSON
function sortKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc: any, key: string) => {
      acc[key] = sortKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

// ─── Invite Code Validation (Private Beta Gate) ───
// Rate-limited: 5 attempts per minute per IP to prevent brute force.
// This is a PUBLIC endpoint (no JWT required — user isn't authenticated yet).
const inviteCodeRateLimit = new Map<string, { count: number; resetAt: number }>();

router.post('/api/auth/validate-invite-code', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Rate limit: 5 attempts per 60 seconds per IP
  const rl = inviteCodeRateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 5) {
      return res.status(429).json({
        valid: false,
        error: 'Too many attempts. Please wait a minute and try again.',
      });
    }
    rl.count++;
  } else {
    inviteCodeRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, error: 'Invite code is required.' });
  }

  const expectedCode = process.env.ASPIRE_INVITE_CODE;
  if (!expectedCode) {
    logger.error('ASPIRE_INVITE_CODE env var not set — invite validation will always fail');
    return res.status(500).json({ valid: false, error: 'Invite system not configured.' });
  }

  const normalizedCode = code.trim().toLowerCase();
  const normalizedExpected = expectedCode.trim().toLowerCase();
  // Timing-safe comparison to prevent timing side-channel attacks (Law #9)
  const codeBuffer = Buffer.from(normalizedCode.padEnd(256, '\0'));
  const expectedBuffer = Buffer.from(normalizedExpected.padEnd(256, '\0'));
  const valid = normalizedCode.length === normalizedExpected.length && crypto.timingSafeEqual(codeBuffer, expectedBuffer);
  if (!valid) {
    return res.status(403).json({ valid: false, error: 'Invalid invite code.' });
  }

  return res.json({ valid: true });
});

// Cleanup rate limit maps every 5 minutes
setInterval(() => {
  const cutoff = Date.now();
  for (const [key, val] of inviteCodeRateLimit) {
    if (cutoff >= val.resetAt) inviteCodeRateLimit.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Server-Side Signup (Private Beta) ───
// Creates user with email auto-confirmed (no email verification in beta).
// Validates invite code server-side before creating the account.
// PUBLIC endpoint — rate-limited via the invite code rate limiter above.
const signupRateLimit = new Map<string, { count: number; resetAt: number }>();

router.post('/api/auth/signup', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Rate limit: 3 signups per minute per IP
  const rl = signupRateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 3) {
      return res.status(429).json({ error: 'Too many signup attempts. Please wait a minute.' });
    }
    rl.count++;
  } else {
    signupRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  const { email, password, inviteCode } = req.body || {};

  if (!email || !password || !inviteCode) {
    return res.status(400).json({ error: 'Email, password, and invite code are required.' });
  }

  if (typeof email !== 'string' || typeof password !== 'string' || typeof inviteCode !== 'string') {
    return res.status(400).json({ error: 'Invalid input types.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  // Validate invite code (timing-safe comparison — Law #9)
  const expectedCode = process.env.ASPIRE_INVITE_CODE;
  if (!expectedCode) {
    return res.status(403).json({ error: 'Invalid invite code.' });
  }
  const normInvite = inviteCode.trim().toLowerCase();
  const normExpected = expectedCode.trim().toLowerCase();
  const invBuf = Buffer.from(normInvite.padEnd(256, '\0'));
  const expBuf = Buffer.from(normExpected.padEnd(256, '\0'));
  if (normInvite.length !== normExpected.length || !crypto.timingSafeEqual(invBuf, expBuf)) {
    return res.status(403).json({ error: 'Invalid invite code.' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Auth service unavailable.' });
  }

  try {
    // Create user with email auto-confirmed (beta — no email verification)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });

    if (error) {
      // Supabase returns specific error for duplicate email
      if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
        return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
      }
      return res.status(400).json({ error: error.message });
    }

    logger.info('Beta signup: user created', { userId: data.user?.id });
    return res.json({ success: true, userId: data.user?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.error('Signup error', { error: msg });
    return res.status(500).json({ error: 'Account creation failed. Please try again.' });
  }
});

/**
 * Emit a receipt to the Trust Spine receipts table.
 * Maps desktop-friendly params to the actual receipts schema:
 *   receipt_type (TEXT), status (SUCCEEDED/FAILED/DENIED), action (JSONB), result (JSONB),
 *   actor_type (USER/SYSTEM/WORKER)
 */
async function emitReceipt(params: {
  receiptId: string;
  receiptType: string;
  outcome: 'success' | 'failed' | 'denied';
  suiteId: string;
  tenantId: string;
  correlationId: string;
  actorType: 'user' | 'system' | 'worker';
  actorId: string;
  riskTier: string;
  actionData?: Record<string, any>;
  resultData?: Record<string, any>;
}): Promise<void> {
  const STATUS_MAP: Record<string, string> = { success: 'SUCCEEDED', failed: 'FAILED', denied: 'DENIED' };
  const ACTOR_MAP: Record<string, string> = { user: 'USER', system: 'SYSTEM', worker: 'WORKER' };

  await db.execute(sql`
    INSERT INTO receipts (receipt_id, receipt_type, status, action, result,
                          suite_id, tenant_id, correlation_id, actor_type, actor_id,
                          created_at)
    VALUES (${params.receiptId}, ${params.receiptType},
            ${STATUS_MAP[params.outcome] || 'FAILED'},
            ${JSON.stringify({ risk_tier: params.riskTier, ...params.actionData })}::jsonb,
            ${JSON.stringify({ outcome: params.outcome, ...params.resultData })}::jsonb,
            ${params.suiteId}, ${params.tenantId},
            ${params.correlationId},
            ${ACTOR_MAP[params.actorType] || 'SYSTEM'},
            ${params.actorId},
            NOW())
  `);
}

/**
 * Suite Bootstrap — creates suite infrastructure for new users
 * Called during onboarding when user has no suite_id in their metadata.
 * Uses service role to bypass RLS for initial setup.
 *
 * Risk Tier: YELLOW (creates tenant context, collects business intelligence)
 * Receipt: onboarding.intake_submission (PII redacted — Law #2 + #9)
 */
// In-memory rate limiter: 3 requests per 60s per user
const bootstrapRateLimit = new Map<string, { count: number; resetAt: number }>();
router.post('/api/onboarding/bootstrap', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-bootstrap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = (req as any).authenticatedUserId;
  if (!userId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Must be authenticated' });
  }

  // Rate limit check — 3 bootstrap attempts per minute per user
  const now = Date.now();
  const rl = bootstrapRateLimit.get(userId);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 3) {
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many onboarding attempts. Please wait and try again.' });
    }
    rl.count++;
  } else {
    bootstrapRateLimit.set(userId, { count: 1, resetAt: now + 60000 });
  }

  // Check if user already has a suite — but only skip if profile is ALSO complete.
  // Previous attempts may have created the suite but failed on the profile upsert,
  // leaving onboarding_completed_at unset and causing the auth gate to loop.
  const existingSuiteId = (req as any).authenticatedSuiteId;
  if (existingSuiteId && existingSuiteId !== getDefaultSuiteId()) {
    // Verify profile actually exists with all required onboarding fields complete
    const { data: existingProfile } = await supabaseAdmin!.from('suite_profiles')
      .select('onboarding_completed_at, owner_name, business_name, industry')
      .eq('suite_id', existingSuiteId)
      .single();
    if (
      existingProfile?.onboarding_completed_at &&
      existingProfile?.owner_name &&
      existingProfile?.business_name &&
      existingProfile?.industry
    ) {
      const identity = await resolveSuiteOfficeIdentity(existingSuiteId);
      return res.json({
        suiteId: existingSuiteId,
        created: false,
        suiteDisplayId: identity.suiteDisplayId,
        officeDisplayId: identity.officeDisplayId,
        businessName: identity.businessName || existingProfile.business_name || null,
      });
    }
    // Profile missing or incomplete — fall through to create/update it
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'BOOTSTRAP_UNAVAILABLE', message: 'Admin client not configured' });
  }

  try {
    // ── Extract & validate all fields ──
    const b = req.body;
    const businessName = sanitizeText(b.businessName);
    const ownerName = sanitizeText(b.ownerName);
    const ownerTitle = sanitizeText(b.ownerTitle);
    const industry = sanitizeText(b.industry);
    const teamSize = sanitizeText(b.teamSize);
    const entityType = validateEnum(b.entityType, ['sole_proprietorship', 'llc', 's_corp', 'c_corp', 'partnership', 'nonprofit', 'other']);
    const yearsInBusiness = validateEnum(b.yearsInBusiness, ['less_than_1', '1_to_3', '3_to_5', '5_to_10', '10_plus']);
    const salesChannel = validateEnum(b.salesChannel, ['online', 'in_person', 'both', 'other']);
    const customerType = validateEnum(b.customerType, ['b2b', 'b2c', 'both']);
    const annualRevenueBand = validateEnum(b.annualRevenueBand, ['under_50k', '50k_100k', '100k_250k', '250k_500k', '500k_1m', '1m_plus']);
    const gender = validateEnum(b.gender, ['male', 'female', 'non-binary', 'prefer-not-to-say']);
    const roleCategory = sanitizeText(b.roleCategory);
    const preferredChannel = validateEnum(b.preferredChannel, ['cold', 'warm', 'hot']) || 'warm';
    const timezone = sanitizeText(b.timezone);
    const currency = (typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency)) ? b.currency : 'USD';
    const fiscalYearEndMonth = (typeof b.fiscalYearEndMonth === 'number' && b.fiscalYearEndMonth >= 1 && b.fiscalYearEndMonth <= 12) ? b.fiscalYearEndMonth : null;

    const servicesNeeded = sanitizeArray(b.servicesNeeded);
    const servicesPriority = sanitizeArray(b.servicesPriority);
    const currentTools = Array.isArray(b.currentTools) ? sanitizeArray(b.currentTools) : (typeof b.currentTools === 'string' ? b.currentTools.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
    const toolsPlanning = sanitizeArray(b.toolsPlanning);
    const businessGoals = sanitizeArray(b.businessGoals);

    // V3 marketing fields (migration 064)
    const industrySpecialty = sanitizeText(b.industrySpecialty);
    const incomeRange = validateEnum(b.incomeRange, ['under_25k','25k_50k','50k_75k','75k_100k','100k_150k','150k_250k','250k_500k','500k_plus']);
    const referralSource = validateEnum(b.referralSource, ['google_search','social_media','friend_referral','podcast','blog_article','conference_event','advertisement','app_store','other']);
    const painPoint = sanitizeText(typeof b.painPoint === 'string' ? b.painPoint.slice(0, 1000) : b.painPoint);

    // Address fields
    const homeAddressLine1 = sanitizeText(b.homeAddressLine1);
    const homeAddressLine2 = sanitizeText(b.homeAddressLine2);
    const homeCity = sanitizeText(b.homeCity);
    const homeState = sanitizeText(b.homeState);
    const homeZip = sanitizeText(b.homeZip);
    const homeCountry = sanitizeText(b.homeCountry) || 'US';
    const businessAddressSameAsHome = b.businessAddressSameAsHome !== false;
    const businessAddressLine1 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine1);
    const businessAddressLine2 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine2);
    const businessCity = businessAddressSameAsHome ? null : sanitizeText(b.businessCity);
    const businessState = businessAddressSameAsHome ? null : sanitizeText(b.businessState);
    const businessZip = businessAddressSameAsHome ? null : sanitizeText(b.businessZip);
    const businessCountry = businessAddressSameAsHome ? null : (sanitizeText(b.businessCountry) || 'US');

    // Date of birth — validate format
    const dateOfBirth = (typeof b.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dateOfBirth)) ? b.dateOfBirth : null;

    // Consent — Law #9: personalization consent required for full intake
    const consentPersonalization = b.consentPersonalization === true;
    const consentCommunications = b.consentCommunications === true;

    // Minimum required fields
    if (!businessName) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Business name is required' });
    }
    if (!ownerName) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Owner name is required' });
    }
    if (!gender) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Gender is required' });
    }
    if (!isValidIsoDate(dateOfBirth)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Date of birth must be YYYY-MM-DD' });
    }
    if (!isAdultDate(dateOfBirth)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'User must be at least 18 years old' });
    }

    // 1. Create suite via app.ensure_suite (handles duplicates gracefully)
    // Deterministic tenantId from userId — ensures idempotency (same user = same tenant)
    const tenantId = `tenant-${userId.replace(/-/g, '').slice(0, 16)}`;
    const suiteName = businessName;
    let suiteId: string;

    try {
      const result = await db.execute(sql`
        SELECT app.ensure_suite(${tenantId}, ${suiteName}) AS suite_id
      `);
      const rows = (result.rows || result) as any[];
      suiteId = rows[0]?.suite_id;
    } catch {
      // If app.ensure_suite doesn't exist, insert directly
      const result = await db.execute(sql`
        INSERT INTO app.suites (tenant_id, name)
        VALUES (${tenantId}, ${suiteName})
        RETURNING suite_id
      `);
      const rows = (result.rows || result) as any[];
      suiteId = rows[0]?.suite_id;
    }

    if (!suiteId) {
      return res.status(500).json({ error: 'BOOTSTRAP_FAILED', message: 'Could not create suite' });
    }

    // 1b. Create tenant_memberships row — enables RLS Path A for client-side queries.
    // Without this, app.check_suite_access() fails for auth.uid() checks,
    // blocking ALL client-side Supabase queries (getSuiteProfile, etc.)
    // This is CRITICAL — if it fails, the user sees "Suite Pending" everywhere.
    try {
      await db.execute(sql`
        INSERT INTO tenant_memberships (tenant_id, user_id, role)
        VALUES (${tenantId}, ${userId}::uuid, 'owner')
        ON CONFLICT (tenant_id, user_id) DO NOTHING
      `);
    } catch (membershipErr: unknown) {
      logger.error('tenant_memberships insert FAILED — client-side RLS will be broken', {
        correlationId, tenantId, userId,
        error: membershipErr instanceof Error ? membershipErr.message : 'unknown'
      });
      return res.status(500).json({
        error: 'BOOTSTRAP_FAILED',
        message: 'Could not create tenant membership — RLS access will be broken'
      });
    }

    // 2. Get user email from Supabase admin
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !user) {
      return res.status(500).json({ error: 'USER_LOOKUP_FAILED', message: 'Could not find user' });
    }

    // 3. Generate receipt ID (Law #2: Receipt for All)
    const receiptId = crypto.randomUUID();

    // 4. Create suite_profile with ALL enterprise fields (service role bypasses RLS)
    const { error: profileError } = await supabaseAdmin
      .from('suite_profiles')
      .upsert({
        suite_id: suiteId,
        email: user.email || '',
        name: ownerName || user.email?.split('@')[0] || 'Owner',
        business_name: businessName,
        owner_name: ownerName,
        owner_title: ownerTitle,
        industry,
        team_size: teamSize,
        entity_type: entityType,
        years_in_business: yearsInBusiness,
        sales_channel: salesChannel,
        customer_type: customerType,
        annual_revenue_band: annualRevenueBand,
        gender,
        role_category: roleCategory,
        date_of_birth: dateOfBirth,
        // Address
        home_address_line1: homeAddressLine1,
        home_address_line2: homeAddressLine2,
        home_city: homeCity,
        home_state: homeState,
        home_zip: homeZip,
        home_country: homeCountry,
        business_address_same_as_home: businessAddressSameAsHome,
        business_address_line1: businessAddressLine1,
        business_address_line2: businessAddressLine2,
        business_city: businessCity,
        business_state: businessState,
        business_zip: businessZip,
        business_country: businessCountry,
        // Services
        services_needed: servicesNeeded,
        services_priority: servicesPriority,
        current_tools: currentTools,
        tools_planning: toolsPlanning,
        business_goals: businessGoals,
        pain_point: painPoint,
        // Preferences
        preferred_channel: preferredChannel,
        timezone,
        currency,
        fiscal_year_end_month: fiscalYearEndMonth,
        // V3 marketing fields
        industry_specialty: industrySpecialty,
        income_range: incomeRange,
        referral_source: referralSource,
        // Consent
        consent_personalization: consentPersonalization,
        consent_communications: consentCommunications,
        intake_schema_version: 3,
        intake_receipt_id: receiptId,
        onboarding_completed_at: new Date().toISOString(),
      }, { onConflict: 'suite_id' });

    if (profileError) {
      logger.error('Profile creation error', { error: profileError?.message || profileError?.code || 'unknown' });
      // FATAL — without the profile row, onboarding_completed_at is never set,
      // causing the auth gate to loop the user back to onboarding indefinitely.
      return res.status(500).json({
        error: 'PROFILE_CREATION_FAILED',
        message: `Failed to create business profile: ${profileError.message || profileError.code || 'unknown error'}`,
        details: profileError.details || profileError.hint || null,
      });
    }

    // 5. Emit intake receipt (Law #2: Receipt for All — PII redacted per Law #9)
    try {
      await emitReceipt({
        receiptId, receiptType: 'onboarding.intake_submission', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId, actorType: 'user', actorId: userId, riskTier: 'yellow',
        actionData: { schema_version: 3, industry_specialty: industrySpecialty, income_range: incomeRange, referral_source: referralSource },
        resultData: {
          fields_completed: Object.entries({
            businessName, industry, teamSize, entityType, yearsInBusiness,
            industrySpecialty, incomeRange, referralSource, painPoint, salesChannel, customerType,
            homeAddressLine1, consentPersonalization,
          }).filter(([, v]) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0)).length,
          industry: industry || '<NOT_PROVIDED>',
          team_size: teamSize || '<NOT_PROVIDED>',
          entity_type: entityType || '<NOT_PROVIDED>',
          consent_personalization: consentPersonalization,
          consent_communications: consentCommunications,
          date_of_birth: dateOfBirth ? '<DOB_REDACTED>' : null,
          gender: gender ? '<GENDER_REDACTED>' : null,
          home_address: homeAddressLine1 ? '<ADDRESS_REDACTED>' : null,
          business_address: businessAddressLine1 ? '<ADDRESS_REDACTED>' : null,
        },
      });
    } catch (receiptErr: unknown) {
      // YELLOW-tier receipt is mandatory — fail closed per Law #3
      logger.error('Receipt emission failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Intake receipt could not be recorded. Operation denied (Law #3: fail closed).' });
    }

    // 6. Update user_metadata with suite_id (so client gets it on session refresh)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { suite_id: suiteId },
    });

    if (updateError) {
      logger.error('User metadata update error', { error: updateError?.message || updateError?.code || 'unknown' });
      return res.status(500).json({ error: 'METADATA_UPDATE_FAILED', message: 'Suite created but metadata update failed' });
    }

    // 7. Fire-and-forget n8n webhook for intake activation (non-blocking)
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
    const webhookPayload = {
      suiteId,
      officeId: suiteId, // officeId defaults to suiteId for single-office tenants
      dateOfBirth,
      gender,
      industry,
      industrySpecialty,
      incomeRange,
      referralSource,
      businessGoals,
      painPoint,
      customerType,
      salesChannel,
      teamSize,
      correlationId,
    };
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (webhookSecret) {
      try {
        const webhookBody = JSON.stringify(sortKeys(webhookPayload));
        // Use sha256= prefix for standard HMAC format
        const hmac = 'sha256=' + crypto.createHmac('sha256', webhookSecret)
          .update(webhookBody)
          .digest('hex');

        fetch(`${N8N_WEBHOOK_URL}/webhook/intake-activation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': hmac,
            'X-Suite-Id': suiteId,
            'X-Correlation-Id': correlationId,
          },
          body: webhookBody,
          signal: AbortSignal.timeout(5000),
        }).catch((err: unknown) => logger.warn('n8n intake webhook failed (non-blocking)', { error: err instanceof Error ? err.message : 'unknown' }));
      } catch (webhookErr: unknown) {
        logger.warn('n8n webhook setup failed (non-blocking)', { error: webhookErr instanceof Error ? webhookErr.message : 'unknown' });
      }
    } else {
      logger.warn('N8N_WEBHOOK_SECRET not set — skipping intake activation webhook (fail-closed)');
    }

    const identity = await resolveSuiteOfficeIdentity(suiteId);

    // 8. Persist display IDs in suite_profiles so client-side RLS queries return them
    // Without this, getTenantIdentity() is the only source, and if it fails the UI shows "Suite Pending"
    try {
      await supabaseAdmin!
        .from('suite_profiles')
        .update({
          display_id: identity.suiteDisplayId,
          office_display_id: identity.officeDisplayId,
        })
        .eq('suite_id', suiteId);
    } catch (displayIdErr: unknown) {
      logger.warn('display_id persistence failed (non-fatal — identity API fallback still works)', {
        correlationId, error: displayIdErr instanceof Error ? displayIdErr.message : 'unknown'
      });
    }

    res.json({
      suiteId,
      created: true,
      receiptId,
      suiteDisplayId: identity.suiteDisplayId,
      officeDisplayId: identity.officeDisplayId,
      businessName: identity.businessName || businessName,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Bootstrap error', { correlationId, error: errorMsg });
    // Emit failure receipt — Law #2: failures also produce receipts
    try {
      const failReceiptId = crypto.randomUUID();
      const sanitizedMsg = sanitizeText(String(errorMsg)) || 'unknown_error';
      // Bootstrap failure — no suite exists yet, so receipt goes to system log only
      logger.error('Bootstrap failed', { correlationId, error: sanitizedMsg });
    } catch (failReceiptErr: unknown) {
      logger.error('Failure receipt also failed', { correlationId, error: failReceiptErr instanceof Error ? failReceiptErr.message : 'unknown' });
    }
    res.status(500).json({ error: 'BOOTSTRAP_FAILED', message: 'Onboarding could not be completed. Please try again.' });
  }
});

/**
 * Onboarding Status — server-side check using supabaseAdmin (bypasses RLS).
 * The client-side Supabase query may be blocked by RLS if no read policy exists
 * on suite_profiles. This endpoint guarantees a reliable answer.
 */
router.get('/api/onboarding/status', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId || suiteId === getDefaultSuiteId()) {
    return res.json({ complete: false, reason: 'no_suite' });
  }
  if (!supabaseAdmin) {
    return res.json({ complete: false, reason: 'admin_unavailable' });
  }
  const { data } = await supabaseAdmin
    .from('suite_profiles')
    .select('onboarding_completed_at, owner_name, business_name, industry')
    .eq('suite_id', suiteId)
    .single();
  const complete = !!(
    data?.onboarding_completed_at &&
    data?.owner_name &&
    data?.business_name &&
    data?.industry
  );
  return res.json({ complete });
});

/**
 * Tenant Identity â€” authoritative business + premium suite/office display IDs.
 * Used by desktop UI surfaces to avoid pending/mock identity labels.
 */
router.get('/api/tenant/identity', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId || suiteId === getDefaultSuiteId()) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Suite context not available' });
  }
  try {
    const identity = await resolveSuiteOfficeIdentity(suiteId);
    return res.json({
      suiteId,
      suiteDisplayId: identity.suiteDisplayId,
      officeDisplayId: identity.officeDisplayId,
      businessName: identity.businessName || null,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'IDENTITY_LOOKUP_FAILED',
      message: error instanceof Error ? error.message : 'Failed to resolve tenant identity',
    });
  }
});

/**
 * Profile Update — updates existing suite_profiles for returning users
 * Called when a user with an existing suite completes/updates their profile.
 * Uses authenticated suite context with server-side sanitization + receipt.
 *
 * Risk Tier: YELLOW (updates tenant profile, collects business intelligence)
 * Receipt: onboarding.profile_update (PII redacted — Law #2 + #9)
 */
router.patch('/api/onboarding/profile', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-profile-${crypto.randomUUID()}`;
  const userId = (req as any).authenticatedUserId;
  const suiteId = (req as any).authenticatedSuiteId;

  if (!userId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Must be authenticated' });
  }
  if (!suiteId || suiteId === getDefaultSuiteId()) {
    return res.status(400).json({ error: 'NO_SUITE', message: 'No suite found. Use /api/onboarding/bootstrap instead.' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SERVICE_UNAVAILABLE', message: 'Admin client not configured' });
  }

  try {
    const b = req.body;

    // ── Server-side sanitization (identical to bootstrap — DRY principle) ──
    const businessName = sanitizeText(b.businessName);
    const ownerName = sanitizeText(b.ownerName);
    const ownerTitle = sanitizeText(b.ownerTitle);
    const industry = sanitizeText(b.industry);
    const teamSize = sanitizeText(b.teamSize);
    const entityType = validateEnum(b.entityType, ['sole_proprietorship', 'llc', 's_corp', 'c_corp', 'partnership', 'nonprofit', 'other']);
    const yearsInBusiness = validateEnum(b.yearsInBusiness, ['less_than_1', '1_to_3', '3_to_5', '5_to_10', '10_plus']);
    const salesChannel = validateEnum(b.salesChannel, ['online', 'in_person', 'both', 'other']);
    const customerType = validateEnum(b.customerType, ['b2b', 'b2c', 'both']);
    const servicesNeeded = sanitizeArray(b.servicesNeeded);
    const currentTools = Array.isArray(b.currentTools)
      ? sanitizeArray(b.currentTools)
      : (typeof b.currentTools === 'string' ? b.currentTools.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
    const painPoint = sanitizeText(typeof b.painPoint === 'string' ? b.painPoint.slice(0, 1000) : b.painPoint);
    const timezone = sanitizeText(b.timezone);
    const currency = (typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency)) ? b.currency : 'USD';
    const annualRevenueBand = validateEnum(b.annualRevenueBand, ['under_50k', '50k_100k', '100k_250k', '250k_500k', '500k_1m', '1m_plus']);
    const gender = validateEnum(b.gender, ['male', 'female', 'non-binary', 'prefer-not-to-say']);
    const dateOfBirth = (typeof b.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dateOfBirth)) ? b.dateOfBirth : null;
    const roleCategory = sanitizeText(b.roleCategory);
    const preferredChannel = validateEnum(b.preferredChannel, ['cold', 'warm', 'hot']);
    const fiscalYearEndMonth = (typeof b.fiscalYearEndMonth === 'number' && b.fiscalYearEndMonth >= 1 && b.fiscalYearEndMonth <= 12)
      ? Math.floor(b.fiscalYearEndMonth) : null;
    const consentPersonalization = b.consentPersonalization === true;
    const consentCommunications = b.consentCommunications === true;

    if (!ownerName) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Owner name is required' });
    }
    if (!gender) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Gender is required' });
    }
    if (!isValidIsoDate(dateOfBirth)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Date of birth must be YYYY-MM-DD' });
    }
    if (!isAdultDate(dateOfBirth)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'User must be at least 18 years old' });
    }

    // V3 marketing fields (migration 064)
    const industrySpecialty = sanitizeText(b.industrySpecialty);
    const incomeRange = validateEnum(b.incomeRange, ['under_25k','25k_50k','50k_75k','75k_100k','100k_150k','150k_250k','250k_500k','500k_plus']);
    const referralSource = validateEnum(b.referralSource, ['google_search','social_media','friend_referral','podcast','blog_article','conference_event','advertisement','app_store','other']);

    // Address fields
    const homeAddressLine1 = sanitizeText(b.homeAddressLine1);
    const homeAddressLine2 = sanitizeText(b.homeAddressLine2);
    const homeCity = sanitizeText(b.homeCity);
    const homeState = sanitizeText(b.homeState);
    const homeZip = sanitizeText(b.homeZip);
    const homeCountry = sanitizeText(b.homeCountry) || 'US';
    const businessAddressSameAsHome = b.businessAddressSameAsHome !== false;
    const businessAddressLine1 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine1);
    const businessAddressLine2 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine2);
    const businessCity = businessAddressSameAsHome ? null : sanitizeText(b.businessCity);
    const businessState = businessAddressSameAsHome ? null : sanitizeText(b.businessState);
    const businessZip = businessAddressSameAsHome ? null : sanitizeText(b.businessZip);
    const businessCountry = businessAddressSameAsHome ? null : (sanitizeText(b.businessCountry) || 'US');

    // Build update object (only non-undefined fields)
    const updatePayload: Record<string, any> = {
      business_name: businessName,
      owner_name: ownerName,
      owner_title: ownerTitle,
      industry,
      team_size: teamSize,
      entity_type: entityType,
      years_in_business: yearsInBusiness,
      sales_channel: salesChannel,
      customer_type: customerType,
      services_needed: servicesNeeded,
      current_tools: currentTools,
      pain_point: painPoint,
      home_address_line1: homeAddressLine1,
      home_address_line2: homeAddressLine2,
      home_city: homeCity,
      home_state: homeState,
      home_zip: homeZip,
      home_country: homeCountry,
      business_address_same_as_home: businessAddressSameAsHome,
      business_address_line1: businessAddressLine1,
      business_address_line2: businessAddressLine2,
      business_city: businessCity,
      business_state: businessState,
      business_zip: businessZip,
      business_country: businessCountry,
      timezone,
      currency,
      annual_revenue_band: annualRevenueBand,
      gender,
      date_of_birth: dateOfBirth,
      role_category: roleCategory,
      preferred_channel: preferredChannel,
      fiscal_year_end_month: fiscalYearEndMonth,
      // V3 marketing fields
      industry_specialty: industrySpecialty,
      income_range: incomeRange,
      referral_source: referralSource,
      consent_personalization: consentPersonalization,
      consent_communications: consentCommunications,
      intake_schema_version: 3,
      onboarding_completed_at: new Date().toISOString(),
    };

    // Upsert via service role — handles both existing and missing profile rows.
    // A missing row can happen if bootstrap created the suite but the profile upsert
    // failed on a previous attempt. Using upsert ensures the profile is created.
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = authUser?.email || '';
    const { error: updateError } = await supabaseAdmin
      .from('suite_profiles')
      .upsert({ suite_id: suiteId, email: userEmail, name: updatePayload.owner_name || 'Owner', ...updatePayload }, { onConflict: 'suite_id' });

    if (updateError) {
      logger.error('Profile update error', { error: updateError?.message || updateError?.code || 'unknown' });
      // Emit failure receipt — Law #2
      try {
        await emitReceipt({
          receiptId: crypto.randomUUID(), receiptType: 'onboarding.profile_update', outcome: 'failed',
          suiteId, tenantId: suiteId, correlationId, actorType: 'user', actorId: userId, riskTier: 'yellow',
          resultData: { reason: 'supabase_update_error', error_code: updateError.code || 'UNKNOWN' },
        });
      } catch (_receiptErr) { /* best-effort — primary error takes precedence */ }
      return res.status(500).json({ error: 'UPDATE_FAILED', message: 'Failed to update profile' });
    }

    // Emit YELLOW receipt — Law #2 (fail-closed per Law #3)
    const receiptId = crypto.randomUUID();
    const updatedFields = Object.keys(updatePayload).filter(k => updatePayload[k] != null);
    try {
      await emitReceipt({
        receiptId, receiptType: 'onboarding.profile_update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId, actorType: 'user', actorId: userId, riskTier: 'yellow',
        resultData: {
          fields_updated: updatedFields, field_count: updatedFields.length,
          ...(dateOfBirth ? { date_of_birth: '<DOB_REDACTED>' } : {}),
          ...(gender ? { gender: '<GENDER_REDACTED>' } : {}),
          ...(homeAddressLine1 ? { home_address: '<ADDRESS_REDACTED>' } : {}),
          ...(businessAddressLine1 ? { business_address: '<ADDRESS_REDACTED>' } : {}),
        },
      });
    } catch (receiptErr: unknown) {
      // YELLOW-tier receipt is mandatory — fail closed per Law #3
      logger.error('Profile update receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Profile update receipt could not be recorded (Law #3: fail closed).' });
    }

    res.json({ suiteId, updated: true, receiptId });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Profile update error', { correlationId, error: errorMsg });
    // Emit failure receipt — Law #2 (outer catch — best-effort)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'onboarding.profile_update', outcome: 'failed',
        suiteId: suiteId || '00000000-0000-0000-0000-000000000000', tenantId: suiteId || 'unknown',
        correlationId, actorType: 'user', actorId: userId || 'unknown', riskTier: 'yellow',
        resultData: { reason: 'unexpected_error', error_message: errorMsg },
      });
    } catch (_receiptErr) { /* best-effort */ }
    res.status(500).json({ error: 'UPDATE_FAILED', message: 'Profile update could not be completed. Please try again.' });
  }
});

router.get('/api/suites/:suiteId', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.suiteId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const profile = await storage.getSuiteProfile(authSuiteId);
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

// Backward-compatible alias: /api/users/:userId -> suite profile lookup
router.get('/api/users/:userId', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const profile = await storage.getSuiteProfile(authSuiteId);
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/slug/:slug', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/users', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-create-profile-${crypto.randomUUID()}`;
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const suiteId = authSuiteId;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const profile = await storage.createSuiteProfile(req.body);

    // Law #2: Receipt for profile creation (YELLOW — state change)
    const receiptId = crypto.randomUUID();
    try {
      await emitReceipt({
        receiptId, receiptType: 'profile.create', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'create_suite_profile' },
        resultData: { profile_id: profile?.suiteId },
      });
    } catch (receiptErr: unknown) {
      logger.error('Profile create receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed — receipt required.' });
    }

    res.status(201).json(profile);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    // Law #2: Receipt for failure
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'profile.create', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'create_suite_profile' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort failure receipt */ }
    res.status(500).json({ error: errorMsg });
  }
});

// DEPRECATED: Use PATCH /api/onboarding/profile instead (has full sanitization + receipt + auth).
// This legacy endpoint is auth-gated to prevent unauthenticated profile writes.
router.patch('/api/users/:userId', async (req: Request, res: Response) => {
  // Auth enforcement — Law #3: fail closed
  const authedUserId = (req as any).authenticatedUserId;
  const authedSuiteId = (req as any).authenticatedSuiteId;
  if (!authedUserId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required. Use PATCH /api/onboarding/profile for profile updates.' });
  }

  const userId = getParam(req.params.userId);
  // Prevent cross-tenant writes: authed user can only update their own suite
  if (userId !== authedSuiteId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot update another tenant\'s profile.' });
  }

  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-profile-update-${crypto.randomUUID()}`;
  try {
    // Sanitize all string fields before passing to storage
    const sanitizedBody: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        sanitizedBody[key] = sanitizeText(value);
      } else if (Array.isArray(value)) {
        sanitizedBody[key] = sanitizeArray(value);
      } else {
        sanitizedBody[key] = value;
      }
    }

    const profile = await storage.updateSuiteProfile(userId, sanitizedBody);
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });

    // Emit YELLOW receipt for profile update — Law #2
    const receiptId = crypto.randomUUID();
    const updatedFields = Object.keys(sanitizedBody).filter(k => sanitizedBody[k] !== undefined);
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, risk_tier, created_at, payload)
        VALUES (${receiptId}, 'onboarding.profile_update', 'success', ${userId}, ${userId},
                ${correlationId}, 'user', ${authedUserId}, 'yellow', NOW(),
                ${JSON.stringify({ fields_updated: updatedFields, field_count: updatedFields.length, via: 'legacy_endpoint' })}::jsonb)
      `);
    } catch (receiptErr: unknown) {
      logger.error('Profile update receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Profile update receipt could not be recorded (Law #3: fail closed).' });
    }

    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/services', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const services = await storage.getServices(authSuiteId);
    res.json(services);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/services/active', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const services = await storage.getActiveServices(authSuiteId);
    res.json(services);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/users/:userId/services', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const suiteId = getParam(req.params.userId);
  // Law #6: Tenant isolation — only allow service creation for own suite
  if (authSuiteId !== suiteId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot create services for another tenant.' });
  }
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-create-service-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    // Input validation — sanitize before passing to Stripe API
    const serviceName = typeof req.body.name === 'string' ? req.body.name.trim().substring(0, 250) : '';
    const serviceDesc = typeof req.body.description === 'string' ? req.body.description.trim().substring(0, 500) : '';
    const unitAmount = typeof req.body.price === 'number' && Number.isInteger(req.body.price) && req.body.price > 0 ? req.body.price : null;
    const currency = typeof req.body.currency === 'string' && /^[a-z]{3}$/i.test(req.body.currency.trim()) ? req.body.currency.trim().toLowerCase() : 'usd';

    if (!serviceName) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Service name is required (non-empty string).' });
    if (unitAmount === null) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Price must be a positive integer (cents).' });

    const stripe = await getUncachableStripeClient();

    const product = await stripe.products.create({
      name: serviceName,
      description: serviceDesc,
      metadata: { suiteId },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency,
    });

    const service = await storage.createService({
      name: serviceName,
      description: serviceDesc,
      price: unitAmount,
      currency,
      duration: typeof req.body.duration === 'number' && req.body.duration > 0 ? req.body.duration : undefined,
      category: typeof req.body.category === 'string' ? req.body.category.trim().substring(0, 100) : undefined,
      suiteId,
      stripeProductId: product.id,
      stripePriceId: price.id,
    });

    // Law #2: Receipt for service creation (RED — Stripe financial operation)
    const receiptId = crypto.randomUUID();
    try {
      await emitReceipt({
        receiptId, receiptType: 'service.create', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'create_service', stripe_product_id: product.id, service_name: serviceName.substring(0, 50) },
        resultData: { service_id: service?.id, stripe_price_id: price.id },
      });
    } catch (receiptErr: unknown) {
      logger.error('Service create receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed — receipt required for Stripe operations.' });
    }

    res.status(201).json(service);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.create', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'create_service' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort failure receipt */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.patch('/api/services/:serviceId', async (req: Request, res: Response) => {
  const serviceId = getParam(req.params.serviceId);
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-update-service-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    // Law #6: Verify service belongs to authenticated tenant before update
    const existing = await storage.getService(serviceId);
    if (!existing) return res.status(404).json({ error: 'Service not found' });
    if (existing.suiteId && existing.suiteId !== suiteId) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot modify another tenant service.' });
    // Whitelist allowed update fields — never spread raw req.body into storage
    const allowedFields = ['name', 'description', 'price', 'currency', 'duration', 'isActive', 'category'] as const;
    const sanitizedUpdate: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) sanitizedUpdate[field] = req.body[field];
    }
    if (typeof sanitizedUpdate.name === 'string') sanitizedUpdate.name = sanitizedUpdate.name.trim().substring(0, 250);
    if (typeof sanitizedUpdate.description === 'string') sanitizedUpdate.description = sanitizedUpdate.description.trim().substring(0, 500);
    const service = await storage.updateService(serviceId, sanitizedUpdate);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Law #2: Receipt for service update (YELLOW — state change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'update_service', service_id: serviceId, fields_updated: Object.keys(req.body) },
        resultData: { service_id: serviceId },
      });
    } catch (receiptErr: unknown) {
      logger.error('Service update receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed.' });
    }

    res.json(service);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.update', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'update_service', service_id: serviceId },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.delete('/api/services/:serviceId', async (req: Request, res: Response) => {
  const serviceId = getParam(req.params.serviceId);
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-delete-service-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    // Law #6: Verify service belongs to authenticated tenant before deletion
    const existing = await storage.getService(serviceId);
    if (!existing) return res.status(404).json({ error: 'Service not found' });
    if (existing.suiteId && existing.suiteId !== suiteId) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot delete another tenant service.' });
    await storage.deleteService(serviceId);

    // Law #2: Receipt for service deletion (RED — irreversible state change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.delete', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'delete_service', service_id: serviceId },
        resultData: { deleted: true },
      });
    } catch (receiptErr: unknown) {
      logger.warn('Service delete receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      // Note: deletion already happened — emit warning but don't fail the response
    }

    res.status(204).send();
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.delete', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'delete_service', service_id: serviceId },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/users/:userId/availability', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const availability = await storage.getAvailability(authSuiteId);
    res.json(availability);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.put('/api/users/:userId/availability', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const suiteId = getParam(req.params.userId);
  // Law #6: Only allow updating own availability
  if (authSuiteId !== suiteId) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot modify another tenant availability.' });
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-set-availability-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    if (!Array.isArray(req.body.slots)) return res.status(400).json({ error: 'INVALID_INPUT', message: 'slots array required' });
    const slots = req.body.slots.map((slot: any) => ({
      ...slot,
      suiteId,
    }));
    const availability = await storage.setAvailability(suiteId, slots);

    // Law #2: Receipt for availability update (YELLOW — scheduling state change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'availability.update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'set_availability', slot_count: slots.length },
        resultData: { updated_count: availability?.length },
      });
    } catch (receiptErr: unknown) {
      logger.error('Availability receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed.' });
    }

    res.json(availability);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'availability.update', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'set_availability' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/users/:userId/buffer-settings', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const settings = await storage.getBufferSettings(authSuiteId);
    res.json(settings || { beforeBuffer: 0, afterBuffer: 15, minimumNotice: 60, maxAdvanceBooking: 30 });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.put('/api/users/:userId/buffer-settings', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  const suiteId = getParam(req.params.userId);
  // Law #6: Only allow updating own buffer settings
  if (authSuiteId !== suiteId) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot modify another tenant buffer settings.' });
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-buffer-settings-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    // Whitelist buffer settings fields — numeric values only
    const bufferUpdate: Record<string, number> = {};
    for (const field of ['beforeBuffer', 'afterBuffer', 'minimumNotice', 'maxAdvanceBooking'] as const) {
      if (typeof req.body[field] === 'number' && Number.isFinite(req.body[field]) && req.body[field] >= 0) {
        bufferUpdate[field] = req.body[field];
      }
    }
    const settings = await storage.upsertBufferSettings(suiteId, bufferUpdate);

    // Law #2: Receipt for buffer settings update (YELLOW — scheduling config change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'buffer_settings.update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'upsert_buffer_settings', fields: Object.keys(bufferUpdate) },
        resultData: { updated: true },
      });
    } catch (receiptErr: unknown) {
      logger.error('Buffer settings receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed.' });
    }

    res.json(settings);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'buffer_settings.update', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'upsert_buffer_settings' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/users/:userId/bookings', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const bookings = await storage.getBookings(authSuiteId);
    res.json(bookings);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/bookings/upcoming', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const bookings = await storage.getUpcomingBookings(authSuiteId);
    res.json(bookings);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/bookings/stats', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (authSuiteId !== getParam(req.params.userId)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant.' });
  try {
    const stats = await storage.getBookingStats(authSuiteId);
    res.json(stats);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/bookings/:bookingId', async (req: Request, res: Response) => {
  const authSuiteId = (req as any).authenticatedSuiteId;
  if (!authSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const booking = await storage.getBooking(getParam(req.params.bookingId));
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    // Law #6: Verify booking belongs to authenticated tenant
    if (booking.suiteId && booking.suiteId !== authSuiteId) return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot access another tenant booking.' });
    res.json(booking);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/bookings/:bookingId/cancel', async (req: Request, res: Response) => {
  // Law #6: Tenant isolation — require authenticated suite context
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  const bookingId = getParam(req.params.bookingId);
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cancel-booking-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const cancelReason = typeof req.body.reason === 'string' ? req.body.reason.trim().substring(0, 500) : undefined;
    const booking = await storage.cancelBooking(bookingId, cancelReason);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Law #2: Receipt for booking cancellation (YELLOW — schedule state change, may trigger refund)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'booking.cancel', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'cancel_booking', booking_id: bookingId, reason: cancelReason?.substring(0, 100) },
        resultData: { cancelled: true, booking_id: bookingId },
      });
    } catch (receiptErr: unknown) {
      logger.warn('Booking cancel receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      // Cancellation already happened — log but don't fail response
    }

    res.json(booking);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'booking.cancel', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'cancel_booking', booking_id: bookingId },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/book/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const services = await storage.getActiveServices(profile.suiteId);
    const availability = await storage.getAvailability(profile.suiteId);
    const bufferSettings = await storage.getBufferSettings(profile.suiteId);

    res.json({
      user: { id: profile.suiteId, name: profile.name, businessName: profile.businessName, logoUrl: profile.logoUrl, accentColor: profile.accentColor },
      services,
      availability,
      bufferSettings: bufferSettings || { beforeBuffer: 0, afterBuffer: 15, minimumNotice: 60, maxAdvanceBooking: 30 },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/book/:slug/slots', async (req: Request, res: Response) => {
  try {
    const { serviceId, date } = req.query;
    if (!serviceId || !date) {
      return res.status(400).json({ error: 'serviceId and date are required' });
    }

    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const service = await storage.getService(serviceId as string);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const availability = await storage.getAvailability(profile.suiteId);
    const bufferSettings = await storage.getBufferSettings(profile.suiteId);
    const existingBookings = await storage.getBookingsByDate(profile.suiteId, new Date(date as string));

    const requestedDate = new Date(date as string);
    const dayOfWeek = requestedDate.getDay();
    const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek && a.isActive);

    const slots: string[] = [];
    const buffer = bufferSettings?.afterBuffer || 15;

    for (const avail of dayAvailability) {
      const [startHour, startMin] = avail.startTime.split(':').map(Number);
      const [endHour, endMin] = avail.endTime.split(':').map(Number);

      let currentTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      while (currentTime + service.duration <= endTime) {
        const slotStart = new Date(requestedDate);
        slotStart.setHours(Math.floor(currentTime / 60), currentTime % 60, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + service.duration);

        const isAvailable = !existingBookings.some(booking => {
          const bookingStart = new Date(booking.scheduledAt);
          const bookingEnd = new Date(bookingStart);
          bookingEnd.setMinutes(bookingEnd.getMinutes() + booking.duration);
          return (slotStart < bookingEnd && slotEnd > bookingStart);
        });

        if (isAvailable) {
          const hours = Math.floor(currentTime / 60).toString().padStart(2, '0');
          const mins = (currentTime % 60).toString().padStart(2, '0');
          slots.push(`${hours}:${mins}`);
        }

        currentTime += 30;
      }
    }

    res.json({ slots });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/book/:slug/checkout', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-checkout-${crypto.randomUUID()}`;
  try {
    const { serviceId, scheduledAt } = req.body;
    // Sanitize client PII inputs (public endpoint — untrusted input)
    const clientName = typeof req.body.clientName === 'string' ? req.body.clientName.trim().substring(0, 200) : '';
    const clientEmail = typeof req.body.clientEmail === 'string' ? req.body.clientEmail.trim().substring(0, 254) : '';
    const clientPhone = typeof req.body.clientPhone === 'string' ? req.body.clientPhone.trim().substring(0, 30) : '';
    const clientNotes = typeof req.body.clientNotes === 'string' ? req.body.clientNotes.trim().substring(0, 1000) : '';

    if (!clientName || !clientEmail) return res.status(400).json({ error: 'INVALID_INPUT', message: 'Client name and email are required.' });

    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const service = await storage.getService(serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    // Law #6: Verify service belongs to the same tenant as the booking page
    if (service.suiteId && service.suiteId !== profile.suiteId) {
      return res.status(400).json({ error: 'INVALID_SERVICE', message: 'Service does not belong to this provider.' });
    }

    const booking = await storage.createBooking({
      suiteId: profile.suiteId,
      serviceId,
      clientName,
      clientEmail,
      clientPhone,
      clientNotes,
      scheduledAt: new Date(scheduledAt),
      duration: service.duration,
      amount: service.price,
      currency: service.currency,
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    if (service.price > 0 && service.stripePriceId) {
      const stripe = await getUncachableStripeClient();
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      const baseUrl = process.env.PUBLIC_BASE_URL?.trim() || (domain ? `https://${domain}` : 'https://www.aspireos.app');

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: service.stripePriceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/book/${getParam(req.params.slug)}/success?bookingId=${booking.id}`,
        cancel_url: `${baseUrl}/book/${getParam(req.params.slug)}/cancel?bookingId=${booking.id}`,
        metadata: { bookingId: booking.id },
        customer_email: clientEmail,
      });

      await storage.updateBooking(booking.id, { stripeCheckoutSessionId: session.id });

      // Law #2: Receipt for booking checkout (RED — financial operation via Stripe)
      await createTrustSpineReceipt({
        suiteId: profile.suiteId,
        receiptType: 'booking.checkout',
        status: 'SUCCEEDED',
        correlationId,
        actorType: 'SYSTEM',
        action: { operation: 'booking_checkout', service_id: serviceId, amount: service.price, currency: service.currency, risk_tier: 'RED' },
        result: { booking_id: booking.id, stripe_session_id: session.id, client_email: '<EMAIL_REDACTED>' },
      }).catch(() => {});

      res.json({ checkoutUrl: session.url, bookingId: booking.id });
    } else {
      await storage.updateBooking(booking.id, { status: 'confirmed', paymentStatus: 'free' });

      // Law #2: Receipt for free booking (YELLOW — state change, no payment)
      await createTrustSpineReceipt({
        suiteId: profile.suiteId,
        receiptType: 'booking.checkout',
        status: 'SUCCEEDED',
        correlationId,
        actorType: 'SYSTEM',
        action: { operation: 'booking_checkout_free', service_id: serviceId, risk_tier: 'YELLOW' },
        result: { booking_id: booking.id, confirmed: true },
      }).catch(() => {});

      res.json({ bookingId: booking.id, confirmed: true });
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    res.status(500).json({ error: errorMsg });
  }
});

router.post('/api/book/:slug/confirm/:bookingId', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-confirm-${crypto.randomUUID()}`;
  try {
    const bookingId = getParam(req.params.bookingId);

    // Law #3: Fail closed — verify payment with Stripe before confirming
    // Check if a valid Stripe checkout session exists for this booking
    const existingBooking = await storage.getBooking(bookingId);
    if (!existingBooking) return res.status(404).json({ error: 'Booking not found' });

    let paymentVerified = false;
    // If service is free (amount 0), no payment verification needed
    if ((existingBooking as any).amount === 0 || (existingBooking as any).amount === null) {
      paymentVerified = true;
    } else {
      // Verify with Stripe that payment was actually completed
      try {
        const stripe = await getUncachableStripeClient();
        const sessions = await stripe.checkout.sessions.list({
          limit: 5,
        });
        const matchingSession = sessions.data.find(
          (s: any) => s.metadata?.bookingId === bookingId && s.payment_status === 'paid'
        );
        paymentVerified = !!matchingSession;
      } catch (stripeErr: unknown) {
        logger.error('Stripe payment verification failed', { correlationId, bookingId, error: stripeErr instanceof Error ? stripeErr.message : 'unknown' });
        // Law #3: Fail closed — cannot confirm without payment verification
        return res.status(503).json({ error: 'PAYMENT_VERIFICATION_FAILED', message: 'Cannot verify payment status. Please try again.' });
      }
    }

    if (!paymentVerified) {
      return res.status(402).json({ error: 'PAYMENT_NOT_VERIFIED', message: 'Payment has not been completed for this booking.' });
    }

    const booking = await storage.updateBooking(bookingId, {
      status: 'confirmed',
      paymentStatus: 'paid',
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Law #2: Receipt for booking confirmation (YELLOW — state change, payment confirmed)
    const suiteId = (booking as any).suiteId || 'unknown';
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'booking.confirm',
      status: 'SUCCEEDED',
      correlationId,
      actorType: 'SYSTEM',
      action: { operation: 'confirm_booking', booking_id: bookingId, risk_tier: 'YELLOW' },
      result: { booking_id: bookingId, confirmed: true, payment_status: 'paid' },
    }).catch(() => {});

    res.json(booking);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

// @deprecated — frontdesk setup/preview-audio endpoints moved to telephonyEnterpriseRoutes.ts

/**
 * ElevenLabs TTS — Text-to-Speech Only (Law #1: Single Brain)
 *
 * ElevenLabs is the mouth. NOT the brain.
 * Intelligence comes from the LangGraph orchestrator via OpenAI SDK skill packs.
 * This route converts orchestrator response text → audio via ElevenLabs TTS API.
 */
const VOICE_IDS: Record<string, string> = {
  ava: 'uYXf8XasLslADfZ2MB4u',
  eli: 'c6kFzbpMaJ8UMD5P6l72',
  finn: 's3TPKV1kjDlVtZbl4Ksh',
  nora: '6aDn1KB0hjpdcocrUkmq',
  sarah: 'DODLEQrClDo8wCz460ld',
};

const VOICE_MODELS: Record<string, string> = {
  ava: 'eleven_flash_v2_5',
  eli: 'eleven_flash_v2_5',
  finn: 'eleven_flash_v2_5',
  nora: 'eleven_flash_v2_5',
  sarah: 'eleven_flash_v2_5',
};

/**
 * ElevenLabs 2026 optimized voice settings:
 * - style: 0 eliminates style computation overhead (biggest latency win)
 * - use_speaker_boost: false reduces latency for real-time paths
 * - stability ~0.5 gives best conversational feel
 * - similarity_boost ~0.82 avoids diminishing returns above 0.85
 * - speed tuned per agent personality
 */
const VOICE_SETTINGS: Record<string, { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean; speed: number }> = {
  ava: { stability: 0.55, similarity_boost: 0.82, style: 0, use_speaker_boost: false, speed: 0.94 },
  eli: { stability: 0.42, similarity_boost: 0.82, style: 0, use_speaker_boost: false, speed: 1.0 },
  finn: { stability: 0.48, similarity_boost: 0.82, style: 0, use_speaker_boost: false, speed: 1.0 },
  nora: { stability: 0.45, similarity_boost: 0.82, style: 0, use_speaker_boost: false, speed: 1.0 },
  sarah: { stability: 0.48, similarity_boost: 0.82, style: 0, use_speaker_boost: false, speed: 1.0 },
};

/**
 * Parse ElevenLabs API error responses into actionable client messages.
 * ElevenLabs returns: { detail: { type, code, message, request_id } }
 */
function parseElevenLabsError(body: string, httpStatus: number): { code: string; clientMessage: string; httpStatus: number } {
  try {
    const parsed = JSON.parse(body);
    const detail = parsed?.detail;
    if (detail && typeof detail === 'object') {
      const code = detail.code || detail.type || 'unknown';
      const map: Record<string, string> = {
        rate_limit_exceeded: 'Voice service is busy — try again in a moment.',
        concurrent_limit_exceeded: 'Too many voice requests — please wait.',
        insufficient_credits: 'Voice credits exhausted. Check your ElevenLabs plan.',
        invalid_api_key: 'Voice service authentication failed.',
        missing_api_key: 'Voice service not configured.',
        voice_not_found: 'Voice not available. Try a different agent.',
        text_too_long: 'Response too long for voice — shown in chat instead.',
        system_busy: 'Voice service temporarily unavailable.',
        service_unavailable: 'Voice service temporarily unavailable.',
      };
      return {
        code,
        clientMessage: map[code] || detail.message || `Voice error: ${code}`,
        httpStatus: httpStatus === 429 ? 429 : httpStatus >= 500 ? 503 : 400,
      };
    }
  } catch { /* not JSON */ }
  return { code: 'unknown', clientMessage: `Voice synthesis failed (${httpStatus})`, httpStatus };
}

function voiceErrorPayload(params: {
  correlationId: string;
  traceId?: string;
  errorCode: string;
  errorStage: 'tts' | 'stt' | 'orchestrator' | 'agent_session';
  message: string;
  retryAfterMs?: number;
  error?: string;
}) {
  return {
    error: params.error || params.errorCode,
    error_code: params.errorCode,
    error_stage: params.errorStage,
    message: params.message,
    correlation_id: params.correlationId,
    trace_id: params.traceId,
    ...(typeof params.retryAfterMs === 'number' ? { retry_after_ms: params.retryAfterMs } : {}),
  };
}

router.post('/api/elevenlabs/tts', async (req: Request, res: Response) => {
  const suiteId = requireAuth(req, res);
  if (!suiteId) return;
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const startedAt = Date.now();
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Correlation-Id', correlationId);
  emitTraceEvent({
    traceId,
    correlationId,
    suiteId,
    agent: typeof req.body?.agent === 'string' ? req.body.agent : null,
    stage: 'tts',
    status: 'start',
    message: 'TTS request started',
  });
  try {
    const { agent, text, voiceId, model, voiceSettings, previous_text } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      logger.warn('[TTS] ELEVENLABS_API_KEY is missing — voice synthesis disabled');
      return res.status(500).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'TTS_NOT_CONFIGURED',
        errorStage: 'tts',
        message: 'Voice synthesis service not configured',
      }));
    }
    logger.info('[TTS] Request', { agent, textLength: text?.length ?? 0 });

    const resolvedVoiceId = voiceId || VOICE_IDS[agent];
    const resolvedModel = model || VOICE_MODELS[agent] || 'eleven_flash_v2_5';
    const resolvedVoiceSettings = {
      ...(VOICE_SETTINGS[agent] || { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: 1.0 }),
      ...(voiceSettings && typeof voiceSettings === 'object' ? voiceSettings : {}),
    };
    if (!resolvedVoiceId) {
      return res.status(400).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'TTS_UNKNOWN_AGENT',
        errorStage: 'tts',
        message: `Unknown agent: ${agent}`,
      }));
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'TTS_INVALID_TEXT',
        errorStage: 'tts',
        message: 'Missing or empty text parameter',
      }));
    }

    const response = await fetchWithTimeoutAndRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}?output_format=${encodeURIComponent(DEFAULT_TTS_OUTPUT_FORMAT)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: resolvedModel,
          voice_settings: resolvedVoiceSettings,
          // Lower first-chunk latency: generate audio after 50 chars instead of default 120
          chunk_length_schedule: [50, 80, 120, 160],
          // Multi-turn prosody continuity: previous text helps ElevenLabs maintain tone
          ...(previous_text ? { previous_text: String(previous_text).slice(-1000) } : {}),
        }),
      },
      { timeoutMs: 20_000, retries: 1, retryOnStatuses: [429, 500, 502, 503, 504] },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('ElevenLabs TTS error', { status: response.status, error: errorBody.substring(0, 200) });
      const parsed = parseElevenLabsError(errorBody, response.status);
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        agent: typeof agent === 'string' ? agent : null,
        stage: 'tts',
        status: 'error',
        message: parsed.clientMessage,
        errorCode: `TTS_${String(parsed.code || 'UNKNOWN').toUpperCase()}`,
        latencyMs: Date.now() - startedAt,
        metadata: { http_status: response.status },
      });
      return res.status(parsed.httpStatus).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: `TTS_${String(parsed.code || 'UNKNOWN').toUpperCase()}`,
        errorStage: 'tts',
        message: parsed.clientMessage,
      }));
    }

    const audioBuffer = await response.arrayBuffer();
    // Safety: cap TTS output at 25MB to prevent memory DoS
    if (audioBuffer.byteLength > 25 * 1024 * 1024) {
      logger.error('[TTS] Audio response too large', { agent, bytes: audioBuffer.byteLength });
      return res.status(502).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'TTS_RESPONSE_TOO_LARGE',
        errorStage: 'tts',
        message: 'Voice synthesis returned unexpectedly large audio',
      }));
    }
    logger.info('[TTS] Success', { agent, bytes: audioBuffer.byteLength });
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      agent: typeof agent === 'string' ? agent : null,
      stage: 'tts',
      status: 'ok',
      message: 'TTS synthesis completed',
      latencyMs: Date.now() - startedAt,
      metadata: { bytes: audioBuffer.byteLength, model: resolvedModel },
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error: unknown) {
    logger.error('TTS error', { error: error instanceof Error ? error.message : 'unknown' });
    captureServerException(error, {
      tags: { voice_stage: 'tts', voice_code: 'TTS_UNAVAILABLE', provider: 'elevenlabs' },
      extra: { correlationId, traceId, agent: typeof req.body?.agent === 'string' ? req.body.agent : null },
    });
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      agent: typeof req.body?.agent === 'string' ? req.body.agent : null,
      stage: 'tts',
      status: 'error',
      message: error instanceof Error ? error.message : 'unknown',
      errorCode: 'TTS_UNAVAILABLE',
      latencyMs: Date.now() - startedAt,
    });
    res.status(500).json(voiceErrorPayload({
      correlationId,
      traceId,
      errorCode: 'TTS_UNAVAILABLE',
      errorStage: 'tts',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
});

router.post('/api/elevenlabs/tts/stream', async (req: Request, res: Response) => {
  const suiteId = requireAuth(req, res);
  if (!suiteId) return;
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-tts-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const startedAt = Date.now();
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Correlation-Id', correlationId);
  emitTraceEvent({
    traceId,
    correlationId,
    suiteId,
    agent: typeof req.body?.agent === 'string' ? req.body.agent : null,
    stage: 'tts',
    status: 'start',
    message: 'TTS stream request started',
  });
  try {
    const { agent, text, voiceId, model, voiceSettings, previous_text } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'TTS_NOT_CONFIGURED',
        errorStage: 'tts',
        message: 'Voice synthesis service not configured',
      }));
    }

    const resolvedVoiceId = voiceId || VOICE_IDS[agent];
    const resolvedModel = model || VOICE_MODELS[agent] || 'eleven_flash_v2_5';
    const resolvedVoiceSettings = {
      ...(VOICE_SETTINGS[agent] || { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: 1.0 }),
      ...(voiceSettings && typeof voiceSettings === 'object' ? voiceSettings : {}),
    };
    if (!resolvedVoiceId) {
      return res.status(400).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'TTS_UNKNOWN_AGENT',
        errorStage: 'tts',
        message: `Unknown agent: ${agent}`,
      }));
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'TTS_INVALID_TEXT',
        errorStage: 'tts',
        message: 'Missing or empty text parameter',
      }));
    }

    const response = await fetchWithTimeoutAndRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}/stream?output_format=${encodeURIComponent(DEFAULT_TTS_OUTPUT_FORMAT)}&optimize_streaming_latency=3`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: resolvedModel,
          voice_settings: resolvedVoiceSettings,
          // Lower first-chunk latency: generate audio after 50 chars instead of default 120
          chunk_length_schedule: [50, 80, 120, 160],
          // Multi-turn prosody continuity: previous text helps ElevenLabs maintain tone
          ...(previous_text ? { previous_text: String(previous_text).slice(-1000) } : {}),
        }),
      },
      { timeoutMs: 20_000, retries: 1, retryOnStatuses: [429, 500, 502, 503, 504] },
    );

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      logger.error('ElevenLabs TTS stream error', { status: response.status, error: errorBody.substring(0, 200) });
      const parsed = parseElevenLabsError(errorBody, response.status);
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        agent: typeof agent === 'string' ? agent : null,
        stage: 'tts',
        status: 'error',
        message: parsed.clientMessage,
        errorCode: `TTS_${String(parsed.code || 'UNKNOWN').toUpperCase()}`,
        latencyMs: Date.now() - startedAt,
        metadata: { http_status: response.status, stream: true },
      });
      return res.status(parsed.httpStatus).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: `TTS_${String(parsed.code || 'UNKNOWN').toUpperCase()}`,
        errorStage: 'tts',
        message: parsed.clientMessage,
      }));
    }

    res.set('Content-Type', 'audio/mpeg');
    res.set('Transfer-Encoding', 'chunked');
    const reader = response.body.getReader();

    // Safety: abort if stream stalls for >60s (prevents zombie connections)
    const streamTimeout = setTimeout(() => {
      reader.cancel().catch(() => {});
      if (!res.writableEnded) res.end();
    }, 60_000);

    // Handle client disconnect mid-stream
    let clientDisconnected = false;
    res.on('close', () => { clientDisconnected = true; });

    const pump = async () => {
      let totalBytes = 0;
      try {
        while (true) {
          if (clientDisconnected) {
            reader.cancel().catch(() => {});
            break;
          }
          const { done, value } = await reader.read();
          if (done) {
            emitTraceEvent({
              traceId,
              correlationId,
              suiteId,
              agent: typeof agent === 'string' ? agent : null,
              stage: 'tts',
              status: 'ok',
              message: 'TTS stream completed',
              latencyMs: Date.now() - startedAt,
              metadata: { bytes: totalBytes, model: resolvedModel, stream: true },
            });
            if (!res.writableEnded) res.end();
            break;
          }
          totalBytes += value?.byteLength || 0;
          if (!res.writableEnded) {
            const canContinue = res.write(value);
            // Basic backpressure: if write buffer full, wait for drain
            if (!canContinue) {
              await new Promise<void>((resolve) => res.once('drain', resolve));
            }
          }
        }
      } catch (pumpErr) {
        logger.error('TTS stream pump error', { error: pumpErr instanceof Error ? pumpErr.message : 'unknown', bytes: totalBytes });
        captureServerException(pumpErr, {
          tags: { voice_stage: 'tts', voice_code: 'TTS_STREAM_PUMP_ERROR', provider: 'elevenlabs' },
          extra: { totalBytes },
        });
        if (!res.writableEnded) res.end();
      }
    };
    try {
      await pump();
    } finally {
      clearTimeout(streamTimeout);
    }
  } catch (error: unknown) {
    logger.error('TTS stream error', { error: error instanceof Error ? error.message : 'unknown' });
    captureServerException(error, {
      tags: { voice_stage: 'tts', voice_code: 'TTS_STREAM_ERROR', provider: 'elevenlabs' },
      extra: { correlationId, traceId },
    });
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      agent: typeof req.body?.agent === 'string' ? req.body.agent : null,
      stage: 'tts',
      status: 'error',
      message: error instanceof Error ? error.message : 'unknown',
      errorCode: 'TTS_UNAVAILABLE',
      latencyMs: Date.now() - startedAt,
      metadata: { stream: true },
    });
    res.status(500).json(voiceErrorPayload({
      correlationId,
      traceId,
      errorCode: 'TTS_UNAVAILABLE',
      errorStage: 'tts',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
});

// ─── ElevenLabs STT — Speech-to-Text via server proxy (no API key on client) ───
router.post('/api/elevenlabs/stt', async (req: Request, res: Response) => {
  const suiteId = requireAuth(req, res);
  if (!suiteId) return;
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const startedAt = Date.now();
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Correlation-Id', correlationId);
  emitTraceEvent({
    traceId,
    correlationId,
    suiteId,
    stage: 'stt',
    status: 'start',
    message: 'STT request started',
  });
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(503).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'STT_NOT_CONFIGURED',
        errorStage: 'stt',
        message: 'Speech recognition service not configured',
      }));
    }

    // Expect raw audio body (audio/webm, audio/wav, etc.) or base64 in JSON
    let audioBuffer: Buffer;

    if (req.is('application/json')) {
      // JSON body with base64 audio
      const { audio, encoding } = req.body;
      if (!audio) {
        return res.status(400).json(voiceErrorPayload({
          correlationId,
          traceId,
          errorCode: 'STT_MISSING_AUDIO',
          errorStage: 'stt',
          message: 'Missing audio data',
        }));
      }
      audioBuffer = Buffer.from(audio, encoding || 'base64');
    } else {
      // Raw binary audio body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      audioBuffer = Buffer.concat(chunks);
    }

    if (audioBuffer.length === 0) {
      return res.status(400).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'STT_EMPTY_AUDIO',
        errorStage: 'stt',
        message: 'Empty audio data',
      }));
    }

    // Cap audio size at 25MB (ElevenLabs limit)
    if (audioBuffer.length > 25 * 1024 * 1024) {
      return res.status(413).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'STT_AUDIO_TOO_LARGE',
        errorStage: 'stt',
        message: 'Audio file too large (max 25MB)',
      }));
    }

    // Use ElevenLabs Speech-to-Text API
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model_id', 'scribe_v2');
    formData.append('language_code', 'en');
    formData.append('keyterms', JSON.stringify(['Aspire', 'Ava', 'Finn', 'Eli', 'Nora', 'Sarah', 'Quinn', 'Clara']));

    // Timeout: 30s for STT API call (prevents hanging on ElevenLabs stall)
    const sttAbort = new AbortController();
    const sttTimeout = setTimeout(() => sttAbort.abort(), 30_000);
    let response: globalThis.Response;
    try {
      response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: formData,
        signal: sttAbort.signal,
      });
    } finally {
      clearTimeout(sttTimeout);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('ElevenLabs STT error', { status: response.status, error: errorBody.substring(0, 200) });
      const parsed = parseElevenLabsError(errorBody, response.status);
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        stage: 'stt',
        status: 'error',
        message: parsed.clientMessage,
        errorCode: `STT_${String(parsed.code || 'UNKNOWN').toUpperCase()}`,
        latencyMs: Date.now() - startedAt,
        metadata: { http_status: response.status },
      });
      return res.status(parsed.httpStatus).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: `STT_${String(parsed.code || 'UNKNOWN').toUpperCase()}`,
        errorStage: 'stt',
        message: parsed.clientMessage,
      }));
    }

    const result = await response.json() as { text?: string; language_code?: string };
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      stage: 'stt',
      status: 'ok',
      message: 'STT transcription completed',
      latencyMs: Date.now() - startedAt,
      metadata: { text_length: (result.text || '').length, language: result.language_code || 'en' },
    });
    res.json({ text: result.text || '', language: result.language_code || 'en', correlation_id: correlationId, trace_id: traceId });
  } catch (error: unknown) {
    logger.error('STT error', { error: error instanceof Error ? error.message : 'unknown' });
    captureServerException(error, {
      tags: { voice_stage: 'stt', voice_code: 'STT_UNAVAILABLE', provider: 'elevenlabs' },
      extra: { correlationId, traceId },
    });
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      stage: 'stt',
      status: 'error',
      message: error instanceof Error ? error.message : 'unknown',
      errorCode: 'STT_UNAVAILABLE',
      latencyMs: Date.now() - startedAt,
    });
    res.status(500).json(voiceErrorPayload({
      correlationId,
      traceId,
      errorCode: 'STT_UNAVAILABLE',
      errorStage: 'stt',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
});

/**
 * Sandbox Health Check — Verify provider sandbox API keys are configured
 * Does NOT log or expose key values (Law #9: Never log secrets)
 */
router.get('/api/sandbox/health', async (_req: Request, res: Response) => {
  type HealthCheck = {
    configured: boolean;
    sandbox: boolean;
    status: string;
    connectivity?: boolean;
    latency_ms?: number;
    failure_code?: string;
  };
  const checks: Record<string, HealthCheck> = {};
  const runProbe = async (
    key: string,
    configured: boolean,
    url: string,
    init?: RequestInit,
    timeoutMs = 3000,
  ): Promise<void> => {
    if (!configured) return;
    const startedAt = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      checks[key].connectivity = resp.ok;
      checks[key].latency_ms = Date.now() - startedAt;
      if (!resp.ok) checks[key].failure_code = `HTTP_${resp.status}`;
    } catch (error) {
      checks[key].connectivity = false;
      checks[key].latency_ms = Date.now() - startedAt;
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      checks[key].failure_code = msg.includes('abort') ? 'TIMEOUT' : 'UNREACHABLE';
    }
  };

  // Stripe
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  checks.stripe = {
    configured: !!stripeKey,
    sandbox: stripeKey.startsWith('sk_test_'),
    status: !stripeKey ? 'NOT_SET' : stripeKey.startsWith('sk_test_') ? 'SANDBOX_OK' : 'LIVE_KEY_WARNING',
  };

  // Plaid
  const plaidId = process.env.PLAID_CLIENT_ID || '';
  const plaidSecret = process.env.PLAID_SECRET || '';
  checks.plaid = {
    configured: !!plaidId && !!plaidSecret,
    sandbox: true, // Plaid sandbox is env-based, not key-prefix based
    status: !plaidId || !plaidSecret ? 'NOT_SET' : 'CONFIGURED',
  };

  // Gusto
  const gustoId = process.env.GUSTO_CLIENT_ID || '';
  checks.gusto = {
    configured: !!gustoId,
    sandbox: true, // Gusto uses gusto-demo.com for sandbox
    status: !gustoId ? 'NOT_SET' : 'CONFIGURED',
  };

  // QuickBooks
  const qbId = process.env.QUICKBOOKS_CLIENT_ID || '';
  checks.quickbooks = {
    configured: !!qbId,
    sandbox: true, // QB sandbox is app-level config
    status: !qbId ? 'NOT_SET' : 'CONFIGURED',
  };

  // ElevenLabs
  checks.elevenlabs = {
    configured: !!process.env.ELEVENLABS_API_KEY,
    sandbox: true,
    status: process.env.ELEVENLABS_API_KEY ? 'CONFIGURED' : 'NOT_SET',
  };
  await runProbe(
    'elevenlabs',
    checks.elevenlabs.configured,
    'https://api.elevenlabs.io/v1/models',
    process.env.ELEVENLABS_API_KEY
      ? { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
      : undefined,
  );

  // Deepgram
  checks.deepgram = {
    configured: !!process.env.DEEPGRAM_API_KEY,
    sandbox: true,
    status: process.env.DEEPGRAM_API_KEY ? 'CONFIGURED' : 'NOT_SET',
  };
  await runProbe(
    'deepgram',
    checks.deepgram.configured,
    'https://api.deepgram.com/v1/projects',
    process.env.DEEPGRAM_API_KEY
      ? { headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` } }
      : undefined,
  );

  // Domain Rail / PolarisM
  checks.domain_rail = {
    configured: !!process.env.DOMAIN_RAIL_HMAC_SECRET && !!process.env.DOMAIN_RAIL_URL,
    sandbox: true,
    status: process.env.DOMAIN_RAIL_HMAC_SECRET ? 'CONFIGURED' : 'NOT_SET',
  };
  if (process.env.DOMAIN_RAIL_URL) {
    await runProbe(
      'domain_rail',
      checks.domain_rail.configured,
      `${process.env.DOMAIN_RAIL_URL.replace(/\/$/, '')}/healthz`,
    );
  }

  // Orchestrator
  const orchUrl = resolveOrchestratorUrl();
  checks.orchestrator = {
    configured: !!process.env.ORCHESTRATOR_URL && !!orchUrl,
    sandbox: true,
    status: orchUrl ? (process.env.ORCHESTRATOR_URL ? 'CONFIGURED' : 'DEFAULT_LOCALHOST') : 'MISSING_IN_PRODUCTION',
  };
  if (orchUrl) {
    await runProbe('orchestrator', checks.orchestrator.configured, `${orchUrl.replace(/\/$/, '')}/healthz`);
  }

  // Zoom Video SDK
  checks.zoom = {
    configured: !!process.env.ZOOM_SDK_KEY && !!process.env.ZOOM_SDK_SECRET,
    sandbox: true,
    status: !process.env.ZOOM_SDK_KEY ? 'NOT_SET' : 'CONFIGURED',
  };

  // Supabase
  checks.supabase = {
    configured: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    sandbox: false,
    status: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'CONFIGURED' : 'NOT_SET',
  };

  const total = Object.keys(checks).length;
  const configured = Object.values(checks).filter(c => c.configured).length;

  res.json({
    summary: `${configured}/${total} providers configured`,
    all_configured: configured === total,
    checks,
  });
});

router.post('/api/telemetry/canvas', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const suiteId = (req as any).authenticatedSuiteId || null;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  const events = Array.isArray(req.body?.events) ? req.body.events : [];

  if (!suiteId) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authenticated suite context required.',
      correlation_id: correlationId,
      trace_id: traceId,
    });
  }

  if (!events.length) {
    return res.status(400).json({
      error: 'INVALID_EVENTS',
      message: 'Expected non-empty events array.',
      correlation_id: correlationId,
      trace_id: traceId,
    });
  }

  const cappedEvents = events.slice(0, 50);
  let incidentReports = 0;

  for (const rawEvent of cappedEvents) {
    const eventName = typeof rawEvent?.event === 'string' ? rawEvent.event : 'unknown';
    const eventData = rawEvent?.data && typeof rawEvent.data === 'object' ? rawEvent.data : {};
    const sessionId = typeof rawEvent?.sessionId === 'string' ? rawEvent.sessionId : 'unknown';
    const eventTimestamp = typeof rawEvent?.timestamp === 'number'
      ? new Date(rawEvent.timestamp).toISOString()
      : new Date().toISOString();
    const pageRoute = typeof eventData.page_route === 'string' ? eventData.page_route : '/canvas';
    const component = typeof eventData.component === 'string' ? eventData.component : 'canvas';

    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      stage: 'session',
      status: eventName === 'error' || eventName === 'slo_violation' ? 'error' : 'ok',
      message: `Canvas telemetry: ${eventName}`,
      errorCode: eventName === 'error' || eventName === 'slo_violation' ? `CANVAS_${eventName.toUpperCase()}` : undefined,
      metadata: {
        actor_id: actorId,
        session_id: sessionId,
        event_timestamp: eventTimestamp,
        event: eventName,
        payload: eventData,
      },
    });

    // Also write to client_events table for admin portal visibility
    if (supabaseAdmin) {
      void supabaseAdmin.from('client_events').insert({
        tenant_id: suiteId,
        session_id: sessionId,
        correlation_id: correlationId,
        event_type: `canvas.${eventName}`,
        source: 'desktop',
        severity: eventName === 'error' ? 'error' : eventName === 'slo_violation' ? 'warning' : 'info',
        component,
        page_route: pageRoute,
        data: { event: eventName, payload: eventData, actor_id: actorId, trace_id: traceId },
      }).then(({ error: ceErr }) => {
        if (ceErr) console.error('[canvas-telemetry] client_events insert failed:', ceErr.message);
      });
    }

    if (eventName === 'error' || eventName === 'slo_violation') {
      incidentReports += 1;
      const eventMessage = typeof eventData.message === 'string' ? eventData.message.slice(0, 180) : `Canvas ${eventName}`;
      const errorCode = typeof eventData.error_code === 'string'
        ? eventData.error_code
        : `CANVAS_${eventName.toUpperCase()}`;

      await reportPipelineIncident({
        title: eventName === 'error' ? 'Desktop canvas error detected' : 'Desktop canvas SLO violation detected',
        severity: eventName === 'error' ? 'sev2' : 'sev3',
        correlationId,
        traceId,
        suiteId,
        component: '/api/telemetry/canvas',
        fingerprint: `desktop:canvas:${suiteId}:${eventName}:${errorCode}`,
        errorCode,
        message: eventMessage,
        metadata: {
          actor_id: actorId,
          session_id: sessionId,
          event: eventName,
          payload: eventData,
        },
      });
    }
  }

  res.status(202).json({
    accepted: true,
    event_count: cappedEvents.length,
    incident_reports: incidentReports,
    correlation_id: correlationId,
    trace_id: traceId,
  });
});

/**
 * Orchestrator Intent Proxy — Law #1: Single Brain
 *
 * Routes user text/voice intent to the LangGraph orchestrator.
 * The orchestrator decides which skill pack handles the intent.
 * Returns response text that gets spoken via ElevenLabs TTS.
 *
 * Hardened with:
 * - 15s timeout (AbortController) — Gate 3: Reliability
 * - Circuit breaker (3 failures → open 60s) — Gate 3: Reliability
 * - Correlation ID forwarding — Gate 2: Observability
 */
const ORCHESTRATOR_TIMEOUT_MS = 90_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60_000;
let orchestratorConsecutiveFailures = 0;
let orchestratorLastFailureAt = 0;

function writeSseHeaders(res: Response, correlationId: string, traceId: string): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('X-Trace-Id', traceId);
}

function writeSseEvent(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.get('/api/orchestrator/intent', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const startedAt = Date.now();
  const streamRequested = req.query.stream === 'true';
  if (!ENABLE_INTENT_SSE_PROXY) {
    return res.status(404).json({
      error: 'DISABLED',
      message: 'SSE proxy endpoint disabled by configuration.',
      correlation_id: correlationId,
    });
  }

  if (!streamRequested) {
    return res.status(400).json({
      error: 'STREAM_REQUIRED',
      message: 'GET /api/orchestrator/intent requires stream=true. Use POST /api/orchestrator/intent for non-streaming requests.',
      correlation_id: correlationId,
    });
  }

  const suiteId = (req as any).authenticatedSuiteId || '';
  if (!suiteId) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authenticated suite context required.',
      correlation_id: correlationId,
    });
  }

  const rawAgent = typeof req.query.agent === 'string' ? req.query.agent : '';
  const parsedAgent = parseRequestedAgent(rawAgent);
  if (STRICT_AGENT_VALIDATION && parsedAgent.provided && !parsedAgent.valid) {
    return res.status(400).json({
      error: 'INVALID_AGENT',
      message: `Unsupported agent '${rawAgent}'.`,
      correlation_id: correlationId,
      allowed_agents: Array.from(SUPPORTED_AGENTS),
    });
  }

  writeSseHeaders(res, correlationId, traceId);
  emitTraceEvent({
    traceId,
    correlationId,
    suiteId: suiteId || null,
    stage: 'orchestrator',
    status: 'start',
    message: 'Orchestrator SSE request started',
    metadata: { stream: true },
  });

  const text = typeof req.query.text === 'string' ? req.query.text.trim() : '';
  if (!text || req.query.passive === 'true') {
    writeSseEvent(res, {
      type: 'connected',
      message: 'stream_connected',
      timestamp: Date.now(),
      correlation_id: correlationId,
      trace_id: traceId,
      resolved_agent: parsedAgent.value,
    });

    const heartbeat = setInterval(() => {
      writeSseEvent(res, {
        type: 'heartbeat',
        timestamp: Date.now(),
        correlation_id: correlationId,
        trace_id: traceId,
      });
    }, 15_000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
    return;
  }

  const ORCHESTRATOR_URL = resolveOrchestratorUrl();
  if (!ORCHESTRATOR_URL) {
    await reportPipelineIncident({
      title: 'Desktop SSE proxy missing orchestrator configuration',
      severity: 'sev1',
      correlationId,
      traceId,
      suiteId,
      component: '/api/orchestrator/intent:sse',
      fingerprint: 'desktop:sse:orchestrator:not_configured',
      agent: parsedAgent.value,
      errorCode: 'ORCHESTRATOR_NOT_CONFIGURED',
      message: 'ORCHESTRATOR_URL is required in production.',
      metadata: { stream: true },
    });
    return res.status(503).json({
      error: 'ORCHESTRATOR_NOT_CONFIGURED',
      message: 'ORCHESTRATOR_URL is required in production.',
      correlation_id: correlationId,
    });
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS);
  req.on('close', () => controller.abort());

  try {
    const response = await fetch(`${ORCHESTRATOR_URL}/v1/intents?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Office-Id': getDefaultOfficeId() || suiteId,
        'X-Actor-Id': (req as any).authenticatedUserId || 'web-stream-client',
        'X-Correlation-Id': correlationId,
        'X-Trace-Id': traceId,
      },
      body: JSON.stringify({
        text,
        agent: parsedAgent.value,
        requested_agent: parsedAgent.value,
        channel: typeof req.query.channel === 'string' ? req.query.channel : 'chat',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status >= 500) {
        await reportPipelineIncident({
          title: 'Desktop SSE proxy upstream orchestrator failure',
          severity: response.status >= 503 ? 'sev1' : 'sev2',
          correlationId,
          traceId,
          suiteId,
          component: '/api/orchestrator/intent:sse',
          fingerprint: `desktop:sse:orchestrator:${suiteId || 'global'}:${parsedAgent.value}:http_${response.status}`,
          agent: parsedAgent.value,
          errorCode: `ORCHESTRATOR_HTTP_${response.status}`,
          statusCode: response.status,
          message: errorText.substring(0, 200),
          metadata: { stream: true },
        });
      }
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId: suiteId || null,
        agent: parsedAgent.value,
        stage: 'orchestrator',
        status: 'error',
        message: `Orchestrator returned ${response.status}`,
        errorCode: `ORCHESTRATOR_HTTP_${response.status}`,
        latencyMs: Date.now() - startedAt,
        metadata: { stream: true },
      });
      writeSseEvent(res, {
        type: 'error',
        timestamp: Date.now(),
        correlation_id: correlationId,
        trace_id: traceId,
        code: 'ORCHESTRATOR_ERROR',
        message: `Orchestrator returned ${response.status}`,
        detail: errorText.substring(0, 200),
      });
      res.end();
      return;
    }

    if (!response.body) {
      await reportPipelineIncident({
        title: 'Desktop SSE proxy upstream returned no stream body',
        severity: 'sev2',
        correlationId,
        traceId,
        suiteId,
        component: '/api/orchestrator/intent:sse',
        fingerprint: `desktop:sse:orchestrator:${suiteId || 'global'}:${parsedAgent.value}:no_stream`,
        agent: parsedAgent.value,
        errorCode: 'ORCHESTRATOR_NO_STREAM',
        message: 'Orchestrator returned no stream body.',
        metadata: { stream: true },
      });
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId: suiteId || null,
        agent: parsedAgent.value,
        stage: 'orchestrator',
        status: 'error',
        message: 'Orchestrator returned no stream body.',
        errorCode: 'ORCHESTRATOR_NO_STREAM',
        latencyMs: Date.now() - startedAt,
        metadata: { stream: true },
      });
      writeSseEvent(res, {
        type: 'error',
        timestamp: Date.now(),
        correlation_id: correlationId,
        trace_id: traceId,
        code: 'ORCHESTRATOR_NO_STREAM',
        message: 'Orchestrator returned no stream body.',
      });
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId: suiteId || null,
      agent: parsedAgent.value,
      stage: 'orchestrator',
      status: 'ok',
      message: 'Orchestrator SSE stream completed',
      latencyMs: Date.now() - startedAt,
      metadata: { stream: true },
    });
    res.end();
  } catch (error: unknown) {
    const code = error instanceof Error && error.name === 'AbortError'
      ? 'ORCHESTRATOR_TIMEOUT'
      : 'ORCHESTRATOR_UNAVAILABLE';
    await reportPipelineIncident({
      title: 'Desktop SSE proxy request failed',
      severity: code === 'ORCHESTRATOR_TIMEOUT' ? 'sev2' : 'sev1',
      correlationId,
      traceId,
      suiteId,
      component: '/api/orchestrator/intent:sse',
      fingerprint: `desktop:sse:orchestrator:${suiteId || 'global'}:${parsedAgent.value}:${code.toLowerCase()}`,
      agent: parsedAgent.value,
      errorCode: code,
      message: error instanceof Error ? error.message : 'Unknown stream error',
      metadata: { stream: true },
    });
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId: suiteId || null,
      agent: parsedAgent.value,
      stage: 'orchestrator',
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown stream error',
      errorCode: code,
      latencyMs: Date.now() - startedAt,
      metadata: { stream: true },
    });
    writeSseEvent(res, {
      type: 'error',
      timestamp: Date.now(),
      correlation_id: correlationId,
      trace_id: traceId,
      code,
      message: error instanceof Error ? error.message : 'Unknown stream error',
    });
    res.end();
  } finally {
    clearTimeout(timeoutId);
  }
});

// Canvas Action Bus task proxy — forwards widget actions to orchestrator (Law #1: Single Brain)
router.post('/api/orchestrator/task', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  const officeId = (req as any).authenticatedOfficeId || suiteId;

  const ORCHESTRATOR_URL = resolveOrchestratorUrl();
  if (!ORCHESTRATOR_URL) {
    return res.status(503).json({
      error: 'ORCHESTRATOR_NOT_CONFIGURED',
      message: 'ORCHESTRATOR_URL is required in production.',
      correlation_id: correlationId,
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(`${ORCHESTRATOR_URL}/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Office-Id': officeId,
        'X-Correlation-Id': correlationId,
        'X-Trace-Id': traceId,
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Orchestrator task proxy error', { correlationId, error: message });
    res.status(502).json({
      error: 'ORCHESTRATOR_PROXY_ERROR',
      message,
      correlation_id: correlationId,
    });
  }
});

router.post('/api/orchestrator/intent', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const startedAt = Date.now();
  const authenticatedSuiteId = (req as any).authenticatedSuiteId || null;
  const authenticatedUserId = (req as any).authenticatedUserId || '';
  const headerSuiteId = typeof req.headers['x-suite-id'] === 'string' ? req.headers['x-suite-id'].trim() : '';
  const headerOfficeId = typeof req.headers['x-office-id'] === 'string' ? req.headers['x-office-id'].trim() : '';
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const s2sSecrets = [
    process.env.S2S_HMAC_SECRET_ACTIVE,
    process.env.DOMAIN_RAIL_HMAC_SECRET,
    process.env.S2S_HMAC_SECRET,
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  const isValidS2S = !authenticatedSuiteId
    && !!bearerToken
    && s2sSecrets.some((secret) => secureTokenEquals(bearerToken, secret.trim()));
  const suiteId = authenticatedSuiteId || (isValidS2S ? (headerSuiteId || null) : null);
  const officeId = (isValidS2S ? (headerOfficeId || headerSuiteId || null) : (getDefaultOfficeId() || suiteId)) || suiteId;
  const actorId = authenticatedUserId || (isValidS2S ? 'n8n-service' : '');
  res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('X-Trace-Id', traceId);
  emitTraceEvent({
    traceId,
    correlationId,
    suiteId,
    agent: typeof req.body?.agent === 'string' ? req.body.agent : null,
    stage: 'orchestrator',
    status: 'start',
    message: 'Orchestrator intent request started',
    metadata: { stream: false },
  });

  try {
    const { agent, text, voiceId, channel, userProfile } = req.body;
    const incomingIntent = typeof req.body?.intent === 'string' ? req.body.intent.trim() : '';
    const incomingTaskType = typeof req.body?.task_type === 'string' ? req.body.task_type.trim() : '';
    const incomingRequestId = typeof req.body?.request_id === 'string' ? req.body.request_id.trim() : '';
    const incomingSessionId = typeof req.body?.session_id === 'string' ? req.body.session_id.trim() : '';
    const incomingConversationId = typeof req.body?.conversation_id === 'string' ? req.body.conversation_id.trim() : '';
    const incomingPayload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : undefined;
    const incomingContext = req.body?.context && typeof req.body.context === 'object' ? req.body.context : undefined;

    if (!text || typeof text !== 'string' || !text.trim()) {
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        stage: 'orchestrator',
        status: 'error',
        message: 'Missing or empty text parameter',
        errorCode: 'ORCHESTRATOR_INVALID_TEXT',
        latencyMs: Date.now() - startedAt,
      });
      return res.status(400).json({ error: 'Missing or empty text parameter' });
    }

    const ORCHESTRATOR_URL = resolveOrchestratorUrl();
    if (!ORCHESTRATOR_URL) {
      await reportPipelineIncident({
        title: 'Desktop intent proxy missing orchestrator configuration',
        severity: 'sev1',
        correlationId,
        traceId,
        suiteId,
        component: '/api/orchestrator/intent',
        fingerprint: 'desktop:intent:orchestrator:not_configured',
        errorCode: 'ORCHESTRATOR_NOT_CONFIGURED',
        message: 'ORCHESTRATOR_URL is required in production.',
        metadata: { stream: false },
      });
      return res.status(503).json({
        error: 'ORCHESTRATOR_NOT_CONFIGURED',
        message: 'ORCHESTRATOR_URL is required in production.',
        correlation_id: correlationId,
      });
    }
    if (!suiteId) {
      emitTraceEvent({
        traceId,
        correlationId,
        stage: 'orchestrator',
        status: 'error',
        message: 'Suite context required via auth or valid S2S token.',
        errorCode: 'AUTH_REQUIRED',
        latencyMs: Date.now() - startedAt,
      });
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authenticated suite context required (or valid S2S bearer + x-suite-id).',
      });
    }

    // Circuit breaker check — Law #3: fail fast when orchestrator is known-down
    const now = Date.now();
    if (
      orchestratorConsecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD &&
      (now - orchestratorLastFailureAt) < CIRCUIT_BREAKER_RESET_MS
    ) {
      const retryAfterMs = Math.max(0, CIRCUIT_BREAKER_RESET_MS - (now - orchestratorLastFailureAt));
      const breakerAgent = parseRequestedAgent(agent).value;
      await reportPipelineIncident({
        title: 'Desktop intent proxy circuit breaker open',
        severity: 'sev1',
        correlationId,
        traceId,
        suiteId,
        component: '/api/orchestrator/intent',
        fingerprint: `desktop:intent:orchestrator:${suiteId || 'global'}:${breakerAgent}:circuit_open`,
        agent: breakerAgent,
        errorCode: 'ORCHESTRATOR_CIRCUIT_OPEN',
        message: 'Orchestrator circuit breaker open. Retrying automatically.',
        metadata: { retry_after_ms: retryAfterMs },
      });
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        stage: 'orchestrator',
        status: 'error',
        message: 'Orchestrator circuit breaker open',
        errorCode: 'ORCHESTRATOR_CIRCUIT_OPEN',
        latencyMs: Date.now() - startedAt,
      });
      return res.status(503).json({
        error: 'ORCHESTRATOR_CIRCUIT_OPEN',
        error_code: 'ORCHESTRATOR_CIRCUIT_OPEN',
        error_stage: 'orchestrator',
        message: 'Orchestrator circuit breaker open. Retrying automatically.',
        retry_after_ms: retryAfterMs,
        correlation_id: correlationId,
      });
    }

    const parsedAgent = parseRequestedAgent(agent);
    if (STRICT_AGENT_VALIDATION && parsedAgent.provided && !parsedAgent.valid) {
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        stage: 'orchestrator',
        status: 'error',
        message: `Unsupported agent '${String(agent)}'.`,
        errorCode: 'INVALID_AGENT',
        latencyMs: Date.now() - startedAt,
      });
      return res.status(400).json({
        error: 'INVALID_AGENT',
        message: `Unsupported agent '${String(agent)}'.`,
        correlation_id: correlationId,
        allowed_agents: Array.from(SUPPORTED_AGENTS),
      });
    }
    const requestedAgent = parsedAgent.value;

    // SSE streaming branch — stream reasoning steps from Ava-Brain to client
    const streamRequested = req.query.stream === 'true';

    if (streamRequested) {
      const backendStreamUrl = `${ORCHESTRATOR_URL}/v1/intents?stream=true`;
      const streamController = new AbortController();
      const streamTimeoutId = setTimeout(() => streamController.abort(), ORCHESTRATOR_TIMEOUT_MS);
      req.on('close', () => streamController.abort());

      // Build enriched body with user_profile (same as non-streaming path)
      // so the backend can greet by name (Mr./Mrs. LastName)
      const streamProfileContext = userProfile ? {
        owner_name: userProfile.ownerName,
        business_name: userProfile.businessName,
        industry: userProfile.industry,
        team_size: userProfile.teamSize,
        industry_specialty: userProfile.industrySpecialty,
        business_goals: userProfile.businessGoals,
        pain_point: userProfile.painPoint,
        preferred_channel: userProfile.preferredChannel,
      } : undefined;
      const streamBody: Record<string, any> = {
        ...req.body,
        agent: requestedAgent,
        requested_agent: requestedAgent,
        user_profile: streamProfileContext,
        suite_id: suiteId,
        office_id: officeId || suiteId,
      };

      try {
        const backendResp = await fetch(backendStreamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Actor-Id': actorId,
            'X-Suite-Id': suiteId,
            'X-Office-Id': officeId || suiteId,
            'X-Correlation-Id': correlationId,
            'X-Trace-Id': traceId,
          },
          body: JSON.stringify(streamBody),
          signal: streamController.signal,
        });

        if (!backendResp.ok || !backendResp.body) {
          emitTraceEvent({
            traceId,
            correlationId,
            suiteId,
            stage: 'orchestrator',
            status: 'error',
            message: 'Backend streaming unavailable',
            errorCode: 'STREAM_FAILED',
            latencyMs: Date.now() - startedAt,
          });
          return res.status(backendResp.status || 502).json({
            error: 'STREAM_FAILED',
            message: 'Backend streaming unavailable',
            correlation_id: correlationId,
          });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('X-Correlation-Id', correlationId);
        res.setHeader('X-Trace-Id', traceId);
        res.flushHeaders();

        // SSE keepalive — Railway's reverse proxy kills idle connections (~100s).
        // Send comment lines (invisible to SSE clients) every 15s to keep it alive
        // while the backend processes the LLM request.
        const keepalive = setInterval(() => {
          if (!res.writableEnded) {
            res.write(': keepalive\n\n');
          }
        }, 15_000);

        // Pipe the readable stream from backend to client
        const reader = (backendResp.body as any).getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
            }
          } catch (_pipeErr) {
            // Client disconnected or backend stream error
          } finally {
            clearInterval(keepalive);
            res.end();
          }
        };

        req.on('close', () => {
          clearInterval(keepalive);
          try { reader.cancel(); } catch {}
        });

        await pump();
        clearTimeout(streamTimeoutId);

        emitTraceEvent({
          traceId,
          correlationId,
          suiteId,
          stage: 'orchestrator',
          status: 'ok',
          message: 'Streaming intent response completed',
          latencyMs: Date.now() - startedAt,
        });
      } catch (err) {
        clearTimeout(streamTimeoutId);
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        if (!res.headersSent) {
          emitTraceEvent({
            traceId,
            correlationId,
            suiteId,
            stage: 'orchestrator',
            status: 'error',
            message: isTimeout ? 'Orchestrator stream timed out' : 'Failed to connect to backend stream',
            errorCode: isTimeout ? 'ORCHESTRATOR_TIMEOUT' : 'STREAM_ERROR',
            latencyMs: Date.now() - startedAt,
          });
          return res.status(isTimeout ? 504 : 502).json({
            error: isTimeout ? 'orchestrator_timeout' : 'STREAM_ERROR',
            message: isTimeout ? 'Orchestrator stream timed out' : 'Failed to connect to backend stream',
            correlation_id: correlationId,
          });
        }
        res.end();
      }
      return;
    }

    // Build profile context for Ava personalization (PII-filtered — Law #9)
    // Only safe business context fields, never DOB/address/gender
    const profileContext = userProfile ? {
      owner_name: userProfile.ownerName,
      business_name: userProfile.businessName,
      industry: userProfile.industry,
      team_size: userProfile.teamSize,
      industry_specialty: userProfile.industrySpecialty,
      business_goals: userProfile.businessGoals,
      pain_point: userProfile.painPoint,
      preferred_channel: userProfile.preferredChannel,
    } : undefined;

    // Timeout enforcement — Gate 3: Reliability
    const downstreamBody: Record<string, any> = {
      text: text.trim(),
      agent: requestedAgent,
      requested_agent: requestedAgent,
      voice_id: voiceId,
      channel: channel || 'voice',
      user_profile: profileContext,
      suite_id: suiteId,
      office_id: officeId || suiteId,
    };
    if (incomingIntent) downstreamBody.intent = incomingIntent;
    if (incomingTaskType) downstreamBody.task_type = incomingTaskType;
    if (incomingRequestId) downstreamBody.request_id = incomingRequestId;
    if (incomingSessionId) downstreamBody.session_id = incomingSessionId;
    if (incomingConversationId) downstreamBody.conversation_id = incomingConversationId;
    if (incomingPayload) downstreamBody.payload = incomingPayload;
    if (incomingContext) downstreamBody.context = incomingContext;

    const response = await fetchWithTimeoutAndRetry(`${ORCHESTRATOR_URL}/v1/intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Office-Id': officeId || suiteId,
        'X-Actor-Id': actorId,
        'X-Correlation-Id': correlationId,
        'X-Trace-Id': traceId,
      },
      body: JSON.stringify(downstreamBody),
    }, {
      timeoutMs: ORCHESTRATOR_TIMEOUT_MS,
      retries: 1,
      retryOnStatuses: [429, 500, 502, 503, 504],
    });

    if (!response.ok) {
      orchestratorConsecutiveFailures++;
      orchestratorLastFailureAt = Date.now();
      const errorText = await response.text();
      logger.error('Orchestrator error', { correlationId, status: response.status, error: errorText.substring(0, 200) });
      if (response.status >= 500) {
        await reportPipelineIncident({
          title: 'Desktop intent proxy upstream orchestrator failure',
          severity: response.status >= 503 ? 'sev1' : 'sev2',
          correlationId,
          traceId,
          suiteId,
          component: '/api/orchestrator/intent',
          fingerprint: `desktop:intent:orchestrator:${suiteId || 'global'}:${requestedAgent}:http_${response.status}`,
          agent: requestedAgent,
          errorCode: `ORCHESTRATOR_HTTP_${response.status}`,
          statusCode: response.status,
          message: errorText.substring(0, 200),
          metadata: { stream: false },
        });
      }
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        agent: requestedAgent,
        stage: 'orchestrator',
        status: 'error',
        message: `Orchestrator returned ${response.status}`,
        errorCode: `ORCHESTRATOR_HTTP_${response.status}`,
        latencyMs: Date.now() - startedAt,
      });

      // Extract human-readable text from orchestrator error response
      let errorData: any = null;
      try { errorData = JSON.parse(errorText); } catch { /* non-JSON error */ }
      const responseText = humanizeUserError(
        errorData?.text || errorData?.message,
        correlationId,
      );

      return res.status(response.status).json({
        response: responseText,
        error: errorData?.error || `Orchestrator returned ${response.status}`,
        error_code: errorData?.error || `ORCHESTRATOR_HTTP_${response.status}`,
        error_stage: 'orchestrator',
        error_reason: errorData?.message || null,
        retryable: response.status >= 500 || response.status === 429,
        retry_after_ms: response.status === 429 ? 5_000 : undefined,
        approval_payload_hash: errorData?.approval_payload_hash || null,
        required_approvals: errorData?.required_approvals || null,
        receipt_ids: errorData?.receipt_ids || [],
        assigned_agent: errorData?.assigned_agent || requestedAgent,
        correlation_id: correlationId,
        trace_id: traceId,
      });
    }

    // Success — reset circuit breaker
    orchestratorConsecutiveFailures = 0;

    // Emit GREEN receipt when profile context was loaded — Law #2
    if (profileContext && suiteId) {
      try {
        const profileReceiptId = crypto.randomUUID();
        await db.execute(sql`
          INSERT INTO receipts (receipt_id, action, result, suite_id, tenant_id,
                                correlation_id, actor_type, actor_id, risk_tier, created_at, payload)
          VALUES (${profileReceiptId}, 'ava.profile_context_loaded', 'success', ${suiteId}, ${suiteId},
                  ${correlationId}, 'system', 'ava-profile-loader', 'green', NOW(),
                  ${JSON.stringify({
                    fields_sent: Object.keys(profileContext).filter(k => (profileContext as any)[k] != null),
                    pii_filtered: ['dateOfBirth', 'gender', 'homeAddress', 'businessAddress'],
                  })}::jsonb)
        `);
      } catch (profileReceiptErr: unknown) {
        // GREEN-tier receipt failure is non-blocking
        logger.warn('Ava profile receipt failed', { correlationId, error: profileReceiptErr instanceof Error ? profileReceiptErr.message : 'unknown' });
      }
    }

    const data = await response.json();
    const resolvedAgent = typeof data?.assigned_agent === 'string' && data.assigned_agent.trim()
      ? data.assigned_agent.trim().toLowerCase()
      : requestedAgent;
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      agent: resolvedAgent,
      stage: 'orchestrator',
      status: 'ok',
      message: 'Orchestrator intent completed',
      latencyMs: Date.now() - startedAt,
      metadata: {
        assigned_agent: resolvedAgent,
        receipt_count: Array.isArray(data?.governance?.receipt_ids) ? data.governance.receipt_ids.length : 0,
      },
    });
    if (res.headersSent) {
      logger.warn('Orchestrator response arrived after timeout — discarding', { correlationId, latencyMs: Date.now() - startedAt });
      return;
    }
    res.json({
      response: data.text || data.message || "I'm ready for your next step.",
      receipt_id: data.governance?.receipt_ids?.[0] || null,
      receipt_ids: data.governance?.receipt_ids || [],
      resolved_agent: resolvedAgent,
      assigned_agent: resolvedAgent,
      media: Array.isArray(data.media) ? data.media : [],
      action: data.plan?.task_type || null,
      governance: data.governance || null,
      risk_tier: data.risk?.tier || null,
      route: data.route || null,
      plan: data.plan || null,
      correlation_id: correlationId,
      trace_id: traceId,
    });
  } catch (error: unknown) {
    orchestratorConsecutiveFailures++;
    orchestratorLastFailureAt = Date.now();

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Orchestrator timeout', { correlationId, timeout_ms: ORCHESTRATOR_TIMEOUT_MS });
      await reportPipelineIncident({
        title: 'Desktop intent proxy timed out waiting for orchestrator',
        severity: 'sev2',
        correlationId,
        traceId,
        suiteId,
        component: '/api/orchestrator/intent',
        fingerprint: `desktop:intent:orchestrator:${suiteId || 'global'}:timeout`,
        errorCode: 'ORCHESTRATOR_TIMEOUT',
        message: `Orchestrator request timed out after ${ORCHESTRATOR_TIMEOUT_MS / 1000}s`,
        metadata: { timeout_ms: ORCHESTRATOR_TIMEOUT_MS },
      });
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        stage: 'orchestrator',
        status: 'error',
        message: `Orchestrator request timed out after ${ORCHESTRATOR_TIMEOUT_MS / 1000}s`,
        errorCode: 'ORCHESTRATOR_TIMEOUT',
        latencyMs: Date.now() - startedAt,
      });
      return res.status(504).json({
        error: 'ORCHESTRATOR_TIMEOUT',
        error_code: 'ORCHESTRATOR_TIMEOUT',
        error_stage: 'orchestrator',
        message: `Orchestrator request timed out after ${ORCHESTRATOR_TIMEOUT_MS / 1000}s`,
        retry_after_ms: 2000,
        correlation_id: correlationId,
        trace_id: traceId,
      });
    }

    logger.error('Orchestrator intent error', { correlationId, error: error instanceof Error ? error.message : 'unknown' });
    await reportPipelineIncident({
      title: 'Desktop intent proxy could not reach orchestrator',
      severity: 'sev1',
      correlationId,
      traceId,
      suiteId,
      component: '/api/orchestrator/intent',
      fingerprint: `desktop:intent:orchestrator:${suiteId || 'global'}:unavailable`,
      errorCode: 'ORCHESTRATOR_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'unknown',
      metadata: { stream: false },
    });
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      stage: 'orchestrator',
      status: 'error',
      message: error instanceof Error ? error.message : 'unknown',
      errorCode: 'ORCHESTRATOR_UNAVAILABLE',
      latencyMs: Date.now() - startedAt,
    });
    // Law #3: Fail Closed — return 503, not 200
    if (!res.headersSent) {
      res.status(503).json({
        error: 'ORCHESTRATOR_UNAVAILABLE',
        error_code: 'ORCHESTRATOR_UNAVAILABLE',
        error_stage: 'orchestrator',
        message: 'The orchestrator is currently unavailable. Please try again.',
        retry_after_ms: 3000,
        correlation_id: correlationId,
        trace_id: traceId,
      });
    }
  }
});

router.get('/api/inbox/items', async (req: Request, res: Response) => {
  // Law #6: Tenant isolation — require authenticated suite context
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  try {
    const result = await db.execute(sql`
      SELECT id, type, sender_name AS "from", subject, preview, priority,
             unread, created_at AS timestamp, tags
      FROM inbox_items
      WHERE suite_id = ${suiteId}
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const rows = (result.rows || result) as any[];
    res.json({ items: rows });
  } catch (error: unknown) {
    // Graceful degradation: table may not exist yet
    logger.warn('inbox_items query failed, returning empty', { error: error instanceof Error ? error.message : 'unknown' });
    res.json({ items: [] });
  }
});

router.get('/api/authority-queue', async (req: Request, res: Response) => {
  // Law #6: Tenant isolation — require authenticated suite context
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  try {
    // Query pending approval requests — scoped to authenticated tenant (Law #6)
    const approvalResult = await db.execute(sql`
      SELECT approval_id AS id,
             tool || '.' || operation AS type,
             COALESCE(draft_summary, COALESCE(payload_redacted->>'title', tool || ' ' || operation)) AS title,
             COALESCE(
               (execution_payload->>'amount_cents')::numeric / 100,
               (payload_redacted->>'amount')::numeric
             ) AS amount,
             COALESCE(execution_payload->>'currency', payload_redacted->>'currency', 'usd') AS currency,
             created_by_user_id AS "requestedBy",
             risk_tier AS risk,
             status,
             created_at AS "createdAt",
             assigned_agent AS "assignedAgent",
             draft_summary AS "draftSummary",
             execution_payload->>'invoice_id' AS "stripeInvoiceId",
             execution_payload->>'customer_name' AS "customerName",
             execution_payload->>'document_id' AS "pandadocDocumentId",
             payload_redacted->>'hosted_invoice_url' AS "hostedInvoiceUrl",
             tool,
             operation,
             execution_payload->>'due_date' AS "dueDate",
             execution_payload->>'invoice_number' AS "invoiceNumber",
             execution_payload->>'description' AS "invoiceDescription"
      FROM approval_requests
      WHERE status = 'pending' AND tenant_id = ${suiteId}
      ORDER BY created_at DESC
      LIMIT 20
    `);
    const pendingApprovals = (approvalResult.rows || approvalResult) as any[];

    // Query recent completed receipts — aligned with trust_spine_bundle schema
    const receiptResult = await db.execute(sql`
      SELECT receipt_id AS id,
             receipt_type AS type,
             COALESCE(receipt_type, 'Action') AS title,
             status,
             created_at AS "completedAt"
      FROM receipts
      WHERE status = 'SUCCEEDED' AND suite_id = ${suiteId}
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const recentReceipts = (receiptResult.rows || receiptResult) as any[];

    res.json({ pendingApprovals, recentReceipts });
  } catch (error: unknown) {
    // Graceful degradation: tables may not exist yet
    logger.warn('authority-queue query failed, returning empty', { error: error instanceof Error ? error.message : 'unknown' });
    res.json({ pendingApprovals: [], recentReceipts: [] });
  }
});

router.post('/api/authority-queue/:id/approve', async (req: Request, res: Response) => {
  // Law #3: Fail Closed — require authenticated suite context for state-changing operations
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  const userId = (req as any).authenticatedUserId;
  const { id } = req.params;
  try {
    // Update approval request status — scoped by tenant_id (Law #6)
    const updateResult = await db.execute(sql`
      UPDATE approval_requests
      SET status = 'approved', decided_at = NOW(), decided_by_user_id = ${userId || null},
          decision_surface = 'desktop_authority_queue', decision_reason = 'user_approved'
      WHERE approval_id = ${id} AND tenant_id = ${suiteId}
    `);

    // Law #3: Fail Closed — verify the update actually matched a row
    const rowCount = (updateResult as any).rowCount ?? (updateResult as any).changes ?? 0;
    if (rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Approval request not found or not in your tenant.' });
    }

    // Generate approval receipt (Law #2: Receipt for All)
    const receiptId = crypto.randomUUID();
    const correlationId = req.headers['x-correlation-id'] as string || `corr-${Date.now()}`;
    const approveAction = JSON.stringify({ type: 'approval.approve', target_id: id, risk_tier: 'yellow' });
    const approveResult = JSON.stringify({ status: 'approved', decision_surface: 'desktop_authority_queue' });
    await db.execute(sql`
      INSERT INTO receipts (receipt_id, receipt_type, action, result, status, suite_id, tenant_id,
                            correlation_id, actor_type, actor_id, hash_alg, created_at)
      VALUES (${receiptId}, 'approval', ${approveAction}::jsonb, ${approveResult}::jsonb, 'SUCCEEDED', ${suiteId}, ${suiteId},
              ${correlationId}, 'USER', ${userId || null}, 'sha256', NOW())
    `);

    // After successful approval, trigger resume execution via orchestrator
    const officeId = getDefaultOfficeId();
    try {
      const orchestratorUrl = resolveOrchestratorUrl();
      if (!orchestratorUrl) {
        throw new Error('ORCHESTRATOR_NOT_CONFIGURED');
      }
      const resumeRes = await fetch(`${orchestratorUrl}/v1/resume/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-suite-id': suiteId,
          'x-office-id': officeId || '',
          'x-actor-id': userId || '',
        },
      });
      const resumeData = await resumeRes.json();
      return res.json({
        approved: true,
        executed: resumeRes.ok,
        ...resumeData,
      });
    } catch (resumeErr) {
      // Approval succeeded but execution failed — return partial success
      return res.json({
        approved: true,
        executed: false,
        error: 'Resume execution failed',
        retry_available: true,
        receiptId,
      });
    }
  } catch (error: unknown) {
    logger.warn('approve failed', { error: error instanceof Error ? error.message : 'unknown' });
    // Law #3: Fail Closed — return error, not fake success
    res.status(500).json({ error: 'APPROVE_FAILED', message: 'Failed to approve request' });
  }
});

router.post('/api/authority-queue/:id/deny', async (req: Request, res: Response) => {
  // Law #3: Fail Closed — require authenticated suite context for state-changing operations
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  const userId = (req as any).authenticatedUserId;
  const { id } = req.params;
  const { reason } = req.body;
  try {
    // Update approval request status — scoped by tenant_id (Law #6)
    const denyResult = await db.execute(sql`
      UPDATE approval_requests
      SET status = 'denied', decided_at = NOW(), decided_by_user_id = ${userId || null},
          decision_surface = 'desktop_authority_queue',
          decision_reason = ${reason || 'No reason provided'}
      WHERE approval_id = ${id} AND tenant_id = ${suiteId}
    `);

    // Law #3: Fail Closed — verify the update actually matched a row
    const denyRowCount = (denyResult as any).rowCount ?? (denyResult as any).changes ?? 0;
    if (denyRowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Approval request not found or not in your tenant.' });
    }

    // Generate denial receipt (Law #2: Receipt for All)
    const receiptId = crypto.randomUUID();
    const correlationId = req.headers['x-correlation-id'] as string || `corr-${Date.now()}`;
    const denyAction = JSON.stringify({ type: 'approval.deny', target_id: id, risk_tier: 'yellow' });
    const denyResultPayload = JSON.stringify({ status: 'denied', reason: reason || 'user_denied', decision_surface: 'desktop_authority_queue' });
    await db.execute(sql`
      INSERT INTO receipts (receipt_id, receipt_type, action, result, status, suite_id, tenant_id,
                            correlation_id, actor_type, actor_id, hash_alg, created_at)
      VALUES (${receiptId}, 'approval', ${denyAction}::jsonb, ${denyResultPayload}::jsonb, 'DENIED', ${suiteId}, ${suiteId},
              ${correlationId}, 'USER', ${userId || null}, 'sha256', NOW())
    `);

    // Post-deny cleanup: void finalized invoices in Stripe
    // Since invoice.create auto-finalizes (to generate preview URL), denial must void it
    try {
      const approvalRows = await db.execute(sql`
        SELECT operation, execution_payload FROM approval_requests
        WHERE approval_id = ${id} AND tenant_id = ${suiteId}
      `);
      const approvalRow = (approvalRows as any).rows?.[0] || (approvalRows as any)[0];
      if (approvalRow?.operation === 'invoice.send') {
        const execPayload = typeof approvalRow.execution_payload === 'string'
          ? JSON.parse(approvalRow.execution_payload)
          : approvalRow.execution_payload;
        const invoiceId = execPayload?.invoice_id;
        if (invoiceId) {
          // Call orchestrator to void the finalized invoice
          const orchestratorUrl = resolveOrchestratorUrl();
          const voidResp = await fetch(`${orchestratorUrl}/v1/void-invoice/${invoiceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Suite-Id': suiteId,
              'X-Correlation-Id': correlationId,
              'X-Office-Id': getDefaultOfficeId(),
            },
          });
          if (voidResp.ok) {
            logger.info('Invoice voided after denial', { invoiceId, approvalId: id });
          } else {
            logger.warn('Invoice void failed after denial', { invoiceId, status: voidResp.status });
          }
        }
      }

      // Cancel finalized quotes on denial (same pattern as invoice void)
      if (approvalRow?.operation === 'quote.send') {
        const execPayload = typeof approvalRow.execution_payload === 'string'
          ? JSON.parse(approvalRow.execution_payload)
          : approvalRow.execution_payload;
        const quoteId = execPayload?.quote_id;
        if (quoteId) {
          const orchestratorUrl = resolveOrchestratorUrl();
          const cancelResp = await fetch(`${orchestratorUrl}/v1/cancel-quote/${quoteId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Suite-Id': suiteId,
              'X-Correlation-Id': correlationId,
              'X-Office-Id': getDefaultOfficeId(),
            },
          });
          if (cancelResp.ok) {
            logger.info('Quote canceled after denial', { quoteId, approvalId: id });
          } else {
            logger.warn('Quote cancel failed after denial', { quoteId, status: cancelResp.status });
          }
        }
      }
    } catch (voidErr: unknown) {
      // Non-fatal: denial succeeded, void/cancel is best-effort cleanup
      logger.warn('Post-deny cleanup failed', { error: voidErr instanceof Error ? voidErr.message : 'unknown' });
    }

    res.json({ id, status: 'denied', reason, deniedAt: new Date().toISOString(), receiptId });
  } catch (error: unknown) {
    logger.warn('deny failed', { error: error instanceof Error ? error.message : 'unknown' });
    // Law #3: Fail Closed — return error, not fake success
    res.status(500).json({ error: 'DENY_FAILED', message: 'Failed to deny request' });
  }
});

/**
 * Execute an already-approved authority queue item via orchestrator resume.
 * Used for retry when approve succeeded but auto-execute failed,
 * or for manual execution after review.
 */
router.post('/api/authority-queue/:id/execute', async (req: Request, res: Response) => {
  const { id } = req.params;
  const suiteId = (req as any).authenticatedSuiteId;
  const userId = (req as any).authenticatedUserId;
  const officeId = getDefaultOfficeId();

  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  try {
    const orchestratorUrl = resolveOrchestratorUrl();
    if (!orchestratorUrl) {
      throw new Error('ORCHESTRATOR_NOT_CONFIGURED');
    }
    const result = await fetch(`${orchestratorUrl}/v1/resume/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-suite-id': suiteId,
        'x-office-id': officeId || '',
        'x-actor-id': userId || '',
      },
    });
    const data = await result.json();
    return res.status(result.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'EXECUTE_FAILED', message: 'Failed to execute approved request' });
  }
});

/**
 * Anam Avatar — Session Token Exchange (Law #9: secrets server-side only)
 *
 * The Anam API key stays on the server. The client receives a short-lived
 * session token to initialize the Anam JS SDK with streamToVideoElement().
 *
 * Persona "Ava" created in Anam dashboard (lab.anam.ai/personas):
 *   - Avatar: Cara at desk (30fa96d0)
 *   - Voice: Hope (0c8b52f4-f26d-4810-855c-c90e5f599cbc)
 *   - LLM: Anam-hosted or server-side custom LLM
 *   - Persona state is created fresh per session token request
 */

router.get('/api/anam/persona-health', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authenticatedUserId;
    if (!userId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
    }
    const ANAM_API_KEY = process.env.ANAM_API_KEY;
    if (!ANAM_API_KEY) {
      return res.status(503).json({ error: 'ANAM_NOT_CONFIGURED', message: 'Anam API key missing' });
    }

    const path = require('path');
    const fs = require('fs');
    const promptPath = path.join(
      process.cwd(),
      '..',
      'backend',
      'orchestrator',
      'src',
      'aspire_orchestrator',
      'config',
      'pack_personas',
      'ava_anam_video_prompt.md',
    );
    let promptTemplate = '';
    try {
      promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch {
      promptTemplate = '';
    }

    const promptValidationIssues = validateAnamAvaPromptAndConfig(promptTemplate, CONFIGURED_ANAM_AVA_PERSONA_ID);
    const toolValidation = await fetchAnamPersonaToolsForValidation(CANONICAL_ANAM_AVA_PERSONA_ID, ANAM_API_KEY);
    const names = toolValidation.tools.map((tool) => String(tool?.name || '').trim()).filter(Boolean);
    const counts = names.reduce<Record<string, number>>((acc, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      personaId: CANONICAL_ANAM_AVA_PERSONA_ID,
      configuredPersonaId: CONFIGURED_ANAM_AVA_PERSONA_ID,
      attachedToolCount: toolValidation.tools.length,
      duplicateTools: Object.entries(counts)
        .filter(([, count]) => count > 1)
        .map(([name, count]) => ({ name, count })),
      promptValidationIssues,
      toolValidationIssues: toolValidation.issues,
      ok: promptValidationIssues.length === 0 && toolValidation.issues.length === 0,
    });
  } catch (error: unknown) {
    logger.error('Anam persona health endpoint failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return res.status(500).json({ error: 'ANAM_PERSONA_HEALTH_FAILED', message: 'Failed to inspect Anam persona health' });
  }
});

router.post('/api/anam/session', async (req: Request, res: Response) => {
  try {
    // Law #3: Fail Closed — require authenticated user for avatar sessions
    const userId = (req as any).authenticatedUserId;
    if (!userId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required for avatar sessions' });
    }

    const ANAM_API_KEY = process.env.ANAM_API_KEY;

    if (!ANAM_API_KEY) {
      return res.status(503).json({ error: 'AVATAR_NOT_CONFIGURED', message: 'Avatar API key not configured' });
    }

    // Determine which persona — Finn or Ava (default)
    // Use EPHEMERAL persona config (not stateful ID) to avoid legacy token type.
    // Anam SDK v4.8 rejects legacy tokens — ephemeral returns type: "ephemeral".
    const requestedPersona = req.body?.persona;
    const resolvedPersona: 'ava' | 'finn' = requestedPersona === 'finn' ? 'finn' : 'ava';

    // Ava: Cara avatar + Hope voice, Finn: custom avatar + voice
    // llmId: Custom LLM registered with Anam → routes to /v1/chat/completions (Law #1: Single Brain)
    // Fallback stays server-side/hosted only; there is no client-side SDK brain routing fallback.
    const ANAM_HOSTED_LLM_ID = 'b4f89001-9638-4879-a9c3-02cc9f9f2004';
    const ANAM_CUSTOM_LLM_ID = process.env.ANAM_CUSTOM_LLM_ID || ANAM_HOSTED_LLM_ID;
    const suiteId = (req as any).authenticatedSuiteId || '';
    const officeId = getDefaultOfficeId() || suiteId;
    const requestedProfile = req.body?.profile || {};

    // Fetch user profile for personalized prompt
    let ownerName = sanitizeText(requestedProfile.ownerName) || '';
    let businessName = sanitizeText(requestedProfile.businessName) || '';
    let salutation = sanitizeText(requestedProfile.salutation) || '';
    let lastName = sanitizeText(requestedProfile.lastName) || '';
    let industry = sanitizeText(requestedProfile.industry) || '';
    let gender = sanitizeText(requestedProfile.gender) || '';
    const hasCamera = !!requestedProfile.hasCamera;
    const fallbackFirstName = sanitizeText(requestedProfile.firstName) || '';

    try {
      if (supabaseAdmin) {
        const { data: profile } = await supabaseAdmin
          .from('suite_profiles')
          .select('owner_name, business_name, industry, gender')
          .eq('suite_id', suiteId)
          .maybeSingle();
        if (profile) {
          ownerName = profile.owner_name || ownerName;
          businessName = profile.business_name || businessName;
          industry = profile.industry || industry;
          gender = profile.gender || gender;
        }
      }
    } catch { /* profile fetch is non-fatal */ }

    const parts = ownerName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || fallbackFirstName || '';
    if (!lastName) lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    
    // Improved salutation logic based on gender
    if (!salutation && lastName) {
      if (gender?.toLowerCase() === 'male') salutation = 'Mr.';
      else if (gender?.toLowerCase() === 'female') salutation = 'Ms.';
      else salutation = 'Mr.'; // Default to Mr. if unknown but lastName exists
    }

    // Load the video prompt from file, with user info baked in
    const fs = require('fs');
    const path = require('path');
    let videoPrompt = '';
    try {
      const promptPath = path.join(process.cwd(), '..', 'backend', 'orchestrator', 'src', 'aspire_orchestrator', 'config', 'pack_personas', 'ava_anam_video_prompt.md');
      videoPrompt = fs.readFileSync(promptPath, 'utf-8');
    } catch {
      // Fallback: use inline prompt if file not found (e.g., Railway deploy)
      videoPrompt = `You are Ava, the executive assistant and chief of staff. You are on a live video call. Keep responses to one to three sentences. Help the user get things done quickly.`;
    }

    const now = new Date();
    const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Replace template variables with actual user info
    videoPrompt = videoPrompt
      .replace(/\{\{business_name\}\}/g, businessName || 'your company')
      .replace(/\{\{salutation\}\}/g, salutation)
      .replace(/\{\{last_name\}\}/g, lastName)
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{owner_name\}\}/g, ownerName)
      .replace(/\{\{gender\}\}/g, gender || 'unknown')
      .replace(/\{\{industry\}\}/g, industry || 'General')
      .replace(/\{\{date\}\}/g, fullDate)
      .replace(/\{\{has_camera\}\}/g, hasCamera ? 'true' : 'false')
      .replace(/\{\{time_of_day\}\}/g, now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening');

    // Keep Ava session config persona-driven to prevent stale hardcoded IDs
    // (voice/tool/document) from breaking engine/session startup.
    const AVA_CONFIG = {
      name: 'Ava',
      personaId: CONFIGURED_ANAM_AVA_PERSONA_ID,
      systemPrompt: videoPrompt,
      skipGreeting: false,
      maxSessionLengthSeconds: 1800,
      voiceDetectionOptions: {
        endOfSpeechSensitivity: 0.7,
        silenceBeforeSkipTurnSeconds: 8,
        silenceBeforeAutoEndTurnSeconds: 1.5,
        speechEnhancementLevel: 0.5,
      },
      voiceGenerationOptions: {
        speed: 1.05,
        stability: 0.5,
        similarityBoost: 0.75,
      },
    };
    const avaConfigValidationErrors = validateAnamAvaPromptAndConfig(
      AVA_CONFIG.systemPrompt,
      AVA_CONFIG.personaId,
    );
    if (avaConfigValidationErrors.length > 0) {
      const strictAnamPromptValidation = process.env.ANAM_PROMPT_STRICT_VALIDATION === 'true';
      logger.error('Anam Ava prompt/config validation failed', {
        strict: strictAnamPromptValidation,
        errors: avaConfigValidationErrors,
      });
      if (strictAnamPromptValidation) {
        return res.status(503).json({
          error: 'ANAM_AVA_CONFIG_INVALID',
          message: 'Ava video configuration validation failed',
          details: avaConfigValidationErrors,
        });
      }
    }
    if (resolvedPersona === 'ava') {
      const strictAnamToolValidation = process.env.ANAM_TOOLSET_STRICT_VALIDATION === 'true';
      const toolValidation = await fetchAnamPersonaToolsForValidation(CANONICAL_ANAM_AVA_PERSONA_ID, ANAM_API_KEY);
      if (toolValidation.issues.length > 0) {
        logger.error('Anam Ava tool validation failed', {
          strict: strictAnamToolValidation,
          issueCount: toolValidation.issues.length,
          issues: toolValidation.issues,
        });
        if (strictAnamToolValidation) {
          return res.status(503).json({
            error: 'ANAM_AVA_TOOLSET_INVALID',
            message: 'Ava toolset validation failed',
            details: toolValidation.issues,
          });
        }
      }
    }
    const finnCtx = `[ASPIRE_CTX:suite_id=${suiteId},user_id=${userId},office_id=${officeId},agent=finn]`;
    const FINN_CONFIG = {
      name: 'Finn',
      avatarId: req.body?.avatarId || '42c2c36e-3e22-4750-881e-8c8e6d14acb1',   // Thomas (new Anam account)
      voiceId: req.body?.voiceId || '7db5f408-833c-49ce-97aa-eaec17077a4c',     // Jack John
      llmId: ANAM_CUSTOM_LLM_ID,
      systemPrompt: `${finnCtx}

[ROLE]
You are Finn, the Finance Hub Manager for a small business owner using Aspire. You are the strategic financial intelligence layer — you read data, analyze trends, draft proposals, and give strategic advice. Aspire does not move money — no payments, no transfers, no charges. When money needs to move, you help the owner understand what to do and where to do it, but execution happens outside of Aspire.

[PERSONALITY]
Calm, direct, and numbers-first — like a trusted CFO who explains things in plain English. Skeptical of stale or incomplete data — always flag what you do not know. Light financial humor where appropriate, never formal corporate-speak. Address the user by name when available.

[SPEAKING STYLE]
You are speaking over a live video call. Keep responses to one to three sentences. Never more than fifty words unless the user asks for detail.
Lead with the financial truth first, then your recommendation, then the next step.
Use natural speech: "Here's the thing," "Not bad actually," "Worth keeping an eye on," "Let me break that down."
Spell out numbers and symbols: say "twenty-five thousand dollars" not "$25K," say "percent" not "%."
Never use markdown, bullet points, headers, bold, or any formatting. Your words will be spoken aloud by a text-to-speech engine.
If you hear a word that sounds wrong, silently correct it — the user's speech may have been slightly mistranscribed.

[GOAL]
Help the business owner understand their financial position, make smart money decisions, and stay ahead of risks. Analyze cash flow, flag anomalies, provide tax guidance, and draft financial recommendations.
When a question crosses into another domain, route explicitly: "That's really a Clara question since it involves contract terms. Want me to pull her in?"
Always distinguish between what you know from data versus what you are estimating.

[GUARDRAILS]
Never break character. You are always Finn.
Aspire does not move money. Never claim or imply that Aspire can process payments, transfers, or charges. This is a hard platform boundary, not just yours.
Never fabricate numeric values. If data is missing or stale, say so plainly.
Never provide licensed professional tax or legal advice — recommend consulting a professional for complex cases.
Never include raw data, JSON, code blocks, or technical schemas in your speech.
Never mention being an AI, a language model, or a chatbot. If asked, say: "I'm Finn, your finance manager here in Aspire."
When giving tax guidance, always include confidence level: "This is well-established" versus "This is a gray area — run it by your accountant."`,
      skipGreeting: true,      // Client sends personalized greeting
      avatarModel: 'cara-3',   // Latest model: sharper video, better lip sync
      maxSessionLengthSeconds: 1800,
      voiceDetectionOptions: {
        endOfSpeechSensitivity: 0.7,        // Moderately eager — faster response, minimal false triggers
        silenceBeforeSkipTurnSeconds: 8,
        silenceBeforeAutoEndTurnSeconds: 1.5, // Respond after 1.5s pause (was 6s — major latency win)
        speechEnhancementLevel: 0.5,         // Noise filtering for better STT accuracy
      },
      voiceGenerationOptions: {
        speed: 1.0,
        stability: 0.65,        // More stable for numbers delivery — deliberate CFO tone
        similarityBoost: 0.75,  // Strong voice identity consistency
      },
    };

    const personaConfig = resolvedPersona === 'finn' ? FINN_CONFIG : AVA_CONFIG;
    const agent = resolvedPersona === 'finn' ? 'Finn' : 'Ava';

    const requestSessionToken = async (config: Record<string, unknown>) => {
      const tokenResponse = await fetch('https://api.anam.ai/v1/auth/session-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ANAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personaConfig: config }),
      });
      const rawText = await tokenResponse.text();
      return { tokenResponse, rawText };
    };

    let { tokenResponse: response, rawText: responseText } = await requestSessionToken(personaConfig as unknown as Record<string, unknown>);
    if (!response.ok) {
      const retriableByPersonaDrift = resolvedPersona === 'ava' && response.status >= 400 && response.status < 500;
      if (retriableByPersonaDrift) {
        const fallbackConfig = { ...(personaConfig as Record<string, unknown>) };
        delete fallbackConfig.personaId;
        const fallbackResult = await requestSessionToken(fallbackConfig);
        if (fallbackResult.tokenResponse.ok) {
          response = fallbackResult.tokenResponse;
          responseText = fallbackResult.rawText;
          logger.warn('Anam session token recovered after dropping personaId', {
            persona: agent,
            originalPersonaId: (personaConfig as Record<string, unknown>).personaId,
            configuredPersonaId: CONFIGURED_ANAM_AVA_PERSONA_ID,
          });
        } else {
          logger.error('Anam session token fallback failed', {
            status: fallbackResult.tokenResponse.status,
            persona: agent,
            avatarId: (personaConfig as Record<string, unknown>).avatarId,
            error: fallbackResult.rawText.substring(0, 500),
          });
        }
      }
    }

    if (!response.ok) {
      logger.error('Anam session token API error', {
        status: response.status,
        persona: agent,
        avatarId: (personaConfig as Record<string, unknown>).avatarId,
        error: responseText.substring(0, 500),
      });
      return res.status(502).json({
        error: 'AVATAR_SESSION_FAILED',
        message: `Avatar service error (Anam API ${response.status})`,
        anamStatus: response.status,
      });
    }

    let data: { sessionToken?: string } = {};
    try {
      data = JSON.parse(responseText || '{}') as { sessionToken?: string };
    } catch {
      data = {};
    }
    if (!data.sessionToken) {
      logger.error('Anam returned no session token', { responseKeys: Object.keys(data), persona: resolvedPersona });
      return res.status(502).json({ error: 'AVATAR_NO_TOKEN', message: 'Avatar service returned invalid response' });
    }

    logger.info('Anam session token obtained', { persona: resolvedPersona, tokenLength: data.sessionToken.length });

    // Return only the session token — no API key exposure
    res.json({ sessionToken: data.sessionToken });
  } catch (error: unknown) {
    logger.error('Avatar session error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'AVATAR_ERROR', message: 'Avatar service error' });
  }
});

// This replaces CUSTOMER_CLIENT_V1 — Anam servers call us directly (server-to-server),
// eliminating the broken client-side round-trip.

router.post('/v1/chat/completions', async (req: Request, res: Response) => {
  const correlationId = `anam-llm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Step 1: Validate shared secret (Law #3: Fail Closed)
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
    const expectedSecret = process.env.ANAM_LLM_SECRET || '';

    if (!expectedSecret) {
      logger.error('Anam LLM endpoint: ANAM_LLM_SECRET not configured', { correlationId });
      return res.status(503).json({ error: { message: 'LLM endpoint not configured', type: 'server_error' } });
    }

    if (!bearerToken || !secureTokenEquals(bearerToken, expectedSecret)) {
      logger.warn('Anam LLM endpoint: invalid secret', { correlationId });
      return res.status(401).json({ error: { message: 'Invalid API key', type: 'authentication_error' } });
    }

    // Step 2: Parse OpenAI Chat Completions request
    const { messages, stream } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: 'messages array is required', type: 'invalid_request_error' } });
    }

    // Extract system message (contains ASPIRE_CTX + persona instructions)
    const systemMsg = messages.find((m: any) => m.role === 'system');
    const systemContent = typeof systemMsg?.content === 'string' ? systemMsg.content : '';

    // Parse [ASPIRE_CTX:suite_id=xxx,user_id=yyy,office_id=zzz,agent=aaa]
    const ctxMatch = systemContent.match(/\[ASPIRE_CTX:([^\]]+)\]/);
    let suiteId = '';
    let userId = '';
    let officeId = '';
    let agentName = 'ava';

    if (ctxMatch) {
      const ctxPairs = ctxMatch[1].split(',');
      for (const pair of ctxPairs) {
        const [key, val] = pair.split('=').map((s: string) => s.trim());
        if (key === 'suite_id') suiteId = val;
        else if (key === 'user_id') userId = val;
        else if (key === 'office_id') officeId = val;
        else if (key === 'agent') agentName = val;
      }
    }

    if (!suiteId || !userId) {
      logger.warn('Anam LLM endpoint: missing tenant context in system prompt', { correlationId, hasCtx: !!ctxMatch });
      return res.status(400).json({ error: { message: 'Missing tenant context', type: 'invalid_request_error' } });
    }

    // Extract the last user message (what the user just said)
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const lastUserMsg = userMessages[userMessages.length - 1];
    const utterance = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content.trim() : '';

    if (!utterance) {
      return res.status(400).json({ error: { message: 'No user message found', type: 'invalid_request_error' } });
    }

    // Build conversation history from messages (skip system, take last 10 exchanges)
    const history = messages
      .filter((m: any) => m.role !== 'system')
      .slice(-20)
      .map((m: any) => ({ role: m.role, content: m.content }));

    // Step 3: Fetch user profile for personalization (server-side lookup)
    let profileContext: Record<string, any> | undefined;
    if (supabaseAdmin) {
      try {
        const { data: sp } = await supabaseAdmin
          .from('suite_profiles')
          .select('owner_name, business_name, industry, team_size, industry_specialty, business_goals, pain_point, preferred_channel')
          .eq('suite_id', suiteId)
          .single();
        if (sp) {
          profileContext = {
            owner_name: sp.owner_name,
            business_name: sp.business_name,
            industry: sp.industry,
            team_size: sp.team_size,
            industry_specialty: sp.industry_specialty,
            business_goals: sp.business_goals,
            pain_point: sp.pain_point,
            preferred_channel: sp.preferred_channel,
          };
        }
      } catch {
        logger.warn('Anam LLM: suite_profiles lookup failed (non-fatal)', { correlationId, suiteId });
      }
    }

    // Step 4: Call orchestrator (Law #1: Single Brain decides)
    const ORCHESTRATOR_URL = resolveOrchestratorUrl();
    if (!ORCHESTRATOR_URL) {
      return res.status(503).json({ error: { message: 'Orchestrator not configured', type: 'server_error' } });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS);

    const orchResponse = await fetch(`${ORCHESTRATOR_URL}/v1/intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Office-Id': officeId || suiteId,
        'X-Actor-Id': userId,
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify({
        text: utterance,
        agent: agentName,
        requested_agent: agentName,
        channel: 'avatar',
        message_history: history,
        user_profile: profileContext,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseText = "I'm here to help. Could you repeat that?";
    if (orchResponse.ok) {
      const data = await orchResponse.json();
      responseText = data.text || data.message || responseText;
    } else {
      const errorText = await orchResponse.text();
      logger.error('Anam LLM: orchestrator error', { correlationId, status: orchResponse.status, error: errorText.substring(0, 200) });
      responseText = 'Let me try that again in a moment.';
    }

    // Step 5: Return response in OpenAI Chat Completions format
    const completionId = `chatcmpl-${correlationId}`;
    const created = Math.floor(Date.now() / 1000);

    if (stream) {
      // SSE streaming format (what Anam expects)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send the full response as one chunk (orchestrator is non-streaming)
      // Anam's TTS processes this into speech — chunking adds unnecessary latency.
      const chunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: 'aspire-orchestrator',
        choices: [{
          index: 0,
          delta: { role: 'assistant', content: responseText },
          finish_reason: null,
        }],
      };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      // Send finish chunk
      const finishChunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created,
        model: 'aspire-orchestrator',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };
      res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming response
      res.json({
        id: completionId,
        object: 'chat.completion',
        created,
        model: 'aspire-orchestrator',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: responseText },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    }

    logger.info('Anam LLM: response sent', {
      correlationId,
      suiteId,
      agent: agentName,
      stream: !!stream,
      responseLength: responseText.length,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Anam LLM: orchestrator timeout', { correlationId });
      return res.status(504).json({ error: { message: 'Request timeout', type: 'server_error' } });
    }
    logger.error('Anam LLM endpoint error', { correlationId, error: error instanceof Error ? error.message : 'unknown' });
    return res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
  }
});

// ─── Mail Onboarding API (Local Service) ───
// Enterprise-grade: Auth required, input validated, fail-closed

import { buildAuthUrl, handleCallback, getValidToken } from './mail/googleOAuth';
import * as onboarding from './mail/onboardingService';
import { createTrustSpineReceipt } from './receiptService';
import * as imapClient from './mail/imapClient';
import * as gmailClient from './mail/gmailClient';

// ─── Validation Helpers (Law #3: Fail Closed) ───

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const EMAIL_LOCAL_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

function isValidUUID(s: string): boolean { return UUID_RE.test(s); }
function isValidDomain(s: string): boolean { return DOMAIN_RE.test(s) && s.length <= 253; }
function isValidLocalPart(s: string): boolean { return EMAIL_LOCAL_RE.test(s) && s.length <= 64; }

/** Extract and validate suite_id from authenticated request. Returns null + sends 401 if missing. */
function requireAuth(req: Request, res: Response): string | null {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
    return null;
  }
  return suiteId;
}

/** Validate jobId from URL params. Returns null + sends 400 if invalid. */
function requireJobId(req: Request, res: Response): string | null {
  const jobId = getParam(req.params.jobId);
  if (!jobId || !isValidUUID(jobId)) {
    res.status(400).json({ error: 'INVALID_JOB_ID', message: 'Valid job ID required' });
    return null;
  }
  return jobId;
}

// Rate limiter for onboarding (5 starts per minute per suite)
const onboardingRateMap = new Map<string, { count: number; resetAt: number }>();
function checkOnboardingRate(suiteId: string): boolean {
  const now = Date.now();
  const entry = onboardingRateMap.get(suiteId);
  if (!entry || now > entry.resetAt) {
    onboardingRateMap.set(suiteId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

const DOMAIN_RAIL_URL = process.env.DOMAIN_RAIL_URL || 'https://domain-rail-production.up.railway.app';

/**
 * Build S2S HMAC headers matching Domain Rail auth.ts format exactly:
 *   x-aspire-timestamp: unix seconds
 *   x-aspire-nonce: random hex string (replay protection)
 *   x-aspire-signature: HMAC-SHA256 of `${timestamp}.${nonce}.${METHOD}.${pathAndQuery}.${sha256(rawBody)}`
 */
function getDomainRailS2SHeaders(
  method: string,
  pathAndQuery: string,
  rawBody: string,
  suiteId?: string,
): Record<string, string> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) throw new Error('DOMAIN_RAIL_HMAC_SECRET not configured');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const base = `${timestamp}.${nonce}.${method.toUpperCase()}.${pathAndQuery}.${bodyHash}`;
  const signature = crypto.createHmac('sha256', secret).update(base).digest('hex');

  return {
    'Content-Type': 'application/json',
    'x-aspire-timestamp': timestamp,
    'x-aspire-nonce': nonce,
    'x-aspire-signature': signature,
    'x-suite-id': suiteId || '',
    'x-correlation-id': `corr_${crypto.randomUUID()}`,
  };
}

async function domainRailProxy(method: string, path: string, body?: any, suiteId?: string, extraHeaders?: Record<string, string>): Promise<{ status: number; data: any }> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) return { status: 503, data: { error: 'DOMAIN_RAIL_HMAC_SECRET not configured' } };
  if (!supabaseAdmin) return { status: 503, data: { error: 'Supabase not configured' } };

  // Mint a short-lived capability token for Domain Rail (Law #5)
  const correlationId = `corr_${crypto.randomUUID()}`;
  const { data: tokenResult, error: tokenErr } = await supabaseAdmin.rpc('trust_issue_capability_token', {
    p_suite_id: suiteId,
    p_office_id: suiteId, // office_id defaults to suite for now
    p_scope: 'domain-rail',
    p_ttl_seconds: 60,
    p_correlation_id: correlationId,
    p_requested_action: { method, path },
    p_metadata: {},
  });
  if (tokenErr || !tokenResult?.token) {
    return { status: 503, data: { error: 'Failed to mint capability token' } };
  }

  const bodyStr = body ? JSON.stringify(body) : '';
  const url = `${DOMAIN_RAIL_URL}${path}`;
  const headers = getDomainRailS2SHeaders(method, path, bodyStr, suiteId);
  headers['x-aspire-capability-token'] = tokenResult.token;
  headers['x-correlation-id'] = correlationId;
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers[k] = v;
  }
  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') opts.body = bodyStr;
  const response = await fetch(url, opts);
  const data = await response.json().catch(() => ({ error: 'Invalid response from Domain Rail' }));
  return { status: response.status, data };
}

// ─── Calendar Events API (Law #2: Receipts, Law #4: Risk Tiers, Law #6: RLS) ───

// Rate limiter for calendar creates: 10 per minute per suite
const calendarRateMap = new Map<string, { count: number; resetAt: number }>();
function checkCalendarRate(suiteId: string): boolean {
  const now = Date.now();
  const entry = calendarRateMap.get(suiteId);
  if (!entry || now > entry.resetAt) {
    calendarRateMap.set(suiteId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const CALENDAR_EVENT_TYPES = ['meeting', 'task', 'reminder', 'call', 'deadline', 'other'] as const;
const CALENDAR_SOURCES = ['manual', 'ava', 'booking', 'google_calendar', 'import'] as const;

// GET /api/calendar/events — list calendar events for suite (GREEN)
router.get('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const result = await db.execute(sql`
      SELECT * FROM calendar_events
      WHERE suite_id = ${suiteId}
      ORDER BY start_time ASC
      LIMIT 100`);
    res.json({ events: result.rows });
  } catch (e: unknown) {
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar/events — create calendar event (YELLOW — Law #4)
router.post('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    if (!checkCalendarRate(suiteId)) {
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many calendar creates. Please wait.' });
    }

    const { title, description, event_type, start_time, end_time, duration_minutes, location, participants, is_all_day, source, source_ref, created_by } = req.body;

    // Validate required fields (Law #3: Fail Closed)
    const cleanTitle = sanitizeText(title);
    if (!cleanTitle || cleanTitle.length > 500) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Title required (max 500 chars)' });
    }
    if (!start_time || isNaN(Date.parse(start_time))) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Valid start_time (ISO 8601) required' });
    }
    const validType = validateEnum(event_type, [...CALENDAR_EVENT_TYPES]) || 'meeting';
    const validSource = validateEnum(source, [...CALENDAR_SOURCES]) || 'manual';

    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const cleanDesc = sanitizeText(description);
    const cleanLoc = sanitizeText(location);
    const cleanSourceRef = sanitizeText(source_ref);
    const cleanCreatedBy = sanitizeText(created_by);
    const cleanParticipants = sanitizeArray(participants);
    const participantsPgArray = cleanParticipants.length > 0
      ? `{${cleanParticipants.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`
      : null;

    const result = await db.execute(sql`
      INSERT INTO calendar_events (suite_id, title, description, event_type, start_time, end_time, duration_minutes, location, participants, is_all_day, source, source_ref, created_by)
      VALUES (${suiteId}, ${cleanTitle}, ${cleanDesc}, ${validType}, ${start_time}, ${end_time || null}, ${duration_minutes || null}, ${cleanLoc}, ${participantsPgArray}::text[], ${is_all_day || false}, ${validSource}, ${cleanSourceRef}, ${cleanCreatedBy})
      RETURNING *`);

    // Emit receipt (Law #2) — matches receipts table schema
    const receiptId = crypto.randomBytes(16).toString('hex');
    const receiptAction = JSON.stringify({ type: 'calendar.event.create', title: cleanTitle, event_type: validType, start_time, source: validSource });
    const receiptResult = JSON.stringify({ outcome: 'success', event_id: result.rows[0]?.id });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.create', ${receiptAction}::jsonb, ${receiptResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar receipt write failed (event created)', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.status(201).json({ event: result.rows[0], receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar create error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// PUT /api/calendar/events/:id — update calendar event (YELLOW — Law #4)
router.put('/api/calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const eventId = getParam(req.params.id);
    if (!eventId || !isValidUUID(eventId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Valid event UUID required' });
    }

    const { title, description, event_type, start_time, end_time, duration_minutes, location, participants, is_all_day } = req.body;

    // Validate if provided
    if (title !== undefined) {
      const cleanTitle = sanitizeText(title);
      if (!cleanTitle || cleanTitle.length > 500) {
        return res.status(400).json({ error: 'INVALID_INPUT', message: 'Title must be 1-500 chars' });
      }
    }
    if (start_time !== undefined && isNaN(Date.parse(start_time))) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Valid start_time (ISO 8601) required' });
    }
    if (event_type !== undefined && !validateEnum(event_type, [...CALENDAR_EVENT_TYPES])) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid event_type' });
    }

    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await db.execute(sql`
      UPDATE calendar_events SET
        title = COALESCE(${sanitizeText(title)}, title),
        description = COALESCE(${description !== undefined ? sanitizeText(description) : null}, description),
        event_type = COALESCE(${event_type !== undefined ? validateEnum(event_type, [...CALENDAR_EVENT_TYPES]) : null}, event_type),
        start_time = COALESCE(${start_time || null}, start_time),
        end_time = COALESCE(${end_time !== undefined ? end_time : null}, end_time),
        duration_minutes = COALESCE(${duration_minutes !== undefined ? duration_minutes : null}, duration_minutes),
        location = COALESCE(${location !== undefined ? sanitizeText(location) : null}, location),
        participants = COALESCE(${participants !== undefined ? (sanitizeArray(participants).length > 0 ? `{${sanitizeArray(participants).map((p: string) => `"${p.replace(/"/g, '\\"')}"`).join(',')}}` : null) : null}::text[], participants),
        is_all_day = COALESCE(${is_all_day !== undefined ? is_all_day : null}, is_all_day),
        updated_at = NOW()
      WHERE id = ${eventId} AND suite_id = ${suiteId}
      RETURNING *`);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Calendar event not found' });
    }

    // Emit receipt (Law #2) — matches receipts table schema
    const receiptId = crypto.randomBytes(16).toString('hex');
    const updReceiptAction = JSON.stringify({ type: 'calendar.event.update', event_id: eventId, fields_updated: Object.keys(req.body) });
    const updReceiptResult = JSON.stringify({ outcome: 'success' });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.update', ${updReceiptAction}::jsonb, ${updReceiptResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar update receipt write failed', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.json({ event: result.rows[0], receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar update error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// DELETE /api/calendar/events/:id — delete calendar event (YELLOW — Law #4)
router.delete('/api/calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const eventId = getParam(req.params.id);
    if (!eventId || !isValidUUID(eventId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Valid event UUID required' });
    }

    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await db.execute(sql`
      DELETE FROM calendar_events
      WHERE id = ${eventId} AND suite_id = ${suiteId}
      RETURNING id`);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Calendar event not found' });
    }

    // Emit receipt (Law #2) — matches receipts table schema
    const receiptId = crypto.randomBytes(16).toString('hex');
    const delReceiptAction = JSON.stringify({ type: 'calendar.event.delete', event_id: eventId });
    const delReceiptResult = JSON.stringify({ outcome: 'success' });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.delete', ${delReceiptAction}::jsonb, ${delReceiptResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar delete receipt write failed', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.json({ success: true, receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar delete error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// PATCH /api/calendar/events/:id/complete — mark event as completed (YELLOW)
router.patch('/api/calendar/events/:id/complete', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const eventId = req.params.id as string;
    if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const { status: newStatus } = req.body || {};
    const validStatuses = ['completed', 'cancelled', 'pending', 'in_progress'];
    const targetStatus = validStatuses.includes(newStatus) ? newStatus : 'completed';
    const completedAt = (targetStatus === 'completed') ? new Date().toISOString() : null;

    const result = await db.execute(sql`
      UPDATE calendar_events SET
        status = ${targetStatus},
        completed_at = ${completedAt},
        updated_at = NOW()
      WHERE id = ${eventId} AND suite_id = ${suiteId}
      RETURNING *`);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Emit receipt (Law #2)
    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-complete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const receiptId = crypto.randomBytes(16).toString('hex');
    const completeAction = JSON.stringify({ type: 'calendar.event.complete', event_id: eventId, new_status: targetStatus });
    const completeResult = JSON.stringify({ outcome: 'success', previous_status: 'pending' });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.complete', ${completeAction}::jsonb, ${completeResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar complete receipt write failed', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.json({ event: result.rows[0], receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar complete error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

// GET /api/calendar/today — today's events merged from calendar_events + bookings (GREEN)
router.get('/api/calendar/today', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;

    const [calResult, bookResult] = await Promise.all([
      db.execute(sql`
        SELECT * FROM calendar_events
        WHERE suite_id = ${suiteId}
          AND start_time::date = CURRENT_DATE
        ORDER BY start_time ASC`),
      db.execute(sql`
        SELECT * FROM bookings
        WHERE suite_id = ${suiteId}
          AND scheduled_at::date = CURRENT_DATE
        ORDER BY scheduled_at ASC`),
    ]);

    const calEvents = (calResult.rows as any[]).map(e => ({
      ...e,
      _source: 'calendar',
    }));

    const bookEvents = (bookResult.rows as any[]).map(b => ({
      id: b.id,
      suite_id: b.suite_id,
      title: `Booking: ${b.client_name || 'Client'}`,
      description: b.client_notes || null,
      event_type: 'meeting',
      start_time: b.scheduled_at,
      end_time: b.scheduled_at && b.duration ? new Date(new Date(b.scheduled_at).getTime() + b.duration * 60_000).toISOString() : null,
      duration_minutes: b.duration,
      location: null,
      participants: [b.client_email].filter(Boolean),
      is_all_day: false,
      source: 'booking',
      source_ref: b.id,
      created_at: b.created_at,
      updated_at: b.updated_at,
      _source: 'booking',
      _booking_status: b.status,
      _booking_amount: b.amount,
    }));

    const merged = [...calEvents, ...bookEvents].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    res.json({ events: merged });
  } catch (e: unknown) {
    logger.error('Calendar today error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to fetch today\'s events' });
  }
});

// GET /api/mail/accounts — list connected mail accounts
router.get('/api/mail/accounts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const accounts = await onboarding.listAccounts(suiteId);
    res.json({ accounts });
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch accounts' }); }
});

// DELETE /api/mail/accounts/:accountId — disconnect/remove mailbox account
router.delete('/api/mail/accounts/:accountId', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const accountId = String(req.params.accountId || '').trim();
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });

    const result = await onboarding.removeAccount(suiteId, accountId);
    if (!result.removed) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.account.removed',
      status: 'SUCCEEDED',
      actorType: 'USER',
      actorId: (req as any).authenticatedUserId || undefined,
      action: { operation: 'remove_mail_account', account_id: accountId, risk_tier: 'YELLOW' },
      result: { removed: true },
    }).catch(() => {});

    res.json({ removed: true });
  } catch (e: unknown) {
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

// GET /api/mail/receipts — list mail receipts
router.get('/api/mail/receipts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const receipts = await onboarding.listMailReceipts(suiteId);
    res.json({ receipts });
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch receipts' }); }
});

// ─── /v1/* Mail Onboarding API (Local Service) ───

// GET /v1/inbox/accounts
router.get('/v1/inbox/accounts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const accounts = await onboarding.listAccounts(suiteId);
    res.json({ accounts });
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch accounts' }); }
});

// POST /v1/mail/onboarding/start (YELLOW — external service setup)
router.post('/v1/mail/onboarding/start', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const officeId = (req as any).authenticatedOfficeId || getDefaultOfficeId();
    if (!checkOnboardingRate(suiteId)) {
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many onboarding requests. Try again in 1 minute.' });
    }
    const { provider, context } = req.body;
    if (!provider || !['POLARIS', 'GOOGLE'].includes(provider)) {
      return res.status(400).json({ error: 'INVALID_PROVIDER', message: 'provider must be POLARIS or GOOGLE' });
    }
    const result = await onboarding.startOnboarding(suiteId, officeId, provider, context);

    // Law #2: Receipt for mail onboarding start (YELLOW — external service setup)
    await createTrustSpineReceipt({
      suiteId,
      officeId,
      receiptType: 'mail.onboarding.start',
      status: 'SUCCEEDED',
      actorType: 'USER',
      actorId: (req as any).authenticatedUserId || undefined,
      action: { operation: 'start_mail_onboarding', provider, risk_tier: 'YELLOW' },
      result: { job_id: (result as any)?.jobId || (result as any)?.id },
    }).catch(() => {});

    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'Onboarding start failed' }); }
});

// GET /v1/mail/onboarding/:jobId
router.get('/v1/mail/onboarding/:jobId', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const data = await onboarding.getOnboarding(jobId, suiteId);
    res.json(data);
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch onboarding status' }); }
});

// POST /v1/mail/onboarding/:jobId/dns/plan
router.post('/v1/mail/onboarding/:jobId/dns/plan', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const { domain, mailbox, displayName, domainMode } = req.body;
    if (domain && !isValidDomain(domain)) {
      return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Invalid domain format' });
    }
    if (mailbox && !isValidLocalPart(mailbox)) {
      return res.status(400).json({ error: 'INVALID_MAILBOX', message: 'Invalid mailbox name' });
    }
    const result = await onboarding.generateDnsPlan(jobId, suiteId, domain, mailbox, displayName, domainMode);
    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'DNS plan generation failed' }); }
});

// POST /v1/mail/onboarding/:jobId/dns/check
router.post('/v1/mail/onboarding/:jobId/dns/check', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const result = await onboarding.checkDns(jobId, suiteId);
    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'DNS check failed' }); }
});

// GET /v1/domains/search — proxy to Domain Rail (needs static IP for ResellerClub)
router.get('/v1/domains/search', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const q = (req.query.q as string || '').trim();
    if (!q || q.length > 253) return res.status(400).json({ error: 'INVALID_QUERY', message: 'Valid search query required' });

    // Build canonical domain (add .com if no TLD provided)
    const domain = q.includes('.') ? q : `${q}.com`;
    const dotIdx = domain.indexOf('.');
    const tld = dotIdx > 0 ? domain.substring(dotIdx + 1) : 'com';

    // Proxy to Domain Rail — only Domain Rail's static IP is whitelisted at ResellerClub
    const drResult = await domainRailProxy('GET', `/v1/domains/check?domain=${encodeURIComponent(domain)}`, undefined, suiteId);
    const rawData: Record<string, any> = drResult.data?.data || {};

    // Transform RC response into DomainSearchResult[] format
    const results: Array<{ domain: string; available: boolean; price: string; currency: string; tld: string; term: number }> = [];
    for (const [rcKey, info] of Object.entries(rawData)) {
      const domainInfo = info as any;
      const rcStatus = typeof domainInfo === 'string' ? domainInfo : domainInfo?.status;
      if (!rcStatus) continue;
      const priceVal = typeof domainInfo === 'object' ? (domainInfo.price || domainInfo.sellingprice) : undefined;
      results.push({
        domain: rcKey.includes('.') ? rcKey : `${rcKey}.${tld}`,
        available: rcStatus === 'available',
        price: priceVal || '12.99',
        currency: (typeof domainInfo === 'object' ? domainInfo.currency : undefined) || 'USD',
        tld,
        term: 1,
      });
    }

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.domain.search',
      status: 'SUCCEEDED',
      action: { operation: 'domain_search', query: q },
      result: { resultCount: results.length },
    }).catch(() => {});

    res.json({ query: q, results });
  } catch (e: unknown) { res.status(500).json({ error: 'Domain search failed' }); }
});

// POST /v1/domains/purchase/request — proxy to Domain Rail (RED tier — explicit authority)
router.post('/v1/domains/purchase/request', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    if (!req.body?.domain || !isValidDomain(req.body.domain)) {
      return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Valid domain required' });
    }
    const { status, data } = await domainRailProxy('POST', '/v1/domains', req.body, suiteId);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.domain.purchase_requested',
      status: status < 400 ? 'SUCCEEDED' : 'FAILED',
      action: { operation: 'domain_purchase', domain: req.body.domain },
      result: { orderId: data?.orderId, statusCode: status },
    }).catch(() => {});

    res.status(status).json(data);
  } catch (e: unknown) { res.status(500).json({ error: 'Domain purchase request failed' }); }
});

// POST /v1/domains/checkout/start — Purchase domain via Domain Rail → ResellerClub (RED tier)
// Payment flows through RC's configured PayPal — no separate PayPal credentials needed
router.post('/v1/domains/checkout/start', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { jobId, domain } = req.body;
    if (!domain || !isValidDomain(domain)) {
      return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Valid domain required' });
    }

    // 1. Verify domain is still available via Domain Rail
    const { data: checkData } = await domainRailProxy('GET', `/v1/domains/check?domain=${encodeURIComponent(domain)}`, undefined, suiteId);
    const rawAvail: Record<string, any> = checkData?.data || {};
    const availEntry = Object.values(rawAvail).find((v: any) => typeof v === 'object' && v?.status) as any;
    if (!availEntry || availEntry?.status !== 'available') {
      return res.status(400).json({ error: 'DOMAIN_NOT_AVAILABLE', message: 'Domain is not available for purchase' });
    }
    const price = availEntry?.price || availEntry?.sellingprice || '12.99';

    // 2. Get contact ID from Domain Rail (proxies to ResellerClub)
    let contactId: string;
    try {
      const { data: contactData } = await domainRailProxy('GET', '/v1/domains/contacts/default', undefined, suiteId);
      contactId = contactData?.contactId;
      if (!contactId) throw new Error('No contact ID returned');
    } catch (e: unknown) {
      return res.status(503).json({ error: 'RC_CONTACT_MISSING', message: 'Could not discover ResellerClub contact. ' + (e instanceof Error ? e.message.slice(0, 100) : '') });
    }

    // 3. Create approval receipt (RED tier — user clicking "Purchase Now" is the approval)
    const approvalId = crypto.randomUUID();
    if (supabaseAdmin) {
      await supabaseAdmin.from('receipts').insert({
        receipt_id: approvalId,
        suite_id: suiteId,
        receipt_type: 'approval',
        status: 'SUCCEEDED',
        risk_tier: 'red',
        actor_type: 'USER',
        tool_used: 'desktop.domain.purchase',
        action: { operation: 'domain_purchase_approval', domain, price },
        result: { approved: true, approved_at: new Date().toISOString() },
      }).then(() => {}, () => {});
    }

    // 4. Register domain via Domain Rail (which calls ResellerClub)
    const idempotencyKey = crypto.randomUUID();
    const { status: drStatus, data: drData } = await domainRailProxy('POST', '/v1/domains', {
      domain,
      years: 1,
      nameservers: ['ns1.emailarray.com', 'ns2.emailarray.com'],
      registrantContactId: contactId,
      adminContactId: contactId,
      techContactId: contactId,
      billingContactId: contactId,
      invoiceOption: 'PayInvoice',
    }, suiteId, {
      'x-aspire-approval-id': approvalId,
      'x-idempotency-key': idempotencyKey,
    });

    if (drStatus >= 400) {
      const errMsg = drData?.error || 'Registration failed';
      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.domain.purchase_failed',
        status: 'FAILED',
        action: { operation: 'domain_register', domain, invoiceOption: 'PayInvoice' },
        result: { error: String(errMsg).slice(0, 200), drStatus },
      }).catch(() => {});
      return res.status(400).json({ error: 'REGISTRATION_FAILED', message: String(errMsg).slice(0, 200) });
    }

    const orderId = drData?.data?.domain_id || drData?.receipt_id || crypto.randomUUID();

    // 5. Update onboarding job if present
    if (supabaseAdmin && jobId) {
      await supabaseAdmin.from('mail_onboarding_jobs').update({
        state: 'DOMAIN_SELECTED',
        domain,
        domain_mode: 'buy_domain',
        last_health: { orderId, price, contactId },
        state_updated_at: new Date().toISOString(),
      }).eq('id', jobId).eq('suite_id', suiteId).then(() => {}, () => {});
    }

    // 6. Receipt (Law #2) — Domain Rail already emits its own receipt, this is the Desktop-side one
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.domain.purchased',
      status: 'SUCCEEDED',
      action: { operation: 'domain_register', domain, invoiceOption: 'PayInvoice', price },
      result: { orderId, contactId, approvalId },
    }).catch(() => {});

    // 7. Return with DNS plan for immediate display
    const dnsPlan = [
      { type: 'MX', host: '@', value: 'mx1.emailarray.com', priority: 10, ttl: 3600 },
      { type: 'MX', host: '@', value: 'mx2.emailarray.com', priority: 20, ttl: 3600 },
      { type: 'TXT', host: '@', value: 'v=spf1 include:spf.emailarray.com ~all', ttl: 3600 },
      { type: 'CNAME', host: 'webmail', value: 'webmail.emailarray.com', ttl: 3600 },
    ];

    res.json({ status: 'COMPLETED', orderId, domain, amount: price, currency: 'USD', dnsPlan });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'unknown';
    logger.error('Checkout start error', { error: errorMsg });
    res.status(500).json({ error: 'CHECKOUT_FAILED', message: errorMsg.slice(0, 200) });
  }
});

// GET /v1/mail/oauth/google/start — redirect to Google consent screen
router.get('/v1/mail/oauth/google/start', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = req.query.jobId as string;
    if (!jobId || !isValidUUID(jobId)) {
      return res.status(400).json({ error: 'INVALID_JOB_ID', message: 'Valid jobId required' });
    }
    const authUrl = buildAuthUrl(jobId, suiteId);
    res.json({ authUrl });
  } catch (e: unknown) { res.status(500).json({ error: 'OAuth initialization failed' }); }
});

// GET /api/mail/oauth/google/callback — handle Google OAuth callback
router.get('/api/mail/oauth/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      return res.redirect('/inbox/setup?error=' + encodeURIComponent(error));
    }
    if (!code || !state) {
      return res.redirect('/inbox/setup?error=missing_code');
    }

    const result = await handleCallback(code, state);
    res.redirect(`/inbox/setup?step=2&provider=google&email=${encodeURIComponent(result.email)}`);
  } catch (e: unknown) {
    const eMsg = e instanceof Error ? e.message : 'oauth_failed';
    logger.error('Google OAuth callback error', { error: eMsg });
    // Sanitize error — don't pass raw error messages into redirect URL
    const safeError = eMsg.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    res.redirect('/inbox/setup?error=' + encodeURIComponent(safeError));
  }
});

// POST /v1/mail/onboarding/:jobId/checks/run
router.post('/v1/mail/onboarding/:jobId/checks/run', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const validChecks = ['LIST', 'DRAFT', 'SEND_TEST', 'LABEL'];
    const requestedChecks = req.body.checks;
    if (requestedChecks && !Array.isArray(requestedChecks)) {
      return res.status(400).json({ error: 'INVALID_CHECKS', message: 'checks must be an array' });
    }
    if (requestedChecks?.some((c: string) => !validChecks.includes(c))) {
      return res.status(400).json({ error: 'INVALID_CHECK_ID', message: `Valid checks: ${validChecks.join(', ')}` });
    }
    const { runChecks } = await import('./mail/verificationService');
    const checks = await runChecks(jobId, suiteId, requestedChecks);
    res.json({ checks });
  } catch (e: unknown) { res.status(500).json({ error: 'Verification checks failed' }); }
});

// POST /v1/mail/eli/policy/apply
router.post('/v1/mail/eli/policy/apply', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { jobId, policy } = req.body;
    if (!jobId || !isValidUUID(jobId)) {
      return res.status(400).json({ error: 'INVALID_JOB_ID', message: 'Valid jobId required' });
    }
    if (!policy || typeof policy !== 'object') {
      return res.status(400).json({ error: 'INVALID_POLICY', message: 'Policy object required' });
    }
    const validKeys = ['canDraft', 'canSend', 'externalApprovalRequired', 'attachmentsAlwaysApproval', 'rateLimitPreset'];
    const policyKeys = Object.keys(policy);
    if (policyKeys.some(k => !validKeys.includes(k))) {
      return res.status(400).json({ error: 'INVALID_POLICY_KEY', message: `Valid keys: ${validKeys.join(', ')}` });
    }
    await onboarding.applyEliPolicy(jobId, suiteId, policy);

    // Law #2: Receipt for Eli mail policy application (YELLOW — governance config change)
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.eli.policy_applied',
      status: 'SUCCEEDED',
      actorType: 'USER',
      actorId: (req as any).authenticatedUserId || undefined,
      action: { operation: 'apply_eli_policy', job_id: jobId, policy_keys: policyKeys, risk_tier: 'YELLOW' },
      result: { applied: true },
    }).catch(() => {});

    res.json({ applied: true });
  } catch (e: unknown) { res.status(500).json({ error: 'Policy application failed' }); }
});

// POST /v1/mail/onboarding/:jobId/activate
router.post('/v1/mail/onboarding/:jobId/activate', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const result = await onboarding.activateOnboarding(jobId, suiteId);

    // Law #2: Receipt for mail onboarding activation (YELLOW — activating mail account)
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.activated',
      status: 'SUCCEEDED',
      actorType: 'USER',
      actorId: (req as any).authenticatedUserId || undefined,
      action: { operation: 'activate_mail_onboarding', job_id: jobId, risk_tier: 'YELLOW' },
      result: { activated: true },
    }).catch(() => {});

    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'Activation failed' }); }
});

// GET /v1/receipts (by jobId) — mail receipts filtered by correlation
router.get('/v1/receipts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const receipts = await onboarding.listMailReceipts(suiteId);
    res.json({ receipts });
  } catch (e: unknown) { res.status(500).json({ error: 'Receipt retrieval failed' }); }
});

// ─── Mail Thread & Message Routes (Production) ───
// Supports both Google (Gmail API) and PolarisM (IMAP) accounts.
// Account type detected from mail_accounts/oauth_tokens, routes to correct client.

/** Load IMAP credentials for a PolarisM account */
async function loadImapCredentials(suiteId: string, accountEmail?: string): Promise<imapClient.MailAccountCredentials | null> {
  let query;
  if (accountEmail) {
    query = sql`
      SELECT email_address, encrypted_password, display_name, imap_host, imap_port, smtp_host, smtp_port
      FROM app.mail_accounts
      WHERE suite_id = ${suiteId}::uuid AND email_address = ${accountEmail} AND status = 'active' AND encrypted_password IS NOT NULL
      LIMIT 1
    `;
  } else {
    query = sql`
      SELECT email_address, encrypted_password, display_name, imap_host, imap_port, smtp_host, smtp_port
      FROM app.mail_accounts
      WHERE suite_id = ${suiteId}::uuid AND mailbox_provider = 'polaris' AND status = 'active' AND encrypted_password IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `;
  }
  const result = await db.execute(query);
  const rows = (result.rows || result) as any[];
  if (!rows.length) return null;

  const row = rows[0];
  try {
    const password = imapClient.decryptPassword(row.encrypted_password);
    return {
      email: row.email_address,
      password,
      displayName: row.display_name,
      imapHost: row.imap_host || process.env.POLARIS_IMAP_HOST || 'mail.emailarray.com',
      imapPort: row.imap_port || parseInt(process.env.POLARIS_IMAP_PORT || '993', 10),
      smtpHost: row.smtp_host || process.env.POLARIS_SMTP_HOST || 'mail.emailarray.com',
      smtpPort: row.smtp_port || parseInt(process.env.POLARIS_SMTP_PORT || '465', 10),
    };
  } catch {
    // Fail closed — can't decrypt credentials
    return null;
  }
}

/** Detect account type: 'google' or 'polaris', and load the right token/creds */
async function detectMailProvider(suiteId: string, preferredAccount?: string): Promise<'google' | 'polaris' | null> {
  if (preferredAccount) {
    // Check if it's a Google account
    const googleResult = await db.execute(sql`
      SELECT email FROM oauth_tokens
      WHERE suite_id = ${suiteId}::uuid AND provider = 'google' AND email = ${preferredAccount}
    `);
    if (((googleResult.rows || googleResult) as any[]).length > 0) return 'google';

    // Check PolarisM
    const polarisResult = await db.execute(sql`
      SELECT email_address FROM app.mail_accounts
      WHERE suite_id = ${suiteId}::uuid AND email_address = ${preferredAccount} AND status = 'active'
    `);
    if (((polarisResult.rows || polarisResult) as any[]).length > 0) return 'polaris';
    return null;
  }

  // No preferred account — check what's available, prefer PolarisM (Aspire Business Email)
  const polarisResult = await db.execute(sql`
    SELECT email_address FROM app.mail_accounts
    WHERE suite_id = ${suiteId}::uuid AND mailbox_provider = 'polaris' AND status = 'active'
    LIMIT 1
  `);
  if (((polarisResult.rows || polarisResult) as any[]).length > 0) return 'polaris';

  const googleResult = await db.execute(sql`
    SELECT email FROM oauth_tokens WHERE suite_id = ${suiteId}::uuid AND provider = 'google'
  `);
  if (((googleResult.rows || googleResult) as any[]).length > 0) return 'google';

  return null;
}

// GET /api/mail/threads — list email threads (Google or PolarisM)
router.get('/api/mail/threads', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const officeId = (req as any).authenticatedOfficeId || getDefaultOfficeId();
    const account = req.query.account as string | undefined;
    const maxResults = Math.min(parseInt(req.query.limit as string || '30', 10), 100);
    const pageToken = req.query.pageToken as string | undefined;

    const provider = await detectMailProvider(suiteId, account);
    if (!provider) {
      return res.json({ threads: [], total: 0, provider: null });
    }

    if (provider === 'google') {
      const accessToken = await getValidToken(suiteId);
      const gmailResult = await gmailClient.listThreads(accessToken, { maxResults, pageToken });

      // Fetch full thread detail for each (with messages) to build MailThread objects
      const threads = [];
      for (const t of gmailResult.threads.slice(0, maxResults)) {
        try {
          const fullThread = await gmailClient.getThread(accessToken, t.id);
          threads.push(gmailClient.gmailThreadToMailThread(fullThread, suiteId, officeId));
        } catch {
          // Skip failed threads
        }
      }

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.threads.listed',
        status: 'SUCCEEDED',
        action: { provider: 'google', operation: 'list_threads', count: threads.length },
        result: { threadCount: threads.length },
      }).catch(() => {});

      return res.json({ threads, total: threads.length, nextPageToken: gmailResult.nextPageToken, provider: 'google' });
    }

    // PolarisM — IMAP
    const creds = await loadImapCredentials(suiteId, account);
    if (!creds) {
      return res.json({ threads: [], total: 0, provider: 'polaris', error: 'NO_CREDENTIALS' });
    }

    const imapResult = await imapClient.listThreads(creds, suiteId, officeId, { maxResults });

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.threads.listed',
      status: 'SUCCEEDED',
      action: { provider: 'polaris', operation: 'list_threads', count: imapResult.threads.length },
      result: { threadCount: imapResult.threads.length },
    }).catch(() => {});

    return res.json({ threads: imapResult.threads, total: imapResult.total, provider: 'polaris' });
  } catch (e: unknown) {
    const eMsg = e instanceof Error ? e.message : 'unknown';
    logger.error('Mail threads list error', { error: eMsg });
    res.status(500).json({ error: 'Failed to fetch threads', message: eMsg.slice(0, 200) });
  }
});

// GET /api/mail/threads/:threadId — get thread detail with messages
router.get('/api/mail/threads/:threadId', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const officeId = (req as any).authenticatedOfficeId || getDefaultOfficeId();
    const threadId = req.params.threadId as string;
    if (!threadId) return res.status(400).json({ error: 'Thread ID required' });

    const account = req.query.account as string | undefined;

    // Detect provider from thread ID prefix
    const isImapThread = threadId.startsWith('imap-');

    if (isImapThread) {
      const creds = await loadImapCredentials(suiteId, account);
      if (!creds) return res.status(404).json({ error: 'Mail credentials not found' });

      const detail = await imapClient.getThreadDetail(creds, threadId, suiteId, officeId);

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.thread.read',
        status: 'SUCCEEDED',
        action: { provider: 'polaris', operation: 'get_thread', threadId },
        result: { messageCount: detail.messages.length },
      }).catch(() => {});

      return res.json(detail);
    }

    // Gmail thread
    const accessToken = await getValidToken(suiteId);
    const fullThread = await gmailClient.getThread(accessToken, threadId);
    const detail = gmailClient.gmailThreadToMailDetail(fullThread, suiteId, officeId);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.thread.read',
      status: 'SUCCEEDED',
      action: { provider: 'google', operation: 'get_thread', threadId },
      result: { messageCount: detail.messages.length },
    }).catch(() => {});

    return res.json(detail);
  } catch (e: unknown) {
    logger.error('Mail thread detail error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// POST /api/mail/messages/send — send email (YELLOW tier — external comms)
router.post('/api/mail/messages/send', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { to, subject, body, html, account, replyToMessageId } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Invalid recipient email' });
    }

    const provider = await detectMailProvider(suiteId, account);
    if (!provider) return res.status(404).json({ error: 'No active mail account found' });

    if (provider === 'google') {
      const accessToken = await getValidToken(suiteId);
      const raw = gmailClient.buildRawMessage({ to, subject, body, html, replyToMessageId });
      const result = await gmailClient.sendMessage(accessToken, raw);

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.message.sent',
        status: 'SUCCEEDED',
        action: { provider: 'google', operation: 'send_message', to: '<EMAIL_REDACTED>' },
        result: { sent: true, provider: 'google' },
      });

      return res.json({ sent: true, messageId: result.id, provider: 'google' });
    }

    // PolarisM — SMTP
    const creds = await loadImapCredentials(suiteId, account);
    if (!creds) return res.status(404).json({ error: 'Mail credentials not found' });

    const result = await imapClient.sendMail(creds, { to, subject, body, html, replyToMessageId });

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.message.sent',
      status: 'SUCCEEDED',
      action: { provider: 'polaris', operation: 'send_message', to: '<EMAIL_REDACTED>' },
      result: { sent: true, provider: 'polaris' },
    });

    return res.json({ sent: true, messageId: result.messageId, provider: 'polaris' });
  } catch (e: unknown) {
    logger.error('Mail send error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/mail/messages/draft — create draft
router.post('/api/mail/messages/draft', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { to, subject, body, html, account } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    const provider = await detectMailProvider(suiteId, account);
    if (!provider) return res.status(404).json({ error: 'No active mail account found' });

    if (provider === 'google') {
      const accessToken = await getValidToken(suiteId);
      const raw = gmailClient.buildRawMessage({ to, subject, body, html });
      const result = await gmailClient.createDraft(accessToken, raw);

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.draft.created',
        status: 'SUCCEEDED',
        action: { provider: 'google', operation: 'create_draft' },
        result: { draftCreated: true },
      }).catch(() => {});

      return res.json({ created: true, draftId: result.id, provider: 'google' });
    }

    // PolarisM — IMAP APPEND to Drafts
    const creds = await loadImapCredentials(suiteId, account);
    if (!creds) return res.status(404).json({ error: 'Mail credentials not found' });

    const result = await imapClient.createDraft(creds, { to, subject, body, html });

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.draft.created',
      status: 'SUCCEEDED',
      action: { provider: 'polaris', operation: 'create_draft' },
      result: { draftCreated: true },
    }).catch(() => {});

    return res.json({ created: true, draftId: result.uid, provider: 'polaris' });
  } catch (e: unknown) {
    logger.error('Mail draft error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// ─── PandaDoc Webhook (Clara Legal) ───
// HMAC-verified webhook endpoint for PandaDoc document lifecycle events.
// Events: document_state_change (sent, viewed, completed, voided, declined)
// Idempotent: dedup by event_id in processed_webhooks table.

const PANDADOC_WEBHOOK_SECRET = process.env.PANDADOC_WEBHOOK_SECRET || '';

router.post('/api/webhooks/pandadoc', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-pandadoc-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);

    // HMAC verification (Law #3: fail closed on missing/invalid signature)
    if (!PANDADOC_WEBHOOK_SECRET) {
      logger.error('PandaDoc webhook secret not configured — rejecting (fail-closed)');
      return res.status(503).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      logger.warn('PandaDoc webhook missing X-PandaDoc-Signature header — rejecting');
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    const expected = crypto
      .createHmac('sha256', PANDADOC_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expected.length !== signature.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      logger.warn('PandaDoc webhook HMAC signature mismatch — possible forgery');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = req.body;
    const eventId = payload.event_id || payload.id || '';
    const eventType = payload.event || 'unknown';
    const docData = payload.data || {};
    const docId = docData.id || '';
    const docStatus = docData.status || '';

    // Extract Aspire metadata
    const metadata = docData.metadata || {};
    const suiteId = metadata.aspire_suite_id || '';
    const correlationId = metadata.aspire_correlation_id || '';

    logger.info('PandaDoc webhook received', { event: eventType, doc: docId?.substring(0, 8), status: docStatus, suite: suiteId?.substring(0, 8) });

    // Idempotency: check processed_webhooks (if DB available)
    if (db && eventId) {
      try {
        const existing = await db.execute(
          sql`SELECT event_id FROM processed_webhooks WHERE event_id = ${eventId} LIMIT 1`
        );
        if (existing.rows && existing.rows.length > 0) {
          logger.info('PandaDoc webhook duplicate event — skipping', { eventId });
          return res.status(200).json({ status: 'already_processed' });
        }

        // Mark as processed
        await db.execute(
          sql`INSERT INTO processed_webhooks (event_id, source, document_id, suite_id, processed_at)
              VALUES (${eventId}, 'pandadoc', ${docId}, ${suiteId || null}::uuid, now())
              ON CONFLICT (event_id) DO NOTHING`
        );
      } catch (dbErr: unknown) {
        // DB error shouldn't block webhook processing — log and continue
        logger.warn('PandaDoc webhook DB dedup error', { error: dbErr instanceof Error ? dbErr.message : 'unknown' });
      }
    }

    // Emit receipt for webhook event
    if (suiteId) {
      await createTrustSpineReceipt({
        suiteId,
        receiptType: `webhook.pandadoc.${eventType}`,
        status: 'SUCCEEDED',
        action: { provider: 'pandadoc', operation: 'webhook', event: eventType },
        result: { documentId: docId, pandadocStatus: docStatus },
      }).catch(() => {});
    }

    // Advance contract state in Supabase based on PandaDoc status
    const statusToState: Record<string, string> = {
      'document.draft': 'draft',
      'document.sent': 'sent',
      'document.viewed': 'sent',
      'document.waiting_approval': 'sent',
      'document.completed': 'signed',
      'document.voided': 'expired',
      'document.declined': 'expired',
      'document.expired': 'expired',
    };
    const targetState = statusToState[docStatus];

    if (targetState && docId && suiteId && db) {
      try {
        await db.execute(
          sql`UPDATE contracts
              SET contract_state = ${targetState},
                  pandadoc_status = ${docStatus},
                  updated_at = now()
              WHERE document_id = ${docId}
              AND suite_id = ${suiteId}::uuid`
        );
        logger.info('PandaDoc webhook state advanced', { doc: docId.substring(0, 8), targetState });
      } catch (stateErr: unknown) {
        // State update failure doesn't block webhook acknowledgement
        logger.warn('PandaDoc webhook state update failed', { error: stateErr instanceof Error ? stateErr.message : 'unknown' });
      }
    }

    res.status(200).json({ status: 'received', event_id: eventId, target_state: targetState || null });
  } catch (error: unknown) {
    logger.error('PandaDoc webhook error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── Geolocation Proxy (ipapi.co blocks browser CORS) ───
router.get('/api/geolocation', async (_req: Request, res: Response) => {
  try {
    const resp = await fetch('https://ipapi.co/json/', {
      headers: { 'User-Agent': 'Aspire-Server/1.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) {
      return res.json({ latitude: null, longitude: null, error: 'upstream_error' });
    }
    const data = await resp.json();
    res.json({ latitude: data.latitude, longitude: data.longitude, city: data.city, region: data.region });
  } catch {
    res.json({ latitude: null, longitude: null, error: 'timeout' });
  }
});

// ─── PandaDoc Health Check ───
router.get('/api/health/pandadoc', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY || '';
    if (!apiKey) {
      return res.status(503).json({ status: 'unconfigured', detail: 'ASPIRE_PANDADOC_API_KEY not set' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch('https://api.pandadoc.com/public/v1/documents?count=1', {
      headers: { 'Authorization': `API-Key ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      return res.json({ status: 'healthy', latency_ms: Date.now() });
    }
    return res.status(503).json({ status: 'unhealthy', http_status: resp.status });
  } catch (error: unknown) {
    return res.status(503).json({ status: 'unhealthy', error: error instanceof Error ? error.message : 'unknown' });
  }
});

// ─── PandaDoc Templates (Live from workspace) ───
// Proxies PandaDoc GET /templates + /templates/{id}/details.
// Any template added to the PandaDoc workspace appears here automatically.
// Clara uses the same API endpoint — single source of truth.

// Custom thumbnail map — premium screenshots served from /templates/*.png
// Local thumbnails are PRIMARY, PandaDoc API images are FALLBACK.
const TEMPLATE_THUMBNAIL_MAP: Record<string, string> = {
  'Pc5saWpynSmb4NT63FPZPS': 'contractor-sow.png',
  '6SUHv5KfZ58umgoLu9vsNm': 'painting-proposal.png',
  'A4PQkBwRPKjTT38xGLHicN': 'hvac-proposal.png',
  '7V367zKUvGHFtgnoqT2e7V': 'roofing-proposal.png',
  'xzFYgP5NuaQhfTwsmByuDX': 'architecture-proposal.png',
  'RMqD3gn7qZRZRPVcMbdnUQ': 'construction-proposal.png',
  'Yxd5Hd8GxvAkCLvUjN9TwC': 'residential-construction.png',
  '7kruQeak5EaHZBy92CC4qT': 'residential-contract.png',
  'rp2knmUFyfhAghLF8E9iB5': 'accounting-proposal.png',
  'FLsK6snwy6yPjU4jajrJ5E': '1040-form.png',
  'VuVk8KwBFLCAJNWhvnofA7': 'commercial-sublease.png',
  'aVPGZtb2PCBxvrZokgeRri': 'nda-mutual.png',
  'sq8j7CH94xPRu6UbDUm6u8': 'nda-basic.png',
  'dg8UdHiAcncid5KhBTUB7i': 'w9-form.png',
};

// Name-based fallback for templates not in UUID map (e.g. newly added)
const TEMPLATE_THUMBNAIL_NAME_MAP: Record<string, string> = {
  'residential landlord': 'residential-landlord-tenant.png',
};

router.get('/api/contracts/templates', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId;
    if (!suiteId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
    }

    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Fetch template list from PandaDoc workspace
    const listResp = await fetch('https://api.pandadoc.com/public/v1/templates?count=100', {
      headers: { 'Authorization': `API-Key ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!listResp.ok) {
      return res.status(listResp.status).json({ error: 'Failed to fetch templates from PandaDoc' });
    }

    const listData = await listResp.json() as { results: Array<{ id: string; name: string; date_created: string; date_modified: string; version: string }> };
    const templates = listData.results || [];

    // Fetch details in batches of 5 to avoid PandaDoc rate limits
    const BATCH_SIZE = 5;
    const enriched: any[] = [];
    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      const batch = templates.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (t) => {
        try {
          const detailCtrl = new AbortController();
          const detailTimeout = setTimeout(() => detailCtrl.abort(), 10000);

          const detailResp = await fetch(`https://api.pandadoc.com/public/v1/templates/${t.id}/details`, {
            headers: { 'Authorization': `API-Key ${apiKey}` },
            signal: detailCtrl.signal,
          });
          clearTimeout(detailTimeout);

          if (!detailResp.ok) {
            // Still resolve local thumbnail even if detail fetch fails
            const fallbackName = (t.name || '').toLowerCase();
            let fallbackThumb = TEMPLATE_THUMBNAIL_MAP[t.id];
            if (!fallbackThumb) {
              for (const [keyword, file] of Object.entries(TEMPLATE_THUMBNAIL_NAME_MAP)) {
                if (fallbackName.includes(keyword)) { fallbackThumb = file; break; }
              }
            }
            return {
              id: t.id,
              name: t.name,
              date_created: t.date_created,
              date_modified: t.date_modified,
              tokens: [],
              fields: [],
              roles: [],
              images: [],
              preview_image_url: fallbackThumb ? `/templates/${fallbackThumb}` : null,
              content_placeholders: [],
              has_pricing: false,
            };
          }

          const detail = await detailResp.json() as any;
          // Resolve thumbnail: local custom > name-based fallback > API image
          const templateName = (detail.name || t.name || '').toLowerCase();
          let thumbnailFile = TEMPLATE_THUMBNAIL_MAP[t.id];
          if (!thumbnailFile) {
            for (const [keyword, file] of Object.entries(TEMPLATE_THUMBNAIL_NAME_MAP)) {
              if (templateName.includes(keyword)) { thumbnailFile = file; break; }
            }
          }
          const resolvedPreviewUrl = thumbnailFile
            ? `/templates/${thumbnailFile}`
            : (detail.images?.[0]?.urls?.[0] || null);

          return {
            id: t.id,
            name: detail.name || t.name,
            date_created: t.date_created,
            date_modified: t.date_modified,
            tokens: (detail.tokens || []).map((tk: any) => ({ name: tk.name, value: tk.value })),
            fields: (detail.fields || []).map((f: any) => ({
              name: f.name,
              type: f.type,
              field_id: f.field_id,
              assigned_to: f.assigned_to?.name || null,
            })),
            roles: (detail.roles || []).map((r: any) => ({ id: r.id, name: r.name })),
            images: (detail.images || []).length,
            preview_image_url: resolvedPreviewUrl,
            content_placeholders: (detail.content_placeholders || []).length,
            has_pricing: Boolean(detail.pricing?.quotes?.length),
          };
        } catch {
          // Graceful degradation — still resolve local thumbnail
          const fallbackName = (t.name || '').toLowerCase();
          let fallbackThumb = TEMPLATE_THUMBNAIL_MAP[t.id];
          if (!fallbackThumb) {
            for (const [keyword, file] of Object.entries(TEMPLATE_THUMBNAIL_NAME_MAP)) {
              if (fallbackName.includes(keyword)) { fallbackThumb = file; break; }
            }
          }
          return {
            id: t.id,
            name: t.name,
            date_created: t.date_created,
            date_modified: t.date_modified,
            tokens: [],
            fields: [],
            roles: [],
            images: 0,
            preview_image_url: fallbackThumb ? `/templates/${fallbackThumb}` : null,
            content_placeholders: 0,
            has_pricing: false,
          };
        }
      })
      );
      enriched.push(...batchResults);
    }

    res.json({ templates: enriched, count: enriched.length });
  } catch (error: unknown) {
    logger.error('Contracts templates error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ─── PandaDoc Template Preview Session ───
// Creates a short-lived editing session for live template preview (read-only visual).
// Returns an E-Token for embedding the template editor in an iframe.
router.post('/api/contracts/templates/:id/preview-session', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId;
    if (!suiteId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
    }

    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const templateId = req.params.id as string;
    if (!templateId) return res.status(400).json({ error: 'Template ID required' });
    // Validate PandaDoc template ID format (alphanumeric, 22 chars base62)
    if (!/^[A-Za-z0-9]{10,30}$/.test(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }

    const editorEmail = process.env.ASPIRE_PANDADOC_EDITOR_EMAIL || 'admin@aspireos.app';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const sessionResp = await fetch(
      `https://api.pandadoc.com/public/v1/templates/${templateId}/editing-sessions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `API-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_email: editorEmail,
          lifetime: 300, // 5 minutes — preview-only
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!sessionResp.ok) {
      const errBody = await sessionResp.text().catch(() => 'unknown');
      logger.warn('PandaDoc editing session failed', { templateId, status: sessionResp.status, body: errBody });
      return res.status(sessionResp.status).json({ error: 'Failed to create preview session' });
    }

    const session = await sessionResp.json() as { id: string; expires_at: string };
    res.json({
      token: session.id,
      template_id: templateId,
      expires_at: session.expires_at,
    });
  } catch (error: unknown) {
    logger.error('Template preview session error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to create preview session' });
  }
});

// ─── Contract CRUD (Clara Legal — Document Hub) ───
// All routes require JWT auth + suite_id scoping (Law #6).

// GET /api/contracts — List contracts (paginated, filterable)
router.get('/api/contracts', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId as string;
    if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required (Law #6)' });

    const status = req.query.status as string || '';
    const templateKey = req.query.template_key as string || '';
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    if (!db) return res.status(503).json({ error: 'Database not available' });

    let query;
    if (status && templateKey) {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid AND contract_state = ${status} AND template_key = ${templateKey}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (status) {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid AND contract_state = ${status}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (templateKey) {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid AND template_key = ${templateKey}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    }

    const result = await db.execute(query);
    const contracts = result.rows || [];

    // Get total count for pagination
    const countResult = await db.execute(
      sql`SELECT COUNT(*)::int as total FROM contracts WHERE suite_id = ${suiteId}::uuid`
    );
    const total = countResult.rows?.[0]?.total || 0;

    res.json({ contracts, total, page, limit });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    console.error('[Contracts] Database query failed:', (error as Error)?.message || error);
    logger.error('Contracts list error', { error: msg });
    // Graceful degradation: contracts table doesn't exist yet (feature not launched).
    // Return empty state for ANY database error on this endpoint to prevent 500s
    // from breaking the entire Documents page.
    return res.json({ contracts: [], total: 0, page: 1, limit: 20, configured: false });
  }
});

// GET /api/contracts/:id — Contract detail + history
router.get('/api/contracts/:id', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId as string;
    if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required (Law #6)' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT * FROM contracts WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = result.rows[0];

    // Fetch signing sessions for this contract
    let sessions: any[] = [];
    try {
      const sessResult = await db.execute(
        sql`SELECT id, token, signer_email, signer_name, expires_at, completed_at, created_at
            FROM signing_sessions
            WHERE document_id = ${contract.document_id} AND suite_id = ${suiteId}::uuid
            ORDER BY created_at DESC`
      );
      sessions = sessResult.rows || [];
    } catch {
      // signing_sessions table may not exist yet
    }

    res.json({ contract, sessions });
  } catch (error: unknown) {
    logger.error('Contracts detail error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

// POST /api/contracts/:id/send — Send document for signature
router.post('/api/contracts/:id/send', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId as string;
    if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required (Law #6)' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    // Look up the contract to get document_id
    const result = await db.execute(
      sql`SELECT document_id, contract_state FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id, contract_state } = result.rows[0] as any;

    // Only draft or reviewed contracts can be sent
    if (!['draft', 'reviewed'].includes(contract_state)) {
      return res.status(400).json({
        error: `Cannot send contract in state '${contract_state}'. Must be draft or reviewed.`,
      });
    }

    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const message = typeof req.body.message === 'string' ? req.body.message.trim().substring(0, 1000) : 'Please review and sign this document.';
    const silent = typeof req.body.silent === 'boolean' ? req.body.silent : true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${document_id}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, silent }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errBody = await resp.text();
      return res.status(resp.status).json({ error: 'PandaDoc send failed', detail: errBody });
    }

    // Update contract state to 'sent'
    await db.execute(
      sql`UPDATE contracts SET contract_state = 'sent', pandadoc_status = 'document.sent', updated_at = now()
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid`
    );

    // Emit receipt
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'contract.send',
      status: 'SUCCEEDED',
      action: { provider: 'pandadoc', operation: 'send', documentId: document_id },
      result: { contractId, state: 'sent' },
    }).catch(() => {});

    res.json({ success: true, contract_state: 'sent' });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Contract send error', { error: errorMsg });
    const sid = (req as any).authenticatedSuiteId as string;
    if (sid) {
      await createTrustSpineReceipt({
        suiteId: sid,
        receiptType: 'contract.send',
        status: 'FAILED',
        action: { provider: 'pandadoc', operation: 'send' },
        result: { error: errorMsg },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to send contract' });
  }
});

// POST /api/contracts/:id/session — Create embedded signing session
router.post('/api/contracts/:id/session', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId as string;
    if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required (Law #6)' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT document_id, contract_state, title FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id, contract_state, title } = result.rows[0] as any;

    if (contract_state !== 'sent') {
      return res.status(400).json({
        error: `Cannot create signing session for contract in state '${contract_state}'. Must be sent.`,
      });
    }

    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const signerEmail = req.body.recipient || '';
    const signerName = req.body.signer_name || '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const sessionBody: any = {};
    if (signerEmail) sessionBody.recipient = signerEmail;

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${document_id}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errBody = await resp.text();
      return res.status(resp.status).json({ error: 'PandaDoc session failed', detail: errBody });
    }

    const sessionData = await resp.json();
    const sessionId = sessionData.id || '';
    const expiresAt = sessionData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Generate a secure token for the public signing URL
    const signingToken = crypto.randomUUID();

    // Store signing session in DB
    try {
      await db.execute(
        sql`INSERT INTO signing_sessions (id, token, document_id, suite_id, signer_email, signer_name, pandadoc_session_id, expires_at, created_at)
            VALUES (${crypto.randomUUID()}::uuid, ${signingToken}, ${document_id}, ${suiteId}::uuid, ${signerEmail}, ${signerName}, ${sessionId}, ${expiresAt}::timestamptz, now())`
      );
    } catch (dbErr: unknown) {
      logger.warn('Failed to store signing session', { error: dbErr instanceof Error ? dbErr.message : 'unknown' });
    }

    // Emit receipt
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'contract.session.create',
      status: 'SUCCEEDED',
      action: { provider: 'pandadoc', operation: 'session', documentId: document_id },
      result: { sessionId, signingToken, expiresAt },
    }).catch(() => {});

    res.json({
      session_id: sessionId,
      signing_token: signingToken,
      signing_url: `/sign/${signingToken}`,
      expires_at: expiresAt,
      document_name: title || '',
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Contract session create error', { error: errorMsg });
    const sid = (req as any).authenticatedSuiteId as string;
    if (sid) {
      await createTrustSpineReceipt({
        suiteId: sid,
        receiptType: 'contract.session.create',
        status: 'FAILED',
        action: { provider: 'pandadoc', operation: 'session.create' },
        result: { error: errorMsg },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to create signing session' });
  }
});

// POST /api/pandadoc/:documentId/preview — Create PandaDoc view session for document preview
// Used by Authority Queue "Review" button so user sees the REAL document before approving
router.post('/api/pandadoc/:documentId/preview', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId;
    if (!suiteId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
    }

    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const documentId = req.params.documentId;
    if (!documentId || documentId.length < 10) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Law #6: Verify document belongs to authenticated tenant before creating preview session
    if (db) {
      const ownerCheck = await db.execute(
        sql`SELECT id FROM contracts WHERE document_id = ${documentId} AND suite_id = ${suiteId}::uuid LIMIT 1`
      );
      if (!ownerCheck.rows || ownerCheck.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Document does not belong to your tenant.' });
      }
    }

    // Create a PandaDoc embedded session for the document.
    // For draft documents this gives a read-only view.
    // For sent documents this shows the document with signing fields visible but not actionable
    // unless a recipient is specified.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${documentId}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      // Fallback: if session creation fails (e.g. draft status not supported),
      // try fetching document details to confirm it exists and return document info only
      if (resp.status === 409 || resp.status === 400) {
        const detailResp = await fetch(`https://api.pandadoc.com/public/v1/documents/${documentId}`, {
          headers: { 'Authorization': `API-Key ${apiKey}` },
        });
        if (detailResp.ok) {
          const doc = await detailResp.json();
          return res.json({
            session_id: null,
            fallback: true,
            document_name: doc.name || '',
            document_status: doc.status || '',
            message: 'Preview session not available for this document status. Document exists.',
          });
        }
      }
      const errBody = await resp.text();
      return res.status(resp.status).json({ error: 'PandaDoc preview session failed', detail: errBody });
    }

    const sessionData = await resp.json();
    res.json({
      session_id: sessionData.id || '',
      expires_at: sessionData.expires_at || '',
      preview_url: `https://app.pandadoc.com/s/${sessionData.id}`,
    });
  } catch (error: unknown) {
    logger.error('PandaDoc preview error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to create preview session' });
  }
});

// POST /api/contracts/:id/void — Void/cancel a document
router.post('/api/contracts/:id/void', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId as string;
    if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required (Law #6)' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT document_id, contract_state FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id, contract_state } = result.rows[0] as any;

    // Only sent contracts can be voided
    if (!['sent', 'draft', 'reviewed'].includes(contract_state)) {
      return res.status(400).json({
        error: `Cannot void contract in state '${contract_state}'.`,
      });
    }

    // Update state to expired
    await db.execute(
      sql`UPDATE contracts SET contract_state = 'expired', pandadoc_status = 'document.voided', updated_at = now()
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid`
    );

    // Emit receipt
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'contract.void',
      status: 'SUCCEEDED',
      action: { provider: 'pandadoc', operation: 'void', documentId: document_id },
      result: { contractId, state: 'expired' },
    }).catch(() => {});

    res.json({ success: true, contract_state: 'expired' });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Contract void error', { error: errorMsg });
    const sid = (req as any).authenticatedSuiteId as string;
    if (sid) {
      await createTrustSpineReceipt({
        suiteId: sid,
        receiptType: 'contract.void',
        status: 'FAILED',
        action: { provider: 'pandadoc', operation: 'void' },
        result: { error: errorMsg },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to void contract' });
  }
});

// GET /api/contracts/:id/download — Get PandaDoc download URL
router.get('/api/contracts/:id/download', async (req: Request, res: Response) => {
  try {
    const suiteId = (req as any).authenticatedSuiteId as string;
    if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required (Law #6)' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT document_id FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id } = result.rows[0] as any;
    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${document_id}/download`, {
      headers: { 'Authorization': `API-Key ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Download not available' });
    }

    // PandaDoc returns the PDF directly — proxy it
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${contractId}.pdf"`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.send(buffer);
  } catch (error: unknown) {
    logger.error('Contract download error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to download contract' });
  }
});

// ─── Public Signing Route (NO AUTH REQUIRED) ───
// External signers access signing sessions via token — no Aspire account needed.
// Token-only access, minimal data exposure.
// Simple in-memory rate limiter for public signing route (per-IP, 20 req/min)
const signingRateLimiter = new Map<string, { count: number; resetAt: number }>();
const SIGNING_RATE_LIMIT = 20;
const SIGNING_RATE_WINDOW_MS = 60_000;

router.get('/api/signing/:token', async (req: Request, res: Response) => {
  try {
    // Rate limit by IP (Law #3: fail-closed on abuse)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = signingRateLimiter.get(clientIp);
    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > SIGNING_RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
      }
    } else {
      signingRateLimiter.set(clientIp, { count: 1, resetAt: now + SIGNING_RATE_WINDOW_MS });
    }

    if (!db) return res.status(503).json({ error: 'Database not available' });

    const token = req.params.token as string;
    // UUID format validation (36 chars: 8-4-4-4-12 hex)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!token || !UUID_RE.test(token)) {
      return res.status(400).json({ error: 'Invalid signing token' });
    }

    const result = await db.execute(
      sql`SELECT s.document_id, s.signer_email, s.signer_name, s.pandadoc_session_id,
                 s.expires_at, s.completed_at, s.created_at,
                 c.title as document_name
          FROM signing_sessions s
          LEFT JOIN contracts c ON c.document_id = s.document_id AND c.suite_id = s.suite_id
          WHERE s.token = ${token}
          LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Signing session not found' });
    }

    const session = result.rows[0] as any;

    // Check expiration
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Signing session expired' });
    }

    // Check if already completed
    if (session.completed_at) {
      return res.json({
        status: 'completed',
        document_name: session.document_name || 'Document',
        completed_at: session.completed_at,
      });
    }

    // Return ONLY safe data — no suite_id, no contract terms, no other signers
    res.json({
      status: 'pending',
      document_name: session.document_name || 'Document',
      signer_name: session.signer_name || '',
      pandadoc_session_id: session.pandadoc_session_id,
      expires_at: session.expires_at,
    });
  } catch (error: unknown) {
    logger.error('Signing token error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to load signing session' });
  }
});

// ─── Voice Pipeline Bypass Test ─────────────────────────────────────────────
// Skips orchestrator/LangGraph entirely: OpenAI direct → ElevenLabs TTS direct
// Used to isolate whether voice issues are in the orchestrator or the audio pipeline
router.post('/api/voice-test/bypass', async (req: Request, res: Response) => {
  const suiteId = requireAuth(req, res);
  if (!suiteId) return;

  const { text, agent = 'ava' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text field required' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.ASPIRE_OPENAI_API_KEY || process.env.ASPIRE_OPENAI_KEY;
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured', stage: 'llm' });
  }
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured', stage: 'tts' });
  }

  const voiceId = VOICE_IDS[agent] || VOICE_IDS.ava;
  const voiceModel = VOICE_MODELS[agent] || 'eleven_flash_v2_5';
  const voiceSettings = VOICE_SETTINGS[agent] || VOICE_SETTINGS.ava;

  try {
    // Step 1: OpenAI Responses API direct (no orchestrator, no LangGraph, no routing)
    const llmStart = Date.now();
    const llmResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        instructions: 'You are Ava, a friendly executive AI assistant. Keep responses under 2 sentences.',
        input: text,
        max_output_tokens: 256,
        store: false,
      }),
    });

    if (!llmResp.ok) {
      const err = await llmResp.text();
      logger.error('OpenAI Responses API error', { status: llmResp.status, detail: err.substring(0, 500) });
      return res.status(502).json({ error: `OpenAI error: ${llmResp.status}`, detail: err.substring(0, 300), stage: 'llm' });
    }

    const llmData = await llmResp.json() as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
    const responseText = llmData.output_text
      || llmData.output?.find(o => o.type === 'message')?.content?.find(c => c.type === 'output_text')?.text
      || 'I could not generate a response.';
    const llmMs = Date.now() - llmStart;

    // Step 2: ElevenLabs TTS direct (no WebSocket, simple HTTP stream)
    const ttsStart = Date.now();
    const ttsResp = await fetchWithTimeoutAndRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${encodeURIComponent(DEFAULT_TTS_OUTPUT_FORMAT)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: responseText.trim(),
          model_id: voiceModel,
          voice_settings: voiceSettings,
        }),
      },
      { timeoutMs: 20_000, retries: 1, retryOnStatuses: [429, 500, 502, 503, 504] },
    );

    if (!ttsResp.ok || !ttsResp.body) {
      const err = await ttsResp.text();
      return res.status(502).json({ error: `ElevenLabs error: ${ttsResp.status}`, detail: err.substring(0, 300), stage: 'tts', responseText });
    }

    const ttsMs = Date.now() - ttsStart;

    // Stream audio back to client
    res.set('Content-Type', 'audio/mpeg');
    res.set('Transfer-Encoding', 'chunked');
    res.set('X-LLM-Response', Buffer.from(responseText).toString('base64'));
    res.set('X-LLM-Latency-Ms', String(llmMs));
    res.set('X-TTS-Latency-Ms', String(ttsMs));

    const reader = ttsResp.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); break; }
      res.write(value);
    }
  } catch (error: unknown) {
    logger.error('Voice bypass test error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown', stage: 'unknown' });
  }
});

// ─── ElevenLabs Conversational AI — Signed URL Proxy (Pass 2A) ───
// Returns a signed URL for establishing an ElevenLabs agent session.
// The ElevenLabs API key stays server-side (Law #9). The signed URL is
// short-lived and scoped to a single conversation session.
router.post('/api/elevenlabs/agent-session', async (req: Request, res: Response) => {
  const suiteId = requireAuth(req, res);
  if (!suiteId) return;
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-agent-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const traceId = resolveTraceId(req, correlationId);
  const startedAt = Date.now();
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Correlation-Id', correlationId);
  emitTraceEvent({
    traceId,
    correlationId,
    suiteId,
    agent: typeof req.body?.agent === 'string' ? req.body.agent : null,
    stage: 'tts',
    status: 'start',
    message: 'Agent session signed URL request started',
  });
  try {
    const { agent } = req.body;
    if (!agent || typeof agent !== 'string') {
      return res.status(400).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'INVALID_AGENT',
        errorStage: 'agent_session',
        message: 'Agent name is required',
      }));
    }
    const validAgents = ['ava', 'eli', 'finn', 'nora', 'sarah'];
    if (!validAgents.includes(agent)) {
      return res.status(400).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'UNKNOWN_AGENT',
        errorStage: 'agent_session',
        message: `Unknown agent: ${agent}`,
      }));
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      logger.warn('[AgentSession] ELEVENLABS_API_KEY is missing — agent sessions disabled');
      return res.status(500).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'AGENT_NOT_CONFIGURED',
        errorStage: 'agent_session',
        message: 'Agent session service not configured',
      }));
    }

    // Resolve the agent ID from environment variables
    const agentEnvKey = `ELEVENLABS_AGENT_${agent.toUpperCase()}`;
    const agentId = process.env[agentEnvKey];
    if (!agentId) {
      logger.warn(`[AgentSession] ${agentEnvKey} not configured for agent "${agent}"`);
      return res.status(500).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'AGENT_ID_NOT_CONFIGURED',
        errorStage: 'agent_session',
        message: `Agent ID not configured for ${agent}`,
      }));
    }

    // Fetch signed URL from ElevenLabs API (8s timeout to prevent server hang)
    const elAbort = new AbortController();
    const elTimeoutId = setTimeout(() => elAbort.abort(), 8_000);
    let elResp: Response;
    try {
      elResp = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          signal: elAbort.signal,
        },
      );
    } catch (err) {
      clearTimeout(elTimeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        logger.error('[AgentSession] ElevenLabs API timed out after 8s', { agent });
        emitTraceEvent({ traceId, correlationId, suiteId, agent, stage: 'tts', status: 'error', errorCode: 'ELEVENLABS_TIMEOUT', message: 'ElevenLabs API timed out', latencyMs: Date.now() - startedAt });
        return res.status(504).json(voiceErrorPayload({ correlationId, traceId, errorCode: 'ELEVENLABS_TIMEOUT', errorStage: 'agent_session', message: 'Voice service timed out — please try again' }));
      }
      throw err;
    }
    clearTimeout(elTimeoutId);

    if (!elResp.ok) {
      const errorBody = await elResp.text().catch(() => '');
      logger.error(`[AgentSession] ElevenLabs returned ${elResp.status}`, { agent, errorBody });
      emitTraceEvent({
        traceId,
        correlationId,
        suiteId,
        agent,
        stage: 'tts',
        status: 'error',
        errorCode: 'ELEVENLABS_API_ERROR',
        message: `ElevenLabs API returned ${elResp.status}`,
        latencyMs: Date.now() - startedAt,
      });
      return res.status(502).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'ELEVENLABS_API_ERROR',
        errorStage: 'agent_session',
        message: 'Failed to obtain signed URL from ElevenLabs',
      }));
    }

    const elData = await elResp.json();
    const signedUrl = elData.signed_url;
    if (!signedUrl || typeof signedUrl !== 'string') {
      logger.error('[AgentSession] ElevenLabs response missing signed_url', { agent, elData });
      return res.status(502).json(voiceErrorPayload({
        correlationId,
        traceId,
        errorCode: 'MISSING_SIGNED_URL',
        errorStage: 'agent_session',
        message: 'ElevenLabs response did not contain a signed URL',
      }));
    }

    // Fetch user profile from Supabase for dynamic variables (optional enrichment)
    let dynamicVariables: Record<string, string | number | boolean> = {};
    try {
      if (supabaseAdmin) {
        const { data: profile } = await supabaseAdmin
          .from('suite_profiles')
          .select('owner_name, business_name, industry, office_id')
          .eq('suite_id', suiteId)
          .maybeSingle();

        if (profile) {
          // Extract last name from owner_name (e.g. "Tonio Scott" → "Scott")
          const ownerName = (profile.owner_name || '').trim();
          const nameParts = ownerName.split(' ').filter(Boolean);
          const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          const firstName = nameParts[0] || '';

          dynamicVariables = {
            suite_id: suiteId,
            user_id: (req as any).authenticatedUserId || '',
            owner_name: ownerName,
            first_name: firstName,
            last_name: lastName,
            salutation: lastName ? 'Mr.' : '',
            business_name: profile.business_name || '',
            industry: profile.industry || '',
            office_id: profile.office_id || '',
          };
        }
      }
    } catch (profileErr) {
      // Non-fatal: agent session works without profile enrichment
      logger.warn('[AgentSession] Failed to fetch suite profile', {
        suiteId,
        error: profileErr instanceof Error ? profileErr.message : 'unknown',
      });
    }

    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      agent,
      stage: 'tts',
      status: 'ok',
      message: 'Agent session signed URL obtained',
      latencyMs: Date.now() - startedAt,
    });

    return res.json({
      signed_url: signedUrl,
      agent_id: agentId,
      dynamic_variables: dynamicVariables,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    logger.error('[AgentSession] Unexpected error', { error: message });
    captureServerException(error instanceof Error ? error : new Error(message), {
      tags: { voice_stage: 'agent_session', provider: 'elevenlabs' },
    });
    emitTraceEvent({
      traceId,
      correlationId,
      suiteId,
      agent: typeof req.body?.agent === 'string' ? req.body.agent : null,
      stage: 'tts',
      status: 'error',
      errorCode: 'AGENT_SESSION_UNEXPECTED',
      message,
      latencyMs: Date.now() - startedAt,
    });
    return res.status(500).json(voiceErrorPayload({
      correlationId,
      traceId,
      errorCode: 'AGENT_SESSION_UNEXPECTED',
      errorStage: 'agent_session',
      message: 'Unexpected error creating agent session',
    }));
  }
});

export default router;





