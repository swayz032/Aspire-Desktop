import { Router, Request, Response } from 'express';
import type { AuthenticatedRequest } from './types';
import crypto from 'crypto';
import { Configuration, PlaidApi, Products, CountryCode } from 'plaid';
import { saveToken, deleteToken, loadAllTokens, deleteAllTokens } from './tokenStore';
import { createTrustSpineReceipt } from './receiptService';
import { logger } from './logger';
import { resolvePlaidBasePath, resolveGustoBaseUrl } from './providerEnvironment';

const configuration = new Configuration({
  basePath: resolvePlaidBasePath(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const GUSTO_API_BASE = resolveGustoBaseUrl();

const plaidClient = new PlaidApi(configuration);

interface PlaidItem {
  accessToken: string;
  itemId: string;
}

let plaidItems: PlaidItem[] = [];

const router = Router();

// --- Helper: extract suite context from headers ---
function getSuiteContext(req: Request) {
  return {
    suiteId: req.authenticatedSuiteId || '',
    officeId: (req.headers['x-office-id'] as string) || undefined,
    actorId: req.authenticatedUserId || 'unknown',
    correlationId: (req.headers['x-correlation-id'] as string) || undefined,
  };
}

// --- Helper: emit receipt for Plaid operations ---
async function emitReceipt(
  req: Request,
  receiptType: string,
  status: 'SUCCEEDED' | 'FAILED' | 'DENIED',
  action: Record<string, unknown>,
  result: Record<string, unknown>,
) {
  const ctx = getSuiteContext(req);
  if (!ctx.suiteId) return; // Can't create receipt without suite_id
  try {
    await createTrustSpineReceipt({
      suiteId: ctx.suiteId,
      officeId: ctx.officeId,
      receiptType,
      status,
      correlationId: ctx.correlationId,
      actorType: 'USER',
      actorId: ctx.actorId,
      action,
      result,
      riskTier: 'GREEN',
      toolUsed: `plaid_${receiptType}`,
    });
  } catch (err) {
    logger.error('Receipt creation failed', { receiptType, error: err instanceof Error ? err.message : 'unknown' });
  }
}

export async function loadPlaidTokens() {
  const stored = await loadAllTokens('plaid:');
  if (stored.length > 0) {
    plaidItems = stored
      .filter(t => t.access_token && t.item_id)
      .map(t => ({ accessToken: t.access_token, itemId: t.item_id! }));
    logger.info(`Plaid: Loaded ${plaidItems.length} connected bank(s) from database`);
  } else {
    const legacyToken = await (await import('./tokenStore')).loadToken('plaid');
    if (legacyToken && legacyToken.access_token) {
      plaidItems = [{ accessToken: legacyToken.access_token, itemId: legacyToken.item_id || 'legacy' }];
      await saveToken(`plaid:${legacyToken.item_id || 'legacy'}`, {
        access_token: legacyToken.access_token,
        item_id: legacyToken.item_id || 'legacy',
      });
      await deleteToken('plaid');
      logger.info('Plaid: Migrated legacy single token to multi-account format');
    }
  }
}

// ─── OAuth Callback (Plaid redirects here after bank auth) ───────────
// Plaid Link OAuth flow: bank auth → redirect to this URL → page re-opens Plaid Link
// to complete the flow. This just serves the connections page which re-initializes Link.
router.get('/api/plaid/oauth-callback', (_req: Request, res: Response) => {
  const baseUrl = process.env.PUBLIC_BASE_URL?.trim() || 'https://www.aspireos.app';
  res.redirect(`${baseUrl}/finance-hub/connections`);
});

// ─── State-Changing Routes (receipts required) ───────────────────────

router.post('/api/plaid/create-link-token', async (req: Request, res: Response) => {
  try {
    const plaidEnv = process.env.PLAID_ENV || 'sandbox';
    const linkConfig: Parameters<typeof plaidClient.linkTokenCreate>[0] = {
      user: { client_user_id: 'aspire-user-1' },
      client_name: 'Aspire',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };
    // redirect_uri is only needed for production OAuth institutions — Sandbox test banks don't use it,
    // and Plaid rejects unregistered URIs. Only include when running in production/development.
    if (plaidEnv !== 'sandbox') {
      const baseUrl = process.env.PUBLIC_BASE_URL?.trim() || 'https://www.aspireos.app';
      linkConfig.redirect_uri = `${baseUrl}/api/plaid/oauth-callback`;
    }
    const response = await plaidClient.linkTokenCreate(linkConfig);
    await emitReceipt(req, 'plaid.link_token.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'GREEN' },
      { link_token_generated: true },
    );
    res.json({ link_token: response.data.link_token });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plaid create link token error', { error: msg });
    await emitReceipt(req, 'plaid.link_token.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'GREEN' },
      { error: msg },
    );
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' });
  }
});

router.post('/api/plaid/exchange-token', async (req: Request, res: Response) => {
  try {
    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const newAccessToken = response.data.access_token;
    const newItemId = response.data.item_id;

    const existing = plaidItems.find(item => item.itemId === newItemId);
    if (existing) {
      existing.accessToken = newAccessToken;
    } else {
      plaidItems.push({ accessToken: newAccessToken, itemId: newItemId });
    }

    await saveToken(`plaid:${newItemId}`, {
      access_token: newAccessToken,
      item_id: newItemId,
    });
    await emitReceipt(req, 'plaid.token.exchange', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', item_id: newItemId },
      { total_connections: plaidItems.length },
    );
    res.json({ success: true, item_id: newItemId, total_connections: plaidItems.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plaid exchange token error', { error: msg });
    await emitReceipt(req, 'plaid.token.exchange', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' });
  }
});

router.post('/api/plaid/processor/stripe', async (req: Request, res: Response) => {
  try {
    const { account_id } = req.body;
    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }
    if (plaidItems.length === 0) {
      return res.status(404).json({ error: 'No Plaid connection found. Connect a bank first.' });
    }

    let matchedItem: PlaidItem | undefined;
    for (const pi of plaidItems) {
      try {
        const accts = await plaidClient.accountsGet({ access_token: pi.accessToken });
        if (accts.data.accounts.some((a) => a.account_id === account_id)) {
          matchedItem = pi;
          break;
        }
      } catch (e: unknown) {
        logger.warn('Plaid accountsGet failed during Stripe processor match', {
          item_id: pi.itemId,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
    if (!matchedItem) {
      return res.status(404).json({ error: 'Account not found in any connected bank' });
    }

    const tokenResponse = await plaidClient.processorStripeBankAccountTokenCreate({
      access_token: matchedItem.accessToken,
      account_id,
    });
    const stripeBankToken = tokenResponse.data.stripe_bank_account_token;

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    const customer = await stripe.customers.create({
      source: stripeBankToken,
      metadata: {
        plaid_account_id: account_id,
        plaid_item_id: matchedItem.itemId,
      },
    });

    await emitReceipt(req, 'plaid.processor.stripe', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'RED', account_id, item_id: matchedItem.itemId },
      { stripe_customer_id: customer.id },
    );
    res.json({
      success: true,
      stripe_customer_id: customer.id,
      message: 'Bank account linked to Stripe for ACH payments',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plaid->Stripe processor error', { error: msg });
    await emitReceipt(req, 'plaid.processor.stripe', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'RED' },
      { error: msg },
    );
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' });
  }
});

router.post('/api/plaid/processor/gusto', async (req: Request, res: Response) => {
  try {
    const { account_id } = req.body;
    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    let matchedItem: PlaidItem | undefined;
    for (const pi of plaidItems) {
      try {
        const accts = await plaidClient.accountsGet({ access_token: pi.accessToken });
        if (accts.data.accounts.some((a) => a.account_id === account_id)) {
          matchedItem = pi;
          break;
        }
      } catch (e: unknown) {
        logger.warn('Plaid accountsGet failed during Gusto processor match', {
          item_id: pi.itemId,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
    if (!matchedItem) {
      return res.status(404).json({ error: 'Account not found in any connected bank' });
    }

    const processorResponse = await plaidClient.processorTokenCreate({
      access_token: matchedItem.accessToken,
      account_id,
      processor: 'gusto' as Parameters<typeof plaidClient.processorTokenCreate>[0]['processor'],
    });
    const processorToken = processorResponse.data.processor_token;

    const { getCurrentAccessToken } = await import('./gustoRoutes');
    const gustoToken = getCurrentAccessToken();

    if (gustoToken) {
      const gustoResp = await fetch(`${GUSTO_API_BASE}/v1/plaid/processor_token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gustoToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ processor_token: processorToken }),
      });

      if (gustoResp.ok) {
        await emitReceipt(req, 'plaid.processor.gusto', 'SUCCEEDED',
          { method: 'POST', path: req.path, risk_tier: 'RED', account_id, item_id: matchedItem.itemId },
          { gusto_linked: true },
        );
        res.json({
          success: true,
          gusto_linked: true,
          message: 'Bank account linked to Payroll for funding',
        });
      } else {
        await emitReceipt(req, 'plaid.processor.gusto', 'SUCCEEDED',
          { method: 'POST', path: req.path, risk_tier: 'RED', account_id, item_id: matchedItem.itemId },
          { gusto_linked: false, gusto_status: gustoResp.status },
        );
        res.json({
          success: true,
          gusto_linked: false,
          message: 'Processor token created but could not link to Payroll. You may need to connect Payroll first.',
        });
      }
    } else {
      await emitReceipt(req, 'plaid.processor.gusto', 'SUCCEEDED',
        { method: 'POST', path: req.path, risk_tier: 'RED', account_id, item_id: matchedItem.itemId },
        { gusto_linked: false, reason: 'no_gusto_token' },
      );
      res.json({
        success: true,
        gusto_linked: false,
        message: 'Processor token created. Connect Payroll first to complete bank linking.',
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Plaid->Gusto processor error', { error: msg });
    await emitReceipt(req, 'plaid.processor.gusto', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'RED' },
      { error: msg },
    );
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' });
  }
});

router.post('/api/plaid/disconnect', async (req: Request, res: Response) => {
  const { item_id } = req.body || {};

  if (item_id) {
    const idx = plaidItems.findIndex(item => item.itemId === item_id);
    if (idx >= 0) {
      plaidItems.splice(idx, 1);
      await deleteToken(`plaid:${item_id}`);
    }
    await emitReceipt(req, 'plaid.disconnect', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', item_id },
      { remaining: plaidItems.length },
    );
    res.json({ success: true, remaining: plaidItems.length });
  } else {
    const disconnectedCount = plaidItems.length;
    plaidItems = [];
    await deleteAllTokens('plaid:');
    await deleteToken('plaid');
    await emitReceipt(req, 'plaid.disconnect', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', disconnect_all: true },
      { disconnected_count: disconnectedCount, remaining: 0 },
    );
    res.json({ success: true, remaining: 0 });
  }
});

// ─── Read-Only Routes (no receipts, structured logging only) ─────────

router.get('/api/plaid/accounts', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: Record<string, any>[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.accountsGet({ access_token: item.accessToken });
        const accounts = response.data.accounts.map((acc) => ({
          ...acc,
          _plaid_item_id: item.itemId,
        }));
        allAccounts.push(...accounts);
      } catch (e: unknown) {
        logger.error('Plaid accounts error for item', {
          item_id: item.itemId,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Plaid accounts error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

router.get('/api/plaid/transactions', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ transactions: [] });
    }
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const allTransactions: Record<string, any>[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
        });
        allTransactions.push(...response.data.transactions);
      } catch (e: unknown) {
        logger.error('Plaid transactions error for item', {
          item_id: item.itemId,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({ transactions: allTransactions });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Plaid transactions error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

router.get('/api/plaid/balances', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: Record<string, any>[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.accountsBalanceGet({ access_token: item.accessToken });
        const accounts = response.data.accounts.map((acc) => ({
          ...acc,
          _plaid_item_id: item.itemId,
        }));
        allAccounts.push(...accounts);
      } catch (e: unknown) {
        logger.error('Plaid balances error for item', {
          item_id: item.itemId,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Plaid balances error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

router.get('/api/plaid/identity', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: Record<string, any>[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.identityGet({ access_token: item.accessToken });
        allAccounts.push(...response.data.accounts);
      } catch (e: unknown) {
        logger.error('Plaid identity error for item', {
          item_id: item.itemId,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Plaid identity error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

router.get('/api/plaid/status', async (_req: Request, res: Response) => {
  if (plaidItems.length === 0) {
    return res.json({
      connected: false,
      healthy: false,
      connections: 0,
      items: [],
      detail: 'Not connected',
    });
  }

  let healthyCount = 0;
  for (const item of plaidItems) {
    try {
      await plaidClient.accountsGet({ access_token: item.accessToken });
      healthyCount += 1;
    } catch (error: unknown) {
      logger.warn('Plaid health check failed for item', {
        item_id: item.itemId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const fullyHealthy = healthyCount === plaidItems.length;
  res.json({
    connected: true,
    healthy: fullyHealthy,
    connections: plaidItems.length,
    healthyConnections: healthyCount,
    items: plaidItems.map(item => ({ item_id: item.itemId })),
    detail: fullyHealthy
      ? 'Healthy · All bank links reachable'
      : `Degraded · ${healthyCount}/${plaidItems.length} bank links reachable`,
  });
});

router.get('/api/plaid/linked-accounts', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: Record<string, any>[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.accountsGet({ access_token: item.accessToken });
        for (const acc of response.data.accounts) {
          allAccounts.push({
            account_id: acc.account_id,
            name: acc.name || acc.official_name || 'Bank Account',
            official_name: acc.official_name,
            mask: acc.mask,
            type: acc.type,
            subtype: acc.subtype,
            institution: (response.data as Record<string, any>).item?.institution_id || null,
            _plaid_item_id: item.itemId,
          });
        }
      } catch (e: unknown) {
        logger.error('Plaid linked-accounts error for item', {
          item_id: item.itemId,
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Plaid linked-accounts error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

export default router;
