import type { StoryModeId } from './StoryModeCarousel';

export interface StoryDashboardConfig {
  hero: {
    title: string;
    value: string;
    delta: string;
    deltaDirection: 'up' | 'down';
  };
  ring: {
    title: string;
    centerValue: string;
    centerLabel: string;
    segments: { label: string; value: number; color: string }[];
  };
  queue: {
    title: string;
    items: { label: string; amount: string; status: 'active' | 'warning' | 'overdue' | 'pending'; age?: string; progress: number }[];
  };
  insight: {
    quote: string;
  };
  finnFocus: string;
}

interface SnapshotChapters {
  now?: { cashAvailable?: number; bankBalance?: number; stripeAvailable?: number; stripePending?: number };
  next?: { expectedInflows7d?: number; expectedOutflows7d?: number; netCashFlow7d?: number; items?: { description?: string; amount?: number; type?: string }[] };
  month?: { revenue?: number; expenses?: number; netIncome?: number; period?: string };
  reconcile?: { mismatchCount?: number; mismatches?: { description?: string; delta?: number }[] };
  actions?: { proposalCount?: number; proposals?: { title?: string; status?: string }[] };
}

interface ConnectionsSummary {
  connected?: number;
  total?: number;
  needsAttention?: number;
}

function fmtDollars(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 100000) return `$${Math.round(abs / 100).toLocaleString('en-US')}`;
  return `$${(abs / 100).toFixed(2)}`;
}

function fmtShort(cents: number): string {
  const val = Math.abs(cents) / 100;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export function getStoryDashboardConfig(
  mode: StoryModeId,
  accent: string,
  snapshot?: { chapters?: SnapshotChapters } | null,
  _connSummary?: ConnectionsSummary | null,
): StoryDashboardConfig {
  const now = snapshot?.chapters?.now;
  const next = snapshot?.chapters?.next;
  const month = snapshot?.chapters?.month;
  const recon = snapshot?.chapters?.reconcile;

  const totalCash = now ? (now.cashAvailable ?? 0) : 0;
  const bankBal = now?.bankBalance ?? 0;
  const stripeAvail = now?.stripeAvailable ?? 0;
  const stripePend = now?.stripePending ?? 0;
  const otherCash = Math.max(0, totalCash - bankBal - stripeAvail - stripePend);

  const configs: Record<StoryModeId, StoryDashboardConfig> = {
    'cash-truth': {
      hero: {
        title: 'Cash Balance Trend',
        value: now ? fmtDollars(totalCash) : '$67,240',
        delta: next ? `${next.netCashFlow7d != null && next.netCashFlow7d >= 0 ? '+' : ''}${fmtShort(next.netCashFlow7d ?? 0)} 7-day net` : '+12.4% vs last period',
        deltaDirection: (next?.netCashFlow7d ?? 1) >= 0 ? 'up' : 'down',
      },
      ring: {
        title: 'Cash Sources',
        centerValue: now ? fmtShort(totalCash) : '$67K',
        centerLabel: 'total',
        segments: [
          { label: 'Bank', value: now ? Math.max(1, Math.round(bankBal / (totalCash || 1) * 100)) : 45, color: accent },
          { label: 'Stripe', value: now ? Math.max(1, Math.round(stripeAvail / (totalCash || 1) * 100)) : 30, color: `${accent}88` },
          { label: 'Pending', value: now ? Math.max(1, Math.round(stripePend / (totalCash || 1) * 100)) : 15, color: `${accent}55` },
          { label: 'Other', value: now ? Math.max(1, Math.round(otherCash / (totalCash || 1) * 100)) : 10, color: 'rgba(255,255,255,0.15)' },
        ],
      },
      queue: {
        title: '7-Day Flows',
        items: next?.items?.slice(0, 4).map(it => ({
          label: it.description ?? 'Flow item',
          amount: `${(it.amount ?? 0) >= 0 ? '+' : ''}${fmtDollars(it.amount ?? 0)}`,
          status: (it.type === 'outflow' ? 'warning' : 'active') as 'active' | 'warning',
          progress: 60,
        })) ?? [
          { label: 'Client payment — Acme Co', amount: '+$8,400', status: 'active' as const, age: '1d', progress: 85 },
          { label: 'Payroll run Mar 15', amount: '-$12,400', status: 'warning' as const, age: '3d', progress: 60 },
          { label: 'Office rent deposit', amount: '-$3,200', status: 'pending' as const, progress: 20 },
          { label: 'Stripe settlement', amount: '+$4,100', status: 'active' as const, age: '2d', progress: 70 },
        ],
      },
      insight: { quote: 'Cash position is strong this week. Revenue trending 12% above forecast — consider accelerating the Q2 tax reserve.' },
      finnFocus: 'Monitoring real-time cash across all providers.',
    },
    'what-changed': {
      hero: {
        title: 'Revenue vs Expenses MoM',
        value: month ? `${(month.netIncome ?? 0) >= 0 ? '+' : ''}${fmtDollars(month.netIncome ?? 0)}` : '+$14,820',
        delta: month ? `${month.period ?? 'This month'} net income` : '+8.2% revenue growth',
        deltaDirection: (month?.netIncome ?? 1) >= 0 ? 'up' : 'down',
      },
      ring: {
        title: 'Category Changes',
        centerValue: '6',
        centerLabel: 'shifts',
        segments: [
          { label: 'Revenue Up', value: 40, color: accent },
          { label: 'Costs Down', value: 25, color: `${accent}88` },
          { label: 'New Items', value: 20, color: `${accent}55` },
          { label: 'Unchanged', value: 15, color: 'rgba(255,255,255,0.15)' },
        ],
      },
      queue: {
        title: 'Top Movers',
        items: [
          { label: 'Consulting revenue', amount: '+$6,200', status: 'active', age: '7d', progress: 90 },
          { label: 'SaaS subscriptions', amount: '-$1,400', status: 'warning', age: '14d', progress: 45 },
          { label: 'Marketing spend', amount: '+$2,800', status: 'active', age: '5d', progress: 65 },
          { label: 'Office supplies', amount: '-$340', status: 'pending', progress: 15 },
        ],
      },
      insight: { quote: 'Revenue up 12% vs last month with expenses holding flat. Consulting income is the primary driver.' },
      finnFocus: 'Tracking the biggest financial deltas since your last review.',
    },
    'invoice-pressure': {
      hero: { title: 'Invoice Aging Trend', value: '$24,600', delta: '3 invoices past 30 days', deltaDirection: 'down' },
      ring: {
        title: 'Invoice Status',
        centerValue: '12',
        centerLabel: 'open',
        segments: [
          { label: 'Current', value: 50, color: accent },
          { label: '30+ Days', value: 25, color: `${accent}88` },
          { label: '60+ Days', value: 15, color: `${accent}55` },
          { label: '90+ Days', value: 10, color: 'rgba(255,255,255,0.15)' },
        ],
      },
      queue: {
        title: 'Overdue Queue',
        items: [
          { label: 'Invoice #1042 — Acme Co', amount: '$3,200', status: 'overdue', age: '45d', progress: 95 },
          { label: 'Invoice #1038 — Beta LLC', amount: '$8,400', status: 'overdue', age: '38d', progress: 80 },
          { label: 'Invoice #1051 — Delta Inc', amount: '$2,100', status: 'warning', age: '22d', progress: 55 },
          { label: 'Invoice #1055 — Gamma Co', amount: '$1,600', status: 'active', age: '8d', progress: 30 },
        ],
      },
      insight: { quote: 'Three invoices aging past 30 days totaling $14,200. Acme Co has the longest outstanding balance.' },
      finnFocus: 'Watching overdue invoices and payment pressure points.',
    },
    'tax-review': {
      hero: { title: 'Tax Liability Trend', value: '$18,450', delta: 'On track for Q1', deltaDirection: 'up' },
      ring: {
        title: 'Tax Categories',
        centerValue: '$18K',
        centerLabel: 'est.',
        segments: [
          { label: 'Income Tax', value: 45, color: accent },
          { label: 'Payroll Tax', value: 30, color: `${accent}88` },
          { label: 'Sales Tax', value: 15, color: `${accent}55` },
          { label: 'Other', value: 10, color: 'rgba(255,255,255,0.15)' },
        ],
      },
      queue: {
        title: 'Deductions Queue',
        items: [
          { label: 'Home office deduction', amount: '$4,200', status: 'active', age: 'Q1', progress: 80 },
          { label: 'Vehicle expenses', amount: '$2,800', status: 'active', age: 'Q1', progress: 65 },
          { label: 'Equipment depreciation', amount: '$6,100', status: 'pending', progress: 40 },
          { label: 'Professional services', amount: '$1,900', status: 'active', age: 'Q1', progress: 55 },
        ],
      },
      insight: { quote: 'Q1 tax reserve is on track. Estimated liability aligns with current withholdings — no adjustment needed yet.' },
      finnFocus: 'Reviewing tax obligations and deduction opportunities.',
    },
    'cleanup-sprint': {
      hero: { title: 'Mismatch Count Trend', value: '4', delta: '-2 from last week', deltaDirection: 'up' },
      ring: {
        title: 'Mismatch Types',
        centerValue: '4',
        centerLabel: 'items',
        segments: [
          { label: 'Duplicates', value: 35, color: accent },
          { label: 'Uncategorized', value: 30, color: `${accent}88` },
          { label: 'Amount Diff', value: 25, color: `${accent}55` },
          { label: 'Missing', value: 10, color: 'rgba(255,255,255,0.15)' },
        ],
      },
      queue: {
        title: 'Unmatched Transactions',
        items: [
          { label: 'AWS charge — duplicate?', amount: '$149', status: 'warning', age: '3d', progress: 70 },
          { label: 'Uber Eats — uncategorized', amount: '$42', status: 'pending', progress: 25 },
          { label: 'Stripe fee discrepancy', amount: '$18', status: 'active', age: '5d', progress: 50 },
          { label: 'PayPal transfer — amount diff', amount: '$320', status: 'overdue', age: '8d', progress: 85 },
        ],
      },
      insight: { quote: 'Four unmatched transactions this week. Most are sub-$50 — likely recurring subscriptions needing categorization.' },
      finnFocus: 'Clearing unmatched transactions and data inconsistencies.',
    },
    'books-vs-bank': {
      hero: {
        title: 'Books vs Bank Delta',
        value: recon ? `${recon.mismatchCount ?? 0} issues` : '$120',
        delta: recon?.mismatchCount ? `${recon.mismatchCount} mismatches found` : 'Nearly reconciled',
        deltaDirection: (recon?.mismatchCount ?? 0) > 0 ? 'down' : 'up',
      },
      ring: {
        title: 'Match Status',
        centerValue: '96%',
        centerLabel: 'matched',
        segments: [
          { label: 'Matched', value: 65, color: accent },
          { label: 'Partial', value: 20, color: `${accent}88` },
          { label: 'Unmatched', value: 10, color: `${accent}55` },
          { label: 'Pending', value: 5, color: 'rgba(255,255,255,0.15)' },
        ],
      },
      queue: {
        title: 'Reconcile Items',
        items: [
          { label: 'Pending deposit — clearing', amount: '$120', status: 'pending', progress: 30 },
          { label: 'Wire transfer confirmed', amount: '$5,400', status: 'active', age: '1d', progress: 95 },
          { label: 'Check #4421 — posted', amount: '$880', status: 'active', age: '2d', progress: 80 },
          { label: 'ACH batch — processing', amount: '$3,200', status: 'warning', age: '3d', progress: 50 },
        ],
      },
      insight: { quote: 'Books and bank are within $120 delta. One pending deposit is still clearing — should resolve by EOD.' },
      finnFocus: 'Comparing your books against bank statements in real-time.',
    },
    'money-memory': {
      hero: { title: '12-Month Cash Trend', value: '$72,400', delta: '+22% YoY growth', deltaDirection: 'up' },
      ring: {
        title: 'Seasonal Patterns',
        centerValue: 'Dec',
        centerLabel: 'peak',
        segments: [
          { label: 'Q4 Peak', value: 40, color: accent },
          { label: 'Q1 Steady', value: 25, color: `${accent}88` },
          { label: 'Q2 Growth', value: 20, color: `${accent}55` },
          { label: 'Q3 Dip', value: 15, color: 'rgba(255,255,255,0.15)' },
        ],
      },
      queue: {
        title: 'Notable Events',
        items: [
          { label: 'Dec peak — holiday contracts', amount: '+$18K', status: 'active', age: '3mo', progress: 90 },
          { label: 'Sep dip — slow quarter', amount: '-$4K', status: 'warning', age: '6mo', progress: 40 },
          { label: 'Mar growth — new client', amount: '+$8K', status: 'active', age: '1yr', progress: 70 },
          { label: 'Jun expansion — hire #3', amount: '-$6K', status: 'pending', age: '9mo', progress: 55 },
        ],
      },
      insight: { quote: 'December was your highest cash month — pattern repeats annually from holiday contracts. Plan for Q3 seasonal dip.' },
      finnFocus: 'Analyzing historical patterns and seasonal trends.',
    },
  };

  return configs[mode] ?? configs['cash-truth'];
}
