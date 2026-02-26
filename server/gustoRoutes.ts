import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { saveToken, loadToken, deleteToken } from './tokenStore';
import { createTrustSpineReceipt } from './receiptService';
import { logger } from './logger';

const router = Router();

const GUSTO_API_BASE = 'https://api.gusto-demo.com';
const GUSTO_API_VERSION = '2025-06-15';
const GUSTO_AUTH_URL = 'https://api.gusto-demo.com/oauth/authorize';
const GUSTO_TOKEN_URL = 'https://api.gusto-demo.com/oauth/token';

const DOMAIN = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
const GUSTO_REDIRECT_URI = `https://${DOMAIN}/api/gusto/callback`;

let currentAccessToken = process.env.GUSTO_ACCESS_TOKEN || '';
let currentRefreshToken = process.env.GUSTO_REFRESH_TOKEN || '';
let currentCompanyUuid = process.env.GUSTO_COMPANY_UUID || '';
let tokenExpiresAt: Date | null = null;

// --- Helper: extract suite context from headers ---
function getSuiteContext(req: Request) {
  return {
    suiteId: (req.headers['x-suite-id'] as string) || '',
    officeId: (req.headers['x-office-id'] as string) || undefined,
    actorId: (req.headers['x-actor-id'] as string) || (req.headers['x-user-id'] as string) || 'unknown',
    correlationId: (req.headers['x-correlation-id'] as string) || undefined,
  };
}

// --- Helper: emit receipt for Gusto operations ---
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
    });
  } catch (err) {
    logger.error('Receipt creation failed', { receiptType, error: err instanceof Error ? err.message : 'unknown' });
  }
}

export async function loadGustoTokens() {
  const stored = await loadToken('gusto');
  if (stored) {
    currentAccessToken = stored.access_token;
    currentRefreshToken = stored.refresh_token || currentRefreshToken;
    currentCompanyUuid = stored.company_uuid || currentCompanyUuid;
    tokenExpiresAt = stored.expires_at || null;
    logger.info('Gusto: Loaded tokens from database');
  }
}

const pendingOAuthStates = new Map<string, number>();

function getGustoHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Gusto-API-Version': GUSTO_API_VERSION,
  };
}

function getCompanyUuid(): string | null {
  return currentCompanyUuid || process.env.GUSTO_COMPANY_UUID || null;
}

function computeExpiresAt(expiresInSeconds = 7200): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

function isTokenExpiringSoon(): boolean {
  if (!tokenExpiresAt) return false;
  return Date.now() >= tokenExpiresAt.getTime() - 60000;
}

router.get('/api/gusto/authorize', (_req: Request, res: Response) => {
  const clientId = process.env.GUSTO_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'Gusto client ID not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  pendingOAuthStates.set(state, Date.now());
  for (const [k, v] of pendingOAuthStates) {
    if (Date.now() - v > 600000) pendingOAuthStates.delete(k);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: GUSTO_REDIRECT_URI,
    state,
  });

  const url = `${GUSTO_AUTH_URL}?${params.toString()}`;
  res.json({ url });
});

router.get('/api/gusto/callback', async (req: Request, res: Response) => {
  const clientId = process.env.GUSTO_CLIENT_ID;
  const clientSecret = process.env.GUSTO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: 'Gusto credentials not configured' });
  }

  const { code, state } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  if (!state || !pendingOAuthStates.has(state as string)) {
    return res.status(403).json({ error: 'Invalid OAuth state' });
  }
  pendingOAuthStates.delete(state as string);

  try {
    const response = await fetch(GUSTO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: GUSTO_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Gusto token exchange failed', { status: response.status, detail: errorText.substring(0, 500) });
      await emitReceipt(req, 'gusto.oauth.callback', 'FAILED',
        { method: 'GET', path: req.path, risk_tier: 'YELLOW' },
        { error: `Token exchange failed with status ${response.status}` },
      );
      return res.status(500).json({ error: 'Token exchange failed' });
    }

    const tokenData = await response.json();
    currentAccessToken = tokenData.access_token;
    currentRefreshToken = tokenData.refresh_token;
    tokenExpiresAt = computeExpiresAt(tokenData.expires_in || 7200);
    logger.info('Gusto: OAuth token exchange successful');

    try {
      const companiesRes = await fetch(`${GUSTO_API_BASE}/v1/me`, {
        headers: getGustoHeaders(currentAccessToken),
      });
      if (companiesRes.ok) {
        const meData = await companiesRes.json();
        const roles = meData.roles || {};
        const payrollAdmin = roles.payroll_admin;
        if (payrollAdmin?.companies?.length > 0) {
          currentCompanyUuid = payrollAdmin.companies[0].uuid;
          logger.info('Gusto: Company UUID set', { companyUuid: currentCompanyUuid });
        }
      }
    } catch (e: unknown) {
      logger.error('Gusto: Failed to fetch company UUID', { error: e instanceof Error ? e.message : 'Unknown error' });
    }

    await saveToken('gusto', {
      access_token: currentAccessToken,
      refresh_token: currentRefreshToken,
      company_uuid: currentCompanyUuid || undefined,
      expires_at: tokenExpiresAt,
    });

    await emitReceipt(req, 'gusto.oauth.callback', 'SUCCEEDED',
      { method: 'GET', path: req.path, risk_tier: 'YELLOW' },
      { company_uuid: currentCompanyUuid || 'unknown' },
    );

    res.redirect('/finance-hub/connections?gusto=connected');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto callback error', { error: msg });
    await emitReceipt(req, 'gusto.oauth.callback', 'FAILED',
      { method: 'GET', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});

async function refreshToken(): Promise<boolean> {
  const clientId = process.env.GUSTO_CLIENT_ID;
  const clientSecret = process.env.GUSTO_CLIENT_SECRET;

  if (!clientId || !clientSecret || !currentRefreshToken) {
    logger.error('Gusto: Missing client credentials or refresh token for token refresh');
    return false;
  }

  try {
    const response = await fetch(`${GUSTO_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: currentRefreshToken,
        grant_type: 'refresh_token',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Gusto token refresh failed', { status: response.status, detail: text.substring(0, 300) });
      return false;
    }

    const data = await response.json();
    currentAccessToken = data.access_token;
    currentRefreshToken = data.refresh_token;
    tokenExpiresAt = computeExpiresAt(data.expires_in || 7200);
    logger.info('Gusto: Token refreshed successfully');
    await saveToken('gusto', {
      access_token: currentAccessToken,
      refresh_token: currentRefreshToken,
      company_uuid: currentCompanyUuid || undefined,
      expires_at: tokenExpiresAt,
    });
    return true;
  } catch (error: unknown) {
    logger.error('Gusto token refresh error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
}

async function gustoFetch(url: string, retried = false): Promise<unknown> {
  if (!currentAccessToken) {
    throw new Error('No Gusto access token');
  }

  if (isTokenExpiringSoon() && !retried) {
    logger.info('Gusto: Token expiring soon, proactively refreshing...');
    await refreshToken();
  }

  const response = await fetch(url, { headers: getGustoHeaders(currentAccessToken) });

  if (response.status === 401 && !retried) {
    logger.info('Gusto: 401 received, attempting token refresh...');
    const refreshed = await refreshToken();
    if (refreshed) {
      return gustoFetch(url, true);
    }
    throw new Error('Gusto token expired and refresh failed');
  }

  const text = await response.text();

  if (!response.ok) {
    logger.error('Gusto API error', { status: response.status, detail: text.substring(0, 500) });
    throw new Error(`Gusto API returned ${response.status}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    logger.error('Gusto API returned non-JSON', { detail: text.substring(0, 500) });
    throw new Error('Invalid JSON response from Gusto');
  }
}

async function gustoMutate(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown, retried = false): Promise<unknown> {
  if (!currentAccessToken) {
    throw new Error('No Gusto access token');
  }

  if (isTokenExpiringSoon() && !retried) {
    await refreshToken();
  }

  const options: RequestInit = {
    method,
    headers: getGustoHeaders(currentAccessToken),
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401 && !retried) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return gustoMutate(url, method, body, true);
    }
    throw new Error('Gusto token expired and refresh failed');
  }

  const text = await response.text();

  if (!response.ok) {
    logger.error('Gusto API mutate error', { method, status: response.status, detail: text.substring(0, 500) });
    throw new Error(`Gusto API returned ${response.status}`);
  }

  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function getSystemToken(): Promise<string> {
  const clientId = process.env.GUSTO_CLIENT_ID;
  const clientSecret = process.env.GUSTO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Gusto client credentials not configured');
  }

  const response = await fetch(GUSTO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'system_access',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Gusto system token failed', { status: response.status, detail: errorText.substring(0, 500) });
    throw new Error('Failed to obtain system access token');
  }

  const data = await response.json();
  return data.access_token;
}

router.post('/api/gusto/create-company', async (req: Request, res: Response) => {
  try {
    const { user, company } = req.body;
    if (!user?.first_name || !user?.last_name || !user?.email || !company?.name) {
      return res.status(400).json({ error: 'Missing required fields: user.first_name, user.last_name, user.email, company.name' });
    }

    const systemToken = await getSystemToken();

    const createRes = await fetch(`${GUSTO_API_BASE}/v1/partner_managed_companies`, {
      method: 'POST',
      headers: getGustoHeaders(systemToken),
      body: JSON.stringify({
        user: {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
        },
        company: {
          name: company.name,
        },
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      logger.error('Gusto create company failed', { status: createRes.status, detail: errorText.substring(0, 500) });
      await emitReceipt(req, 'gusto.company.create', 'FAILED',
        { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_name: company.name },
        { error: `Gusto API returned ${createRes.status}` },
      );
      return res.status(createRes.status).json({ error: 'Failed to create partner managed company', detail: errorText.substring(0, 500) });
    }

    const data = await createRes.json();
    const companyUuid = data.company_uuid || data.uuid;
    const accessToken = data.access_token;
    const refreshTokenValue = data.refresh_token;

    currentAccessToken = accessToken;
    currentRefreshToken = refreshTokenValue;
    currentCompanyUuid = companyUuid;
    tokenExpiresAt = computeExpiresAt(7200);

    await saveToken('gusto', {
      access_token: currentAccessToken,
      refresh_token: currentRefreshToken,
      company_uuid: currentCompanyUuid,
      expires_at: tokenExpiresAt,
    });

    logger.info('Gusto: Partner managed company created', { companyUuid });
    await emitReceipt(req, 'gusto.company.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_name: company.name },
      { company_uuid: companyUuid },
    );
    res.json({ success: true, company_uuid: companyUuid });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create company error', { error: msg });
    await emitReceipt(req, 'gusto.company.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/gusto/migrate', async (req: Request, res: Response) => {
  try {
    const companyUuid = getCompanyUuid();
    if (!companyUuid || !currentAccessToken) {
      return res.status(400).json({ error: 'No Gusto company connected. Complete OAuth first.' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }

    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
      || req.socket.remoteAddress
      || '127.0.0.1';

    const migrateRes = await fetch(`${GUSTO_API_BASE}/v1/partner_managed_companies/${companyUuid}/migrate`, {
      method: 'PUT',
      headers: getGustoHeaders(currentAccessToken),
      body: JSON.stringify({
        email,
        ip_address: ipAddress,
        external_user_id: 'aspire-founder',
      }),
    });

    if (!migrateRes.ok) {
      const errorText = await migrateRes.text();
      logger.error('Gusto migration failed', { status: migrateRes.status, detail: errorText.substring(0, 500) });
      await emitReceipt(req, 'gusto.company.migrate', 'FAILED',
        { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
        { error: `Gusto API returned ${migrateRes.status}` },
      );
      return res.status(migrateRes.status).json({ error: 'Migration failed', detail: errorText.substring(0, 500) });
    }

    const data = await migrateRes.json();
    logger.info('Gusto: Company migrated successfully', { companyUuid });
    await emitReceipt(req, 'gusto.company.migrate', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { migrated: true },
    );
    res.json({ success: true, data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto migration error', { error: msg });
    await emitReceipt(req, 'gusto.company.migrate', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.get('/api/gusto/status', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid || !currentAccessToken) {
    return res.json({ connected: false, detail: 'Gusto credentials not configured' });
  }

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}`) as Record<string, unknown>;
    res.json({
      connected: true,
      companyName: data.name || data.trade_name || 'Connected',
      ein: data.ein,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.json({ connected: false, detail: msg });
  }
});

router.get('/api/gusto/company', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto company fetch error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch company data' });
  }
});

router.get('/api/gusto/employees', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/employees`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto employees fetch error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/api/gusto/employees/:uuid', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto employee detail error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch employee details' });
  }
});

router.get('/api/gusto/payrolls', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto payrolls fetch error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch payrolls' });
  }
});

router.get('/api/gusto/payrolls/:uuid', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/payrolls/${req.params.uuid}`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto payroll detail error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch payroll details' });
  }
});

router.get('/api/gusto/pay-schedules', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/pay_schedules`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto pay schedules error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch pay schedules' });
  }
});

router.get('/api/gusto/departments', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/departments`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto departments error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.get('/api/gusto/contractors', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/contractors`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto contractors error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

router.get('/api/gusto/locations', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/locations`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto locations error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

router.get('/api/gusto/bank-accounts', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/bank_accounts`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto bank accounts error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

router.get('/api/gusto/time-off-policies', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/time_off_policies`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto time-off policies error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch time-off policies' });
  }
});

router.get('/api/gusto/federal-tax-details', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/federal_tax_details`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto federal tax details error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch federal tax details' });
  }
});

router.put('/api/gusto/federal-tax-details', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/federal_tax_details`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.federal_tax.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update federal tax details error', { error: msg });
    await emitReceipt(req, 'gusto.federal_tax.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update federal tax details' });
  }
});

router.get('/api/gusto/contractor-payments', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/contractor_payments`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto contractor payments error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch contractor payments' });
  }
});

router.post('/api/gusto/employees', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/employees`, 'POST', req.body);
    await emitReceipt(req, 'gusto.employee.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { employee: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create employee error', { error: msg });
    await emitReceipt(req, 'gusto.employee.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/api/gusto/employees/:uuid', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.employee.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update employee error', { error: msg });
    await emitReceipt(req, 'gusto.employee.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.get('/api/gusto/employees/:uuid/federal-taxes', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/federal_taxes`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto employee federal taxes error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch employee federal taxes' });
  }
});

router.put('/api/gusto/employees/:uuid/federal-taxes', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/federal_taxes`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.employee_federal_tax.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update employee federal taxes error', { error: msg });
    await emitReceipt(req, 'gusto.employee_federal_tax.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update employee federal taxes' });
  }
});

router.get('/api/gusto/employees/:uuid/state-taxes', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/state_taxes`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto employee state taxes error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch employee state taxes' });
  }
});

router.put('/api/gusto/employees/:uuid/state-taxes', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/state_taxes`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.employee_state_tax.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update employee state taxes error', { error: msg });
    await emitReceipt(req, 'gusto.employee_state_tax.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update employee state taxes' });
  }
});

router.get('/api/gusto/employees/:uuid/jobs', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/jobs`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto employee jobs error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch employee jobs' });
  }
});

router.post('/api/gusto/employees/:uuid/jobs', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/jobs`, 'POST', req.body);
    await emitReceipt(req, 'gusto.employee_job.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { job: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create employee job error', { error: msg });
    await emitReceipt(req, 'gusto.employee_job.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create employee job' });
  }
});

router.get('/api/gusto/employees/:uuid/time-off-balances', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/time_off_activities`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto employee time-off balances error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch employee time-off balances' });
  }
});

router.get('/api/gusto/time-off-requests', async (_req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/time_off_requests`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto time-off requests error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch time-off requests' });
  }
});

router.post('/api/gusto/time-off-requests', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/time_off_requests`, 'POST', req.body);
    await emitReceipt(req, 'gusto.time_off_request.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { time_off_request: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create time-off request error', { error: msg });
    await emitReceipt(req, 'gusto.time_off_request.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create time-off request' });
  }
});

router.put('/api/gusto/time-off-requests/:uuid', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/time_off_requests/${req.params.uuid}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.time_off_request.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', request_uuid: req.params.uuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update time-off request error', { error: msg });
    await emitReceipt(req, 'gusto.time_off_request.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', request_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update time-off request' });
  }
});

router.post('/api/gusto/payrolls', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls`, 'POST', req.body);
    await emitReceipt(req, 'gusto.payroll.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { payroll: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create payroll error', { error: msg });
    await emitReceipt(req, 'gusto.payroll.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create payroll' });
  }
});

router.put('/api/gusto/payrolls/:uuid', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/payrolls/${req.params.uuid}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.payroll.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', payroll_uuid: req.params.uuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update payroll error', { error: msg });
    await emitReceipt(req, 'gusto.payroll.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', payroll_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update payroll' });
  }
});

router.put('/api/gusto/payrolls/:uuid/calculate', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls/${req.params.uuid}/calculate`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.payroll.calculate', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', payroll_uuid: req.params.uuid, company_uuid: companyUuid },
      { calculated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto calculate payroll error', { error: msg });
    await emitReceipt(req, 'gusto.payroll.calculate', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', payroll_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to calculate payroll' });
  }
});

router.get('/api/gusto/payrolls/:uuid/prepare', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls/${req.params.uuid}`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto prepare payroll error', { error: msg });
    res.status(500).json({ error: 'Failed to prepare payroll' });
  }
});

router.put('/api/gusto/payrolls/:uuid/prepare', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls/${req.params.uuid}/prepare`, 'PUT', req.body || {});
    await emitReceipt(req, 'gusto.payroll.prepare', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', payroll_uuid: req.params.uuid, company_uuid: companyUuid },
      { prepared: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto prepare payroll error', { error: msg });
    await emitReceipt(req, 'gusto.payroll.prepare', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', payroll_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: msg || 'Failed to prepare/calculate payroll' });
  }
});

router.get('/api/gusto/payrolls/:uuid/receipt', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/payrolls/${req.params.uuid}/receipt`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto payroll receipt error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch payroll receipt' });
  }
});

router.post('/api/gusto/contractors', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/contractors`, 'POST', req.body);
    await emitReceipt(req, 'gusto.contractor.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { contractor: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create contractor error', { error: msg });
    await emitReceipt(req, 'gusto.contractor.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create contractor' });
  }
});

router.put('/api/gusto/contractors/:uuid', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/contractors/${req.params.uuid}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.contractor.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', contractor_uuid: req.params.uuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update contractor error', { error: msg });
    await emitReceipt(req, 'gusto.contractor.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', contractor_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update contractor' });
  }
});

router.post('/api/gusto/contractor-payments/preview', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/contractor_payments`, 'POST', req.body);
    await emitReceipt(req, 'gusto.contractor_payment.preview', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { payment_preview: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto preview contractor payment error', { error: msg });
    await emitReceipt(req, 'gusto.contractor_payment.preview', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to preview contractor payment' });
  }
});

router.post('/api/gusto/contractor-payment-groups', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/contractor_payment_groups`, 'POST', req.body);
    await emitReceipt(req, 'gusto.contractor_payment_group.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'RED' },
      { payment_group: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create contractor payment group error', { error: msg });
    await emitReceipt(req, 'gusto.contractor_payment_group.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'RED' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create contractor payment group' });
  }
});

router.put('/api/gusto/company', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.company.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update company error', { error: msg });
    await emitReceipt(req, 'gusto.company.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update company' });
  }
});

router.post('/api/gusto/locations', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/locations`, 'POST', req.body);
    await emitReceipt(req, 'gusto.location.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { location: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create location error', { error: msg });
    await emitReceipt(req, 'gusto.location.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create location' });
  }
});

router.post('/api/gusto/departments', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/departments`, 'POST', req.body);
    await emitReceipt(req, 'gusto.department.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', company_uuid: companyUuid },
      { department: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create department error', { error: msg });
    await emitReceipt(req, 'gusto.department.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.get('/api/gusto/employees/:uuid/pay-stubs', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/pay_stubs`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto get employee pay stubs error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch pay stubs' });
  }
});

router.get('/api/gusto/payrolls/:payrollUuid/employees/:employeeUuid/pay-stub', async (req: Request, res: Response) => {
  try {
    if (!currentAccessToken) {
      return res.status(503).json({ error: 'No Gusto access token' });
    }
    if (isTokenExpiringSoon()) {
      try { await refreshToken(); } catch (e) { /* token refresh is best-effort here */ }
    }
    const url = `${GUSTO_API_BASE}/v1/payrolls/${req.params.payrollUuid}/employees/${req.params.employeeUuid}/pay_stub`;
    let response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`,
        'Accept': 'application/pdf',
        'X-Gusto-API-Version': GUSTO_API_VERSION,
      },
    });
    if (response.status === 401) {
      try {
        await refreshToken();
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${currentAccessToken}`,
            'Accept': 'application/pdf',
            'X-Gusto-API-Version': GUSTO_API_VERSION,
          },
        });
      } catch (e) {
        return res.status(401).json({ error: 'Token refresh failed' });
      }
    }
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch pay stub PDF' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=paystub-${req.params.employeeUuid}.pdf`);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto get pay stub PDF error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch pay stub PDF' });
  }
});

router.put('/api/gusto/payrolls/:uuid/submit', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls/${req.params.uuid}/submit`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.payroll.submit', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'RED', payroll_uuid: req.params.uuid, company_uuid: companyUuid },
      { submitted: true, payroll: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto submit payroll error', { error: msg });
    await emitReceipt(req, 'gusto.payroll.submit', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'RED', payroll_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to submit payroll' });
  }
});

router.put('/api/gusto/compensations/:compensationId', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/compensations/${req.params.compensationId}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.compensation.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', compensation_id: req.params.compensationId },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update compensation error', { error: msg });
    await emitReceipt(req, 'gusto.compensation.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', compensation_id: req.params.compensationId },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update compensation' });
  }
});

router.get('/api/gusto/jobs/:jobId/compensations', async (req: Request, res: Response) => {
  try {
    const data = await gustoFetch(`${GUSTO_API_BASE}/v1/jobs/${req.params.jobId}/compensations`);
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto get job compensations error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch job compensations' });
  }
});

router.post('/api/gusto/jobs/:jobId/compensations', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/jobs/${req.params.jobId}/compensations`, 'POST', req.body);
    await emitReceipt(req, 'gusto.compensation.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', job_id: req.params.jobId },
      { compensation: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto create job compensation error', { error: msg });
    await emitReceipt(req, 'gusto.compensation.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', job_id: req.params.jobId },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to create job compensation' });
  }
});

router.put('/api/gusto/employees/:uuid/onboarding-status', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/onboarding_status`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.employee.onboarding_update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update employee onboarding status error', { error: msg });
    await emitReceipt(req, 'gusto.employee.onboarding_update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', employee_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update employee onboarding status' });
  }
});

router.put('/api/gusto/departments/:uuid', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/departments/${req.params.uuid}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.department.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', department_uuid: req.params.uuid, company_uuid: companyUuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update department error', { error: msg });
    await emitReceipt(req, 'gusto.department.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', department_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.put('/api/gusto/locations/:uuid', async (req: Request, res: Response) => {
  const companyUuid = getCompanyUuid();
  if (!companyUuid) return res.status(503).json({ error: 'Gusto credentials not configured' });

  try {
    const data = await gustoMutate(`${GUSTO_API_BASE}/v1/companies/${companyUuid}/locations/${req.params.uuid}`, 'PUT', req.body);
    await emitReceipt(req, 'gusto.location.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', location_uuid: req.params.uuid, company_uuid: companyUuid },
      { updated: true },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto update location error', { error: msg });
    await emitReceipt(req, 'gusto.location.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', location_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.post('/api/gusto/employees/:uuid/terminations', async (req: Request, res: Response) => {
  try {
    const data = await gustoMutate(
      `${GUSTO_API_BASE}/v1/employees/${req.params.uuid}/terminations`,
      'POST',
      req.body
    );
    await emitReceipt(req, 'gusto.employee.terminate', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'RED', employee_uuid: req.params.uuid },
      { termination: data },
    );
    res.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto terminate employee error', { error: msg });
    await emitReceipt(req, 'gusto.employee.terminate', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'RED', employee_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: msg || 'Failed to terminate employee' });
  }
});

router.delete('/api/gusto/employees/:uuid', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${GUSTO_API_BASE}/v1/employees/${req.params.uuid}`, {
      method: 'DELETE',
      headers: getGustoHeaders(currentAccessToken),
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(errBody || `Gusto API error: ${response.status}`);
    }
    await emitReceipt(req, 'gusto.employee.delete', 'SUCCEEDED',
      { method: 'DELETE', path: req.path, risk_tier: 'RED', employee_uuid: req.params.uuid },
      { deleted: true },
    );
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gusto delete employee error', { error: msg });
    await emitReceipt(req, 'gusto.employee.delete', 'FAILED',
      { method: 'DELETE', path: req.path, risk_tier: 'RED', employee_uuid: req.params.uuid },
      { error: msg },
    );
    res.status(500).json({ error: msg || 'Failed to delete employee' });
  }
});

export function getCurrentAccessToken(): string {
  return currentAccessToken;
}

export default router;
