import { Router, Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { updateConnectionSyncTime, getConnectionByProvider } from './financeTokenStore';
import { loadToken, saveToken } from './tokenStore';
import { getDefaultSuiteId, getDefaultOfficeId } from './suiteContext';
import crypto from 'crypto';
import { logger } from './logger';

const router = Router();

const GUSTO_API_BASE = 'https://api.gusto-demo.com';
const GUSTO_API_VERSION = '2025-06-15';
const GUSTO_TOKEN_URL = 'https://api.gusto-demo.com/oauth/token';

const GUSTO_EVENT_MAP: Record<string, string> = {
  'payroll.calculated': 'payroll_calculated',
  'payroll.submitted': 'payroll_submitted',
  'payroll.processed': 'payroll_paid',
  'payroll.reversed': 'payroll_paid',
  'employee.created': 'employee_changed',
  'employee.updated': 'employee_changed',
  'employee.terminated': 'employee_changed',
  'company.updated': 'employee_changed',
};

function computeRawHash(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function verifyGustoSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.GUSTO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn('GUSTO_WEBHOOK_SECRET not set — accepting webhook without signature verification (sandbox mode)');
    return true;
  }

  try {
    const hash = crypto.createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch (error: unknown) {
    logger.error('Gusto webhook signature verification error', { error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}

async function writeFinanceEvent(params: {
  suiteId: string;
  officeId: string;
  connectionId: string | null;
  providerEventId: string;
  eventType: string;
  occurredAt: Date;
  amount: number | null;
  currency: string;
  status: string;
  entityRefs: any;
  rawHash: string;
  receiptId: string | null;
  metadata: any;
}): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      INSERT INTO finance_events (suite_id, office_id, connection_id, provider, provider_event_id, event_type, occurred_at, amount, currency, status, entity_refs, raw_hash, receipt_id, metadata)
      VALUES (${params.suiteId}, ${params.officeId}, ${params.connectionId}, 'gusto', ${params.providerEventId}, ${params.eventType}, ${params.occurredAt}, ${params.amount}, ${params.currency}, ${params.status}, ${JSON.stringify(params.entityRefs)}, ${params.rawHash}, ${params.receiptId}, ${JSON.stringify(params.metadata)})
      ON CONFLICT (suite_id, office_id, provider, provider_event_id) DO NOTHING
      RETURNING event_id
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      logger.info('Gusto finance event written', { providerEventId: params.providerEventId });
      return true;
    }
    logger.info('Gusto finance event already exists (idempotent skip)', { providerEventId: params.providerEventId });
    return false;
  } catch (error: unknown) {
    logger.error('Failed to write Gusto finance event', { error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}

export async function refreshGustoCompanyToken(): Promise<{ accessToken: string; companyUuid: string } | null> {
  const stored = await loadToken('gusto');
  if (!stored) {
    logger.warn('Gusto: No stored token found for company token refresh');
    return null;
  }

  const accessToken = stored.access_token;
  const refreshTokenValue = stored.refresh_token;
  const companyUuid = stored.company_uuid || process.env.GUSTO_COMPANY_UUID || '';
  const expiresAt = stored.expires_at ? new Date(stored.expires_at) : null;

  if (expiresAt && Date.now() < expiresAt.getTime() - 120000) {
    return { accessToken, companyUuid };
  }

  logger.info('Gusto: Company access token expiring or expired, refreshing...');

  const clientId = process.env.GUSTO_CLIENT_ID;
  const clientSecret = process.env.GUSTO_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshTokenValue) {
    logger.error('Gusto: Missing client credentials or refresh token for company token refresh');
    return null;
  }

  try {
    const response = await fetch(GUSTO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenValue,
        grant_type: 'refresh_token',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Gusto company token refresh failed', { status: response.status, detail: text.substring(0, 300) });
      return null;
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const newExpiresAt = new Date(Date.now() + (data.expires_in || 7200) * 1000);

    await saveToken('gusto', {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      company_uuid: companyUuid || undefined,
      expires_at: newExpiresAt,
    });

    logger.info('Gusto: Company access token refreshed successfully');
    return { accessToken: newAccessToken, companyUuid };
  } catch (error: unknown) {
    logger.error('Gusto company token refresh error', { error: error instanceof Error ? error.message : 'unknown' });
    return null;
  }
}

function getGustoHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Gusto-API-Version': GUSTO_API_VERSION,
  };
}

async function gustoApiFetch(url: string, accessToken: string): Promise<any> {
  const response = await fetch(url, { headers: getGustoHeaders(accessToken) });

  if (!response.ok) {
    const text = await response.text();
    logger.error('Gusto API error', { status: response.status, detail: text.substring(0, 500) });
    throw new Error(`Gusto API returned ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    logger.error('Gusto API returned non-JSON', { detail: text.substring(0, 500) });
    throw new Error('Invalid JSON response from Gusto');
  }
}

export async function fetchGustoPayrolls(suiteId?: string, officeId?: string): Promise<any[]> {
  const sId = suiteId || getDefaultSuiteId();
  const oId = officeId || getDefaultOfficeId();

  const tokenResult = await refreshGustoCompanyToken();
  if (!tokenResult) {
    logger.warn('Gusto: No valid company token for payroll fetch');
    return [];
  }

  const { accessToken, companyUuid } = tokenResult;
  if (!companyUuid) {
    logger.warn('Gusto: No company UUID available for payroll fetch');
    return [];
  }

  const connection = await getConnectionByProvider(sId, oId, 'gusto');
  const connectionId = connection?.id || null;

  try {
    const payrolls = await gustoApiFetch(
      `${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls?processing_statuses=processed,submitted&page=1&per=25`,
      accessToken
    );

    const payrollList = Array.isArray(payrolls) ? payrolls : [];
    const results: any[] = [];

    for (const payroll of payrollList) {
      const payrollUuid = payroll.uuid || payroll.payroll_uuid || 'unknown';
      const checkDate = payroll.check_date || new Date().toISOString().split('T')[0];
      const processingStatus = payroll.processing_status || 'unknown';

      let eventType = 'payroll_paid';
      if (processingStatus === 'submitted') {
        eventType = 'payroll_submitted';
      } else if (processingStatus === 'calculated') {
        eventType = 'payroll_calculated';
      }

      const totalAmount = payroll.totals?.gross_pay
        ? Math.round(parseFloat(payroll.totals.gross_pay) * 100)
        : null;

      const providerEventId = `gusto_payroll_${payrollUuid}_${checkDate}`;

      await writeFinanceEvent({
        suiteId: sId,
        officeId: oId,
        connectionId,
        providerEventId,
        eventType,
        occurredAt: new Date(checkDate),
        amount: totalAmount,
        currency: 'usd',
        status: processingStatus === 'processed' ? 'posted' : 'pending',
        entityRefs: {
          payroll_uuid: payrollUuid,
          pay_period_start: payroll.pay_period?.start_date || null,
          pay_period_end: payroll.pay_period?.end_date || null,
        },
        rawHash: computeRawHash(payroll),
        receiptId: null,
        metadata: {
          processing_status: processingStatus,
          check_date: checkDate,
          employee_count: payroll.employee_compensations?.length || 0,
          totals: payroll.totals || {},
          source: 'payroll_fetch',
        },
      });

      results.push({
        payroll_uuid: payrollUuid,
        check_date: checkDate,
        processing_status: processingStatus,
        totals: payroll.totals || {},
        pay_period: payroll.pay_period || {},
      });
    }

    if (connectionId) {
      try {
        await updateConnectionSyncTime(connectionId, 'last_sync_at');
      } catch (e: unknown) {
        logger.error('Failed to update Gusto connection sync time', { error: e instanceof Error ? e.message : 'unknown' });
      }
    }

    await createReceipt({
      suiteId: sId,
      officeId: oId,
      actionType: 'sync_pull',
      inputs: { provider: 'gusto', type: 'payroll_fetch', companyUuid },
      outputs: { payrolls: results.length },
      metadata: { provider: 'gusto', connectionId },
    });

    logger.info('Gusto payrolls fetched', { count: results.length });
    return results;
  } catch (error: unknown) {
    logger.error('Gusto payroll fetch error', { error: error instanceof Error ? error.message : 'unknown' });
    throw error;
  }
}

let capturedVerificationToken: string | null = null;

router.get('/api/gusto/webhook-verification-token', (_req: Request, res: Response) => {
  if (capturedVerificationToken) {
    res.json({ verification_token: capturedVerificationToken, message: 'Token captured from Gusto verification POST. Use this as GUSTO_WEBHOOK_SECRET.' });
  } else {
    res.json({ verification_token: null, message: 'No verification token captured yet. Trigger a re-request from Gusto.' });
  }
});

router.post('/api/gusto/request-verification', async (_req: Request, res: Response) => {
  try {
    const token = await refreshGustoCompanyToken();
    if (!token) {
      return res.status(503).json({ error: 'No Gusto access token available. Complete OAuth first.' });
    }

    const subsRes = await fetch(`${GUSTO_API_BASE}/v1/webhook_subscriptions`, {
      headers: getGustoHeaders(token.accessToken),
    });

    if (!subsRes.ok) {
      const text = await subsRes.text();
      return res.status(subsRes.status).json({ error: 'Failed to list webhook subscriptions', detail: text.substring(0, 500) });
    }

    const subs = await subsRes.json();
    const subscriptions = Array.isArray(subs) ? subs : (subs.webhook_subscriptions || []);

    if (subscriptions.length === 0) {
      return res.json({ message: 'No webhook subscriptions found. Create one in the Gusto developer portal first.' });
    }

    const results = [];
    for (const sub of subscriptions) {
      const uuid = sub.uuid || sub.id;
      if (!uuid) continue;

      const reqTokenRes = await fetch(`${GUSTO_API_BASE}/v1/webhook_subscriptions/${uuid}/request_verification_token`, {
        headers: getGustoHeaders(token.accessToken),
      });

      results.push({
        subscription_uuid: uuid,
        status: reqTokenRes.status,
        message: reqTokenRes.ok ? 'Verification token re-requested. Check /api/gusto/webhook-verification-token for the captured token.' : 'Failed to request verification token',
      });
    }

    res.json({ message: 'Verification token re-requested for all subscriptions', results });
  } catch (error: unknown) {
    logger.error('Gusto verification re-request error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/gusto/verify-subscription', async (req: Request, res: Response) => {
  try {
    const token = await refreshGustoCompanyToken();
    if (!token) {
      return res.status(503).json({ error: 'No Gusto access token available.' });
    }

    const verificationToken = req.body.verification_token || capturedVerificationToken;
    if (!verificationToken) {
      return res.status(400).json({ error: 'No verification token available. Re-request one first.' });
    }

    const subsRes = await fetch(`${GUSTO_API_BASE}/v1/webhook_subscriptions`, {
      headers: getGustoHeaders(token.accessToken),
    });

    if (!subsRes.ok) {
      return res.status(subsRes.status).json({ error: 'Failed to list subscriptions' });
    }

    const subs = await subsRes.json();
    const subscriptions = Array.isArray(subs) ? subs : (subs.webhook_subscriptions || []);

    const results = [];
    for (const sub of subscriptions) {
      const uuid = sub.uuid || sub.id;
      if (!uuid) continue;

      const verifyRes = await fetch(`${GUSTO_API_BASE}/v1/webhook_subscriptions/${uuid}/verify`, {
        method: 'PUT',
        headers: getGustoHeaders(token.accessToken),
        body: JSON.stringify({ verification_token: verificationToken }),
      });

      const verifyData = await verifyRes.text();
      results.push({
        subscription_uuid: uuid,
        status: verifyRes.status,
        verified: verifyRes.ok,
        response: verifyData.substring(0, 500),
      });
    }

    res.json({ message: 'Verification attempted', results, verification_token_used: verificationToken });
  } catch (error: unknown) {
    logger.error('Gusto verify subscription error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/gusto/finance-webhook', async (req: Request, res: Response) => {
  try {
    if (req.body && req.body.verification_token && !req.body.event_type && !req.body.type) {
      capturedVerificationToken = req.body.verification_token;
      logger.info('GUSTO VERIFICATION TOKEN RECEIVED (redacted from logs for security)');
      logger.info('Visit /api/gusto/webhook-verification-token to retrieve it.');
      return res.status(200).json({ received: true, verification_token_captured: true });
    }

    const signature = req.headers['x-gusto-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifyGustoSignature(rawBody, signature || '')) {
      logger.error('Gusto webhook signature verification failed');
      return res.status(401).json({ error: 'Webhook verification failed' });
    }

    const body = req.body;
    const eventType = body.event_type || body.type || '';
    const resourceUuid = body.resource_uuid || body.entity_uuid || body.uuid || '';
    const timestamp = body.timestamp || new Date().toISOString();

    logger.info('Gusto webhook received', { eventType, resourceUuid });

    const normalizedType = GUSTO_EVENT_MAP[eventType];
    if (!normalizedType) {
      logger.info('Unhandled Gusto webhook event type, acknowledging', { eventType });
      return res.status(200).json({ received: true, handled: false });
    }

    const connection = await getConnectionByProvider(getDefaultSuiteId(), getDefaultOfficeId(), 'gusto');
    const connectionId = connection?.id || null;

    const providerEventId = `gusto_${eventType}_${resourceUuid}_${timestamp}`;
    const rawHash = computeRawHash(body);

    const receiptId = await createReceipt({
      suiteId: getDefaultSuiteId(),
      officeId: getDefaultOfficeId(),
      actionType: 'ingest_webhook',
      inputs: { provider: 'gusto', event_type: eventType, resource_uuid: resourceUuid },
      outputs: { normalized_type: normalizedType, providerEventId },
      metadata: { provider: 'gusto', event_type: eventType },
    });

    const written = await writeFinanceEvent({
      suiteId: getDefaultSuiteId(),
      officeId: getDefaultOfficeId(),
      connectionId,
      providerEventId,
      eventType: normalizedType,
      occurredAt: new Date(timestamp),
      amount: body.amount ? Math.round(parseFloat(body.amount) * 100) : null,
      currency: 'usd',
      status: 'posted',
      entityRefs: {
        event_type: eventType,
        resource_uuid: resourceUuid,
        company_uuid: body.company_uuid || null,
      },
      rawHash,
      receiptId,
      metadata: {
        original_event_type: eventType,
        source: 'webhook',
      },
    });

    if (connectionId) {
      try {
        await updateConnectionSyncTime(connectionId, 'last_webhook_at');
      } catch (e: unknown) {
        logger.error('Failed to update Gusto connection webhook time', { error: e instanceof Error ? e.message : 'unknown' });
      }
    }

    logger.info('Gusto webhook processed', { eventType, normalizedType, written });
    res.status(200).json({ received: true, handled: true, eventType: normalizedType, written });
  } catch (error: unknown) {
    logger.error('Gusto webhook processing error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;
