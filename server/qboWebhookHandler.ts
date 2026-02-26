import { Router, Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { updateConnectionSyncTime, getConnectionByProvider } from './financeTokenStore';
import { loadToken } from './tokenStore';
import { getDefaultSuiteId, getDefaultOfficeId } from './suiteContext';
import crypto from 'crypto';
import { logger } from './logger';

const router = Router();

const QBO_EVENT_MAP: Record<string, string> = {
  'Invoice': 'qbo_invoice_changed',
  'Payment': 'qbo_payment_changed',
  'JournalEntry': 'qbo_journal_posted',
  'ProfitAndLoss': 'qbo_report_refreshed',
  'BalanceSheet': 'qbo_report_refreshed',
  'Estimate': 'qbo_invoice_changed',
  'Bill': 'qbo_payment_changed',
  'BillPayment': 'qbo_payment_changed',
};

const QBO_API_BASE = 'https://sandbox-quickbooks.api.intuit.com';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

function computeRawHash(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function verifyQBOSignature(payload: string, signature: string): boolean {
  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken) {
    logger.warn('QBO_WEBHOOK_VERIFIER_TOKEN not set — accepting webhook without signature verification (sandbox mode)');
    return true;
  }

  try {
    const hash = crypto.createHmac('sha256', verifierToken)
      .update(payload)
      .digest('base64');
    return hash === signature;
  } catch (error: unknown) {
    logger.error('QBO webhook signature verification error', { error: error instanceof Error ? error.message : 'unknown' });
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
      VALUES (${params.suiteId}, ${params.officeId}, ${params.connectionId}, 'qbo', ${params.providerEventId}, ${params.eventType}, ${params.occurredAt}, ${params.amount}, ${params.currency}, ${params.status}, ${JSON.stringify(params.entityRefs)}, ${params.rawHash}, ${params.receiptId}, ${JSON.stringify(params.metadata)})
      ON CONFLICT (suite_id, office_id, provider, provider_event_id) DO NOTHING
      RETURNING event_id
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      logger.info('QBO finance event written', { providerEventId: params.providerEventId });
      return true;
    }
    logger.info('QBO finance event already exists (idempotent skip)', { providerEventId: params.providerEventId });
    return false;
  } catch (error: unknown) {
    logger.error('Failed to write QBO finance event', { error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}

async function getQBOCredentials(): Promise<{ accessToken: string; realmId: string; refreshToken: string } | null> {
  const stored = await loadToken('quickbooks');
  if (!stored || !stored.access_token || !stored.realm_id) {
    return null;
  }
  return {
    accessToken: stored.access_token,
    realmId: stored.realm_id,
    refreshToken: stored.refresh_token || '',
  };
}

async function refreshQBOToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('QBO token refresh failed', { status: response.status, detail: errorText.substring(0, 500) });
      return null;
    }

    const tokenData = await response.json();
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    };
  } catch (error: unknown) {
    logger.error('QBO token refresh error', { error: error instanceof Error ? error.message : 'unknown' });
    return null;
  }
}

async function qboApiFetch(path: string, accessToken: string, realmId: string, retried = false, refreshToken?: string): Promise<any> {
  const url = `${QBO_API_BASE}/v3/company/${realmId}${path}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 && !retried && refreshToken) {
    logger.info('QBO: 401 received, attempting token refresh...');
    const refreshed = await refreshQBOToken(refreshToken);
    if (refreshed) {
      return qboApiFetch(path, refreshed.accessToken, realmId, true);
    }
    throw new Error('QBO token expired and refresh failed');
  }

  if (!response.ok) {
    const text = await response.text();
    logger.error('QBO API error', { status: response.status, detail: text.substring(0, 500) });
    throw new Error(`QBO API returned ${response.status}`);
  }

  return response.json();
}

export async function pollQuickBooksCDC(suiteId?: string, officeId?: string): Promise<{ processed: number }> {
  const sId = suiteId || getDefaultSuiteId();
  const oId = officeId || getDefaultOfficeId();

  const creds = await getQBOCredentials();
  if (!creds) {
    logger.warn('QBO: No credentials available for CDC polling');
    return { processed: 0 };
  }

  const connection = await getConnectionByProvider(sId, oId, 'qbo');
  const connectionId = connection?.id || null;

  let lastPollTime: string;
  try {
    const result = await db.execute(sql`
      SELECT data->>'last_cdc_poll' as last_poll
      FROM finance_entities
      WHERE suite_id = ${sId} AND office_id = ${oId} AND provider = 'qbo' AND entity_type = 'cdc_cursor'
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0 && (rows as any[])[0].last_poll) {
      lastPollTime = (rows as any[])[0].last_poll;
    } else {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      lastPollTime = oneDayAgo.toISOString();
    }
  } catch {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    lastPollTime = oneDayAgo.toISOString();
  }

  const entities = 'Invoice,Payment,JournalEntry,Estimate,Bill,BillPayment';
  const cdcPath = `/cdc?changedSince=${encodeURIComponent(lastPollTime)}&entities=${entities}`;

  let processed = 0;

  try {
    const cdcData = await qboApiFetch(cdcPath, creds.accessToken, creds.realmId, false, creds.refreshToken);

    const cdcResponse = cdcData?.CDCResponse;
    if (!Array.isArray(cdcResponse)) {
      logger.info('QBO CDC: No changes found');
      return { processed: 0 };
    }

    for (const queryResponse of cdcResponse) {
      const queryResponseEntries = queryResponse?.QueryResponse;
      if (!Array.isArray(queryResponseEntries)) continue;

      for (const entityGroup of queryResponseEntries) {
        for (const entityName of Object.keys(entityGroup)) {
          if (entityName === 'startPosition' || entityName === 'maxResults' || entityName === 'totalCount') continue;

          const eventType = QBO_EVENT_MAP[entityName];
          if (!eventType) continue;

          const entityList = entityGroup[entityName];
          if (!Array.isArray(entityList)) continue;

          for (const entity of entityList) {
            const entityId = entity.Id || entity.id || 'unknown';
            const lastUpdated = entity.MetaData?.LastUpdatedTime || new Date().toISOString();
            const providerEventId = `qbo_${entityName}_${entityId}_${lastUpdated}`;

            const amount = entity.TotalAmt != null ? Math.round(entity.TotalAmt * 100) : null;

            const written = await writeFinanceEvent({
              suiteId: sId,
              officeId: oId,
              connectionId,
              providerEventId,
              eventType,
              occurredAt: new Date(lastUpdated),
              amount,
              currency: entity.CurrencyRef?.value?.toLowerCase() || 'usd',
              status: 'posted',
              entityRefs: {
                entity_type: entityName,
                entity_id: entityId,
                doc_number: entity.DocNumber || null,
              },
              rawHash: computeRawHash(entity),
              receiptId: null,
              metadata: {
                sync_token: entity.SyncToken,
                sparse: entity.sparse,
                source: 'cdc_poll',
              },
            });

            if (written) processed++;
          }
        }
      }
    }

    const nowIso = new Date().toISOString();
    try {
      const existing = await db.execute(sql`
        SELECT id FROM finance_entities
        WHERE suite_id = ${sId} AND office_id = ${oId} AND provider = 'qbo' AND entity_type = 'cdc_cursor'
        LIMIT 1
      `);
      const existingRows = existing.rows || existing;
      if (existingRows && (existingRows as any[]).length > 0) {
        await db.execute(sql`
          UPDATE finance_entities
          SET data = ${JSON.stringify({ last_cdc_poll: nowIso })}, updated_at = NOW()
          WHERE suite_id = ${sId} AND office_id = ${oId} AND provider = 'qbo' AND entity_type = 'cdc_cursor'
        `);
      } else {
        await db.execute(sql`
          INSERT INTO finance_entities (suite_id, office_id, provider, entity_type, entity_id, data)
          VALUES (${sId}, ${oId}, 'qbo', 'cdc_cursor', 'cdc_cursor', ${JSON.stringify({ last_cdc_poll: nowIso })})
        `);
      }
    } catch (e: unknown) {
      logger.error('Failed to save QBO CDC cursor', { error: e instanceof Error ? e.message : 'unknown' });
    }

    if (connectionId) {
      try {
        await updateConnectionSyncTime(connectionId, 'last_sync_at');
      } catch (e: unknown) {
        logger.error('Failed to update QBO connection sync time', { error: e instanceof Error ? e.message : 'unknown' });
      }
    }

    await createReceipt({
      suiteId: sId,
      officeId: oId,
      actionType: 'sync_pull',
      inputs: { provider: 'qbo', type: 'cdc_poll', changedSince: lastPollTime },
      outputs: { processed },
      metadata: { provider: 'qbo', connectionId },
    });

    logger.info('QBO CDC poll complete', { processed });
    return { processed };
  } catch (error: unknown) {
    logger.error('QBO CDC poll error', { error: error instanceof Error ? error.message : 'unknown' });
    throw error;
  }
}

export async function fetchQBOReports(suiteId?: string, officeId?: string): Promise<{ profitAndLoss: any; balanceSheet: any }> {
  const sId = suiteId || getDefaultSuiteId();
  const oId = officeId || getDefaultOfficeId();

  const creds = await getQBOCredentials();
  if (!creds) {
    logger.warn('QBO: No credentials available for report fetching');
    return { profitAndLoss: null, balanceSheet: null };
  }

  const connection = await getConnectionByProvider(sId, oId, 'qbo');
  const connectionId = connection?.id || null;

  let profitAndLoss: any = null;
  let balanceSheet: any = null;

  try {
    const plReport = await qboApiFetch('/reports/ProfitAndLoss?date_macro=This Month', creds.accessToken, creds.realmId, false, creds.refreshToken);
    profitAndLoss = plReport;

    const today = new Date().toISOString().split('T')[0];
    const providerEventId = `qbo_ProfitAndLoss_report_${today}`;

    await writeFinanceEvent({
      suiteId: sId,
      officeId: oId,
      connectionId,
      providerEventId,
      eventType: 'qbo_report_refreshed',
      occurredAt: new Date(),
      amount: null,
      currency: 'usd',
      status: 'posted',
      entityRefs: {
        report_type: 'ProfitAndLoss',
        date_macro: 'This Month',
      },
      rawHash: computeRawHash(plReport),
      receiptId: null,
      metadata: {
        report_name: plReport?.Header?.ReportName || 'ProfitAndLoss',
        start_period: plReport?.Header?.StartPeriod || null,
        end_period: plReport?.Header?.EndPeriod || null,
        source: 'report_fetch',
      },
    });
  } catch (error: unknown) {
    logger.error('QBO ProfitAndLoss report fetch error', { error: error instanceof Error ? error.message : 'unknown' });
  }

  try {
    const bsReport = await qboApiFetch('/reports/BalanceSheet?date_macro=Today', creds.accessToken, creds.realmId, false, creds.refreshToken);
    balanceSheet = bsReport;

    const today = new Date().toISOString().split('T')[0];
    const providerEventId = `qbo_BalanceSheet_report_${today}`;

    await writeFinanceEvent({
      suiteId: sId,
      officeId: oId,
      connectionId,
      providerEventId,
      eventType: 'qbo_report_refreshed',
      occurredAt: new Date(),
      amount: null,
      currency: 'usd',
      status: 'posted',
      entityRefs: {
        report_type: 'BalanceSheet',
        date_macro: 'Today',
      },
      rawHash: computeRawHash(bsReport),
      receiptId: null,
      metadata: {
        report_name: bsReport?.Header?.ReportName || 'BalanceSheet',
        start_period: bsReport?.Header?.StartPeriod || null,
        end_period: bsReport?.Header?.EndPeriod || null,
        source: 'report_fetch',
      },
    });
  } catch (error: unknown) {
    logger.error('QBO BalanceSheet report fetch error', { error: error instanceof Error ? error.message : 'unknown' });
  }

  await createReceipt({
    suiteId: sId,
    officeId: oId,
    actionType: 'sync_pull',
    inputs: { provider: 'qbo', type: 'report_fetch' },
    outputs: { profitAndLoss: !!profitAndLoss, balanceSheet: !!balanceSheet },
    metadata: { provider: 'qbo', connectionId },
  });

  logger.info('QBO reports fetched', { profitAndLoss: !!profitAndLoss, balanceSheet: !!balanceSheet });
  return { profitAndLoss, balanceSheet };
}

router.post('/api/qbo/finance-webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['intuit-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifyQBOSignature(rawBody, signature || '')) {
      logger.error('QBO webhook signature verification failed');
      return res.status(401).json({ error: 'Webhook verification failed' });
    }

    const body = req.body;
    const eventNotifications = body.eventNotifications || [];

    logger.info('QBO webhook received', { notificationCount: eventNotifications.length });

    let totalWritten = 0;

    for (const notification of eventNotifications) {
      const realmId = notification.realmId || '';
      const dataChangeEvent = notification.dataChangeEvent;
      if (!dataChangeEvent?.entities) continue;

      const connection = await getConnectionByProvider(getDefaultSuiteId(), getDefaultOfficeId(), 'qbo');
      const connectionId = connection?.id || null;

      for (const entity of dataChangeEvent.entities) {
        const entityName = entity.name || '';
        const entityId = entity.id || '';
        const lastUpdated = entity.lastUpdated || new Date().toISOString();
        const operation = entity.operation || 'Update';

        const eventType = QBO_EVENT_MAP[entityName];
        if (!eventType) {
          logger.info('QBO webhook: Unhandled entity type, skipping', { entityName });
          continue;
        }

        const providerEventId = `qbo_${entityName}_${entityId}_${lastUpdated}`;
        const rawHash = computeRawHash(entity);

        const receiptId = await createReceipt({
          suiteId: getDefaultSuiteId(),
          officeId: getDefaultOfficeId(),
          actionType: 'ingest_webhook',
          inputs: { provider: 'qbo', entityName, entityId, operation },
          outputs: { eventType, providerEventId },
          metadata: { provider: 'qbo', realmId },
        });

        const written = await writeFinanceEvent({
          suiteId: getDefaultSuiteId(),
          officeId: getDefaultOfficeId(),
          connectionId,
          providerEventId,
          eventType,
          occurredAt: new Date(lastUpdated),
          amount: null,
          currency: 'usd',
          status: 'posted',
          entityRefs: {
            entity_type: entityName,
            entity_id: entityId,
            operation,
            realm_id: realmId,
          },
          rawHash,
          receiptId,
          metadata: {
            operation,
            source: 'webhook',
          },
        });

        if (written) totalWritten++;
      }

      if (connectionId) {
        try {
          await updateConnectionSyncTime(connectionId, 'last_webhook_at');
        } catch (e: unknown) {
          logger.error('Failed to update QBO connection webhook time', { error: e instanceof Error ? e.message : 'unknown' });
        }
      }
    }

    logger.info('QBO webhook processed', { totalWritten });
    res.status(200).json({ received: true, handled: true, written: totalWritten });
  } catch (error: unknown) {
    logger.error('QBO webhook processing error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;
