import 'dotenv/config';
// Also load .env.local for local dev overrides (e.g. DEV_BYPASS_AUTH)
// dotenv/config only reads .env — .env.local must be loaded explicitly.
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import * as fs from 'fs';
import { resolve } from 'path';
const localEnvPath = resolve(process.cwd(), '.env.local');
if (existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { pool, db } from './db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';
import routes from './routes';
import { createReceipt } from './receiptService';
import { supabaseAdmin } from './supabaseAdmin';
import { getBreakerStates } from './circuitBreaker';
import { getIdempotencyStats } from './webhookIdempotency';

// ─── Optional heavy imports (non-fatal if missing) ────────────────────────────
let runMigrations: ((opts: { databaseUrl: string }) => Promise<void>) | null = null;
let getStripeSync: (() => Promise<{ syncBackfill: () => Promise<void>; findOrCreateManagedWebhook: (url: string) => Promise<void> }>) | null = null;
let WebhookHandlers: { processWebhook: (body: Buffer, sig: string) => Promise<void> } | null = null;
let registerObjectStorageRoutes: ((app: express.Application) => void) | null = null;

try {
  const stripeModule = require('./stripeSync');
  runMigrations = stripeModule.runMigrations;
  getStripeSync = stripeModule.getStripeSync;
} catch (e) {
  logger.warn('Stripe sync module not available');
}

try {
  const webhookModule = require('./stripeWebhookHandler');
  WebhookHandlers = webhookModule.default || webhookModule;
} catch (e) {
  logger.warn('Stripe webhook handler not available');
}

try {
  const objectStorageModule = require('./objectStorage');
  registerObjectStorageRoutes = objectStorageModule.registerObjectStorageRoutes;
} catch (e) {
  logger.warn('Object storage module not available');
}

const app = express();
const IS_LOCAL_SYNTHETIC_SMOKE = process.env.IS_LOCAL_SYNTHETIC_SMOKE === 'true';

// ─── RLS tenant context ───────────────────────────────────────────────────────
async function applyTenantContext(suiteId: string): Promise<boolean> {
  try {
    await db.execute(sql`SELECT set_config('app.current_suite_id', ${suiteId}, true)`);
    return true;
  } catch (err: unknown) {
    logger.warn('Failed to apply tenant RLS context', {
      suite_id: suiteId,
      reason: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    return false;
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
// Protects all /api/* and /v1/* routes with Supabase JWT validation.
// Runs BEFORE route registration so every handler can trust req.authenticatedSuiteId.
//
// NOTE: supabase-js getUser() has a regression in v2.95.x — it ignores the
// passed token and looks for a session cookie instead. We bypass it by calling
// the Supabase REST endpoint directly (GET /auth/v1/user with Bearer header).
// See: https://github.com/supabase/supabase-js/issues/XXXX
const AUTH_BYPASS_TOKEN = process.env.DEV_AUTH_BYPASS_TOKEN;
const defaultSuiteId    = process.env.DEV_DEFAULT_SUITE_ID;

app.use(async (req, res, next) => {
  const path = req.path;
  // Public routes — no auth required
  const PUBLIC_PREFIXES = [
    '/api/health',
    '/api/config/public',
    '/api/stripe/webhook',
    '/api/stripe-finance/webhook',
    '/api/pandadoc/webhook',
    '/api/plaid/webhook',
    '/admin/ops/incidents/report',
    '/v1/tools/',           // ElevenLabs tool webhooks — auth via ELEVENLABS_WEBHOOK_SECRET
    '/v1/agents/invoke',    // n8n → orchestrator internal trust
    '/v1/agents/invoke-sync',
  ];
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return next();
  if (!path.startsWith('/api') && !path.startsWith('/v1')) return next();

  const authHeader  = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  // DEV_AUTH_BYPASS_TOKEN: local development shortcut — never set in production
  if (AUTH_BYPASS_TOKEN && bearerToken === AUTH_BYPASS_TOKEN) {
    const headerSuiteId  = req.headers['x-suite-id'] as string | undefined;
    const headerOfficeId = req.headers['x-office-id'] as string | undefined;
    if (headerSuiteId) {
      await applyTenantContext(headerSuiteId);
    }
    (req as any).authenticatedUserId  = 'dev-bypass';
    (req as any).authenticatedSuiteId = headerSuiteId || defaultSuiteId;
    (req as any).authenticatedOfficeId = headerOfficeId || headerSuiteId || defaultSuiteId;
    return next();
  }

  // n8n internal service account (X-Service-Token header)
  const serviceToken = req.headers['x-service-token'] as string | undefined;
  const N8N_SERVICE_TOKEN = process.env.N8N_SERVICE_TOKEN;
  if (N8N_SERVICE_TOKEN && serviceToken === N8N_SERVICE_TOKEN) {
    const headerSuiteId  = req.headers['x-suite-id'] as string | undefined;
    const headerOfficeId = req.headers['x-office-id'] as string | undefined;
    if (headerSuiteId) {
      await applyTenantContext(headerSuiteId);
    }
    (req as any).authenticatedUserId  = 'n8n-service';
    (req as any).authenticatedSuiteId = headerSuiteId;
    (req as any).authenticatedOfficeId = headerOfficeId || headerSuiteId;
    return next();
  }

  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('[auth-debug] AUTH_REQUIRED — no Bearer header', { path: req.path, has_auth_header: !!authHeader });
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authentication required. Please sign in.',
    });
  }

  // JWT present: validate and extract suite_id.
  // NOTE: supabase-js 2.95.x has a regression where supabaseAdmin.auth.getUser(token)
  // returns "Auth session missing!" even when given a valid JWT (the SDK looks for an
  // attached session instead of using the passed token). We bypass with a direct REST
  // call to GET /auth/v1/user — that endpoint validates the Bearer JWT server-side.
  const token = bearerToken;
  const supabaseUrl    = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseApiKey = process.env.SUPABASE_ANON_KEY
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '';
  let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
  let validationError: string | null = null;
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseApiKey,
      },
    });
    if (userResp.ok) {
      user = (await userResp.json()) as typeof user;
    } else {
      validationError = `${userResp.status} ${userResp.statusText}`;
    }
  } catch (fetchErr) {
    validationError = fetchErr instanceof Error ? fetchErr.message : 'fetch_failed';
  }
  if (!user) {
    // Decode JWT payload (no verification) for diagnostic purposes only — the token is already rejected.
    let jwtClaims: Record<string, unknown> | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        jwtClaims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      }
    } catch { /* swallow */ }
    logger.warn('[auth-debug] INVALID_TOKEN', {
      path: req.path,
      validation_error: validationError ?? 'no_user_returned',
      token_len: token.length,
      jwt_iss: jwtClaims?.iss ?? null,
      jwt_aud: jwtClaims?.aud ?? null,
      jwt_sub_prefix: typeof jwtClaims?.sub === 'string' ? (jwtClaims.sub as string).slice(0, 8) : null,
      jwt_exp: jwtClaims?.exp ?? null,
      jwt_expired: typeof jwtClaims?.exp === 'number' ? (jwtClaims.exp * 1000 < Date.now()) : null,
    });
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired authentication token',
    });
  }

  const suiteId = user.user_metadata?.suite_id || defaultSuiteId;

  const jwtHeaderSuiteId = req.headers['x-suite-id'] as string | undefined;
  if (jwtHeaderSuiteId && suiteId && jwtHeaderSuiteId !== suiteId) {
    logger.error('TENANT_ISOLATION_VIOLATION: x-suite-id header mismatch', { header_suite_id: jwtHeaderSuiteId, jwt_suite_id: suiteId, user_id: user.id });
    try {
      const { createReceipt } = require('./receiptService');
      await createReceipt({
        suiteId: 'system',
        officeId: 'system',
        actionType: 'auth.tenant_mismatch',
        inputs: { header_suite_id: jwtHeaderSuiteId, jwt_suite_id: suiteId, user_id: user.id },
        outputs: { reason: 'TENANT_ISOLATION_VIOLATION' },
        metadata: { source: 'rls_guard', risk_tier: 'red' },
      });
    } catch (_receiptErr) { /* best-effort */ }
    return res.status(403).json({
      error: 'TENANT_ISOLATION_VIOLATION',
      message: 'x-suite-id header does not match authenticated tenant (Law #6)',
    });
  }

  if (suiteId) {
    const applied = await applyTenantContext(suiteId);
    if (!applied) {
      logger.warn('Continuing request with JWT suite context only (RLS context unavailable)', {
        user_id: user.id,
        suite_id: suiteId,
        path: req.path,
      });
    }
  }

  // Attach user info for receipt actor binding
  (req as any).authenticatedUserId = user.id;
  (req as any).authenticatedSuiteId = suiteId;
  (req as any).authenticatedUserName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  next();
} catch (error) {
    // Law #3: Fail closed on unexpected errors
    logger.error('RLS middleware error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'AUTH_ERROR', message: 'Authentication check failed' });
  }
});

async function initStripe() {
  if (IS_LOCAL_SYNTHETIC_SMOKE) {
    logger.info('Skipping Stripe init in local synthetic smoke mode');
    return;
  }

  if (!runMigrations || !getStripeSync) {
    logger.warn('Stripe modules not loaded, skipping Stripe sync setup');
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set, skipping Stripe sync setup');
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    logger.warn('STRIPE_SECRET_KEY not set, skipping Stripe sync setup');
    return;
  }

  try {
    logger.info('Initializing Stripe schema');
    const migrationPromise = Promise.race([
      runMigrations({ databaseUrl }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Stripe migration timeout')), 10000))
    ]);
    await migrationPromise;
    logger.info('Stripe schema ready');

    const stripeSync = await getStripeSync();

    logger.info('Setting up managed webhook');
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
    const webhookBaseUrl = process.env.PUBLIC_BASE_URL?.trim() || (domain ? `https://${domain}` : '');
    if (!webhookBaseUrl) {
      throw new Error('PUBLIC_BASE_URL (or REPLIT_DOMAINS) is required for Stripe webhook setup');
    }
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);

    logger.info('Syncing Stripe data');
    stripeSync.syncBackfill().then(() => {
      logger.info('Stripe data synced');
    }).catch((err: Error) => {
      logger.error('Error syncing Stripe data', { error: err.message });
    });
  } catch (error) {
    logger.error('Failed to initialize Stripe', { error: error instanceof Error ? error.message : 'unknown' });
  }
}

if (WebhookHandlers) {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];
      if (!signature) return res.status(400).json({ error: 'Missing signature' });

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (error: unknown) {
        logger.error('Webhook error', { error: error instanceof Error ? error.message : 'unknown' });
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );
}

try {
  const stripeFinanceWebhook = require('./stripeFinanceWebhook').default;
  app.use(stripeFinanceWebhook);
  logger.info('Stripe finance webhook handler registered');
} catch (e) {
  logger.warn('Stripe finance webhook handler not available, skipping');
}

// Trust Railway's reverse proxy for correct client IP (1 hop)
app.set('trust proxy', 1);

// Global API rate limiter — 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith('/api') && !req.path.startsWith('/v1'),
  handler: (_req, res) => {
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again shortly.',
      retryAfter: 60,
    });
  },
});

// Stricter limiter for auth endpoints — 10 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Try again in 15 minutes.',
      retryAfter: 900,
    });
  },
});

app.use(apiLimiter);
app.use('/api/auth/', authLimiter);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // esm.sh removed 2026-05-05: @anam-ai/js-sdk now self-hosted at
      // /vendor/anam/<version>/index.js (built by scripts/build-anam-sdk.mjs).
      // If any future feature needs esm.sh, prefer self-hosting via the same
      // /vendor pattern instead of widening CSP.
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:", "https://cdn.plaid.com", "https://elevenlabs.io", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://source.zoom.us", "https://zoom.us", "https://*.zoom.us"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://source.zoom.us", "https://zoom.us"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://*.elevenlabs.io",
        "wss://*.elevenlabs.io",
        "https://zoom.us",
        "wss://zoom.us",
        "https://*.zoom.us",
        "wss://*.zoom.us",
        "https://*.zoomdev.us",
        "wss://*.zoomdev.us",
        "https://*.cloudflare.com",
        "https://*.cloudfront.net",
        "https://*.anam.ai",
        "wss://*.anam.ai",
        "https://*.pandadoc.com",
        "https://*.stripe.com",
        "https://*.plaid.com",
        "https://maps.googleapis.com",
        "https://aerialview.googleapis.com",
        "https://api.deepgram.com",
        "wss://api.deepgram.com",
        "https://cdn.jsdelivr.net",
        "https://*.sentry.io",
        "https://*.ingest.sentry.io",
        "https://unpkg.com",
        "https://ipapi.co",
        "https://api.open-meteo.com",
        // Twilio Voice JS SDK 2.x — signaling WebSocket, insights, and roaming
        // discovery. Without these the Device.register() handshake throws
        // UnknownError(31000) at the WSTransport layer, which is what users
        // see as "call failed" on the calls.tsx page.
        "https://*.twilio.com",
        "wss://*.twilio.com",
      ],
      mediaSrc: ["'self'", "data:", "blob:", "https://zoom.us", "https://*.zoom.us", "https://storage.googleapis.com"],
      frameSrc: ["'self'", "https://*.pandadoc.com", "https://*.stripe.com", "https://*.plaid.com", "https://zoom.us", "https://*.zoom.us"],
      workerSrc: ["'self'", "blob:", "https://source.zoom.us"],
      fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://source.zoom.us"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'sameorigin' },
  // Unlocks SharedArrayBuffer for high-performance Zoom video rendering in Chrome
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: { policy: 'credentialless' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Response compression (skip SSE streams)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers.accept === 'text/event-stream') return false;
    // SSE streaming requests — compression buffers tiny SSE events in zlib,
    // preventing real-time delivery and causing client timeouts.
    if (req.query?.stream === 'true') return false;
    return compression.filter(req, res);
  },
}));

// CORS — restricted to known origins (D-C4 fix: no wildcards in production)
const CORS_ALLOWED_ORIGINS = (process.env.ASPIRE_CORS_ORIGINS || 'https://www.aspireos.app,https://aspireos.app,http://localhost:5000,http://localhost:5173,http://localhost:3000').split(',');

function validateProductionEnv(): void {
  const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
  const aspireEnv = (process.env.ASPIRE_ENV || '').trim().toLowerCase();
  // Only enforce parity when ASPIRE_ENV is explicitly set.
  if (aspireEnv && (nodeEnv === 'production') !== (aspireEnv === 'production')) {
    throw new Error(`Environment mismatch: NODE_ENV=${nodeEnv || 'unset'} ASPIRE_ENV=${aspireEnv || 'unset'}`);
  }
  if (nodeEnv !== 'production') return;
  const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim();
  if (!orchestratorUrl) {
    throw new Error('ORCHESTRATOR_URL is required in production');
  }
}
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? CORS_ALLOWED_ORIGINS
    : true, // Allow all in dev for convenience
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Suite-Id'],
}));
// No-cache for API routes only — static assets get their own cache headers below
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.json({
  limit: '1mb',
  verify: (req: any, _res, buf) => {
    // Preserve raw body for webhook signature verification (Plaid, Stripe, etc.)
    if (req.url?.includes('/webhook')) {
      req.rawBody = buf;
    }
    // Preserve raw body for tool invocation paths so we can recover from
    // wrong/missing Content-Type from Anam webhook runtime (Round 3 hotfix).
    if (req.url?.startsWith('/v1/tools') || req.url?.startsWith('/v1/agents/invoke-sync')) {
      req.rawBody = buf;
    }
  },
}));
// Round 3 hotfix: Anam's webhook runtime occasionally posts /v1/tools/* with a
// non-application/json Content-Type (or none at all). The global express.json
// above ignores those, leaving req.body = {} and breaking every tool call with
// MISSING_TASK. This second JSON parser is scoped ONLY to tool paths and accepts
// ANY content-type — if the global one already populated req.body it's a no-op.
app.use(['/v1/tools', '/v1/agents/invoke-sync'], express.json({
  limit: '1mb',
  type: () => true,
  verify: (req: any, _res, buf) => {
    if (!req.rawBody) req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Malformed JSON guard:
// body-parser throws before routes run when Content-Type is application/json
// and payload is invalid JSON (for example single quotes or truncated body).
// Convert that into a clean 400 response so logs stay actionable.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const isJsonParseError = err instanceof SyntaxError || err?.type === 'entity.parse.failed';
  if (!isJsonParseError) return next(err);

  const path = req.path || '';
  const isToolPath = path.startsWith('/v1/tools') || path.startsWith('/v1/agents/invoke-sync');
  logger.warn('[HTTP] Invalid JSON payload', {
    path,
    method: req.method,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    userAgent: req.headers['user-agent'],
    isToolPath,
  });

  return res.status(400).json({
    error: 'INVALID_JSON',
    message: isToolPath
      ? 'Tool webhook body must be valid JSON object (double quotes required).'
      : 'Request body must be valid JSON.',
  });
});

// Request timeout — 30s default, 60s for orchestrator (Law #10: timeout enforcement)
app.use((req, res, next) => {
  if (req.headers.upgrade === 'websocket') return next();
  if (req.headers.accept === 'text/event-stream') return next();
  if (req.query?.stream === 'true') return next();

  // Orchestrator + TTS routes need longer timeout (LLM inference + synthesis)
  const isLongRoute = req.path.startsWith('/api/orchestrator/') || req.path.startsWith('/api/elevenlabs/tts');
  const timeoutMs = isLongRoute ? 120_000 : 30_000;

  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn('Request timeout', { path: req.path, method: req.method });
      res.status(504).json({
        error: 'REQUEST_TIMEOUT',
        message: `Request timed out after ${timeoutMs / 1000} seconds`,
      });
    }
  }, timeoutMs);

  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));

  next();
});

app.use(routes);

// ElevenLabs agent tool webhook endpoints (/v1/tools/*)
import agentToolRoutes from './agentToolRoutes';
app.use(agentToolRoutes);

// Client-side incident reports — accepts and logs, best-effort
app.post('/admin/ops/incidents/report', express.json(), (req, res) => {
  const { title, severity, component } = req.body || {};
  logger.info('[Incident] Client report', { title, severity, component });
  res.json({ received: true });
});

try {
  const gustoRoutes = require('./gustoRoutes').default;
  app.use(gustoRoutes);
  logger.info('Gusto routes registered');
} catch (e) {
  logger.warn('Gusto routes not available, skipping');
}

try {
  const plaidRoutes = require('./plaidRoutes').default;
  app.use(plaidRoutes);
  logger.info('Plaid routes registered');
} catch (e) {
  logger.warn('Plaid routes not available, skipping');
}

try {
  const plaidWebhookHandler = require('./plaidWebhookHandler').default;
  app.use(plaidWebhookHandler);
  logger.info('Plaid webhook handler registered');
} catch (e) {
  logger.warn('Plaid webhook handler not available, skipping');
}

try {
  const quickbooksRoutes = require('./quickbooksRoutes').default;
  app.use(quickbooksRoutes);
  logger.info('QuickBooks routes registered');
} catch (e) {
  logger.warn('QuickBooks routes not available, skipping');
}

try {
  const qboWebhookHandler = require('./qboWebhookHandler').default;
  app.use(qboWebhookHandler);
  logger.info('QuickBooks webhook handler registered');
} catch (e) {
  logger.warn('QuickBooks webhook handler not available, skipping');
}

try {
  const gustoWebhookHandler = require('./gustoWebhookHandler').default;
  app.use(gustoWebhookHandler);
  logger.info('Gusto webhook handler registered');
} catch (e) {
  logger.warn('Gusto webhook handler not available, skipping');
}

try {
  const stripeConnectRoutes = require('./stripeConnectRoutes').default;
  app.use(stripeConnectRoutes);
  logger.info('Stripe Connect routes registered');
} catch (e) {
  logger.warn('Stripe Connect routes not available, skipping');
}

try {
  const financeRoutes = require('./financeRoutes').default;
  app.use(financeRoutes);
  logger.info('Finance storyline routes registered');
} catch (e) {
  logger.warn('Finance routes not available, skipping');
}

try {
  const telephonyEnterpriseRoutes = require('./telephonyEnterpriseRoutes').default;
  const { startOutboxWorker } = require('./telephonyEnterpriseRoutes');
  app.use(telephonyEnterpriseRoutes);
  if (!IS_LOCAL_SYNTHETIC_SMOKE) {
    startOutboxWorker();
  }
  logger.info('Telephony enterprise routes registered', {
    endpoints: 15,
    outbox_worker: !IS_LOCAL_SYNTHETIC_SMOKE,
  });
} catch (e) {
  logger.warn('Telephony enterprise routes not available, skipping');
}

// twilioRoutes.ts removed — all telephony now handled by telephonyEnterpriseRoutes.ts (17 endpoints)

try {
  const mailRoutes = require('./mailRoutes').default;
  app.use(mailRoutes);
  logger.info('PolarisM mail routes registered');
} catch (e) {
  logger.warn('Mail routes not available, skipping');
}

try {
  const zoomRoutes = require('./routes/zoom').default;
  app.use(zoomRoutes);
  logger.info('Zoom routes registered');
} catch (e) {
  logger.warn('Zoom routes not available, skipping');
}

try {
  const deepgramRoutes = require('./routes/deepgram').default;
  app.use(deepgramRoutes);
  logger.info('Deepgram routes registered');
} catch (e) {
  logger.warn('Deepgram routes not available, skipping');
}

if (registerObjectStorageRoutes) {
  registerObjectStorageRoutes(app);
}

try {
  const placesRoutes = require('./placesRoutes').default;
  app.use(placesRoutes);
  logger.info('Google Places proxy routes registered');
} catch (e) {
  logger.warn('Places routes not available, skipping');
}

try {
  const propertyRoutes = require('./serviceHub/property/propertyRoutes').default;
  app.use(propertyRoutes);
  logger.info('Service Hub property routes registered');
} catch (e) {
  logger.warn('Service Hub property routes not available, skipping', {
    reason: e instanceof Error ? e.message.slice(0, 160) : 'unknown',
  });
}

try {
  const aerialViewRoute = require('./serviceHub/property/aerialViewRoute').default;
  app.use(aerialViewRoute);
  logger.info('Aerial View route registered (GET /api/property/aerial-video)');
} catch (e) {
  logger.warn('Aerial View route not available, skipping', {
    reason: e instanceof Error ? e.message.slice(0, 160) : 'unknown',
  });
}

// Public client config — returns non-secret keys that the browser needs at runtime.
// Google Places API key is browser-facing by design (restricted by HTTP referrer in GCP).
// This avoids the EXPO_PUBLIC_* build-time limitation: the key comes from SM at server startup.
app.get('/api/config/public', (_req, res) => {
  res.json({
    googlePlacesApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  });
});

// Deep health check — DB connectivity, pool stats, memory, latency
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, unknown> = {
    server: true,
    uptime_s: Math.floor(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };

  // Database connectivity + latency
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
    checks.db_latency_ms = Date.now() - dbStart;
  } catch {
    checks.database = false;
    checks.db_latency_ms = Date.now() - dbStart;
  }

  // Pool statistics
  checks.pool = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };

  // Supabase admin client
  checks.supabase_admin = supabaseAdmin !== null;

  // Overall status
  const isHealthy = checks.database === true && checks.supabase_admin === true;
  const isDegraded = checks.database === true && !checks.supabase_admin;
  const status = isHealthy ? 'ok' : isDegraded ? 'degraded' : 'unhealthy';

  // Circuit breaker states (Law #10: reliability observability)
  checks.circuit_breakers = getBreakerStates();

  // Webhook idempotency cache stats
  checks.webhook_idempotency = getIdempotencyStats();

  // Pool pressure warning
  if (pool.waitingCount > 5) {
    checks.pool_pressure = 'high';
    logger.warn('Health check: high pool pressure', { waiting: pool.waitingCount });
  }

  res.status(isHealthy || isDegraded ? 200 : 503).json({
    status,
    service: 'aspire-desktop',
    version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Static assets — must come AFTER API routes so /api/* is never intercepted
// Vite dist is the production build output; fall through to index.html for SPA routing
const distPath = resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Immutable cache for hashed assets (Vite fingerprints JS/CSS with content hash)
      if (path.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  // SPA fallback — always serve index.html for unknown routes
  app.get('*', (_req, res) => {
    res.sendFile(resolve(distPath, 'index.html'));
  });
} else {
  // Dev mode — Vite handles the frontend separately
  app.get('/', (_req, res) => res.json({ status: 'Aspire Desktop Server', mode: 'development' }));
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);

async function boot(): Promise<void> {
  try {
    validateProductionEnv();
  } catch (err: unknown) {
    logger.error('Production environment validation failed', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    process.exit(1);
  }

  // Initialize Stripe (non-blocking — server starts regardless)
  initStripe().catch((err: Error) => {
    logger.error('Stripe initialization failed', { error: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Aspire Desktop Server listening on port ${PORT}`, {
      node_env: process.env.NODE_ENV || 'development',
      aspire_env: process.env.ASPIRE_ENV || 'unset',
      port: PORT,
    });
  });
}

boot().catch((err: unknown) => {
  logger.error('Fatal boot error', { error: err instanceof Error ? err.message : 'unknown' });
  process.exit(1);
});

export default app;
