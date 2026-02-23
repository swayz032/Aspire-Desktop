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

let runMigrations: any = null;
let getStripeSync: any = null;
let WebhookHandlers: any = null;
let registerObjectStorageRoutes: any = null;

try {
  runMigrations = require('stripe-replit-sync').runMigrations;
  getStripeSync = require('./stripeClient').getStripeSync;
  WebhookHandlers = require('./webhookHandlers').WebhookHandlers;
} catch (e) {
  console.warn('Stripe modules not available, skipping Stripe integration');
}

try {
  registerObjectStorageRoutes = require('./replit_integrations/object_storage').registerObjectStorageRoutes;
} catch (e) {
  console.warn('Object storage module not available, skipping');
}

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Default suite ID — bootstrapped at startup
let defaultSuiteId: string = '';
let defaultOfficeId: string = '';

// Supabase admin client for JWT verification
console.log('SUPABASE_URL set:', !!process.env.SUPABASE_URL, 'SERVICE_ROLE set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
console.log('supabaseAdmin initialized:', supabaseAdmin !== null);

// Paths that skip JWT auth (health, public booking, webhooks, static)
const PUBLIC_PATHS = [
  '/api/health',
  '/api/stripe/webhook',
  '/api/book/',             // Public booking pages
  '/api/ops-snapshot',
  '/api/sandbox/health',
  '/api/webhooks/twilio/',  // Twilio webhooks (signature-validated, no JWT)
  '/api/mail/oauth/google/callback', // Google redirects here without JWT
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
      console.error('CRITICAL: Supabase admin client unavailable — auth cannot be verified');
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
    if (suiteId) {
      await db.execute(sql`SELECT set_config('app.current_suite_id', ${suiteId}, true)`);
    }

    // Attach user info for receipt actor binding
    (req as any).authenticatedUserId = user.id;
    (req as any).authenticatedSuiteId = suiteId;

    next();
  } catch (error) {
    // Law #3: Fail closed on unexpected errors
    console.error('RLS middleware error:', error);
    res.status(500).json({ error: 'AUTH_ERROR', message: 'Authentication check failed' });
  }
});

async function initStripe() {
  if (!runMigrations || !getStripeSync) {
    console.warn('Stripe modules not loaded, skipping Stripe sync setup');
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set, skipping Stripe sync setup');
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY not set, skipping Stripe sync setup');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    const migrationPromise = Promise.race([
      runMigrations({ databaseUrl }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Stripe migration timeout')), 10000))
    ]);
    await migrationPromise;
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);

    console.log('Syncing Stripe data...');
    stripeSync.syncBackfill().then(() => {
      console.log('Stripe data synced');
    }).catch((err: Error) => {
      console.error('Error syncing Stripe data:', err);
    });
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
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
      } catch (error: any) {
        console.error('Webhook error:', error.message);
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );
}

try {
  const stripeFinanceWebhook = require('./stripeFinanceWebhook').default;
  app.use(stripeFinanceWebhook);
  console.log('Stripe finance webhook handler registered');
} catch (e) {
  console.warn('Stripe finance webhook handler not available, skipping');
}

app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  console.log('Gusto routes registered');
} catch (e) {
  console.warn('Gusto routes not available, skipping');
}

try {
  const plaidRoutes = require('./plaidRoutes').default;
  app.use(plaidRoutes);
  console.log('Plaid routes registered');
} catch (e) {
  console.warn('Plaid routes not available, skipping');
}

try {
  const plaidWebhookHandler = require('./plaidWebhookHandler').default;
  app.use(plaidWebhookHandler);
  console.log('Plaid webhook handler registered');
} catch (e) {
  console.warn('Plaid webhook handler not available, skipping');
}

try {
  const quickbooksRoutes = require('./quickbooksRoutes').default;
  app.use(quickbooksRoutes);
  console.log('QuickBooks routes registered');
} catch (e) {
  console.warn('QuickBooks routes not available, skipping');
}

try {
  const qboWebhookHandler = require('./qboWebhookHandler').default;
  app.use(qboWebhookHandler);
  console.log('QuickBooks webhook handler registered');
} catch (e) {
  console.warn('QuickBooks webhook handler not available, skipping');
}

try {
  const gustoWebhookHandler = require('./gustoWebhookHandler').default;
  app.use(gustoWebhookHandler);
  console.log('Gusto webhook handler registered');
} catch (e) {
  console.warn('Gusto webhook handler not available, skipping');
}

try {
  const stripeConnectRoutes = require('./stripeConnectRoutes').default;
  app.use(stripeConnectRoutes);
  console.log('Stripe Connect routes registered');
} catch (e) {
  console.warn('Stripe Connect routes not available, skipping');
}

try {
  const financeRoutes = require('./financeRoutes').default;
  app.use(financeRoutes);
  console.log('Finance storyline routes registered');
} catch (e) {
  console.warn('Finance routes not available, skipping');
}

try {
  const telephonyEnterpriseRoutes = require('./telephonyEnterpriseRoutes').default;
  const { startOutboxWorker } = require('./telephonyEnterpriseRoutes');
  app.use(telephonyEnterpriseRoutes);
  startOutboxWorker();
  console.log('Telephony enterprise routes registered (15 endpoints + outbox worker)');
} catch (e) {
  console.warn('Telephony enterprise routes not available, skipping');
}

// @deprecated — legacy routes kept for transition, will be removed
try {
  const twilioRoutes = require('./twilioRoutes').default;
  app.use(twilioRoutes);
  console.log('Twilio telephony routes registered (legacy)');
} catch (e) {
  console.warn('Twilio routes not available, skipping');
}

try {
  const mailRoutes = require('./mailRoutes').default;
  app.use(mailRoutes);
  console.log('PolarisM mail routes registered');
} catch (e) {
  console.warn('Mail routes not available, skipping');
}

try {
  const livekitRoutes = require('./routes/livekit').default;
  app.use(livekitRoutes);
  console.log('LiveKit routes registered');
} catch (e) {
  console.warn('LiveKit routes not available, skipping');
}

try {
  const deepgramRoutes = require('./routes/deepgram').default;
  app.use(deepgramRoutes);
  console.log('Deepgram routes registered');
} catch (e) {
  console.warn('Deepgram routes not available, skipping');
}

if (registerObjectStorageRoutes) {
  registerObjectStorageRoutes(app);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ops-snapshot', async (req, res) => {
  try {
    const snapshot: any = {
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
      const totalBalance = accounts.reduce((s: number, a: any) => s + (a.balances?.current || 0), 0);
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
  } catch (error: any) {
    console.error('Ops snapshot error:', error.message);
    res.json({
      cashPosition: { availableCash: 0, upcomingOutflows7d: 0, expectedInflows7d: 0, accountsConnected: 0 },
      providers: { plaid: false, stripe: false, gusto: false, quickbooks: false },
    });
  }
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
  } catch (e: any) {
    console.warn('Failed to load Gusto tokens:', e.message);
  }
  try {
    const { loadPlaidTokens } = require('./plaidRoutes');
    await loadPlaidTokens();
  } catch (e: any) {
    console.warn('Failed to load Plaid tokens:', e.message);
  }
  try {
    const { loadQBTokens } = require('./quickbooksRoutes');
    await loadQBTokens();
  } catch (e: any) {
    console.warn('Failed to load QuickBooks tokens:', e.message);
  }
  console.log('OAuth tokens loaded from database');

  try {
    const { runInitialSync } = require('./initialSync');
    runInitialSync(defaultSuiteId, defaultOfficeId).catch((err: any) => console.warn('Initial sync error:', err));
  } catch (e: any) {
    console.warn('Initial sync module not available:', e.message);
  }
}

async function start() {
  // Load secrets from AWS Secrets Manager (production) or .env.local (dev)
  // Must happen BEFORE any code reads process.env for provider keys
  try {
    await loadSecrets();
  } catch (err: any) {
    console.error('[FATAL] Secrets loading failed:', err.message);
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

    console.log(`Suite context: ${defaultSuiteId || 'JWT-based'}, Office: ${defaultOfficeId || 'JWT-based'}`);

    await loadOAuthTokens();
    await initStripe();
  } catch (err: any) {
    console.error('Startup initialization failed:', err.message);
    console.warn('Server will continue with JWT-based suite context');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aspire Desktop server running on port ${PORT}`);
  });
}

export { defaultSuiteId, defaultOfficeId };

start().catch(console.error);
