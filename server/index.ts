import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { setDefaultSuiteId, setDefaultOfficeId } from './suiteContext';
import { createClient } from '@supabase/supabase-js';
import { loadSecrets } from './secrets';
import { logger } from './logger';
import { setupTtsWebSocket } from './wsTts';

let runMigrations: ((opts: { databaseUrl: string }) => Promise<void>) | null = null;
let getStripeSync: (() => Promise<{ findOrCreateManagedWebhook: (url: string) => Promise<void>; syncBackfill: () => Promise<void> }>) | null = null;
let WebhookHandlers: { processWebhook: (body: Buffer, sig: string) => Promise<void> } | null = null;
let registerObjectStorageRoutes: ((app: express.Express) => void) | null = null;

try {
  runMigrations = require('stripe-replit-sync').runMigrations;
  getStripeSync = require('./stripeClient').getStripeSync;
  WebhookHandlers = require('./webhookHandlers').WebhookHandlers;
} catch (e) {
  logger.warn('Stripe modules not available, skipping Stripe integration');
}

try {
  registerObjectStorageRoutes = require('./replit_integrations/object_storage').registerObjectStorageRoutes;
} catch (e) {
  logger.warn('Object storage module not available, skipping');
}

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Default suite ID — bootstrapped at startup
let defaultSuiteId: string = '';
let defaultOfficeId: string = '';

// Supabase admin client for JWT verification
logger.info('Supabase config check', { supabase_url_set: !!process.env.SUPABASE_URL, service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY });
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
logger.info('Supabase admin initialized', { initialized: supabaseAdmin !== null });

// Paths that skip JWT auth (health, public booking, webhooks, static)
const PUBLIC_PATHS = [
  '/api/health',
  '/api/stripe/webhook',
  '/api/book/',             // Public booking pages
  '/api/sandbox/health',
  '/api/webhooks/twilio/',  // Twilio webhooks (signature-validated, no JWT)
  '/api/mail/oauth/google/callback', // Google redirects here without JWT
  '/api/conference/join/',  // Join code resolution — guests authenticate via short-lived code, not JWT
  '/api/ava/chat-stream',   // Anam CUSTOMER_CLIENT_V1 callback — auth via session store, not JWT
  '/api/auth/validate-invite-code', // Private beta invite gate — rate-limited, no JWT needed
  '/api/auth/signup',               // Private beta signup — rate-limited, invite code validated server-side
];

// /v1/ paths that REQUIRE auth (Law #3: Fail Closed — default deny)
const AUTH_REQUIRED_V1 = [
  '/v1/mail/',
  '/v1/domains/',
  '/v1/inbox/',
  '/v1/receipts',
];

function isPublicPath(path: string): boolean {
  // Auth-required /v1/ paths must NOT be public
  if (AUTH_REQUIRED_V1.some(p => path.startsWith(p))) return false;
  return PUBLIC_PATHS.some(p => path.startsWith(p)) || !path.startsWith('/api');
}

// RLS context middleware — Law #3: Fail Closed + Law #6: Tenant Isolation
// JWT-based suite derivation for authenticated routes.
// Public routes use defaultSuiteId (read-only, RLS-scoped).
// Authenticated routes REQUIRE valid JWT — no fallback.
app.use(async (req, res, next) => {
  try {
    // Public paths: use defaultSuiteId (read-only, no auth needed)
    if (isPublicPath(req.path)) {
      if (defaultSuiteId) {
        await db.execute(sql`SELECT set_config('app.current_suite_id', ${defaultSuiteId}, true)`);
      }
      return next();
    }

    // Authenticated paths: Law #3 — fail closed if auth unavailable
    if (!supabaseAdmin) {
      logger.error('CRITICAL: Supabase admin client unavailable — auth cannot be verified');
      return res.status(503).json({
        error: 'AUTH_UNAVAILABLE',
        message: 'Authentication service unavailable',
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      // Law #3: Fail Closed — authenticated routes REQUIRE JWT.
      // No JWT = no access to non-public API routes.
      // Client must send Authorization: Bearer <jwt> via authenticatedFetch.
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authentication required. Please sign in.',
      });
    }

    // JWT present: validate and extract suite_id
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
      });
    }

    const suiteId = user.user_metadata?.suite_id || defaultSuiteId;

    // Law #6 defense-in-depth: if x-suite-id header is present, it MUST match JWT-derived suite_id
    // This prevents header-spoofing attacks where a valid JWT holder tries to access another tenant
    const headerSuiteId = req.headers['x-suite-id'] as string | undefined;
    if (headerSuiteId && suiteId && headerSuiteId !== suiteId) {
      logger.error('TENANT_ISOLATION_VIOLATION: x-suite-id header mismatch', { header_suite_id: headerSuiteId, jwt_suite_id: suiteId, user_id: user.id });
      // Law #2: emit denial receipt for tenant isolation violation
      try {
        const { createReceipt } = require('./receiptService');
        await createReceipt({
          suiteId: 'system',
          officeId: 'system',
          actionType: 'auth.tenant_mismatch',
          inputs: { header_suite_id: headerSuiteId, jwt_suite_id: suiteId, user_id: user.id },
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
      await db.execute(sql`SELECT set_config('app.current_suite_id', ${suiteId}, true)`);
    }

    // Attach user info for receipt actor binding
    (req as any).authenticatedUserId = user.id;
    (req as any).authenticatedSuiteId = suiteId;

    next();
  } catch (error) {
    // Law #3: Fail closed on unexpected errors
    logger.error('RLS middleware error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'AUTH_ERROR', message: 'Authentication check failed' });
  }
});

async function initStripe() {
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
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
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

// CORS — restricted to known origins (D-C4 fix: no wildcards in production)
const CORS_ALLOWED_ORIGINS = (process.env.ASPIRE_CORS_ORIGINS || 'https://www.aspireos.app,https://aspireos.app,http://localhost:5000,http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? CORS_ALLOWED_ORIGINS
    : true, // Allow all in dev for convenience
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Suite-Id'],
}));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.json());
app.use(routes);

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
  startOutboxWorker();
  logger.info('Telephony enterprise routes registered', { endpoints: 15, outbox_worker: true });
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
  const livekitRoutes = require('./routes/livekit').default;
  app.use(livekitRoutes);
  logger.info('LiveKit routes registered');
} catch (e) {
  logger.warn('LiveKit routes not available, skipping');
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

// Enhanced health check (D-C15 + B-H10) — checks DB connectivity
app.get('/api/health', async (req, res) => {
  const checks: Record<string, boolean> = {
    server: true,
  };

  // Check database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Supabase admin client
  checks.supabase_admin = supabaseAdmin !== null;

  const allHealthy = Object.values(checks).every(Boolean);
  const status = allHealthy ? 'ok' : 'degraded';

  res.status(allHealthy ? 200 : 503).json({
    status,
    service: 'aspire-desktop',
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.get('/api/ops-snapshot', async (req, res) => {
  try {
    const snapshot = {
      cashPosition: { availableCash: 0, upcomingOutflows7d: 0, expectedInflows7d: 0, accountsConnected: 0 },
      providers: { plaid: false, stripe: false, gusto: false, quickbooks: false },
    };

    const safeFetch = async (url: string) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    };

    const [plaidData, stripeData, gustoData] = await Promise.all([
      safeFetch(`http://localhost:${PORT}/api/plaid/accounts`),
      safeFetch(`http://localhost:${PORT}/api/stripe/invoices/summary`),
      safeFetch(`http://localhost:${PORT}/api/gusto/status`),
    ]);

    if (plaidData?.accounts?.length > 0) {
      const accounts = plaidData.accounts;
      const totalBalance = accounts.reduce((s: number, a: Record<string, unknown>) => s + (((a.balances as Record<string, number> | undefined)?.current) || 0), 0);
      snapshot.cashPosition.availableCash = totalBalance;
      snapshot.cashPosition.accountsConnected = accounts.length;
      snapshot.providers.plaid = true;
    }

    if (stripeData?.outstanding) {
      snapshot.cashPosition.expectedInflows7d = stripeData.outstanding.total || 0;
      snapshot.providers.stripe = true;
    }

    if (gustoData?.connected) {
      snapshot.providers.gusto = true;
    }

    res.json(snapshot);
  } catch (error: unknown) {
    logger.error('Ops snapshot error', { error: error instanceof Error ? error.message : 'unknown' });
    res.json({
      cashPosition: { availableCash: 0, upcomingOutflows7d: 0, expectedInflows7d: 0, accountsConnected: 0 },
      providers: { plaid: false, stripe: false, gusto: false, quickbooks: false },
    });
  }
});

// ─── Public Landing Page (Google OAuth verification requirement) ───
// Google requires: HTTP 200 at root, product description, privacy + terms links.
// Unauthenticated visitors see this. Authenticated users get the SPA.
const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aspire — Governed AI Execution for Small Business</title>
  <meta name="description" content="Aspire is a governed AI execution platform that helps small business professionals automate invoicing, contracts, scheduling, email, and more — with full audit trails and human approval for every action.">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column}
    .hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center}
    .logo{width:72px;height:72px;border-radius:36px;background:#00BCD4;display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 0 30px rgba(0,188,212,0.3)}
    .logo span{font-size:32px;font-weight:700;color:#fff}
    h1{font-size:36px;font-weight:700;color:#fff;margin-bottom:12px}
    .tagline{font-size:18px;color:#999;max-width:520px;line-height:1.6;margin-bottom:40px}
    .features{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;max-width:700px;margin-bottom:48px}
    .feat{background:#141414;border:1px solid #222;border-radius:10px;padding:16px 20px;font-size:14px;color:#bbb}
    .cta{display:inline-block;background:#00BCD4;color:#fff;font-size:16px;font-weight:600;padding:14px 40px;border-radius:10px;text-decoration:none;transition:opacity .2s}
    .cta:hover{opacity:0.85}
    .beta-badge{display:inline-block;background:rgba(0,188,212,0.15);border:1px solid rgba(0,188,212,0.3);color:#00BCD4;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:24px}
    footer{border-top:1px solid #1a1a1a;padding:32px 24px;text-align:center}
    footer a{color:#00BCD4;text-decoration:none;margin:0 16px;font-size:14px}
    footer a:hover{text-decoration:underline}
    .contact{color:#666;font-size:13px;margin-top:16px}
  </style>
</head>
<body>
  <div class="hero">
    <div class="logo"><span>A</span></div>
    <span class="beta-badge">Private Beta</span>
    <h1>Aspire</h1>
    <p class="tagline">Governed AI execution for small business professionals. Automate invoicing, contracts, scheduling, email, and bookkeeping — with full audit trails and human approval for every action.</p>
    <div class="features">
      <div class="feat">Invoicing &amp; Payments</div>
      <div class="feat">Contracts &amp; E-Signatures</div>
      <div class="feat">Email &amp; Calendar</div>
      <div class="feat">Bookkeeping</div>
      <div class="feat">Voice AI Assistant</div>
      <div class="feat">Full Audit Trail</div>
    </div>
    <a href="/login" class="cta">Sign In to Aspire</a>
  </div>
  <footer>
    <div>
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
    </div>
    <p class="contact">Contact: support@aspireos.app &bull; Aspire OS &copy; 2026</p>
  </footer>
</body>
</html>`;

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Aspire</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#ccc;padding:48px 24px;max-width:720px;margin:0 auto;line-height:1.8}h1{color:#fff;margin-bottom:8px}h2{color:#fff;margin-top:32px;margin-bottom:8px}.updated{color:#666;margin-bottom:32px;font-size:14px}a{color:#00BCD4}p{margin-bottom:16px}</style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: February 28, 2026</p>
  <p>Aspire OS ("Aspire", "we", "us") operates the aspireos.app platform. This policy describes how we collect, use, and protect your information.</p>
  <h2>Information We Collect</h2>
  <p>We collect information you provide when creating an account (email address, name, business name, industry) and information generated through your use of the platform (invoices, contracts, calendar events, email drafts, receipts, and audit logs).</p>
  <h2>How We Use Your Information</h2>
  <p>We use your information to provide and improve the Aspire platform, process your business operations (invoicing, scheduling, email, contracts), maintain audit trails and receipts for governance compliance, and communicate with you about your account.</p>
  <h2>Data Storage &amp; Security</h2>
  <p>Your data is stored securely using Supabase (PostgreSQL) with row-level security (RLS) ensuring strict tenant isolation. All state-changing operations produce immutable audit receipts. We encrypt sensitive data at rest and in transit using industry-standard TLS 1.3.</p>
  <h2>Third-Party Services</h2>
  <p>Aspire integrates with third-party services to provide functionality: Stripe (payments), PandaDoc (contracts), Google (calendar/email), ElevenLabs (voice), and others. Each integration is governed by capability tokens with limited scope and short expiry. We share only the minimum data necessary for each operation.</p>
  <h2>Your Rights</h2>
  <p>You may request access to, correction of, or deletion of your personal data at any time by contacting support@aspireos.app. We will respond within 30 days.</p>
  <h2>Data Retention</h2>
  <p>We retain your data for as long as your account is active. Audit receipts are retained for compliance purposes. Upon account deletion, personal data is removed within 30 days; anonymized audit records may be retained.</p>
  <h2>Contact</h2>
  <p>For privacy inquiries: <a href="mailto:support@aspireos.app">support@aspireos.app</a></p>
  <p><a href="/">Back to Aspire</a></p>
</body>
</html>`;

const TERMS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service — Aspire</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#ccc;padding:48px 24px;max-width:720px;margin:0 auto;line-height:1.8}h1{color:#fff;margin-bottom:8px}h2{color:#fff;margin-top:32px;margin-bottom:8px}.updated{color:#666;margin-bottom:32px;font-size:14px}a{color:#00BCD4}p{margin-bottom:16px}</style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p class="updated">Last updated: February 28, 2026</p>
  <p>These Terms of Service ("Terms") govern your access to and use of the Aspire platform operated by Aspire OS ("Aspire", "we", "us").</p>
  <h2>Acceptance of Terms</h2>
  <p>By accessing or using Aspire, you agree to be bound by these Terms. If you do not agree, do not use the platform.</p>
  <h2>Description of Service</h2>
  <p>Aspire is a governed AI execution platform for small business professionals. The platform provides AI-assisted automation for invoicing, contracts, scheduling, email management, bookkeeping, and other business operations. All actions are governed by approval workflows and produce immutable audit receipts.</p>
  <h2>Account Responsibilities</h2>
  <p>You are responsible for maintaining the security of your account credentials. You agree to provide accurate information during registration. You are responsible for all activity under your account. Aspire is currently in private beta — access requires an invite code.</p>
  <h2>Acceptable Use</h2>
  <p>You agree not to use Aspire for any unlawful purpose, attempt to gain unauthorized access to other accounts or systems, interfere with the operation of the platform, or reverse-engineer the platform's software.</p>
  <h2>Financial Operations</h2>
  <p>Aspire facilitates financial operations (invoicing, payments) through third-party providers. You are responsible for the accuracy of financial data you provide. Aspire is not a financial institution and does not hold funds on your behalf.</p>
  <h2>Intellectual Property</h2>
  <p>The Aspire platform, including its software, design, and branding, is owned by Aspire OS. Your business data remains your property. You grant Aspire a limited license to process your data as necessary to provide the service.</p>
  <h2>Limitation of Liability</h2>
  <p>Aspire is provided "as is" during the beta period. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability shall not exceed the fees paid by you in the 12 months preceding the claim.</p>
  <h2>Termination</h2>
  <p>Either party may terminate at any time. Upon termination, your access will be revoked and your data will be handled per our Privacy Policy.</p>
  <h2>Changes to Terms</h2>
  <p>We may update these Terms. Continued use after changes constitutes acceptance.</p>
  <h2>Contact</h2>
  <p>Questions about these Terms: <a href="mailto:support@aspireos.app">support@aspireos.app</a></p>
  <p><a href="/">Back to Aspire</a></p>
</body>
</html>`;

// Serve public landing page at root (unauthenticated — no JWT check)
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(LANDING_HTML);
});

app.get('/privacy-policy', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(PRIVACY_HTML);
});

app.get('/terms', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(TERMS_HTML);
});

const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath, { maxAge: 0, etag: false }));

const distPath = path.join(process.cwd(), 'dist');
app.use('/assets', express.static(path.join(distPath, 'assets'), { maxAge: 0, etag: false, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); } }));
app.use(express.static(distPath, { maxAge: 0, etag: false }));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && req.method === 'GET') {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

async function loadOAuthTokens() {
  try {
    const { loadGustoTokens } = require('./gustoRoutes');
    await loadGustoTokens();
  } catch (e: unknown) {
    logger.warn('Failed to load Gusto tokens', { error: e instanceof Error ? e.message : 'unknown' });
  }
  try {
    const { loadPlaidTokens } = require('./plaidRoutes');
    await loadPlaidTokens();
  } catch (e: unknown) {
    logger.warn('Failed to load Plaid tokens', { error: e instanceof Error ? e.message : 'unknown' });
  }
  try {
    const { loadQBTokens } = require('./quickbooksRoutes');
    await loadQBTokens();
  } catch (e: unknown) {
    logger.warn('Failed to load QuickBooks tokens', { error: e instanceof Error ? e.message : 'unknown' });
  }
  logger.info('OAuth tokens loaded from database');

  try {
    const { runInitialSync } = require('./initialSync');
    runInitialSync(defaultSuiteId, defaultOfficeId).catch((err: unknown) => logger.warn('Initial sync error', { error: err instanceof Error ? err.message : 'unknown' }));
  } catch (e: unknown) {
    logger.warn('Initial sync module not available', { error: e instanceof Error ? e.message : 'unknown' });
  }
}

async function start() {
  // Load secrets from AWS Secrets Manager (production) or .env.local (dev)
  // Must happen BEFORE any code reads process.env for provider keys
  try {
    await loadSecrets();
  } catch (err: unknown) {
    logger.error('[FATAL] Secrets loading failed', { error: err instanceof Error ? err.message : 'unknown' });
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);  // Fail closed — server CANNOT start without secrets
    }
    // Dev mode: continue (may use .env.local values)
  }

  try {
    // Bootstrap default suite context — resilient to schema differences
    // Priority: 1) suite_profiles (public schema), 2) app.ensure_suite, 3) JWT-only mode

    // Try suite_profiles first (public schema — always available on Supabase)
    try {
      const profileResult = await db.execute(sql`
        SELECT suite_id FROM suite_profiles LIMIT 1
      `);
      const profileRows = (profileResult.rows || profileResult) as any[];
      if (profileRows.length > 0) {
        defaultSuiteId = profileRows[0].suite_id;
      }
    } catch {
      // suite_profiles might not exist yet — continue
    }

    // Fallback: try app.ensure_suite (Trust Spine schema — local Postgres)
    if (!defaultSuiteId) {
      try {
        const suiteResult = await db.execute(sql`
          SELECT app.ensure_suite('default-tenant', 'Aspire Desktop') AS suite_id
        `);
        const rows = (suiteResult.rows || suiteResult) as any[];
        defaultSuiteId = rows[0]?.suite_id || '';
      } catch {
        // app schema not available — JWT-only mode
      }
    }

    if (defaultSuiteId) {
      setDefaultSuiteId(defaultSuiteId);

      // Try to find default office
      try {
        const officeResult = await db.execute(sql`
          SELECT office_id FROM app.offices WHERE suite_id = ${defaultSuiteId} LIMIT 1
        `);
        const officeRows = (officeResult.rows || officeResult) as any[];
        defaultOfficeId = officeRows[0]?.office_id || '';
      } catch {
        // app.offices not available — office context from JWT
      }
      if (defaultOfficeId) setDefaultOfficeId(defaultOfficeId);
    }

    logger.info('Suite context initialized', { suite_id: defaultSuiteId || 'JWT-based', office_id: defaultOfficeId || 'JWT-based' });

    await loadOAuthTokens();
    await initStripe();
  } catch (err: unknown) {
    logger.error('Startup initialization failed', { error: err instanceof Error ? err.message : 'unknown' });
    logger.warn('Server will continue with JWT-based suite context');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('Aspire Desktop server running', { port: PORT });
  });

  // Mount multi-context WebSocket TTS proxy on the HTTP server
  // Provides persistent WS connection for low-latency voice with barge-in support
  try {
    setupTtsWebSocket(server);
  } catch (err: unknown) {
    logger.warn('WebSocket TTS proxy setup failed — HTTP streaming fallback active', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  // Graceful shutdown (D-C11) — drain connections before exit
  const SHUTDOWN_TIMEOUT_MS = 30_000;
  let shuttingDown = false;

  function gracefulShutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Graceful shutdown initiated', { signal, timeout_s: SHUTDOWN_TIMEOUT_MS / 1000 });

    // Stop accepting new connections
    server.close(() => {
      logger.info('All connections drained. Exiting cleanly.');
      process.exit(0);
    });

    // Force exit if connections don't drain in time
    setTimeout(() => {
      logger.error('Shutdown timeout — forcing exit with in-flight requests lost');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export { defaultSuiteId, defaultOfficeId };

start().catch((err) => logger.error('Server start failed', { error: err instanceof Error ? err.message : 'unknown' }));
