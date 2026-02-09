import { Router, Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { updateConnectionSyncTime, getConnectionByProvider } from './financeTokenStore';
import { loadToken, saveToken } from './tokenStore';
import crypto from 'crypto';

const router = Router();

const DEFAULT_SUITE_ID = 'default';
const DEFAULT_OFFICE_ID = 'default';

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
    console.warn('GUSTO_WEBHOOK_SECRET not set — accepting webhook without signature verification (sandbox mode)');
    return true;
  }

  try {
    const hash = crypto.createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch (error: any) {
    console.error('Gusto webhook signature verification error:', error.message);
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
      console.log(`Gusto finance event written: ${params.providerEventId}`);
      return true;
    }
    console.log(`Gusto finance event already exists (idempotent skip): ${params.providerEventId}`);
    return false;
  } catch (error: any) {
    console.error('Failed to write Gusto finance event:', error.message);
    return false;
  }
}

export async function refreshGustoCompanyToken(): Promise<{ accessToken: string; companyUuid: string } | null> {
  const stored = await loadToken('gusto');
  if (!stored) {
    console.warn('Gusto: No stored token found for company token refresh');
    return null;
  }

  const accessToken = stored.access_token;
  const refreshTokenValue = stored.refresh_token;
  const companyUuid = stored.company_uuid || process.env.GUSTO_COMPANY_UUID || '';
  const expiresAt = stored.expires_at ? new Date(stored.expires_at) : null;

  if (expiresAt && Date.now() < expiresAt.getTime() - 120000) {
    return { accessToken, companyUuid };
  }

  console.log('Gusto: Company access token expiring or expired, refreshing...');

  const clientId = process.env.GUSTO_CLIENT_ID;
  const clientSecret = process.env.GUSTO_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshTokenValue) {
    console.error('Gusto: Missing client credentials or refresh token for company token refresh');
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
      console.error(`Gusto company token refresh failed ${response.status}: ${text.substring(0, 300)}`);
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

    console.log('Gusto: Company access token refreshed successfully');
    return { accessToken: newAccessToken, companyUuid };
  } catch (error: any) {
    console.error('Gusto company token refresh error:', error.message);
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
    console.error(`Gusto API error ${response.status}: ${text.substring(0, 500)}`);
    throw new Error(`Gusto API returned ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('Gusto API returned non-JSON:', text.substring(0, 500));
    throw new Error('Invalid JSON response from Gusto');
  }
}

export async function fetchGustoPayrolls(suiteId?: string, officeId?: string): Promise<any[]> {
  const sId = suiteId || DEFAULT_SUITE_ID;
  const oId = officeId || DEFAULT_OFFICE_ID;

  const tokenResult = await refreshGustoCompanyToken();
  if (!tokenResult) {
    console.warn('Gusto: No valid company token for payroll fetch');
    return [];
  }

  const { accessToken, companyUuid } = tokenResult;
  if (!companyUuid) {
    console.warn('Gusto: No company UUID available for payroll fetch');
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
      } catch (e: any) {
        console.error('Failed to update Gusto connection sync time:', e.message);
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

    console.log(`Gusto payrolls fetched: ${results.length} payroll runs`);
    return results;
  } catch (error: any) {
    console.error('Gusto payroll fetch error:', error.message);
    throw error;
  }
}

router.post('/api/gusto/finance-webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-gusto-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifyGustoSignature(rawBody, signature || '')) {
      console.error('Gusto webhook signature verification failed');
      return res.status(401).json({ error: 'Webhook verification failed' });
    }

    const body = req.body;
    const eventType = body.event_type || body.type || '';
    const resourceUuid = body.resource_uuid || body.entity_uuid || body.uuid || '';
    const timestamp = body.timestamp || new Date().toISOString();

    console.log(`Gusto webhook received: ${eventType} for resource ${resourceUuid}`);

    const normalizedType = GUSTO_EVENT_MAP[eventType];
    if (!normalizedType) {
      console.log(`Unhandled Gusto webhook event type: ${eventType}, acknowledging`);
      return res.status(200).json({ received: true, handled: false });
    }

    const connection = await getConnectionByProvider(DEFAULT_SUITE_ID, DEFAULT_OFFICE_ID, 'gusto');
    const connectionId = connection?.id || null;

    const providerEventId = `gusto_${eventType}_${resourceUuid}_${timestamp}`;
    const rawHash = computeRawHash(body);

    const receiptId = await createReceipt({
      suiteId: DEFAULT_SUITE_ID,
      officeId: DEFAULT_OFFICE_ID,
      actionType: 'ingest_webhook',
      inputs: { provider: 'gusto', event_type: eventType, resource_uuid: resourceUuid },
      outputs: { normalized_type: normalizedType, providerEventId },
      metadata: { provider: 'gusto', event_type: eventType },
    });

    const written = await writeFinanceEvent({
      suiteId: DEFAULT_SUITE_ID,
      officeId: DEFAULT_OFFICE_ID,
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
      } catch (e: any) {
        console.error('Failed to update Gusto connection webhook time:', e.message);
      }
    }

    console.log(`Gusto webhook processed: ${eventType} -> ${normalizedType} (written: ${written})`);
    res.status(200).json({ received: true, handled: true, eventType: normalizedType, written });
  } catch (error: any) {
    console.error('Gusto webhook processing error:', error.message);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;
