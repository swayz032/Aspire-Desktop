import { db } from './db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { loadToken, loadAllTokens } from './tokenStore';
import { createReceipt } from './receiptService';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

async function upsertConnection(suiteId: string, officeId: string, provider: string, externalAccountId: string): Promise<string> {
  const result = await db.execute(sql`
    INSERT INTO finance_connections (suite_id, office_id, provider, external_account_id, status, last_sync_at)
    VALUES (${suiteId}, ${officeId}, ${provider}, ${externalAccountId}, 'connected', NOW())
    ON CONFLICT (suite_id, office_id, provider) DO UPDATE SET
      external_account_id = ${externalAccountId},
      status = 'connected',
      last_sync_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `);
  const rows = (result.rows || result) as any[];
  return rows[0].id;
}

async function insertEvent(params: {
  suiteId: string;
  officeId: string;
  connectionId: string | null;
  provider: string;
  providerEventId: string;
  eventType: string;
  occurredAt: Date;
  amount: number;
  currency: string;
  status: string;
  entityRefs: any;
  metadata: any;
  receiptId: string | null;
}): Promise<void> {
  const eventId = crypto.randomUUID();
  const rawHash = crypto.createHash('sha256').update(JSON.stringify({ ...params, eventId })).digest('hex');
  await db.execute(sql`
    INSERT INTO finance_events (event_id, suite_id, office_id, connection_id, provider, provider_event_id, event_type, occurred_at, amount, currency, status, entity_refs, metadata, raw_hash, receipt_id)
    VALUES (${eventId}, ${params.suiteId}, ${params.officeId}, ${params.connectionId}, ${params.provider}, ${params.providerEventId}, ${params.eventType}, ${params.occurredAt}, ${params.amount}, ${params.currency}, ${params.status}, ${JSON.stringify(params.entityRefs || {})}, ${JSON.stringify(params.metadata || {})}, ${rawHash}, ${params.receiptId})
    ON CONFLICT (suite_id, office_id, provider, provider_event_id) DO NOTHING
  `);
}

async function syncPlaid(suiteId: string, officeId: string, receiptId: string): Promise<void> {
  const tokens = await loadAllTokens('plaid:');
  if (tokens.length === 0) {
    console.log('Initial sync: Plaid - no tokens found, skipping');
    return;
  }

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

  let totalAccounts = 0;
  let totalTransactions = 0;

  for (const token of tokens) {
    if (!token.access_token) continue;

    const connectionId = await upsertConnection(suiteId, officeId, 'plaid', token.item_id || 'unknown');

    try {
      const balanceResponse = await plaidClient.accountsBalanceGet({ access_token: token.access_token });
      const accounts = balanceResponse.data.accounts;
      const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.balances?.current || 0), 0);

      await insertEvent({
        suiteId,
        officeId,
        connectionId,
        provider: 'plaid',
        providerEventId: `plaid_balance_${token.item_id || 'unknown'}_${new Date().toISOString().split('T')[0]}`,
        eventType: 'bank_balance_updated',
        occurredAt: new Date(),
        amount: Math.round(totalBalance * 100),
        currency: 'USD',
        status: 'posted',
        entityRefs: { accounts: accounts.map((a: any) => ({ id: a.account_id, name: a.name, type: a.type })) },
        metadata: { accountCount: accounts.length, balances: accounts.map((a: any) => ({ id: a.account_id, current: a.balances?.current, available: a.balances?.available })) },
        receiptId,
      });
      totalAccounts += accounts.length;
    } catch (err: any) {
      console.error(`Initial sync: Plaid balance error for item ${token.item_id}:`, err.message);
    }

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      const txResponse = await plaidClient.transactionsGet({
        access_token: token.access_token,
        start_date: startDate,
        end_date: endDate,
        options: { count: 100, offset: 0 },
      });

      const transactions = txResponse.data.transactions;
      for (const tx of transactions) {
        await insertEvent({
          suiteId,
          officeId,
          connectionId,
          provider: 'plaid',
          providerEventId: `plaid_tx_${tx.transaction_id}`,
          eventType: tx.pending ? 'bank_tx_pending' : 'bank_tx_posted',
          occurredAt: new Date(tx.date),
          amount: Math.round((tx.amount || 0) * 100),
          currency: 'USD',
          status: tx.pending ? 'pending' : 'posted',
          entityRefs: { accountId: tx.account_id, category: tx.category },
          metadata: { name: tx.name, merchantName: tx.merchant_name, transactionType: tx.transaction_type },
          receiptId,
        });
        totalTransactions++;
      }
    } catch (err: any) {
      console.error(`Initial sync: Plaid transactions error for item ${token.item_id}:`, err.message);
    }
  }

  console.log(`Initial sync: Plaid - ${totalAccounts} accounts, ${totalTransactions} transactions synced`);
}

async function syncStripe(suiteId: string, officeId: string, receiptId: string): Promise<void> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.log('Initial sync: Stripe - no secret key, skipping');
    return;
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(stripeKey);
  const connectionId = await upsertConnection(suiteId, officeId, 'stripe', 'stripe_account');

  let chargeCount = 0;
  let payoutCount = 0;
  let feeCount = 0;

  try {
    const balance = await stripe.balance.retrieve();
    const availableAmount = balance.available?.[0]?.amount || 0;
    const pendingAmount = balance.pending?.[0]?.amount || 0;

    await insertEvent({
      suiteId,
      officeId,
      connectionId,
      provider: 'stripe',
      providerEventId: `stripe_balance_${new Date().toISOString().split('T')[0]}`,
      eventType: 'balance_pending_to_available',
      occurredAt: new Date(),
      amount: availableAmount,
      currency: 'USD',
      status: 'posted',
      entityRefs: {},
      metadata: { available: availableAmount, pending: pendingAmount },
      receiptId,
    });
  } catch (err: any) {
    console.error('Initial sync: Stripe balance error:', err.message);
  }

  try {
    const payouts = await stripe.payouts.list({ limit: 20 });
    for (const payout of payouts.data) {
      await insertEvent({
        suiteId,
        officeId,
        connectionId,
        provider: 'stripe',
        providerEventId: `stripe_payout_${payout.id}`,
        eventType: payout.status === 'paid' ? 'payout_paid' : 'payout_created',
        occurredAt: new Date(payout.created * 1000),
        amount: payout.amount,
        currency: 'USD',
        status: payout.status === 'paid' ? 'posted' : 'pending',
        entityRefs: { payoutId: payout.id, destination: payout.destination },
        metadata: { method: payout.method, type: payout.type, arrivalDate: payout.arrival_date },
        receiptId,
      });
      payoutCount++;
    }
  } catch (err: any) {
    console.error('Initial sync: Stripe payouts error:', err.message);
  }

  try {
    const charges = await stripe.charges.list({ limit: 30 });
    for (const charge of charges.data) {
      await insertEvent({
        suiteId,
        officeId,
        connectionId,
        provider: 'stripe',
        providerEventId: `stripe_charge_${charge.id}`,
        eventType: 'payment_succeeded',
        occurredAt: new Date(charge.created * 1000),
        amount: charge.amount,
        currency: 'USD',
        status: charge.paid ? 'posted' : 'pending',
        entityRefs: { chargeId: charge.id, customerId: charge.customer },
        metadata: { description: charge.description, receiptUrl: charge.receipt_url, paymentMethod: charge.payment_method },
        receiptId,
      });
      chargeCount++;
    }
  } catch (err: any) {
    console.error('Initial sync: Stripe charges error:', err.message);
  }

  try {
    const fees = await stripe.balanceTransactions.list({ limit: 20, type: 'stripe_fee' });
    for (const fee of fees.data) {
      await insertEvent({
        suiteId,
        officeId,
        connectionId,
        provider: 'stripe',
        providerEventId: `stripe_fee_${fee.id}`,
        eventType: 'fee_assessed',
        occurredAt: new Date(fee.created * 1000),
        amount: Math.abs(fee.amount),
        currency: 'USD',
        status: 'posted',
        entityRefs: { transactionId: fee.id, source: fee.source },
        metadata: { description: fee.description, type: fee.type, net: fee.net, fee: fee.fee },
        receiptId,
      });
      feeCount++;
    }
  } catch (err: any) {
    console.error('Initial sync: Stripe fees error:', err.message);
  }

  console.log(`Initial sync: Stripe - ${chargeCount} charges, ${payoutCount} payouts, ${feeCount} fees synced`);
}

async function syncQuickBooks(suiteId: string, officeId: string, receiptId: string): Promise<void> {
  const token = await loadToken('quickbooks');
  if (!token || !token.access_token || !token.realm_id) {
    console.log('Initial sync: QuickBooks - no tokens found, skipping');
    return;
  }

  const connectionId = await upsertConnection(suiteId, officeId, 'qbo', token.realm_id);

  try {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const response = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${token.realm_id}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Initial sync: QuickBooks P&L request failed: ${response.status}`);
      return;
    }

    const report = await response.json();
    let revenue = 0;
    let expenses = 0;

    if (report.Rows?.Row) {
      for (const row of report.Rows.Row) {
        if (row.group === 'Income' && row.Summary?.ColData?.[1]?.value) {
          revenue = parseFloat(row.Summary.ColData[1].value) || 0;
        }
        if (row.group === 'Expenses' && row.Summary?.ColData?.[1]?.value) {
          expenses = parseFloat(row.Summary.ColData[1].value) || 0;
        }
      }
    }

    await insertEvent({
      suiteId,
      officeId,
      connectionId,
      provider: 'qbo',
      providerEventId: `qbo_pnl_${startDate}_${endDate}`,
      eventType: 'qbo_report_refreshed',
      occurredAt: new Date(),
      amount: Math.round((revenue - expenses) * 100),
      currency: 'USD',
      status: 'posted',
      entityRefs: { realmId: token.realm_id },
      metadata: { revenue, expenses, reportType: 'ProfitAndLoss', startDate, endDate },
      receiptId,
    });

    console.log(`Initial sync: QuickBooks - P&L report synced (revenue: ${revenue}, expenses: ${expenses})`);
  } catch (err: any) {
    console.error('Initial sync: QuickBooks error:', err.message);
  }
}

async function syncGusto(suiteId: string, officeId: string, receiptId: string): Promise<void> {
  const token = await loadToken('gusto');
  if (!token || !token.access_token || !token.company_uuid) {
    console.log('Initial sync: Gusto - no tokens found, skipping');
    return;
  }

  const connectionId = await upsertConnection(suiteId, officeId, 'gusto', token.company_uuid);

  try {
    const response = await fetch(
      `https://api.gusto-demo.com/v1/companies/${token.company_uuid}/payrolls?processed=true`,
      {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Initial sync: Gusto payrolls request failed: ${response.status}`);
      return;
    }

    const payrolls = await response.json();
    let payrollCount = 0;

    if (Array.isArray(payrolls)) {
      const recentPayrolls = payrolls.slice(0, 20);
      for (const payroll of recentPayrolls) {
        const totalAmount = payroll.totals?.net_pay
          ? parseFloat(payroll.totals.net_pay)
          : (payroll.totals?.gross_pay ? parseFloat(payroll.totals.gross_pay) : 0);

        await insertEvent({
          suiteId,
          officeId,
          connectionId,
          provider: 'gusto',
          providerEventId: `gusto_payroll_${payroll.payroll_uuid || payroll.id || payroll.check_date}`,
          eventType: 'payroll_paid',
          occurredAt: new Date(payroll.check_date || payroll.processed_date || new Date()),
          amount: Math.round(totalAmount * 100),
          currency: 'USD',
          status: 'posted',
          entityRefs: { companyUuid: token.company_uuid, payrollId: payroll.payroll_uuid || payroll.id },
          metadata: { checkDate: payroll.check_date, payPeriod: payroll.pay_period, totals: payroll.totals },
          receiptId,
        });
        payrollCount++;
      }
    }

    console.log(`Initial sync: Gusto - ${payrollCount} payrolls synced`);
  } catch (err: any) {
    console.error('Initial sync: Gusto error:', err.message);
  }
}

export async function registerConnectionsFromTokens(suiteId: string, officeId: string): Promise<void> {
  try {
    const plaidTokens = await loadAllTokens('plaid:');
    if (plaidTokens.length > 0) {
      for (const token of plaidTokens) {
        if (token.access_token) {
          await upsertConnection(suiteId, officeId, 'plaid', token.item_id || 'unknown');
        }
      }
      console.log(`Registered ${plaidTokens.length} Plaid connection(s)`);
    }

    if (process.env.STRIPE_SECRET_KEY) {
      await upsertConnection(suiteId, officeId, 'stripe', 'stripe_account');
      console.log('Registered Stripe connection');
    }

    const qboToken = await loadToken('quickbooks');
    if (qboToken?.access_token && qboToken.realm_id) {
      await upsertConnection(suiteId, officeId, 'qbo', qboToken.realm_id);
      console.log('Registered QuickBooks connection');
    }

    const gustoToken = await loadToken('gusto');
    if (gustoToken?.access_token && gustoToken.company_uuid) {
      await upsertConnection(suiteId, officeId, 'gusto', gustoToken.company_uuid);
      console.log('Registered Gusto connection');
    }
  } catch (err: any) {
    console.error('Failed to register connections from tokens:', err.message);
  }
}

export async function runInitialSync(suiteId: string, officeId: string): Promise<void> {
  console.log(`Initial sync starting for suite=${suiteId}, office=${officeId}`);

  const receiptId = await createReceipt({
    suiteId,
    officeId,
    actionType: 'sync_pull',
    inputs: { suiteId, officeId, trigger: 'initial_sync', timestamp: new Date().toISOString() },
    outputs: { status: 'started' },
    metadata: { source: 'initialSync' },
  });

  try {
    await syncPlaid(suiteId, officeId, receiptId);
  } catch (err: any) {
    console.error('Initial sync: Plaid sync failed:', err.message);
  }

  try {
    await syncStripe(suiteId, officeId, receiptId);
  } catch (err: any) {
    console.error('Initial sync: Stripe sync failed:', err.message);
  }

  try {
    await syncQuickBooks(suiteId, officeId, receiptId);
  } catch (err: any) {
    console.error('Initial sync: QuickBooks sync failed:', err.message);
  }

  try {
    await syncGusto(suiteId, officeId, receiptId);
  } catch (err: any) {
    console.error('Initial sync: Gusto sync failed:', err.message);
  }

  console.log('Initial sync completed');
}
