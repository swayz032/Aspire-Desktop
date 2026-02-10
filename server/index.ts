import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { setDefaultSuiteId, setDefaultOfficeId } from './suiteContext';

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

// RLS context middleware — MUST run before ANY route that touches DB
// Sets app.current_suite_id for row-level security enforcement (Law #6)
app.use(async (req, res, next) => {
  try {
    // Use default suite for all requests. Auth-based suite derivation comes in Phase 1.
    // SECURITY: Do NOT accept suite_id from request headers (injection risk)
    const suiteId = defaultSuiteId;
    if (suiteId) {
      await db.execute(sql`SELECT set_config('app.current_suite_id', ${suiteId}, true)`);
    }
    next();
  } catch (error) {
    next(error);
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
  try {
    // Bootstrap default suite + office
    const suiteResult = await db.execute(sql`
      SELECT app.ensure_suite('default-tenant', 'Aspire Desktop') AS suite_id
    `);
    const rows = (suiteResult.rows || suiteResult) as any[];
    defaultSuiteId = rows[0].suite_id;
    setDefaultSuiteId(defaultSuiteId);

    // Ensure default office exists
    const officeResult = await db.execute(sql`
      INSERT INTO app.offices (suite_id, label)
      VALUES (${defaultSuiteId}, 'Default Office')
      ON CONFLICT DO NOTHING
      RETURNING office_id
    `);
    const officeRows = (officeResult.rows || officeResult) as any[];
    if (officeRows.length > 0) {
      defaultOfficeId = officeRows[0].office_id;
    } else {
      const existingOffice = await db.execute(sql`
        SELECT office_id FROM app.offices WHERE suite_id = ${defaultSuiteId} LIMIT 1
      `);
      const existingRows = (existingOffice.rows || existingOffice) as any[];
      defaultOfficeId = existingRows[0]?.office_id || '';
    }
    setDefaultOfficeId(defaultOfficeId);

    console.log(`Suite bootstrapped: ${defaultSuiteId}, Office: ${defaultOfficeId}`);

    await loadOAuthTokens();
    await initStripe();
  } catch (err: any) {
    console.error('Startup initialization failed:', err.message);
    console.warn('Server will continue with limited functionality');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aspire Desktop server running on port ${PORT}`);
  });
}

export { defaultSuiteId, defaultOfficeId };

start().catch(console.error);
