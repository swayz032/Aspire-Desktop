import { Router, Request, Response } from 'express';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { updateConnectionSyncTime } from './financeTokenStore';
import crypto from 'crypto';

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

const DEFAULT_SUITE_ID = 'default';
const DEFAULT_OFFICE_ID = 'default';

const PLAID_EVENT_MAP: Record<string, string> = {
  'TRANSACTIONS.DEFAULT_UPDATE': 'bank_tx_posted',
  'TRANSACTIONS.INITIAL_UPDATE': 'bank_tx_posted',
  'TRANSACTIONS.HISTORICAL_UPDATE': 'bank_tx_posted',
  'TRANSACTIONS.TRANSACTIONS_REMOVED': 'bank_tx_reversed',
  'TRANSACTIONS.SYNC_UPDATES_AVAILABLE': 'bank_tx_posted',
  'ITEM.WEBHOOK_UPDATE_ACKNOWLEDGED': 'bank_account_linked',
  'ITEM.ERROR': 'bank_item_error',
  'ITEM.PENDING_EXPIRATION': 'bank_item_error',
  'ITEM.USER_PERMISSION_REVOKED': 'bank_item_error',
  'HOLDINGS.DEFAULT_UPDATE': 'bank_balance_updated',
  'BALANCE.DEFAULT_UPDATE': 'bank_balance_updated',
};

function computeBodyHash(body: string): string {
  return crypto.createHash('sha256').update(body).digest('hex');
}

async function verifyPlaidWebhook(req: Request): Promise<boolean> {
  const plaidEnv = process.env.PLAID_ENV || 'sandbox';

  if (plaidEnv === 'sandbox' || plaidEnv === 'development') {
    console.warn('Plaid webhook verification skipped in sandbox/development mode');
    return true;
  }

  try {
    const verificationHeader = req.headers['plaid-verification'] as string;
    if (!verificationHeader) {
      console.error('Missing Plaid-Verification header');
      return false;
    }

    const tokenParts = verificationHeader.split('.');
    if (tokenParts.length !== 3) {
      console.error('Invalid JWT format in Plaid-Verification header');
      return false;
    }

    const headerJson = Buffer.from(tokenParts[0], 'base64url').toString('utf-8');
    const header = JSON.parse(headerJson);
    const kid = header.kid;

    if (!kid) {
      console.error('Missing kid in JWT header');
      return false;
    }

    const keyResponse = await plaidClient.webhookVerificationKeyGet({
      key_id: kid,
    });

    const jwk = keyResponse.data.key;
    const publicKey = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });

    const signatureInput = `${tokenParts[0]}.${tokenParts[1]}`;
    const signature = Buffer.from(tokenParts[2], 'base64url');

    const isValid = crypto.verify(
      'sha256',
      Buffer.from(signatureInput),
      publicKey,
      signature
    );

    if (!isValid) {
      console.error('Plaid webhook JWT signature verification failed');
      return false;
    }

    const payloadJson = Buffer.from(tokenParts[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    const bodyString = JSON.stringify(req.body);
    const bodyHash = computeBodyHash(bodyString);

    if (payload.request_body_sha256 !== bodyHash) {
      console.error('Plaid webhook body hash mismatch');
      return false;
    }

    console.log('Plaid webhook verification passed');
    return true;
  } catch (error: any) {
    console.error('Plaid webhook verification error:', error.message);
    return false;
  }
}

function buildProviderEventId(webhookType: string, webhookCode: string, itemId: string, timestamp: string): string {
  return `plaid_${webhookType}_${webhookCode}_${itemId}_${timestamp}`;
}

async function findConnectionByItemId(itemId: string): Promise<{ id: string; suiteId: string; officeId: string } | null> {
  try {
    const result = await db.execute(sql`
      SELECT id, suite_id, office_id
      FROM finance_connections
      WHERE provider = 'plaid' AND external_account_id = ${itemId}
      LIMIT 1
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      const row = (rows as any[])[0];
      return { id: row.id, suiteId: row.suite_id, officeId: row.office_id };
    }
    return null;
  } catch (error: any) {
    console.error('Failed to find connection by item ID:', error.message);
    return null;
  }
}

async function writeFinanceEvent(params: {
  suiteId: string;
  officeId: string;
  connectionId: string | null;
  provider: string;
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
      VALUES (${params.suiteId}, ${params.officeId}, ${params.connectionId}, ${params.provider}, ${params.providerEventId}, ${params.eventType}, ${params.occurredAt}, ${params.amount}, ${params.currency}, ${params.status}, ${JSON.stringify(params.entityRefs)}, ${params.rawHash}, ${params.receiptId}, ${JSON.stringify(params.metadata)})
      ON CONFLICT (suite_id, office_id, provider, provider_event_id) DO NOTHING
      RETURNING event_id
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      console.log(`Finance event written: ${params.providerEventId}`);
      return true;
    }
    console.log(`Finance event already exists (idempotent skip): ${params.providerEventId}`);
    return false;
  } catch (error: any) {
    console.error('Failed to write finance event:', error.message);
    return false;
  }
}

export async function pullPlaidTransactionsSync(accessToken: string, connectionId: string, suiteId: string, officeId: string): Promise<{ added: number; modified: number; removed: number }> {
  try {
    let cursor: string | undefined;

    try {
      const cursorResult = await db.execute(sql`
        SELECT data->>'sync_cursor' as cursor
        FROM finance_entities
        WHERE connection_id = ${connectionId} AND entity_type = 'sync_cursor' AND provider = 'plaid'
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      const cursorRows = cursorResult.rows || cursorResult;
      if (cursorRows && (cursorRows as any[]).length > 0 && (cursorRows as any[])[0].cursor) {
        cursor = (cursorRows as any[])[0].cursor;
      }
    } catch (e: any) {
      console.log('No existing sync cursor found, starting fresh');
    }

    let added = 0;
    let modified = 0;
    let removed = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor || undefined,
      });

      const data = response.data;

      for (const tx of data.added) {
        const amountCents = Math.round(tx.amount * 100);
        const eventType = tx.pending ? 'bank_tx_pending' : 'bank_tx_posted';
        const status = tx.pending ? 'pending' : 'posted';
        const providerEventId = `plaid_tx_${tx.transaction_id}`;

        await writeFinanceEvent({
          suiteId,
          officeId,
          connectionId,
          provider: 'plaid',
          providerEventId,
          eventType,
          occurredAt: new Date(tx.date),
          amount: amountCents,
          currency: tx.iso_currency_code?.toLowerCase() || 'usd',
          status,
          entityRefs: {
            bank_tx_id: tx.transaction_id,
            account_id: tx.account_id,
            category: tx.category,
          },
          rawHash: computeBodyHash(JSON.stringify(tx)),
          receiptId: null,
          metadata: {
            name: tx.name,
            merchant_name: tx.merchant_name,
            payment_channel: tx.payment_channel,
          },
        });
        added++;
      }

      for (const tx of data.modified) {
        const amountCents = Math.round(tx.amount * 100);
        const eventType = tx.pending ? 'bank_tx_pending' : 'bank_tx_posted';
        const status = tx.pending ? 'pending' : 'posted';
        const providerEventId = `plaid_tx_${tx.transaction_id}`;

        await writeFinanceEvent({
          suiteId,
          officeId,
          connectionId,
          provider: 'plaid',
          providerEventId,
          eventType,
          occurredAt: new Date(tx.date),
          amount: amountCents,
          currency: tx.iso_currency_code?.toLowerCase() || 'usd',
          status,
          entityRefs: {
            bank_tx_id: tx.transaction_id,
            account_id: tx.account_id,
            category: tx.category,
          },
          rawHash: computeBodyHash(JSON.stringify(tx)),
          receiptId: null,
          metadata: {
            name: tx.name,
            merchant_name: tx.merchant_name,
            payment_channel: tx.payment_channel,
          },
        });
        modified++;
      }

      for (const removedTx of data.removed) {
        const providerEventId = `plaid_tx_removed_${removedTx.transaction_id}`;
        await writeFinanceEvent({
          suiteId,
          officeId,
          connectionId,
          provider: 'plaid',
          providerEventId,
          eventType: 'bank_tx_reversed',
          occurredAt: new Date(),
          amount: null,
          currency: 'usd',
          status: 'reversed',
          entityRefs: {
            bank_tx_id: removedTx.transaction_id,
          },
          rawHash: computeBodyHash(JSON.stringify(removedTx)),
          receiptId: null,
          metadata: {},
        });
        removed++;
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    if (cursor) {
      try {
        const existing = await db.execute(sql`
          SELECT id FROM finance_entities
          WHERE connection_id = ${connectionId} AND entity_type = 'sync_cursor' AND provider = 'plaid'
          LIMIT 1
        `);
        const existingRows = existing.rows || existing;
        if (existingRows && (existingRows as any[]).length > 0) {
          await db.execute(sql`
            UPDATE finance_entities
            SET data = ${JSON.stringify({ sync_cursor: cursor })}, updated_at = NOW()
            WHERE connection_id = ${connectionId} AND entity_type = 'sync_cursor' AND provider = 'plaid'
          `);
        } else {
          await db.execute(sql`
            INSERT INTO finance_entities (suite_id, office_id, connection_id, provider, entity_type, entity_id, data)
            VALUES (${suiteId}, ${officeId}, ${connectionId}, 'plaid', 'sync_cursor', ${connectionId}, ${JSON.stringify({ sync_cursor: cursor })})
          `);
        }
      } catch (e: any) {
        console.error('Failed to save sync cursor:', e.message);
      }
    }

    await createReceipt({
      suiteId,
      officeId,
      actionType: 'sync_pull',
      inputs: { connectionId, provider: 'plaid', cursor },
      outputs: { added, modified, removed },
      metadata: { provider: 'plaid', connectionId },
    });

    await updateConnectionSyncTime(connectionId, 'last_sync_at');

    console.log(`Plaid transactions sync complete: +${added} ~${modified} -${removed}`);
    return { added, modified, removed };
  } catch (error: any) {
    console.error('Plaid transactions sync error:', error?.response?.data || error.message);
    throw error;
  }
}

export async function fetchPlaidBalances(accessToken: string, connectionId: string, suiteId: string, officeId: string): Promise<any[]> {
  try {
    const response = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
    });

    const accounts = response.data.accounts;
    const balanceResults: any[] = [];

    for (const account of accounts) {
      const providerEventId = `plaid_balance_${account.account_id}_${new Date().toISOString().split('T')[0]}`;
      const balanceCents = Math.round((account.balances.current || 0) * 100);

      await writeFinanceEvent({
        suiteId,
        officeId,
        connectionId,
        provider: 'plaid',
        providerEventId,
        eventType: 'bank_balance_updated',
        occurredAt: new Date(),
        amount: balanceCents,
        currency: account.balances.iso_currency_code?.toLowerCase() || 'usd',
        status: 'posted',
        entityRefs: {
          account_id: account.account_id,
          account_name: account.name,
          account_type: account.type,
          account_subtype: account.subtype,
        },
        rawHash: computeBodyHash(JSON.stringify(account.balances)),
        receiptId: null,
        metadata: {
          available: account.balances.available,
          current: account.balances.current,
          limit: account.balances.limit,
        },
      });

      balanceResults.push({
        account_id: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        balances: account.balances,
      });
    }

    await createReceipt({
      suiteId,
      officeId,
      actionType: 'sync_pull',
      inputs: { connectionId, provider: 'plaid', type: 'balance' },
      outputs: { accounts: balanceResults.length },
      metadata: { provider: 'plaid', connectionId, type: 'balance_fetch' },
    });

    console.log(`Plaid balances fetched: ${balanceResults.length} accounts`);
    return balanceResults;
  } catch (error: any) {
    console.error('Plaid balance fetch error:', error?.response?.data || error.message);
    throw error;
  }
}

const router = Router();

router.post('/api/plaid/finance-webhook', async (req: Request, res: Response) => {
  try {
    const isValid = await verifyPlaidWebhook(req);
    if (!isValid) {
      console.error('Plaid webhook verification failed, rejecting request');
      return res.status(401).json({ error: 'Webhook verification failed' });
    }

    const body = req.body;
    const webhookType = body.webhook_type || '';
    const webhookCode = body.webhook_code || '';
    const itemId = body.item_id || '';
    const compositeType = `${webhookType}.${webhookCode}`;

    console.log(`Plaid webhook received: ${compositeType} for item ${itemId}`);

    const eventType = PLAID_EVENT_MAP[compositeType];
    if (!eventType) {
      console.log(`Unhandled Plaid webhook type: ${compositeType}, acknowledging`);
      return res.status(200).json({ received: true, handled: false });
    }

    const connection = await findConnectionByItemId(itemId);
    const suiteId = connection?.suiteId || DEFAULT_SUITE_ID;
    const officeId = connection?.officeId || DEFAULT_OFFICE_ID;
    const connectionId = connection?.id || null;

    const timestamp = new Date().toISOString();
    const providerEventId = buildProviderEventId(webhookType, webhookCode, itemId, timestamp);
    const rawHash = computeBodyHash(JSON.stringify(body));

    const receiptId = await createReceipt({
      suiteId,
      officeId,
      actionType: 'ingest_webhook',
      inputs: { provider: 'plaid', webhookType: compositeType, itemId },
      outputs: { eventType, providerEventId },
      metadata: { provider: 'plaid', webhookType: compositeType, itemId },
    });

    const written = await writeFinanceEvent({
      suiteId,
      officeId,
      connectionId,
      provider: 'plaid',
      providerEventId,
      eventType,
      occurredAt: new Date(),
      amount: body.new_transactions ? body.new_transactions : null,
      currency: 'usd',
      status: 'posted',
      entityRefs: {
        item_id: itemId,
        webhook_type: webhookType,
        webhook_code: webhookCode,
      },
      rawHash,
      receiptId,
      metadata: body,
    });

    if (connectionId) {
      try {
        await updateConnectionSyncTime(connectionId, 'last_webhook_at');
      } catch (e: any) {
        console.error('Failed to update connection webhook time:', e.message);
      }
    }

    console.log(`Plaid webhook processed: ${compositeType} -> ${eventType} (written: ${written})`);
    res.status(200).json({ received: true, handled: true, eventType, written });
  } catch (error: any) {
    console.error('Plaid webhook processing error:', error.message);
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

export default router;
