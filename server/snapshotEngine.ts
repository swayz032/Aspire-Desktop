import { db } from './db';
import { sql } from 'drizzle-orm';
import { createReceipt } from './receiptService';
import { getConnectionsByTenant, ConnectionRecord } from './financeTokenStore';

export interface ChapterNow {
  cashAvailable: number;
  bankBalance: number;
  stripeAvailable: number;
  stripePending: number;
  lastUpdated: string | null;
}

export interface ChapterNext {
  expectedInflows7d: number;
  expectedOutflows7d: number;
  netCashFlow7d: number;
  items: any[];
}

export interface ChapterMonth {
  revenue: number;
  expenses: number;
  netIncome: number;
  period: string;
}

export interface ChapterReconcile {
  mismatches: any[];
  mismatchCount: number;
}

export interface ChapterActions {
  proposals: any[];
  proposalCount: number;
}

export interface Snapshot {
  chapters: {
    now: ChapterNow;
    next: ChapterNext;
    month: ChapterMonth;
    reconcile: ChapterReconcile;
    actions: ChapterActions;
  };
  provenance: Record<string, any>;
  staleness: Record<string, any>;
  generatedAt: string;
  connected: boolean;
}

export async function computeChapterNow(suiteId: string, officeId: string): Promise<ChapterNow> {
  try {
    const bankResult = await db.execute(sql`
      SELECT amount, metadata, occurred_at
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'bank_balance_updated'
      ORDER BY occurred_at DESC
      LIMIT 1
    `);
    const bankRows = (bankResult.rows || bankResult) as any[];
    const bankBalance = bankRows.length > 0 ? (bankRows[0].amount || 0) : 0;
    const bankLastUpdated = bankRows.length > 0 ? bankRows[0].occurred_at : null;

    const stripeResult = await db.execute(sql`
      SELECT amount, metadata, occurred_at
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'balance_pending_to_available'
      ORDER BY occurred_at DESC
      LIMIT 1
    `);
    const stripeRows = (stripeResult.rows || stripeResult) as any[];
    const stripeAvailable = stripeRows.length > 0 ? (stripeRows[0].metadata?.available || stripeRows[0].amount || 0) : 0;
    const stripePending = stripeRows.length > 0 ? (stripeRows[0].metadata?.pending || 0) : 0;
    const stripeLastUpdated = stripeRows.length > 0 ? stripeRows[0].occurred_at : null;

    const lastUpdated = bankLastUpdated || stripeLastUpdated || null;
    const cashAvailable = bankBalance + stripeAvailable;

    return {
      cashAvailable,
      bankBalance,
      stripeAvailable,
      stripePending,
      lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    };
  } catch (error: any) {
    console.error('Failed to compute chapter NOW:', error.message);
    return { cashAvailable: 0, bankBalance: 0, stripeAvailable: 0, stripePending: 0, lastUpdated: null };
  }
}

export async function computeChapterNext(suiteId: string, officeId: string): Promise<ChapterNext> {
  try {
    const items: any[] = [];

    const invoiceResult = await db.execute(sql`
      SELECT event_id, amount, metadata, occurred_at, provider
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'invoice_sent'
        AND status = 'pending'
        AND occurred_at >= NOW() - INTERVAL '14 days'
      ORDER BY occurred_at ASC
    `);
    const invoiceRows = (invoiceResult.rows || invoiceResult) as any[];
    for (const row of invoiceRows) {
      items.push({
        type: 'inflow',
        description: row.metadata?.description || 'Pending invoice',
        amount: row.amount || 0,
        expectedDate: new Date(row.occurred_at).toISOString(),
        provider: row.provider,
      });
    }

    const payoutResult = await db.execute(sql`
      SELECT pc.event_id, pc.amount, pc.metadata, pc.occurred_at, pc.provider, pc.provider_event_id
      FROM finance_events pc
      WHERE pc.suite_id = ${suiteId} AND pc.office_id = ${officeId}
        AND pc.event_type = 'payout_created'
        AND pc.occurred_at >= NOW() - INTERVAL '14 days'
        AND NOT EXISTS (
          SELECT 1 FROM finance_events pp
          WHERE pp.suite_id = ${suiteId} AND pp.office_id = ${officeId}
            AND pp.event_type = 'payout_paid'
            AND pp.provider_event_id = pc.provider_event_id
        )
      ORDER BY pc.occurred_at ASC
    `);
    const payoutRows = (payoutResult.rows || payoutResult) as any[];
    for (const row of payoutRows) {
      items.push({
        type: 'inflow',
        description: row.metadata?.description || 'Pending payout deposit',
        amount: row.amount || 0,
        expectedDate: new Date(row.occurred_at).toISOString(),
        provider: row.provider,
      });
    }

    const payrollResult = await db.execute(sql`
      SELECT pc.event_id, pc.amount, pc.metadata, pc.occurred_at, pc.provider, pc.provider_event_id
      FROM finance_events pc
      WHERE pc.suite_id = ${suiteId} AND pc.office_id = ${officeId}
        AND pc.event_type = 'payroll_calculated'
        AND pc.occurred_at >= NOW() - INTERVAL '14 days'
        AND NOT EXISTS (
          SELECT 1 FROM finance_events pp
          WHERE pp.suite_id = ${suiteId} AND pp.office_id = ${officeId}
            AND pp.event_type = 'payroll_paid'
            AND pp.provider_event_id = pc.provider_event_id
        )
      ORDER BY pc.occurred_at ASC
    `);
    const payrollRows = (payrollResult.rows || payrollResult) as any[];
    for (const row of payrollRows) {
      items.push({
        type: 'outflow',
        description: row.metadata?.description || 'Upcoming payroll',
        amount: row.amount || 0,
        expectedDate: new Date(row.occurred_at).toISOString(),
        provider: row.provider,
      });
    }

    const expectedInflows7d = items
      .filter(i => i.type === 'inflow')
      .reduce((sum, i) => sum + i.amount, 0);
    const expectedOutflows7d = items
      .filter(i => i.type === 'outflow')
      .reduce((sum, i) => sum + i.amount, 0);
    const netCashFlow7d = expectedInflows7d - expectedOutflows7d;

    return { expectedInflows7d, expectedOutflows7d, netCashFlow7d, items };
  } catch (error: any) {
    console.error('Failed to compute chapter NEXT:', error.message);
    return { expectedInflows7d: 0, expectedOutflows7d: 0, netCashFlow7d: 0, items: [] };
  }
}

export async function computeChapterMonth(suiteId: string, officeId: string): Promise<ChapterMonth> {
  try {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const qboResult = await db.execute(sql`
      SELECT amount, metadata, occurred_at
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'qbo_report_refreshed'
        AND occurred_at >= DATE_TRUNC('month', NOW())
      ORDER BY occurred_at DESC
      LIMIT 1
    `);
    const qboRows = (qboResult.rows || qboResult) as any[];

    if (qboRows.length > 0 && qboRows[0].metadata?.revenue !== undefined) {
      const meta = qboRows[0].metadata;
      const revenue = meta.revenue || 0;
      const expenses = meta.expenses || 0;
      return { revenue, expenses, netIncome: revenue - expenses, period };
    }

    const revenueResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'payment_succeeded'
        AND occurred_at >= DATE_TRUNC('month', NOW())
    `);
    const revenueRows = (revenueResult.rows || revenueResult) as any[];
    const revenue = Number(revenueRows[0]?.total || 0);

    const expenseResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type IN ('payroll_paid', 'fee_assessed')
        AND occurred_at >= DATE_TRUNC('month', NOW())
    `);
    const expenseRows = (expenseResult.rows || expenseResult) as any[];
    const expenses = Number(expenseRows[0]?.total || 0);

    return { revenue, expenses, netIncome: revenue - expenses, period };
  } catch (error: any) {
    console.error('Failed to compute chapter MONTH:', error.message);
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return { revenue: 0, expenses: 0, netIncome: 0, period };
  }
}

export async function computeChapterReconcile(suiteId: string, officeId: string): Promise<ChapterReconcile> {
  try {
    const mismatches: any[] = [];
    let mismatchSeq = 0;

    const settlementResult = await db.execute(sql`
      SELECT pp.event_id, pp.amount, pp.occurred_at, pp.provider, pp.provider_event_id
      FROM finance_events pp
      WHERE pp.suite_id = ${suiteId} AND pp.office_id = ${officeId}
        AND pp.event_type = 'payout_paid'
        AND pp.occurred_at >= NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM finance_events bt
          WHERE bt.suite_id = ${suiteId} AND bt.office_id = ${officeId}
            AND bt.event_type = 'bank_tx_posted'
            AND bt.occurred_at BETWEEN pp.occurred_at AND pp.occurred_at + INTERVAL '3 days'
            AND bt.amount = pp.amount
        )
    `);
    const settlementRows = (settlementResult.rows || settlementResult) as any[];
    for (const row of settlementRows) {
      mismatchSeq++;
      mismatches.push({
        id: `mismatch-${mismatchSeq}`,
        type: 'settlement_timing',
        title: 'Settlement timing gap',
        description: `Payout of ${row.amount} on ${new Date(row.occurred_at).toISOString().split('T')[0]} has no matching bank deposit within 3 days`,
        reasonCode: 'SETTLEMENT_DELAY',
        severity: 'medium',
        amounts: { payout: row.amount },
        providers: [row.provider, 'plaid'],
        nextStep: 'Check bank transactions for delayed deposit',
        relatedEventIds: [row.event_id],
      });
    }

    const payoutMatchResult = await db.execute(sql`
      SELECT pp.event_id AS payout_event_id, pp.amount AS payout_amount, pp.occurred_at AS payout_date,
             bt.event_id AS bank_event_id, bt.amount AS bank_amount
      FROM finance_events pp
      JOIN finance_events bt
        ON bt.suite_id = pp.suite_id AND bt.office_id = pp.office_id
        AND bt.event_type = 'bank_tx_posted'
        AND bt.occurred_at BETWEEN pp.occurred_at AND pp.occurred_at + INTERVAL '3 days'
      WHERE pp.suite_id = ${suiteId} AND pp.office_id = ${officeId}
        AND pp.event_type = 'payout_paid'
        AND pp.occurred_at >= NOW() - INTERVAL '30 days'
        AND bt.amount != pp.amount
    `);
    const payoutMatchRows = (payoutMatchResult.rows || payoutMatchResult) as any[];
    for (const row of payoutMatchRows) {
      mismatchSeq++;
      mismatches.push({
        id: `mismatch-${mismatchSeq}`,
        type: 'payout_amount_mismatch',
        title: 'Payout amount mismatch',
        description: `Stripe payout ${row.payout_amount} does not match bank deposit ${row.bank_amount}`,
        reasonCode: 'AMOUNT_MISMATCH',
        severity: 'high',
        amounts: { payout: row.payout_amount, bankDeposit: row.bank_amount },
        providers: ['stripe', 'plaid'],
        nextStep: 'Compare Stripe payout details with bank transaction',
        relatedEventIds: [row.payout_event_id, row.bank_event_id],
      });
    }

    const bankTotalResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'bank_tx_posted'
        AND occurred_at >= DATE_TRUNC('month', NOW())
    `);
    const bankTotalRows = (bankTotalResult.rows || bankTotalResult) as any[];
    const bankTotal = Number(bankTotalRows[0]?.total || 0);

    const qboTotalResult = await db.execute(sql`
      SELECT metadata
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type = 'qbo_report_refreshed'
        AND occurred_at >= DATE_TRUNC('month', NOW())
      ORDER BY occurred_at DESC
      LIMIT 1
    `);
    const qboTotalRows = (qboTotalResult.rows || qboTotalResult) as any[];
    if (qboTotalRows.length > 0 && qboTotalRows[0].metadata?.bankTotal !== undefined) {
      const qboTotal = Number(qboTotalRows[0].metadata.bankTotal);
      if (qboTotal > 0 && bankTotal > 0) {
        const diff = Math.abs(bankTotal - qboTotal);
        const pct = diff / Math.max(bankTotal, qboTotal);
        if (pct > 0.05) {
          mismatchSeq++;
          mismatches.push({
            id: `mismatch-${mismatchSeq}`,
            type: 'cash_vs_books',
            title: 'Cash vs books discrepancy',
            description: `Bank transactions total ${bankTotal} but QBO reports ${qboTotal} (${(pct * 100).toFixed(1)}% difference)`,
            reasonCode: 'CASH_BOOKS_DIVERGENCE',
            severity: 'high',
            amounts: { bankTotal, qboTotal, difference: diff },
            providers: ['plaid', 'qbo'],
            nextStep: 'Review QBO entries against bank feed',
            relatedEventIds: [],
          });
        }
      }
    }

    const missingEntryResult = await db.execute(sql`
      SELECT ps.event_id, ps.amount, ps.occurred_at, ps.provider_event_id
      FROM finance_events ps
      WHERE ps.suite_id = ${suiteId} AND ps.office_id = ${officeId}
        AND ps.event_type = 'payment_succeeded'
        AND ps.occurred_at >= NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM finance_events qp
          WHERE qp.suite_id = ${suiteId} AND qp.office_id = ${officeId}
            AND qp.event_type = 'qbo_payment_changed'
            AND qp.provider_event_id = ps.provider_event_id
        )
    `);
    const missingEntryRows = (missingEntryResult.rows || missingEntryResult) as any[];
    for (const row of missingEntryRows) {
      mismatchSeq++;
      mismatches.push({
        id: `mismatch-${mismatchSeq}`,
        type: 'missing_entry',
        title: 'Missing QBO entry',
        description: `Payment of ${row.amount} on ${new Date(row.occurred_at).toISOString().split('T')[0]} has no matching QBO record`,
        reasonCode: 'MISSING_BOOK_ENTRY',
        severity: 'medium',
        amounts: { payment: row.amount },
        providers: ['stripe', 'qbo'],
        nextStep: 'Create matching entry in QuickBooks',
        relatedEventIds: [row.event_id],
      });
    }

    return { mismatches, mismatchCount: mismatches.length };
  } catch (error: any) {
    console.error('Failed to compute chapter RECONCILE:', error.message);
    return { mismatches: [], mismatchCount: 0 };
  }
}

export async function computeChapterActions(
  suiteId: string,
  officeId: string,
  chapterNow?: ChapterNow,
  chapterNext?: ChapterNext,
  chapterMonth?: ChapterMonth,
  chapterReconcile?: ChapterReconcile,
): Promise<ChapterActions> {
  try {
    const proposals: any[] = [];

    const now = chapterNow || await computeChapterNow(suiteId, officeId);
    const next = chapterNext || await computeChapterNext(suiteId, officeId);
    const month = chapterMonth || await computeChapterMonth(suiteId, officeId);
    const reconcile = chapterReconcile || await computeChapterReconcile(suiteId, officeId);

    if (next.expectedOutflows7d > now.cashAvailable && next.expectedOutflows7d > 0) {
      proposals.push({
        title: 'Fund payroll buffer',
        type: 'cash_management',
        description: `Upcoming outflows of ${next.expectedOutflows7d} exceed available cash of ${now.cashAvailable}. Consider transferring funds to cover the gap.`,
        risk: 'MED',
        evidence: { cashAvailable: now.cashAvailable, expectedOutflows: next.expectedOutflows7d },
        predictedImpact: `Shortfall of ${next.expectedOutflows7d - now.cashAvailable}`,
        dependencies: ['bank_transfer'],
      });
    }

    const overdueResult = await db.execute(sql`
      SELECT inv.event_id, inv.amount, inv.occurred_at, inv.metadata
      FROM finance_events inv
      WHERE inv.suite_id = ${suiteId} AND inv.office_id = ${officeId}
        AND inv.event_type = 'invoice_sent'
        AND inv.occurred_at < NOW() - INTERVAL '14 days'
        AND NOT EXISTS (
          SELECT 1 FROM finance_events ip
          WHERE ip.suite_id = ${suiteId} AND ip.office_id = ${officeId}
            AND ip.event_type = 'invoice_paid'
            AND ip.provider_event_id = inv.provider_event_id
        )
    `);
    const overdueRows = (overdueResult.rows || overdueResult) as any[];
    if (overdueRows.length > 0) {
      const totalOverdue = overdueRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      proposals.push({
        title: 'Collect overdue AR',
        type: 'collections',
        description: `${overdueRows.length} invoice(s) totaling ${totalOverdue} are overdue (>14 days). Follow up to collect payment.`,
        risk: 'HIGH',
        evidence: { overdueCount: overdueRows.length, totalOverdue },
        predictedImpact: `Recover up to ${totalOverdue} in outstanding receivables`,
        dependencies: ['client_communication'],
      });
    }

    if (reconcile.mismatchCount > 3) {
      proposals.push({
        title: 'Review reconciliation items',
        type: 'reconciliation',
        description: `${reconcile.mismatchCount} reconciliation mismatches detected. Review and resolve to maintain accurate books.`,
        risk: 'HIGH',
        evidence: { mismatchCount: reconcile.mismatchCount },
        predictedImpact: 'Improved financial accuracy and audit readiness',
        dependencies: ['bookkeeper_review'],
      });
    }

    const prevMonthResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM finance_events
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
        AND event_type IN ('payroll_paid', 'fee_assessed')
        AND occurred_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
        AND occurred_at < DATE_TRUNC('month', NOW())
    `);
    const prevMonthRows = (prevMonthResult.rows || prevMonthResult) as any[];
    const prevExpenses = Number(prevMonthRows[0]?.total || 0);
    if (prevExpenses > 0 && month.expenses > prevExpenses * 1.10) {
      const growthPct = ((month.expenses - prevExpenses) / prevExpenses * 100).toFixed(1);
      proposals.push({
        title: 'Review expense growth',
        type: 'expense_management',
        description: `Monthly expenses grew ${growthPct}% vs last month (${prevExpenses} → ${month.expenses}). Review for unnecessary spend.`,
        risk: 'LOW',
        evidence: { currentExpenses: month.expenses, previousExpenses: prevExpenses, growthPct },
        predictedImpact: `Potential savings of ${month.expenses - prevExpenses}`,
        dependencies: [],
      });
    }

    return { proposals, proposalCount: proposals.length };
  } catch (error: any) {
    console.error('Failed to compute chapter ACTIONS:', error.message);
    return { proposals: [], proposalCount: 0 };
  }
}

export function computeProvenance(connections: ConnectionRecord[], events: any[]): Record<string, any> {
  const now = Date.now();

  function getConfidence(lastSync: Date | null): string {
    if (!lastSync) return 'none';
    const diffMs = now - lastSync.getTime();
    if (diffMs < 5 * 60 * 1000) return 'high';
    if (diffMs < 60 * 60 * 1000) return 'medium';
    if (diffMs < 24 * 60 * 60 * 1000) return 'low';
    return 'none';
  }

  function findProviders(eventTypes: string[]): string[] {
    const providers = new Set<string>();
    for (const e of events) {
      if (eventTypes.includes(e.event_type)) {
        providers.add(e.provider);
      }
    }
    return Array.from(providers);
  }

  function getLastSync(providerNames: string[]): Date | null {
    let latest: Date | null = null;
    for (const conn of connections) {
      if (providerNames.includes(conn.provider) && conn.lastSyncAt) {
        if (!latest || conn.lastSyncAt > latest) {
          latest = conn.lastSyncAt;
        }
      }
    }
    return latest;
  }

  const metrics: Record<string, { eventTypes: string[]; excludes?: string }> = {
    cash_available: {
      eventTypes: ['bank_balance_updated', 'balance_pending_to_available'],
      excludes: 'Stripe pending balance not included',
    },
    expected_inflows: {
      eventTypes: ['invoice_sent', 'payout_created'],
    },
    expected_outflows: {
      eventTypes: ['payroll_calculated'],
    },
    revenue: {
      eventTypes: ['payment_succeeded', 'qbo_report_refreshed'],
    },
    expenses: {
      eventTypes: ['payroll_paid', 'fee_assessed', 'qbo_report_refreshed'],
    },
    reconciliation: {
      eventTypes: ['payout_paid', 'bank_tx_posted', 'qbo_payment_changed', 'payment_succeeded'],
    },
  };

  const provenance: Record<string, any> = {};
  for (const [metric, config] of Object.entries(metrics)) {
    const providers = findProviders(config.eventTypes);
    const lastSync = getLastSync(providers.length > 0 ? providers : connections.map(c => c.provider));
    provenance[metric] = {
      source: providers,
      lastSyncAt: lastSync ? lastSync.toISOString() : null,
      confidence: getConfidence(lastSync),
      ...(config.excludes ? { excludes: config.excludes } : {}),
    };
  }

  return provenance;
}

export function computeStaleness(connections: ConnectionRecord[]): Record<string, any> {
  const now = Date.now();
  const staleness: Record<string, any> = {};

  for (const conn of connections) {
    const lastData = conn.lastSyncAt || conn.lastWebhookAt;
    let staleSeconds = lastData ? Math.floor((now - lastData.getTime()) / 1000) : Infinity;
    let status: string;

    if (!lastData || conn.status !== 'connected') {
      status = 'offline';
      staleSeconds = -1;
    } else if (staleSeconds < 5 * 60) {
      status = 'fresh';
    } else if (staleSeconds < 60 * 60) {
      status = 'stale';
    } else if (staleSeconds < 24 * 60 * 60) {
      status = 'very_stale';
    } else {
      status = 'offline';
    }

    staleness[conn.provider] = {
      lastSyncAt: conn.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
      lastWebhookAt: conn.lastWebhookAt ? conn.lastWebhookAt.toISOString() : null,
      staleSeconds: staleSeconds === -1 ? null : staleSeconds,
      status,
    };
  }

  return staleness;
}

export async function computeSnapshot(suiteId: string, officeId: string): Promise<Snapshot> {
  const connections = await getConnectionsByTenant(suiteId, officeId);
  const connected = connections.length > 0;

  const [chapterNow, chapterNext, chapterMonth, chapterReconcile] = await Promise.all([
    computeChapterNow(suiteId, officeId),
    computeChapterNext(suiteId, officeId),
    computeChapterMonth(suiteId, officeId),
    computeChapterReconcile(suiteId, officeId),
  ]);

  const chapterActions = await computeChapterActions(suiteId, officeId, chapterNow, chapterNext, chapterMonth, chapterReconcile);

  const eventsResult = await db.execute(sql`
    SELECT event_type, provider, occurred_at
    FROM finance_events
    WHERE suite_id = ${suiteId} AND office_id = ${officeId}
      AND occurred_at >= NOW() - INTERVAL '30 days'
  `);
  const events = (eventsResult.rows || eventsResult) as any[];

  const provenance = computeProvenance(connections, events);
  const staleness = computeStaleness(connections);
  const generatedAt = new Date().toISOString();

  const receiptId = await createReceipt({
    suiteId,
    officeId,
    actionType: 'compute_snapshot',
    inputs: { suiteId, officeId, connectionCount: connections.length },
    outputs: { generatedAt, connected, mismatchCount: chapterReconcile.mismatchCount, proposalCount: chapterActions.proposalCount },
    metadata: { generatedAt },
  });

  await db.execute(sql`
    INSERT INTO finance_snapshots (suite_id, office_id, generated_at, chapter_now, chapter_next, chapter_month, chapter_reconcile, chapter_actions, sources, staleness, receipt_id)
    VALUES (
      ${suiteId},
      ${officeId},
      ${new Date(generatedAt)},
      ${JSON.stringify(chapterNow)},
      ${JSON.stringify(chapterNext)},
      ${JSON.stringify(chapterMonth)},
      ${JSON.stringify(chapterReconcile)},
      ${JSON.stringify(chapterActions)},
      ${JSON.stringify(provenance)},
      ${JSON.stringify(staleness)},
      ${receiptId}
    )
  `);

  console.log(`Snapshot computed for ${suiteId}/${officeId} at ${generatedAt}`);

  return {
    chapters: {
      now: chapterNow,
      next: chapterNext,
      month: chapterMonth,
      reconcile: chapterReconcile,
      actions: chapterActions,
    },
    provenance,
    staleness,
    generatedAt,
    connected,
  };
}
