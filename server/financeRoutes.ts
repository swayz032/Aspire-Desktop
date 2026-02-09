import { Router, Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { getConnectionsByTenant } from './financeTokenStore';
import { computeSnapshot } from './snapshotEngine';
import crypto from 'crypto';

const router = Router();

const getQueryParam = (param: string | string[] | undefined, defaultVal: string): string =>
  param ? (Array.isArray(param) ? param[0] : param) : defaultVal;

const METRIC_DEFINITIONS: Record<string, { definition: string; formula: string; providers: string[] }> = {
  cash_available: {
    definition: 'Total cash available across all connected bank accounts and payment processors',
    formula: 'sum(bank_balances) + stripe_available_balance',
    providers: ['plaid', 'stripe'],
  },
  expected_inflows: {
    definition: 'Expected cash inflows over the next 7 days based on outstanding invoices and scheduled payments',
    formula: 'sum(outstanding_invoices_due_within_7d) + sum(scheduled_deposits)',
    providers: ['stripe', 'qbo'],
  },
  expected_outflows: {
    definition: 'Expected cash outflows over the next 7 days including payroll, bills, and scheduled payments',
    formula: 'sum(upcoming_payroll) + sum(bills_due_within_7d) + sum(scheduled_payments)',
    providers: ['gusto', 'qbo'],
  },
  monthly_revenue: {
    definition: 'Total revenue recognized in the current calendar month',
    formula: 'sum(income_transactions_current_month)',
    providers: ['stripe', 'qbo'],
  },
  monthly_expenses: {
    definition: 'Total expenses recorded in the current calendar month',
    formula: 'sum(expense_transactions_current_month)',
    providers: ['plaid', 'qbo'],
  },
  net_income: {
    definition: 'Net income for the current month calculated as revenue minus expenses',
    formula: 'monthly_revenue - monthly_expenses',
    providers: ['stripe', 'plaid', 'qbo'],
  },
  mismatch_count: {
    definition: 'Number of transactions that could not be automatically reconciled between providers',
    formula: 'count(unreconciled_transactions)',
    providers: ['plaid', 'stripe', 'qbo'],
  },
};

const emptyChapters = () => ({
  now: { cashAvailable: 0, bankBalance: 0, stripeAvailable: 0, stripePending: 0, lastUpdated: null },
  next: { expectedInflows7d: 0, expectedOutflows7d: 0, netCashFlow7d: 0, items: [] },
  month: { revenue: 0, expenses: 0, netIncome: 0, period: 'current_month' },
  reconcile: { mismatches: [], mismatchCount: 0 },
  actions: { proposals: [], proposalCount: 0 },
});

router.get('/api/finance/snapshot', async (req: Request, res: Response) => {
  try {
    const suiteId = getQueryParam(req.query.suiteId as string, 'default');
    const officeId = getQueryParam(req.query.officeId as string, 'default');

    const snapshotResult = await db.execute(sql`
      SELECT id, suite_id, office_id, generated_at, chapter_now, chapter_next, chapter_month,
             chapter_reconcile, chapter_actions, sources, staleness, receipt_id
      FROM finance_snapshots
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
      ORDER BY generated_at DESC
      LIMIT 1
    `);

    const rows = (snapshotResult.rows || snapshotResult) as any[];
    const connections = await getConnectionsByTenant(suiteId, officeId);
    const connected = connections.length > 0 && connections.some(c => c.status === 'connected');

    const staleThresholdMs = 5 * 60 * 1000;
    let snap = rows.length > 0 ? rows[0] : null;

    if (connected && (!snap || (Date.now() - new Date(snap.generated_at).getTime()) > staleThresholdMs)) {
      try {
        const freshSnapshot = await computeSnapshot(suiteId, officeId);
        return res.json(freshSnapshot);
      } catch (computeError: any) {
        console.warn('Auto-compute snapshot failed, using cached:', computeError.message);
      }
    }

    if (snap) {
      res.json({
        chapters: {
          now: snap.chapter_now || emptyChapters().now,
          next: snap.chapter_next || emptyChapters().next,
          month: snap.chapter_month || emptyChapters().month,
          reconcile: snap.chapter_reconcile || emptyChapters().reconcile,
          actions: snap.chapter_actions || emptyChapters().actions,
        },
        provenance: snap.sources || {},
        staleness: snap.staleness || {},
        generatedAt: snap.generated_at || null,
        connected,
      });
    } else {
      res.json({
        chapters: emptyChapters(),
        provenance: {},
        staleness: {},
        generatedAt: null,
        connected,
      });
    }
  } catch (error: any) {
    console.error('Finance snapshot error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/finance/timeline', async (req: Request, res: Response) => {
  try {
    const suiteId = getQueryParam(req.query.suiteId as string, 'default');
    const officeId = getQueryParam(req.query.officeId as string, 'default');
    const range = getQueryParam(req.query.range as string, '30d');
    const limit = Math.min(parseInt(getQueryParam(req.query.limit as string, '50'), 10) || 50, 200);
    const offset = parseInt(getQueryParam(req.query.offset as string, '0'), 10) || 0;

    const days = parseInt(range.replace('d', ''), 10) || 30;

    const result = await db.execute(sql`
      SELECT event_id, provider, event_type, occurred_at, amount, currency, status, entity_refs, metadata
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND occurred_at >= NOW() - (${days} || ' days')::interval
      ORDER BY occurred_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows = (result.rows || result) as any[];
    const events = rows.map((row: any) => ({
      eventId: row.event_id,
      provider: row.provider,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      entityRefs: row.entity_refs,
      metadata: row.metadata,
    }));

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int as total
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND occurred_at >= NOW() - (${days} || ' days')::interval
    `);
    const countRows = (countResult.rows || countResult) as any[];
    const total = countRows[0]?.total || 0;

    res.json({ events, total, limit, offset });
  } catch (error: any) {
    console.error('Finance timeline error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/finance/explain', async (req: Request, res: Response) => {
  try {
    const suiteId = getQueryParam(req.query.suiteId as string, 'default');
    const officeId = getQueryParam(req.query.officeId as string, 'default');
    const metricId = getQueryParam(req.query.metricId as string, '');

    if (!metricId) {
      return res.status(400).json({ error: 'metricId query parameter is required' });
    }

    const metric = METRIC_DEFINITIONS[metricId];
    if (!metric) {
      return res.status(404).json({ error: `Unknown metric: ${metricId}`, availableMetrics: Object.keys(METRIC_DEFINITIONS) });
    }

    const connections = await getConnectionsByTenant(suiteId, officeId);

    const sources = metric.providers.map(provider => {
      const conn = connections.find(c => c.provider === provider);
      return {
        provider,
        lastSyncAt: conn?.lastSyncAt || null,
        confidence: conn ? (conn.status === 'connected' ? 'high' : 'low') : 'none',
      };
    });

    const relatedResult = await db.execute(sql`
      SELECT event_id, provider, event_type, occurred_at, amount, currency
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
      ORDER BY occurred_at DESC
      LIMIT 5
    `);
    const relatedRows = (relatedResult.rows || relatedResult) as any[];
    const relatedEvents = relatedRows.map((row: any) => ({
      eventId: row.event_id,
      provider: row.provider,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      amount: row.amount,
      currency: row.currency,
    }));

    res.json({
      metricId,
      definition: metric.definition,
      formula: metric.formula,
      sources,
      exclusions: [],
      relatedEvents,
    });
  } catch (error: any) {
    console.error('Finance explain error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/connections/status', async (req: Request, res: Response) => {
  try {
    const suiteId = getQueryParam(req.query.suiteId as string, 'default');
    const officeId = getQueryParam(req.query.officeId as string, 'default');

    const connections = await getConnectionsByTenant(suiteId, officeId);

    const mapped = connections.map(conn => {
      let nextStep: string | null = null;
      if (conn.status === 'disconnected') nextStep = 'reconnect';
      else if (conn.status === 'needs_reauth') nextStep = 'reauthorize';
      else if (conn.status === 'pending') nextStep = 'complete_setup';

      return {
        id: conn.id,
        provider: conn.provider,
        status: conn.status,
        lastSyncAt: conn.lastSyncAt,
        lastWebhookAt: conn.lastWebhookAt,
        nextStep,
      };
    });

    const connected = mapped.filter(c => c.status === 'connected').length;
    const needsAttention = mapped.filter(c => c.nextStep !== null).length;

    res.json({
      connections: mapped,
      summary: {
        total: mapped.length,
        connected,
        needsAttention,
      },
    });
  } catch (error: any) {
    console.error('Connections status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/finance/lifecycle', async (req: Request, res: Response) => {
  try {
    const suiteId = getQueryParam(req.query.suiteId as string, 'default');
    const officeId = getQueryParam(req.query.officeId as string, 'default');
    const entityId = getQueryParam(req.query.entityId as string, '');

    let result;
    if (entityId) {
      result = await db.execute(sql`
        SELECT event_id, provider, event_type, occurred_at, amount, currency, status, entity_refs
        FROM finance_events
        WHERE suite_id = ${suiteId} AND office_id = ${officeId}
          AND (entity_refs->>'invoice_id' = ${entityId}
            OR entity_refs->>'payment_intent_id' = ${entityId}
            OR entity_refs->>'payout_id' = ${entityId}
            OR entity_refs->>'bank_tx_id' = ${entityId}
            OR entity_refs->>'booking_id' = ${entityId})
        ORDER BY occurred_at ASC
        LIMIT 50
      `);
    } else {
      result = await db.execute(sql`
        SELECT event_id, provider, event_type, occurred_at, amount, currency, status, entity_refs
        FROM finance_events
        WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        ORDER BY occurred_at DESC
        LIMIT 20
      `);
    }

    const rows = (result.rows || result) as any[];

    const LIFECYCLE_STAGES = ['booked', 'invoiced', 'paid', 'deposited', 'posted'];
    const EVENT_TO_STAGE: Record<string, string> = {
      'booking_created': 'booked',
      'qbo_invoice_changed': 'invoiced',
      'invoice_sent': 'invoiced',
      'invoice_paid': 'paid',
      'payment_succeeded': 'paid',
      'payout_created': 'deposited',
      'payout_paid': 'deposited',
      'bank_tx_posted': 'deposited',
      'qbo_journal_posted': 'posted',
      'qbo_payment_changed': 'posted',
    };

    const completedStages = new Set<string>();
    const stageDetails: Record<string, any> = {};

    for (const row of rows) {
      const stage = EVENT_TO_STAGE[row.event_type];
      if (stage && !stageDetails[stage]) {
        completedStages.add(stage);
        stageDetails[stage] = {
          provider: row.provider,
          timestamp: row.occurred_at,
          eventId: row.event_id,
          amount: row.amount,
        };
      }
    }

    const steps = LIFECYCLE_STAGES.map((stage, i) => {
      const detail = stageDetails[stage];
      const isCompleted = completedStages.has(stage);
      const allPreviousCompleted = LIFECYCLE_STAGES.slice(0, i).every(s => completedStages.has(s));
      const isCurrent = !isCompleted && allPreviousCompleted;
      return {
        label: stage.charAt(0).toUpperCase() + stage.slice(1),
        status: isCompleted ? 'completed' : (isCurrent ? 'current' : 'pending'),
        provider: detail?.provider || null,
        timestamp: detail?.timestamp || null,
        eventId: detail?.eventId || null,
        amount: detail?.amount || null,
      };
    });

    res.json({ steps, entityId: entityId || null });
  } catch (error: any) {
    console.error('Finance lifecycle error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/finance/compute-snapshot', async (req: Request, res: Response) => {
  try {
    const { suiteId = 'default', officeId = 'default' } = req.body;
    const snapshot = await computeSnapshot(suiteId, officeId);
    res.json(snapshot);
  } catch (error: any) {
    console.error('Compute snapshot error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/finance/proposals', async (req: Request, res: Response) => {
  try {
    const { suiteId = 'default', officeId = 'default', title, type, description, predictedImpact, dependencies } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'title and type are required' });
    }

    const providerEventId = `proposal_${crypto.randomUUID()}`;
    const metadata = { title, type, description, predictedImpact, dependencies };

    const result = await db.execute(sql`
      INSERT INTO finance_events (suite_id, office_id, provider, provider_event_id, event_type, occurred_at, metadata)
      VALUES (${suiteId}, ${officeId}, 'aspire', ${providerEventId}, 'proposal_created', NOW(), ${JSON.stringify(metadata)})
      RETURNING event_id, occurred_at
    `);

    const rows = (result.rows || result) as any[];
    const eventId = rows[0].event_id;
    const occurredAt = rows[0].occurred_at;

    const receiptId = await createReceipt({
      suiteId,
      officeId,
      actionType: 'propose_action',
      inputs: { title, type, description, predictedImpact, dependencies },
      outputs: { eventId, providerEventId },
      metadata: { proposalTitle: title },
    });

    await db.execute(sql`
      UPDATE finance_events SET receipt_id = ${receiptId} WHERE event_id = ${eventId}
    `);

    console.log(`Proposal created: ${eventId} (${title})`);

    res.status(201).json({
      eventId,
      title,
      type,
      description,
      predictedImpact,
      dependencies,
      occurredAt,
      receiptId,
    });
  } catch (error: any) {
    console.error('Create proposal error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/finance/actions/execute', async (req: Request, res: Response) => {
  try {
    const { suiteId = 'default', officeId = 'default', proposalId, approvedBy } = req.body;

    if (!proposalId || !approvedBy) {
      return res.status(400).json({ error: 'proposalId and approvedBy are required' });
    }

    const proposalResult = await db.execute(sql`
      SELECT event_id, metadata, amount, currency
      FROM finance_events
      WHERE event_id = ${proposalId} AND suite_id = ${suiteId} AND office_id = ${officeId} AND event_type = 'proposal_created'
      LIMIT 1
    `);

    const proposalRows = (proposalResult.rows || proposalResult) as any[];
    if (proposalRows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = proposalRows[0];
    const proposalMeta = proposal.metadata || {};

    let riskTier = 'low';
    const amount = proposal.amount || 0;
    if (amount > 100000) riskTier = 'high';
    else if (amount > 10000) riskTier = 'medium';

    const policyDecision = {
      riskTier,
      approved: riskTier !== 'high',
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: 'trust_spine_v1',
    };

    if (!policyDecision.approved) {
      return res.status(403).json({
        error: 'Proposal rejected by policy evaluation',
        riskTier,
        policyDecision,
      });
    }

    const executionEventId = `exec_${crypto.randomUUID()}`;
    const executionMeta = {
      proposalId,
      approvedBy,
      proposalTitle: proposalMeta.title,
      policyDecision,
    };

    const execResult = await db.execute(sql`
      INSERT INTO finance_events (suite_id, office_id, provider, provider_event_id, event_type, occurred_at, amount, currency, metadata)
      VALUES (${suiteId}, ${officeId}, 'aspire', ${executionEventId}, 'action_executed', NOW(), ${amount}, ${proposal.currency || 'usd'}, ${JSON.stringify(executionMeta)})
      RETURNING event_id, occurred_at
    `);

    const execRows = (execResult.rows || execResult) as any[];
    const execEventId = execRows[0].event_id;
    const executedAt = execRows[0].occurred_at;

    const receiptId = await createReceipt({
      suiteId,
      officeId,
      actionType: 'execute_action',
      inputs: { proposalId, approvedBy },
      outputs: { execEventId, policyDecision },
      policyDecisionId: `policy_${crypto.randomUUID()}`,
      metadata: { proposalTitle: proposalMeta.title, riskTier },
    });

    await db.execute(sql`
      UPDATE finance_events SET receipt_id = ${receiptId} WHERE event_id = ${execEventId}
    `);

    console.log(`Action executed: ${execEventId} for proposal ${proposalId}`);

    res.status(201).json({
      executionEventId: execEventId,
      proposalId,
      approvedBy,
      policyDecision,
      executedAt,
      receiptId,
    });
  } catch (error: any) {
    console.error('Execute action error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
