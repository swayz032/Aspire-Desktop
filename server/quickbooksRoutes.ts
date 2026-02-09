import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { saveToken, loadToken, deleteToken } from './tokenStore';
const QuickBooks = require('node-quickbooks');

const router = Router();

const DOMAIN = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
const REDIRECT_URI = `https://${DOMAIN}/api/quickbooks/callback`;
const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let realmId: string | null = null;
let qbo: any = null;
let tokenExpiresAt: Date | null = null;
const pendingOAuthStates = new Map<string, number>();

export async function loadQBTokens() {
  const stored = await loadToken('quickbooks');
  if (stored) {
    accessToken = stored.access_token;
    refreshToken = stored.refresh_token || null;
    realmId = stored.realm_id || null;
    tokenExpiresAt = stored.expires_at ? new Date(stored.expires_at) : null;
    initQBO();
    console.log('QuickBooks: Loaded tokens from database');
  }
}

function getClientCredentials() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function getBasicAuthHeader(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

function computeExpiresAt(expiresInSeconds = 3600): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

function isTokenExpiringSoon(): boolean {
  if (!tokenExpiresAt) return true;
  return Date.now() >= tokenExpiresAt.getTime() - 120000;
}

function initQBO() {
  const creds = getClientCredentials();
  if (!creds || !accessToken || !realmId) return null;
  qbo = new QuickBooks(
    creds.clientId,
    creds.clientSecret,
    accessToken,
    false,
    realmId,
    true,
    false,
    null,
    '2.0',
    refreshToken
  );
  return qbo;
}

function ensureQBO(): any {
  if (!qbo) initQBO();
  return qbo;
}

async function doRefreshToken(): Promise<boolean> {
  const creds = getClientCredentials();
  if (!creds || !refreshToken) {
    console.error('QuickBooks: Missing credentials or refresh token for refresh');
    return false;
  }

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${getBasicAuthHeader(creds.clientId, creds.clientSecret)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken!,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`QuickBooks token refresh failed ${response.status}: ${errorText.substring(0, 500)}`);
      return false;
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    tokenExpiresAt = computeExpiresAt(tokenData.expires_in || 3600);
    initQBO();

    await saveToken('quickbooks', {
      access_token: accessToken!,
      refresh_token: refreshToken,
      realm_id: realmId,
      expires_at: tokenExpiresAt,
    });

    console.log('QuickBooks: Token refreshed successfully');
    return true;
  } catch (error: any) {
    console.error('QuickBooks token refresh error:', error.message);
    return false;
  }
}

async function qboQueryWithRefresh(method: string, ...args: any[]): Promise<any> {
  if (isTokenExpiringSoon()) {
    console.log('QuickBooks: Token expiring soon, proactively refreshing...');
    await doRefreshToken();
  }

  try {
    return await qboQuery(method, ...args);
  } catch (err: any) {
    const errStr = JSON.stringify(err);
    const isAuthError = errStr.includes('AuthenticationFailed') ||
      errStr.includes('TOKEN_EXPIRED') ||
      errStr.includes('AuthorizationFailed') ||
      (err?.fault?.error?.[0]?.code === '3200') ||
      (err?.fault?.type === 'SERVICE' && errStr.includes('token'));

    if (isAuthError || err?.fault?.type === 'SERVICE') {
      console.log('QuickBooks: API error, attempting token refresh...');
      const refreshed = await doRefreshToken();
      if (refreshed) {
        return await qboQuery(method, ...args);
      }
    }
    throw err;
  }
}

function qboQuery(method: string, ...args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const instance = ensureQBO();
    if (!instance) return reject(new Error('Not connected to QuickBooks'));
    instance[method](...args, (err: any, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function qboReportWithRefresh(reportMethod: string, params: any): Promise<any> {
  if (isTokenExpiringSoon()) {
    console.log('QuickBooks: Token expiring soon, proactively refreshing...');
    await doRefreshToken();
  }

  const runReport = () => new Promise((resolve, reject) => {
    const instance = ensureQBO();
    if (!instance) return reject(new Error('Not connected to QuickBooks'));
    instance[reportMethod](params, (err: any, report: any) => {
      if (err) reject(err);
      else resolve(report);
    });
  });

  try {
    return await runReport();
  } catch (err: any) {
    if (err?.fault?.type === 'SERVICE' || err?.fault?.error?.[0]?.code === '3200') {
      console.log('QuickBooks: Report error, attempting token refresh...');
      const refreshed = await doRefreshToken();
      if (refreshed) {
        return await runReport();
      }
    }
    throw err;
  }
}

router.get('/api/quickbooks/authorize', (_req: Request, res: Response) => {
  const creds = getClientCredentials();
  if (!creds) {
    return res.status(503).json({ error: 'QuickBooks credentials not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingOAuthStates.set(state, Date.now());
  for (const [k, v] of pendingOAuthStates) {
    if (Date.now() - v > 600000) pendingOAuthStates.delete(k);
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: REDIRECT_URI,
    state,
  });

  const url = `${AUTH_URL}?${params.toString()}`;
  res.json({ url });
});

router.get('/api/quickbooks/callback', async (req: Request, res: Response) => {
  const creds = getClientCredentials();
  if (!creds) {
    return res.status(503).json({ error: 'QuickBooks credentials not configured' });
  }

  const { code, realmId: queryRealmId, state } = req.query;

  if (!code || !queryRealmId) {
    return res.status(400).json({ error: 'Missing code or realmId' });
  }

  if (!state || !pendingOAuthStates.has(state as string)) {
    return res.status(403).json({ error: 'Invalid OAuth state — possible CSRF attack' });
  }
  pendingOAuthStates.delete(state as string);

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${getBasicAuthHeader(creds.clientId, creds.clientSecret)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`QuickBooks token exchange failed ${response.status}: ${errorText.substring(0, 500)}`);
      return res.status(500).json({ error: 'Token exchange failed' });
    }

    const tokenData = await response.json();
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    realmId = queryRealmId as string;
    tokenExpiresAt = computeExpiresAt(tokenData.expires_in || 3600);
    initQBO();

    await saveToken('quickbooks', {
      access_token: accessToken!,
      refresh_token: refreshToken,
      realm_id: realmId,
      expires_at: tokenExpiresAt,
    });

    res.redirect('/finance-hub/connections?qb=connected');
  } catch (error: any) {
    console.error('QuickBooks callback error:', error.message);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});

router.post('/api/quickbooks/refresh', async (_req: Request, res: Response) => {
  try {
    const success = await doRefreshToken();
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Token refresh failed' });
    }
  } catch (error: any) {
    console.error('QuickBooks refresh error:', error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

router.get('/api/quickbooks/status', (_req: Request, res: Response) => {
  res.json({
    connected: !!(accessToken && realmId),
    realmId: realmId || null,
  });
});

router.post('/api/quickbooks/disconnect', async (_req: Request, res: Response) => {
  accessToken = null;
  refreshToken = null;
  realmId = null;
  qbo = null;
  tokenExpiresAt = null;
  await deleteToken('quickbooks');
  res.json({ success: true });
});

router.get('/api/quickbooks/company', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('getCompanyInfo', realmId);
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks company error:', error);
    res.status(500).json({ error: 'Failed to fetch company info' });
  }
});

router.get('/api/quickbooks/accounts', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findAccounts', { fetchAll: true });
    res.json({ accounts: data?.QueryResponse?.Account || [] });
  } catch (error: any) {
    console.error('QuickBooks accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

router.get('/api/quickbooks/profit-and-loss', async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = (req.query.end_date as string) || new Date().toISOString().split('T')[0];
    const data = await qboReportWithRefresh('reportProfitAndLoss', { start_date: startDate, end_date: endDate });
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks P&L error:', error);
    res.status(500).json({ error: 'Failed to fetch P&L report' });
  }
});

router.get('/api/quickbooks/profit-and-loss-detail', async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = (req.query.end_date as string) || new Date().toISOString().split('T')[0];
    const data = await qboReportWithRefresh('reportProfitAndLossDetail', { start_date: startDate, end_date: endDate });
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks P&L Detail error:', error);
    res.status(500).json({ error: 'Failed to fetch P&L detail report' });
  }
});

router.get('/api/quickbooks/balance-sheet', async (_req: Request, res: Response) => {
  try {
    const data = await qboReportWithRefresh('reportBalanceSheet', { date_macro: 'This Fiscal Year-to-date' });
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks Balance Sheet error:', error);
    res.status(500).json({ error: 'Failed to fetch balance sheet' });
  }
});

router.get('/api/quickbooks/cash-flow', async (_req: Request, res: Response) => {
  try {
    const data = await qboReportWithRefresh('reportCashFlow', { date_macro: 'This Fiscal Year-to-date' });
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks Cash Flow error:', error);
    res.status(500).json({ error: 'Failed to fetch cash flow report' });
  }
});

router.get('/api/quickbooks/trial-balance', async (_req: Request, res: Response) => {
  try {
    const data = await qboReportWithRefresh('reportTrialBalance', {});
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks Trial Balance error:', error);
    res.status(500).json({ error: 'Failed to fetch trial balance' });
  }
});

router.get('/api/quickbooks/general-ledger', async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = (req.query.end_date as string) || new Date().toISOString().split('T')[0];
    const data = await qboReportWithRefresh('reportGeneralLedgerDetail', {
      start_date: startDate,
      end_date: endDate,
    });
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks General Ledger error:', error);
    res.status(500).json({ error: 'Failed to fetch general ledger' });
  }
});

router.get('/api/quickbooks/aged-receivables', async (_req: Request, res: Response) => {
  try {
    const data = await qboReportWithRefresh('reportAgedReceivableDetail', {});
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks Aged Receivables error:', error);
    res.status(500).json({ error: 'Failed to fetch aged receivables' });
  }
});

router.get('/api/quickbooks/aged-payables', async (_req: Request, res: Response) => {
  try {
    const data = await qboReportWithRefresh('reportAgedPayableDetail', {});
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks Aged Payables error:', error);
    res.status(500).json({ error: 'Failed to fetch aged payables' });
  }
});

router.get('/api/quickbooks/invoices', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findInvoices', { fetchAll: true });
    res.json({ invoices: data?.QueryResponse?.Invoice || [] });
  } catch (error: any) {
    console.error('QuickBooks invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/api/quickbooks/customers', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findCustomers', { fetchAll: true });
    res.json({ customers: data?.QueryResponse?.Customer || [] });
  } catch (error: any) {
    console.error('QuickBooks customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/api/quickbooks/vendors', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findVendors', { fetchAll: true });
    res.json({ vendors: data?.QueryResponse?.Vendor || [] });
  } catch (error: any) {
    console.error('QuickBooks vendors error:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.get('/api/quickbooks/bills', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findBills', { fetchAll: true });
    res.json({ bills: data?.QueryResponse?.Bill || [] });
  } catch (error: any) {
    console.error('QuickBooks bills error:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

router.get('/api/quickbooks/payments', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findPayments', { fetchAll: true });
    res.json({ payments: data?.QueryResponse?.Payment || [] });
  } catch (error: any) {
    console.error('QuickBooks payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.get('/api/quickbooks/expenses', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findPurchases', { fetchAll: true });
    res.json({ expenses: data?.QueryResponse?.Purchase || [] });
  } catch (error: any) {
    console.error('QuickBooks expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.get('/api/quickbooks/items', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findItems', { fetchAll: true });
    res.json({ items: data?.QueryResponse?.Item || [] });
  } catch (error: any) {
    console.error('QuickBooks items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.get('/api/quickbooks/tax-codes', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findTaxCodes', { fetchAll: true });
    res.json({ taxCodes: data?.QueryResponse?.TaxCode || [] });
  } catch (error: any) {
    console.error('QuickBooks tax codes error:', error);
    res.status(500).json({ error: 'Failed to fetch tax codes' });
  }
});

router.get('/api/quickbooks/journal-entries', async (_req: Request, res: Response) => {
  try {
    const data = await qboQueryWithRefresh('findJournalEntries', { fetchAll: true });
    res.json({ journalEntries: data?.QueryResponse?.JournalEntry || [] });
  } catch (error: any) {
    console.error('QuickBooks journal entries error:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

router.post('/api/quickbooks/journal-entries', async (req: Request, res: Response) => {
  try {
    const { lines, txnDate, privateNote } = req.body;
    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'Journal entry requires at least 2 lines (debit and credit)' });
    }

    const journalEntry: any = {
      Line: lines.map((line: any) => ({
        DetailType: 'JournalEntryLineDetail',
        Amount: Math.abs(line.amount),
        Description: line.description || '',
        JournalEntryLineDetail: {
          PostingType: line.type,
          AccountRef: { value: line.accountId, name: line.accountName },
        },
      })),
    };

    if (txnDate) journalEntry.TxnDate = txnDate;
    if (privateNote) journalEntry.PrivateNote = privateNote;

    if (isTokenExpiringSoon()) await doRefreshToken();

    const data = await new Promise((resolve, reject) => {
      const instance = ensureQBO();
      if (!instance) return reject(new Error('Not connected'));
      instance.createJournalEntry(journalEntry, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks create journal entry error:', error);
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

router.get('/api/quickbooks/transaction-list', async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = (req.query.end_date as string) || new Date().toISOString().split('T')[0];
    const data = await qboReportWithRefresh('reportTransactionList', {
      start_date: startDate,
      end_date: endDate,
    });
    res.json(data);
  } catch (error: any) {
    console.error('QuickBooks Transaction List error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction list' });
  }
});

export default router;
