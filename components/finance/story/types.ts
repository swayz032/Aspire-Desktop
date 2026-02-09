export type EventDirection = 'inflow' | 'outflow' | 'transfer' | 'adjustment';

export type EventProvider = 'plaid' | 'stripe' | 'quickbooks' | 'gusto' | 'manual' | 'system';

export interface FinanceEvent {
  id: string;
  type: string;
  time: string;
  amount: number;
  direction: EventDirection;
  counterparty: string;
  provider: EventProvider;
  sourceIds: string[];
  links: { label: string; route: string }[];
  description?: string;
  category?: string;
  account?: string;
}

export interface TimelineGroup {
  label: string;
  period: 'day' | 'week' | 'month';
  date: string;
  events: FinanceEvent[];
  totalInflow: number;
  totalOutflow: number;
  netChange: number;
}

export interface DepartmentShelf {
  id: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity';
  icon: string;
  color: string;
  totalBalance: number;
  accounts: ShelfAccount[];
  trend: number[];
}

export interface ShelfAccount {
  id: string;
  name: string;
  balance: number;
  subType: string;
  lastActivity?: string;
  trend: number[];
}

export interface ExplainItem {
  label: string;
  amount: number;
  percentage: number;
  provider?: EventProvider;
  sourceId?: string;
}

export interface WizardScenario {
  id: string;
  label: string;
  icon: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  fields: { key: string; label: string; type: 'amount' | 'text' | 'date' | 'account' }[];
}

export function groupEventsByTimeline(events: FinanceEvent[], period: 'day' | 'week' | 'month'): TimelineGroup[] {
  const groups = new Map<string, FinanceEvent[]>();

  for (const event of events) {
    const date = new Date(event.time);
    let key: string;

    if (period === 'day') {
      key = date.toISOString().split('T')[0];
    } else if (period === 'week') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      key = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  return Array.from(groups.entries()).map(([label, evts]) => {
    const totalInflow = evts.filter(e => e.direction === 'inflow').reduce((s, e) => s + e.amount, 0);
    const totalOutflow = evts.filter(e => e.direction === 'outflow').reduce((s, e) => s + e.amount, 0);
    return {
      label,
      period,
      date: evts[0]?.time || '',
      events: evts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
      totalInflow,
      totalOutflow,
      netChange: totalInflow - totalOutflow,
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function categorizeToDepartments(accounts: any[]): DepartmentShelf[] {
  const deptMap: Record<string, { accounts: any[]; color: string; icon: string }> = {
    Asset: { accounts: [], color: '#3B82F6', icon: 'wallet-outline' },
    Liability: { accounts: [], color: '#EF4444', icon: 'card-outline' },
    Income: { accounts: [], color: '#10B981', icon: 'trending-up-outline' },
    Expense: { accounts: [], color: '#F59E0B', icon: 'trending-down-outline' },
    Equity: { accounts: [], color: '#8B5CF6', icon: 'diamond-outline' },
  };

  for (const acct of accounts) {
    const type = (acct.AccountType || acct.Classification || '').replace(/s$/, '');
    const matchedType = Object.keys(deptMap).find(k =>
      type.toLowerCase().includes(k.toLowerCase()) ||
      (k === 'Income' && type.toLowerCase().includes('revenue'))
    );
    if (matchedType) {
      deptMap[matchedType].accounts.push(acct);
    } else if (type.toLowerCase().includes('cost')) {
      deptMap.Expense.accounts.push(acct);
    }
  }

  return Object.entries(deptMap).map(([name, dept]) => {
    const total = dept.accounts.reduce((s, a) => s + (parseFloat(a.CurrentBalance) || 0), 0);
    const fakeSparkline = [total * 0.85, total * 0.88, total * 0.92, total * 0.87, total * 0.95, total * 0.93, total * 0.97, total];
    return {
      id: name.toLowerCase(),
      name,
      type: name as DepartmentShelf['type'],
      icon: dept.icon,
      color: dept.color,
      totalBalance: total,
      trend: fakeSparkline,
      accounts: dept.accounts.map(a => ({
        id: a.Id || a.id || '',
        name: a.Name || a.name || '',
        balance: parseFloat(a.CurrentBalance) || 0,
        subType: a.AccountSubType || a.SubAccount || '',
        lastActivity: a.MetaData?.LastUpdatedTime,
        trend: [
          (parseFloat(a.CurrentBalance) || 0) * 0.9,
          (parseFloat(a.CurrentBalance) || 0) * 0.92,
          (parseFloat(a.CurrentBalance) || 0) * 0.88,
          (parseFloat(a.CurrentBalance) || 0) * 0.95,
          parseFloat(a.CurrentBalance) || 0,
        ],
      })),
    };
  }).filter(d => d.accounts.length > 0);
}
