import { Router, Request, Response } from 'express';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { saveToken, deleteToken, loadAllTokens, deleteAllTokens } from './tokenStore';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

interface PlaidItem {
  accessToken: string;
  itemId: string;
}

let plaidItems: PlaidItem[] = [];

const router = Router();

export async function loadPlaidTokens() {
  const stored = await loadAllTokens('plaid:');
  if (stored.length > 0) {
    plaidItems = stored
      .filter(t => t.access_token && t.item_id)
      .map(t => ({ accessToken: t.access_token, itemId: t.item_id! }));
    console.log(`Plaid: Loaded ${plaidItems.length} connected bank(s) from database`);
  } else {
    const legacyToken = await (await import('./tokenStore')).loadToken('plaid');
    if (legacyToken && legacyToken.access_token) {
      plaidItems = [{ accessToken: legacyToken.access_token, itemId: legacyToken.item_id || 'legacy' }];
      await saveToken(`plaid:${legacyToken.item_id || 'legacy'}`, {
        access_token: legacyToken.access_token,
        item_id: legacyToken.item_id || 'legacy',
      });
      await deleteToken('plaid');
      console.log('Plaid: Migrated legacy single token to multi-account format');
    }
  }
}

router.post('/api/plaid/create-link-token', async (_req: Request, res: Response) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'aspire-user-1' },
      client_name: 'Aspire',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error('Plaid create link token error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create link token' });
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
    res.json({ success: true, item_id: newItemId, total_connections: plaidItems.length });
  } catch (error: any) {
    console.error('Plaid exchange token error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

router.get('/api/plaid/accounts', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: any[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.accountsGet({ access_token: item.accessToken });
        const accounts = response.data.accounts.map((acc: any) => ({
          ...acc,
          _plaid_item_id: item.itemId,
        }));
        allAccounts.push(...accounts);
      } catch (e: any) {
        console.error(`Plaid accounts error for item ${item.itemId}:`, e?.response?.data || e.message);
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: any) {
    console.error('Plaid accounts error:', error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
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

    const allTransactions: any[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
        });
        allTransactions.push(...response.data.transactions);
      } catch (e: any) {
        console.error(`Plaid transactions error for item ${item.itemId}:`, e?.response?.data || e.message);
      }
    }
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({ transactions: allTransactions });
  } catch (error: any) {
    console.error('Plaid transactions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get('/api/plaid/balances', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: any[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.accountsBalanceGet({ access_token: item.accessToken });
        const accounts = response.data.accounts.map((acc: any) => ({
          ...acc,
          _plaid_item_id: item.itemId,
        }));
        allAccounts.push(...accounts);
      } catch (e: any) {
        console.error(`Plaid balances error for item ${item.itemId}:`, e?.response?.data || e.message);
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: any) {
    console.error('Plaid balances error:', error.message);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

router.get('/api/plaid/identity', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: any[] = [];
    for (const item of plaidItems) {
      try {
        const response = await plaidClient.identityGet({ access_token: item.accessToken });
        allAccounts.push(...response.data.accounts);
      } catch (e: any) {
        console.error(`Plaid identity error for item ${item.itemId}:`, e?.response?.data || e.message);
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: any) {
    console.error('Plaid identity error:', error.message);
    res.status(500).json({ error: 'Failed to fetch identity' });
  }
});

router.get('/api/plaid/status', (_req: Request, res: Response) => {
  res.json({
    connected: plaidItems.length > 0,
    connections: plaidItems.length,
    items: plaidItems.map(item => ({ item_id: item.itemId })),
  });
});

router.get('/api/plaid/linked-accounts', async (_req: Request, res: Response) => {
  try {
    if (plaidItems.length === 0) {
      return res.json({ accounts: [] });
    }
    const allAccounts: any[] = [];
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
            institution: (response.data as any).item?.institution_id || null,
            _plaid_item_id: item.itemId,
          });
        }
      } catch (e: any) {
        console.error(`Plaid linked-accounts error for item ${item.itemId}:`, e?.response?.data || e.message);
      }
    }
    res.json({ accounts: allAccounts });
  } catch (error: any) {
    console.error('Plaid linked-accounts error:', error.message);
    res.status(500).json({ error: 'Failed to fetch linked accounts' });
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
        if (accts.data.accounts.some((a: any) => a.account_id === account_id)) {
          matchedItem = pi;
          break;
        }
      } catch (e) {}
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
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' as any });

    const customer = await stripe.customers.create({
      source: stripeBankToken,
      metadata: {
        plaid_account_id: account_id,
        plaid_item_id: matchedItem.itemId,
      },
    });

    res.json({
      success: true,
      stripe_customer_id: customer.id,
      message: 'Bank account linked to Stripe for ACH payments',
    });
  } catch (error: any) {
    console.error('Plaid→Stripe processor error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create Stripe bank token' });
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
        if (accts.data.accounts.some((a: any) => a.account_id === account_id)) {
          matchedItem = pi;
          break;
        }
      } catch (e) {}
    }
    if (!matchedItem) {
      return res.status(404).json({ error: 'Account not found in any connected bank' });
    }

    const processorResponse = await plaidClient.processorTokenCreate({
      access_token: matchedItem.accessToken,
      account_id,
      processor: 'gusto' as any,
    });
    const processorToken = processorResponse.data.processor_token;

    const GUSTO_API_BASE = 'https://api.gusto-demo.com';
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
        res.json({
          success: true,
          gusto_linked: true,
          message: 'Bank account linked to Payroll for funding',
        });
      } else {
        res.json({
          success: true,
          gusto_linked: false,
          message: 'Processor token created but could not link to Payroll. You may need to connect Payroll first.',
        });
      }
    } else {
      res.json({
        success: true,
        gusto_linked: false,
        message: 'Processor token created. Connect Payroll first to complete bank linking.',
      });
    }
  } catch (error: any) {
    console.error('Plaid→Gusto processor error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create Gusto processor token' });
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
    res.json({ success: true, remaining: plaidItems.length });
  } else {
    plaidItems = [];
    await deleteAllTokens('plaid:');
    await deleteToken('plaid');
    res.json({ success: true, remaining: 0 });
  }
});

export default router;
