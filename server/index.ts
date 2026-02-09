import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { db } from './db';
import { sql } from 'drizzle-orm';

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

async function initDatabase() {
  console.log('Initializing database tables...');
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      business_name TEXT,
      booking_slug TEXT UNIQUE,
      logo_url TEXT,
      accent_color TEXT,
      stripe_customer_id TEXT,
      stripe_account_id TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      duration INTEGER NOT NULL,
      price INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd' NOT NULL,
      color TEXT DEFAULT '#4facfe',
      is_active BOOLEAN DEFAULT true NOT NULL,
      stripe_price_id TEXT,
      stripe_product_id TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS availability (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL,
      service_id UUID REFERENCES services(id) NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT,
      client_notes TEXT,
      scheduled_at TIMESTAMP NOT NULL,
      duration INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      payment_status TEXT DEFAULT 'unpaid' NOT NULL,
      stripe_payment_intent_id TEXT,
      stripe_checkout_session_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd' NOT NULL,
      cancelled_at TIMESTAMP,
      cancel_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS buffer_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
      before_buffer INTEGER DEFAULT 0 NOT NULL,
      after_buffer INTEGER DEFAULT 15 NOT NULL,
      minimum_notice INTEGER DEFAULT 60 NOT NULL,
      max_advance_booking INTEGER DEFAULT 30 NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS front_desk_setup (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
      line_mode TEXT DEFAULT 'ASPIRE_NUMBER',
      aspire_number_e164 TEXT,
      existing_number_e164 TEXT,
      forwarding_verified BOOLEAN DEFAULT false,
      business_name TEXT,
      business_hours JSONB,
      after_hours_mode TEXT DEFAULT 'TAKE_MESSAGE',
      pronunciation TEXT,
      enabled_reasons JSONB DEFAULT '[]',
      questions_by_reason JSONB DEFAULT '{}',
      target_by_reason JSONB DEFAULT '{}',
      busy_mode TEXT DEFAULT 'TAKE_MESSAGE',
      team_members JSONB DEFAULT '[]',
      setup_complete BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      realm_id TEXT,
      company_uuid TEXT,
      item_id TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS finance_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      suite_id TEXT NOT NULL,
      office_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_account_id TEXT,
      status TEXT DEFAULT 'connected' NOT NULL,
      scopes JSONB,
      last_sync_at TIMESTAMP,
      last_webhook_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_connections_suite_office_provider
    ON finance_connections (suite_id, office_id, provider)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS finance_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID REFERENCES finance_connections(id) NOT NULL,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      expires_at TIMESTAMP,
      rotation_version INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS finance_events (
      event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      suite_id TEXT NOT NULL,
      office_id TEXT NOT NULL,
      connection_id UUID REFERENCES finance_connections(id),
      provider TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at TIMESTAMP NOT NULL,
      amount INTEGER,
      currency TEXT DEFAULT 'usd',
      status TEXT DEFAULT 'posted',
      entity_refs JSONB,
      raw_hash TEXT,
      receipt_id UUID,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS finance_events_idempotency_idx
    ON finance_events (suite_id, office_id, provider, provider_event_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_finance_events_suite_office_occurred
    ON finance_events (suite_id, office_id, occurred_at)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS finance_entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      suite_id TEXT NOT NULL,
      office_id TEXT NOT NULL,
      connection_id UUID REFERENCES finance_connections(id),
      provider TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS finance_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      suite_id TEXT NOT NULL,
      office_id TEXT NOT NULL,
      generated_at TIMESTAMP NOT NULL,
      chapter_now JSONB,
      chapter_next JSONB,
      chapter_month JSONB,
      chapter_reconcile JSONB,
      chapter_actions JSONB,
      sources JSONB,
      staleness JSONB,
      receipt_id UUID,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_finance_snapshots_suite_office
    ON finance_snapshots (suite_id, office_id)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS receipts (
      receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      suite_id TEXT NOT NULL,
      office_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      inputs_hash TEXT,
      outputs_hash TEXT,
      policy_decision_id TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_receipts_suite_office
    ON receipts (suite_id, office_id)
  `);

  console.log('Database tables ready');
}

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
    runInitialSync('default', 'default').catch((err: any) => console.warn('Initial sync error:', err));
  } catch (e: any) {
    console.warn('Initial sync module not available:', e.message);
  }
}

async function start() {
  await initDatabase();
  await loadOAuthTokens();
  await initStripe();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aspire Desktop server running on port ${PORT}`);
  });
}

start().catch(console.error);
