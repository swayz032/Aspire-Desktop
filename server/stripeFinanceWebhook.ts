import { Router, Request, Response } from 'express';
import express from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { updateConnectionSyncTime, getConnectionByProvider } from './financeTokenStore';
import crypto from 'crypto';

const DEFAULT_SUITE_ID = 'default';
const DEFAULT_OFFICE_ID = 'default';

const STRIPE_EVENT_MAP: Record<string, string> = {
  'invoice.sent': 'invoice_sent',
  'invoice.paid': 'invoice_paid',
  'invoice.payment_succeeded': 'payment_succeeded',
  'invoice.payment_failed': 'payment_failed',
  'payment_intent.succeeded': 'payment_succeeded',
  'payment_intent.payment_failed': 'payment_failed',
  'charge.refunded': 'payment_refunded',
  'payout.created': 'payout_created',
  'payout.paid': 'payout_paid',
  'payout.failed': 'payout_failed',
  'balance.available': 'balance_pending_to_available',
};

function getStripeClient() {
  const Stripe = require('stripe');
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_CONNECT_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not found in environment');
  }
  return new Stripe(key);
}

function computeRawHash(data: any): string {
  const raw = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function extractAmount(eventType: string, dataObject: any): number | null {
  if (eventType.startsWith('invoice.')) {
    return dataObject.amount_paid ?? dataObject.amount_due ?? null;
  }
  if (eventType.startsWith('payment_intent.')) {
    return dataObject.amount ?? null;
  }
  if (eventType.startsWith('charge.')) {
    return dataObject.amount_refunded ?? dataObject.amount ?? null;
  }
  if (eventType.startsWith('payout.')) {
    return dataObject.amount ?? null;
  }
  if (eventType === 'balance.available') {
    const available = dataObject.available;
    if (Array.isArray(available) && available.length > 0) {
      return available.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
    }
    return null;
  }
  return null;
}

function extractEntityRefs(eventType: string, dataObject: any, stripeEventId: string): Record<string, string> {
  const refs: Record<string, string> = { stripe_event_id: stripeEventId };

  if (dataObject.id) {
    if (eventType.startsWith('invoice.')) {
      refs.invoice_id = dataObject.id;
    } else if (eventType.startsWith('payment_intent.')) {
      refs.payment_intent_id = dataObject.id;
    } else if (eventType.startsWith('charge.')) {
      refs.charge_id = dataObject.id;
    } else if (eventType.startsWith('payout.')) {
      refs.payout_id = dataObject.id;
    }
  }

  if (dataObject.customer) {
    refs.customer_id = typeof dataObject.customer === 'string' ? dataObject.customer : dataObject.customer.id;
  }

  if (dataObject.payment_intent && typeof dataObject.payment_intent === 'string') {
    refs.payment_intent_id = dataObject.payment_intent;
  }

  return refs;
}

function extractFee(eventType: string, dataObject: any): number | null {
  if (eventType === 'payment_intent.succeeded' || eventType === 'invoice.paid' || eventType === 'invoice.payment_succeeded') {
    if (dataObject.charges?.data?.[0]?.balance_transaction) {
      return null;
    }
    if (typeof dataObject.application_fee_amount === 'number') {
      return dataObject.application_fee_amount;
    }
  }
  if (eventType.startsWith('charge.') && dataObject.balance_transaction) {
    const bt = dataObject.balance_transaction;
    if (typeof bt === 'object' && typeof bt.fee === 'number') {
      return bt.fee;
    }
  }
  return null;
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
  entityRefs: any;
  rawHash: string;
  metadata?: any;
}): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      INSERT INTO finance_events (suite_id, office_id, connection_id, provider, provider_event_id, event_type, occurred_at, amount, currency, entity_refs, raw_hash, metadata)
      VALUES (${params.suiteId}, ${params.officeId}, ${params.connectionId}, 'stripe', ${params.providerEventId}, ${params.eventType}, ${params.occurredAt}, ${params.amount}, ${params.currency}, ${JSON.stringify(params.entityRefs)}, ${params.rawHash}, ${JSON.stringify(params.metadata || {})})
      ON CONFLICT (suite_id, office_id, provider, provider_event_id) DO NOTHING
      RETURNING event_id
    `);
    const rows = result.rows || result;
    if (rows && (rows as any[]).length > 0) {
      return (rows as any[])[0].event_id;
    }
    return null;
  } catch (error: any) {
    console.error('Failed to write finance event:', error.message);
    throw error;
  }
}

export async function fetchPayoutReconciliation(payoutId: string, suiteId?: string, officeId?: string): Promise<void> {
  try {
    const stripe = getStripeClient();
    const sId = suiteId || DEFAULT_SUITE_ID;
    const oId = officeId || DEFAULT_OFFICE_ID;

    const payout = await stripe.payouts.retrieve(payoutId);
    console.log(`Fetching reconciliation for payout ${payoutId}, amount: ${payout.amount}`);

    const balanceTransactions = await stripe.balanceTransactions.list({
      payout: payoutId,
      limit: 100,
    });

    const connection = await getConnectionByProvider(sId, oId, 'stripe');
    const connectionId = connection?.id || null;

    for (const bt of balanceTransactions.data) {
      const providerEventId = `payout_recon_${payoutId}_${bt.id}`;
      const entityRefs = {
        payout_id: payoutId,
        balance_transaction_id: bt.id,
        source_type: bt.type,
        source_id: bt.source || null,
      };

      await writeFinanceEvent({
        suiteId: sId,
        officeId: oId,
        connectionId,
        providerEventId,
        eventType: 'payout_reconciliation',
        occurredAt: new Date(bt.created * 1000),
        amount: bt.amount,
        currency: bt.currency || 'usd',
        entityRefs,
        rawHash: computeRawHash(bt),
        metadata: { payout_status: payout.status, bt_type: bt.type },
      });
    }

    console.log(`Payout reconciliation complete: ${balanceTransactions.data.length} balance transactions for payout ${payoutId}`);
  } catch (error: any) {
    console.error('Failed to fetch payout reconciliation:', error.message);
    throw error;
  }
}

export async function checkSettlementState(suiteId?: string, officeId?: string): Promise<{
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
}> {
  try {
    const stripe = getStripeClient();
    const sId = suiteId || DEFAULT_SUITE_ID;
    const oId = officeId || DEFAULT_OFFICE_ID;

    const balance = await stripe.balance.retrieve();

    const available = (balance.available || []).map((b: any) => ({
      amount: b.amount,
      currency: b.currency,
    }));
    const pending = (balance.pending || []).map((b: any) => ({
      amount: b.amount,
      currency: b.currency,
    }));

    const connection = await getConnectionByProvider(sId, oId, 'stripe');
    const connectionId = connection?.id || null;

    const totalAvailable = available.reduce((sum: number, b: any) => sum + b.amount, 0);
    const totalPending = pending.reduce((sum: number, b: any) => sum + b.amount, 0);

    if (totalAvailable > 0) {
      const providerEventId = `balance_check_${Date.now()}`;
      await writeFinanceEvent({
        suiteId: sId,
        officeId: oId,
        connectionId,
        providerEventId,
        eventType: 'balance_pending_to_available',
        occurredAt: new Date(),
        amount: totalAvailable,
        currency: 'usd',
        entityRefs: { available_total: totalAvailable, pending_total: totalPending },
        rawHash: computeRawHash(balance),
        metadata: { available, pending },
      });
    }

    console.log(`Settlement state: available=${totalAvailable}, pending=${totalPending}`);
    return { available, pending };
  } catch (error: any) {
    console.error('Failed to check settlement state:', error.message);
    throw error;
  }
}

const router = Router();

router.post(
  '/api/stripe/finance-webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      let event: any;

      if (webhookSecret) {
        if (!signature) {
          console.error('Missing stripe-signature header');
          return res.status(400).json({ error: 'Missing signature' });
        }
        try {
          const stripe = getStripeClient();
          const sig = Array.isArray(signature) ? signature[0] : signature;
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
          console.error('Stripe webhook signature verification failed:', err.message);
          return res.status(400).json({ error: 'Signature verification failed' });
        }
      } else {
        console.warn('STRIPE_WEBHOOK_SECRET not set — accepting webhook without signature verification (sandbox mode)');
        try {
          event = JSON.parse(typeof req.body === 'string' ? req.body : req.body.toString());
        } catch (err: any) {
          console.error('Failed to parse webhook body:', err.message);
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      }

      const stripeEventType = event.type;
      const normalizedType = STRIPE_EVENT_MAP[stripeEventType];

      if (!normalizedType) {
        console.log(`Unhandled Stripe event type: ${stripeEventType}, skipping`);
        return res.status(200).json({ received: true, skipped: true });
      }

      const dataObject = event.data?.object || {};
      const amount = extractAmount(stripeEventType, dataObject);
      const entityRefs = extractEntityRefs(stripeEventType, dataObject, event.id);
      const rawHash = computeRawHash(event);
      const currency = dataObject.currency || 'usd';
      const occurredAt = new Date((event.created || Math.floor(Date.now() / 1000)) * 1000);

      const connection = await getConnectionByProvider(DEFAULT_SUITE_ID, DEFAULT_OFFICE_ID, 'stripe');
      const connectionId = connection?.id || null;

      const eventId = await writeFinanceEvent({
        suiteId: DEFAULT_SUITE_ID,
        officeId: DEFAULT_OFFICE_ID,
        connectionId,
        providerEventId: event.id,
        eventType: normalizedType,
        occurredAt,
        amount,
        currency,
        entityRefs,
        rawHash,
      });

      if (eventId) {
        try {
          const receiptId = await createReceipt({
            suiteId: DEFAULT_SUITE_ID,
            officeId: DEFAULT_OFFICE_ID,
            actionType: 'ingest_webhook',
            inputs: { provider: 'stripe', stripe_event_id: event.id, event_type: stripeEventType },
            outputs: { event_id: eventId, normalized_type: normalizedType },
            metadata: { source: 'stripe_finance_webhook' },
          });

          await db.execute(sql`
            UPDATE finance_events SET receipt_id = ${receiptId} WHERE event_id = ${eventId}::uuid
          `);
        } catch (receiptErr: any) {
          console.error('Failed to create receipt for finance event:', receiptErr.message);
        }

        const fee = extractFee(stripeEventType, dataObject);
        if (fee !== null && fee > 0) {
          try {
            await writeFinanceEvent({
              suiteId: DEFAULT_SUITE_ID,
              officeId: DEFAULT_OFFICE_ID,
              connectionId,
              providerEventId: `${event.id}_fee`,
              eventType: 'fee_assessed',
              occurredAt,
              amount: fee,
              currency,
              entityRefs: { ...entityRefs, fee_source_event: event.id },
              rawHash: computeRawHash({ event_id: event.id, fee }),
            });
          } catch (feeErr: any) {
            console.error('Failed to write fee event:', feeErr.message);
          }
        }
      }

      if (stripeEventType.startsWith('payout.') && dataObject.id) {
        try {
          await fetchPayoutReconciliation(dataObject.id, DEFAULT_SUITE_ID, DEFAULT_OFFICE_ID);
        } catch (reconErr: any) {
          console.error('Payout reconciliation failed:', reconErr.message);
        }
      }

      if (connectionId) {
        try {
          await updateConnectionSyncTime(connectionId, 'last_webhook_at');
        } catch (syncErr: any) {
          console.error('Failed to update connection webhook time:', syncErr.message);
        }
      }

      console.log(`Stripe finance webhook processed: ${stripeEventType} -> ${normalizedType} (event: ${event.id})`);
      return res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Stripe finance webhook error:', error.message);
      return res.status(500).json({ error: 'Webhook processing error' });
    }
  }
);

export default router;
