import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { getConnectionsByTenant } from './financeTokenStore';
import { computeSnapshot } from './snapshotEngine';
import { getDefaultOfficeId } from './suiteContext';
import crypto from 'crypto';
import { logger } from './logger';
import { withBreakerAction } from './circuitBreaker';

// Stripe client lazy-initialized so this module doesn't fail to load when
// STRIPE_SECRET_KEY is missing in dev. Used only by the approve endpoint to
// finalize + send invoices created by Quinn.
const stripeKey = process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
let _stripeInstance: Stripe | null = null;
function getStripeForApprove(): Stripe | null {
  if (!stripeKey) return null;
  if (!_stripeInstance) _stripeInstance = new Stripe(stripeKey);
  return _stripeInstance;
}

const router = Router();

const getQueryParam = (param: unknown, defaultVal: string): string =>
  param ? (Array.isArray(param) ? String(param[0]) : String(param)) : defaultVal;

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
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = getQueryParam(req.query.officeId, getDefaultOfficeId());

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
        const freshSnapshot = await withBreakerAction('backend', () =>
          computeSnapshot(suiteId, officeId)
        );
        return res.json(freshSnapshot);
      } catch (computeError: unknown) {
        logger.warn('Auto-compute snapshot failed, using cached', { error: computeError instanceof Error ? computeError.message : 'unknown' });
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Finance snapshot error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/finance/timeline', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = getQueryParam(req.query.officeId, getDefaultOfficeId());
    const range = getQueryParam(req.query.range, '30d');
    const limit = Math.min(parseInt(getQueryParam(req.query.limit, '50'), 10) || 50, 200);
    const offset = parseInt(getQueryParam(req.query.offset, '0'), 10) || 0;

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Finance timeline error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/finance/explain', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = getQueryParam(req.query.officeId, getDefaultOfficeId());
    const metricId = getQueryParam(req.query.metricId, '');

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Finance explain error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/connections/status', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = getQueryParam(req.query.officeId, getDefaultOfficeId());

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Connections status error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/finance/lifecycle', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = getQueryParam(req.query.officeId, getDefaultOfficeId());
    const entityId = getQueryParam(req.query.entityId, '');

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Finance lifecycle error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/finance/compute-snapshot', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = req.body.officeId || getDefaultOfficeId();
    const snapshot = await withBreakerAction('backend', () =>
      computeSnapshot(suiteId, officeId)
    );
    res.json(snapshot);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Compute snapshot error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/finance/proposals', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = req.body.officeId || getDefaultOfficeId();
    const { title, type, description, predictedImpact, dependencies,
            risk_tier, required_approval, inputs_hash, correlation_id, action, inputs } = req.body;

    if (!title && !action) {
      return res.status(400).json({ error: 'title or action is required' });
    }

    const correlationId = correlation_id || req.headers['x-correlation-id'] || `corr_${crypto.randomUUID()}`;
    const proposalId = `proposal_${crypto.randomUUID()}`;
    const riskTier = risk_tier || 'yellow';
    const requiredApproval = required_approval || (riskTier === 'red' ? 'owner' : riskTier === 'yellow' ? 'admin' : 'none');
    const intentSummary = title || action || 'Finance proposal';

    const inputsHashComputed = inputs_hash || `sha256:${crypto.createHash('sha256').update(
      JSON.stringify({ suiteId, officeId, action: action || type, inputs: inputs || { title, description, predictedImpact, dependencies } })
    ).digest('hex')}`;

    const metadata = {
      title: intentSummary, type: type || action, description, predictedImpact, dependencies,
      risk_tier: riskTier, required_approval: requiredApproval, inputs_hash: inputsHashComputed,
      correlation_id: correlationId, inputs: inputs || {},
    };

    const result = await db.execute(sql`
      INSERT INTO finance_events (suite_id, office_id, provider, provider_event_id, event_type, occurred_at, status, metadata)
      VALUES (${suiteId}, ${officeId}, 'aspire', ${proposalId}, 'proposal_created', NOW(), 'pending', ${JSON.stringify(metadata)})
      RETURNING event_id, occurred_at
    `);

    const rows = (result.rows || result) as any[];
    const eventId = rows[0].event_id;
    const occurredAt = rows[0].occurred_at;

    const receiptId = await createReceipt({
      suiteId,
      officeId,
      actionType: 'propose_action',
      inputs: { title: intentSummary, type: type || action, risk_tier: riskTier, inputs_hash: inputsHashComputed, correlation_id: correlationId },
      outputs: { eventId, proposalId },
      metadata: { proposalTitle: intentSummary, risk_tier: riskTier, required_approval: requiredApproval },
    });

    await db.execute(sql`
      UPDATE finance_events SET receipt_id = ${receiptId} WHERE event_id = ${eventId}
    `);

    logger.info('Proposal created', { eventId, title: intentSummary, riskTier });

    res.status(201).json({
      eventId,
      proposalId,
      title: intentSummary,
      type: type || action,
      risk_tier: riskTier,
      required_approval: requiredApproval,
      inputs_hash: inputsHashComputed,
      correlation_id: correlationId,
      status: 'pending',
      occurredAt,
      receiptId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Create proposal error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/finance/actions/execute', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const { officeId = getDefaultOfficeId(), proposalId, approvedBy } = req.body;

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

    // Law #1 (Single Brain) + Law #4 (Risk Tiers): Policy decisions are made by
    // the LangGraph orchestrator, not in-process. This endpoint verifies the proposal
    // was already approved through the authority queue before executing.
    const riskTier = proposalMeta.risk_tier || 'yellow';
    const amount = proposal.amount || 0;

    const executionEventId = `exec_${crypto.randomUUID()}`;
    const executionMeta = {
      proposalId,
      approvedBy,
      proposalTitle: proposalMeta.title,
      riskTier,
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
      outputs: { execEventId },
      metadata: { proposalTitle: proposalMeta.title, riskTier },
    });

    await db.execute(sql`
      UPDATE finance_events SET receipt_id = ${receiptId} WHERE event_id = ${execEventId}
    `);

    logger.info('Action executed', { execEventId, proposalId });

    res.status(201).json({
      executionEventId: execEventId,
      proposalId,
      approvedBy,
      riskTier,
      executedAt,
      receiptId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Execute action error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Finn v2: Exceptions endpoint ──────────────────────────────────────────────
router.get('/api/finance/exceptions', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = getQueryParam(req.query.officeId, getDefaultOfficeId());
    const correlationId = (req.headers['x-correlation-id'] as string) || `corr_${crypto.randomUUID()}`;

    // Get current snapshot to derive exceptions
    const snapshotResult = await db.execute(sql`
      SELECT chapter_now, chapter_next, chapter_month, chapter_reconcile, chapter_actions, staleness, generated_at
      FROM finance_snapshots
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
      ORDER BY generated_at DESC
      LIMIT 1
    `);

    const rows = (snapshotResult.rows || snapshotResult) as any[];
    const snap = rows.length > 0 ? rows[0] : null;
    const exceptions: Array<{
      exception_id: string; lane: string; severity: string;
      summary: string; evidence_refs: string[]; recommended_next_action: string;
    }> = [];

    if (snap) {
      const now = snap.chapter_now || {};
      const next = snap.chapter_next || {};
      const reconcile = snap.chapter_reconcile || {};
      const staleness = snap.staleness || {};

      // Low cash buffer
      if (now.cashAvailable !== undefined && now.cashAvailable < 5000) {
        exceptions.push({
          exception_id: `exc_low_cash_${Date.now()}`,
          lane: 'cash',
          severity: now.cashAvailable < 1000 ? 'critical' : 'warn',
          summary: `Cash buffer is low at $${(now.cashAvailable || 0).toLocaleString()}`,
          evidence_refs: ['snapshot.now.cashAvailable'],
          recommended_next_action: 'finance.proposal.create',
        });
      }

      // Negative net cash flow forecast
      if (next.netCashFlow7d !== undefined && next.netCashFlow7d < 0) {
        exceptions.push({
          exception_id: `exc_negative_forecast_${Date.now()}`,
          lane: 'cash',
          severity: Math.abs(next.netCashFlow7d) > 10000 ? 'critical' : 'warn',
          summary: `Projected 7-day net cash flow is negative: -$${Math.abs(next.netCashFlow7d).toLocaleString()}`,
          evidence_refs: ['snapshot.next.netCashFlow7d'],
          recommended_next_action: 'finance.proposal.create',
        });
      }

      // Reconciliation mismatches
      const mismatchCount = reconcile.mismatchCount || 0;
      if (mismatchCount > 0) {
        exceptions.push({
          exception_id: `exc_reconcile_${Date.now()}`,
          lane: 'books',
          severity: mismatchCount > 5 ? 'warn' : 'info',
          summary: `${mismatchCount} unreconciled transaction${mismatchCount > 1 ? 's' : ''} between providers`,
          evidence_refs: ['snapshot.reconcile.mismatches'],
          recommended_next_action: 'finance.proposal.create',
        });
      }

      // Stale data per lane
      for (const [provider, info] of Object.entries(staleness as Record<string, any>)) {
        if (info && info.isStale) {
          const lane = provider === 'gusto' ? 'payroll' : provider === 'stripe' ? 'invoices' : 'books';
          exceptions.push({
            exception_id: `exc_stale_${provider}_${Date.now()}`,
            lane,
            severity: 'warn',
            summary: `Data from ${provider} is stale (last sync: ${info.lastSyncAt || 'unknown'})`,
            evidence_refs: [`staleness.${provider}`],
            recommended_next_action: 'a2a.create',
          });
        }
      }
    } else {
      // No snapshot at all
      exceptions.push({
        exception_id: `exc_no_snapshot_${Date.now()}`,
        lane: 'cash',
        severity: 'critical',
        summary: 'No financial snapshot available — connect at least one provider',
        evidence_refs: [],
        recommended_next_action: 'finance.proposal.create',
      });
    }

    // Sort by severity: critical > warn > info
    const severityOrder: Record<string, number> = { critical: 0, warn: 1, info: 2 };
    exceptions.sort((a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2));

    // Emit receipt
    await createReceipt({
      suiteId,
      officeId,
      actionType: 'compute_snapshot',
      inputs: { endpoint: 'finance.exceptions.read', correlation_id: correlationId },
      outputs: { exception_count: exceptions.length },
      metadata: { event_type: 'finance.exceptions.read' },
    });

    res.json({
      as_of: snap?.generated_at || new Date().toISOString(),
      exceptions,
      correlation_id: correlationId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Finance exceptions error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Finn v2: Authority Queue endpoints ────────────────────────────────────────
router.get('/api/authority-queue', async (req: Request, res: Response) => {
  // Law #6: Tenant isolation — use authenticated context, never trust client-supplied IDs
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const officeId = getQueryParam(req.query.officeId, getDefaultOfficeId());
    const domain = getQueryParam(req.query.domain, 'finance');
    const statusFilter = getQueryParam(req.query.status, 'pending');

    const result = await db.execute(sql`
      SELECT event_id, provider_event_id, occurred_at, status, metadata, receipt_id
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'proposal_created'
        AND status = ${statusFilter}
      ORDER BY occurred_at DESC
      LIMIT 50
    `);

    const rows = (result.rows || result) as any[];
    const items = rows.map((row: any) => {
      const meta = row.metadata || {};
      return {
        id: row.event_id,
        proposalId: row.provider_event_id,
        domain,
        title: meta.title || 'Untitled proposal',
        type: meta.type || 'unknown',
        risk_tier: meta.risk_tier || 'yellow',
        required_approval: meta.required_approval || 'admin',
        status: row.status || 'pending',
        correlation_id: meta.correlation_id || null,
        inputs_hash: meta.inputs_hash || null,
        createdAt: row.occurred_at,
        receiptId: row.receipt_id,
      };
    });

    res.json({ items, total: items.length, domain });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Authority queue error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/authority-queue/:id/approve', async (req: Request, res: Response) => {
  // Law #6: Tenant isolation — use authenticated context, never trust client-supplied IDs
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const officeId = req.body.officeId || getDefaultOfficeId();
    const approvedBy = req.body.approvedBy || 'owner';
    const correlationId = (req.headers['x-correlation-id'] as string) || req.body.correlation_id || `corr_${crypto.randomUUID()}`;

    // Check current status (idempotent)
    const check = await db.execute(sql`
      SELECT event_id, status, metadata FROM finance_events
      WHERE event_id = ${eventId} AND suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'proposal_created'
      LIMIT 1
    `);

    const checkRows = (check.rows || check) as any[];
    if (checkRows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (checkRows[0].status === 'approved') {
      return res.json({ id: eventId, status: 'approved', executed: true, message: 'Already approved' });
    }

    if (checkRows[0].status === 'denied') {
      return res.status(409).json({ error: 'Cannot approve a denied proposal' });
    }

    // === Wire Approve → Stripe finalize + send ===
    // Production transcript 2026-05-19 78dc8fa7 surfaced this gap: the
    // approve endpoint marked the proposal as approved in the database
    // but never actually sent the Stripe invoice to the customer. The
    // desktop drawer checks `result.body.executed === true` (see
    // components/AuthorityQueueDrawer.tsx:118) and shows
    // "Approved, but send failed" when it's not. The Stripe invoice was
    // sitting in DRAFT status indefinitely.
    //
    // The proposal metadata stores the stripe_invoice_id from Quinn's
    // CREATE call (orchestrator writes it during the proposal_created
    // event). We pull it here, finalize the draft, then send.
    const metadata = checkRows[0].metadata || {};
    const stripeInvoiceId = metadata.stripe_invoice_id
      || metadata.inputs?.stripe_invoice_id
      || metadata.inputs?.stripeInvoiceId
      || null;

    let executed = false;
    let stripeStatus: string | null = null;
    let stripeError: string | null = null;
    const stripe = getStripeForApprove();

    if (stripe && stripeInvoiceId && metadata.type === 'invoice') {
      try {
        // Step 1: finalize the draft invoice (transitions draft → open).
        // Safe to call on already-finalized invoices — Stripe returns the
        // existing invoice unchanged.
        let invoice = await stripe.invoices.retrieve(stripeInvoiceId);
        if (invoice.status === 'draft') {
          invoice = await stripe.invoices.finalizeInvoice(stripeInvoiceId, {
            auto_advance: false, // don't kick off Stripe's auto-collection
          });
        }

        // Step 2: send the invoice email to the customer. Stripe's
        // sendInvoice() is idempotent — if the invoice was already sent
        // it just returns the current state. Skip if the invoice has
        // already been collected or voided.
        if (invoice.status === 'open' || invoice.status === 'uncollectible') {
          invoice = await stripe.invoices.sendInvoice(stripeInvoiceId);
        }

        stripeStatus = invoice.status || 'unknown';
        executed = invoice.status === 'open' || invoice.status === 'paid';
        logger.info('Stripe invoice sent on approve', {
          eventId,
          stripeInvoiceId,
          status: stripeStatus,
          customerEmail: invoice.customer_email,
        });
      } catch (stripeErr: unknown) {
        const msg = stripeErr instanceof Error ? stripeErr.message : 'unknown stripe error';
        stripeError = msg;
        logger.error('Stripe finalize/send failed on approve', {
          eventId, stripeInvoiceId, error: msg,
        });
        // Don't fail the whole approve — the proposal is still marked
        // approved; surface the send failure so the user can retry
        // from the Finance Hub.
      }
    } else if (!stripeInvoiceId) {
      logger.warn('Approve endpoint: no stripe_invoice_id in proposal metadata', { eventId });
      stripeError = 'NO_STRIPE_INVOICE_ID';
    } else if (!stripe) {
      logger.warn('Approve endpoint: Stripe key not configured', { eventId });
      stripeError = 'STRIPE_NOT_CONFIGURED';
    }

    // Mark the proposal as approved regardless of Stripe outcome — the
    // user explicitly approved it, that audit trail stands. Stripe send
    // is a separate concern surfaced via `executed` + `stripeError`.
    await db.execute(sql`
      UPDATE finance_events SET status = 'approved'
      WHERE event_id = ${eventId} AND suite_id = ${suiteId} AND office_id = ${officeId}
    `);

    const receiptId = await createReceipt({
      suiteId,
      officeId,
      actionType: 'execute_action',
      inputs: { eventId, action: 'approve', approvedBy, correlation_id: correlationId, stripeInvoiceId },
      outputs: { status: 'approved', executed, stripeStatus, stripeError },
      metadata: { event_type: 'authority.item.approved', proposalTitle: metadata.title, stripeStatus, executed },
    });

    logger.info('Authority item approved', { eventId, approvedBy, executed, stripeStatus });

    res.json({
      id: eventId,
      status: 'approved',
      executed,
      approvedBy,
      receiptId,
      correlation_id: correlationId,
      ...(stripeStatus ? { stripeStatus } : {}),
      ...(stripeError ? { error: stripeError } : {}),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Authority approve error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

router.post('/api/authority-queue/:id/deny', async (req: Request, res: Response) => {
  // Law #6: Tenant isolation — use authenticated context, never trust client-supplied IDs
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }
  try {
    const eventId = parseInt(req.params.id as string, 10);
    const officeId = req.body.officeId || getDefaultOfficeId();
    const deniedBy = req.body.deniedBy || 'owner';
    const reason = req.body.reason || '';
    const correlationId = (req.headers['x-correlation-id'] as string) || req.body.correlation_id || `corr_${crypto.randomUUID()}`;

    const check = await db.execute(sql`
      SELECT event_id, status, metadata FROM finance_events
      WHERE event_id = ${eventId} AND suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'proposal_created'
      LIMIT 1
    `);

    const checkRows = (check.rows || check) as any[];
    if (checkRows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (checkRows[0].status === 'denied') {
      return res.json({ id: eventId, status: 'denied', message: 'Already denied' });
    }

    if (checkRows[0].status === 'approved') {
      return res.status(409).json({ error: 'Cannot deny an approved proposal' });
    }

    await db.execute(sql`
      UPDATE finance_events SET status = 'denied'
      WHERE event_id = ${eventId} AND suite_id = ${suiteId} AND office_id = ${officeId}
    `);

    const receiptId = await createReceipt({
      suiteId,
      officeId,
      actionType: 'execute_action',
      inputs: { eventId, action: 'deny', deniedBy, reason, correlation_id: correlationId },
      outputs: { status: 'denied', reason },
      metadata: { event_type: 'authority.item.denied', proposalTitle: checkRows[0].metadata?.title },
    });

    logger.info('Authority item denied', { eventId, deniedBy });

    res.json({ id: eventId, status: 'denied', deniedBy, reason, receiptId, correlation_id: correlationId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Authority deny error', { error: msg });
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
