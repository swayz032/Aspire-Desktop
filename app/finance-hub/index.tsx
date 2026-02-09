import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { ProposalReviewSheet, Proposal } from '@/components/finance/ProposalReviewSheet';
import SourceBadge from '@/components/finance/SourceBadge';
import ExplainDrawer from '@/components/finance/ExplainDrawer';
import TimelineRow from '@/components/finance/TimelineRow';
import ReconcileCard from '@/components/finance/ReconcileCard';
import LifecycleChain from '@/components/finance/LifecycleChain';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns, cardWithPattern, heroCardBg } from '@/constants/cardPatterns';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

interface SnapshotData {
  chapters: {
    now: { cashAvailable: number; bankBalance: number; stripeAvailable: number; stripePending: number; lastUpdated: string | null };
    next: { expectedInflows7d: number; expectedOutflows7d: number; netCashFlow7d: number; items: any[] };
    month: { revenue: number; expenses: number; netIncome: number; period: string };
    reconcile: { mismatches: any[]; mismatchCount: number };
    actions: { proposals: any[]; proposalCount: number };
  };
  provenance: Record<string, any>;
  staleness: Record<string, any>;
  generatedAt: string | null;
  connected: boolean;
}

interface ConnectionStatus {
  connections: Array<{ id: string; provider: string; status: string; lastSyncAt: string | null; nextStep: string | null }>;
  summary: { total: number; connected: number; needsAttention: number };
}

interface TimelineEvent {
  eventId: string;
  provider: string;
  eventType: string;
  occurredAt: string;
  amount: number | null;
  currency: string;
  status: string;
  entityRefs: any;
  metadata?: any;
  receiptId?: string;
}

const fallbackCashTrendData = [
  { day: 'Jan 25', value: 42000 }, { day: 'Jan 26', value: 41200 }, { day: 'Jan 27', value: 43800 },
  { day: 'Jan 28', value: 44500 }, { day: 'Jan 29', value: 39200 }, { day: 'Jan 30', value: 40100 },
  { day: 'Jan 31', value: 41800 }, { day: 'Feb 1', value: 43200 }, { day: 'Feb 2', value: 44900 },
  { day: 'Feb 3', value: 42100 }, { day: 'Feb 4', value: 45600 }, { day: 'Feb 5', value: 44200 },
  { day: 'Feb 6', value: 46800 }, { day: 'Feb 7', value: 47200 },
];

const fallbackMoneyInOutData = [
  { day: 'Mon', inflow: 6200, outflow: 3100 },
  { day: 'Tue', inflow: 4800, outflow: 5200 },
  { day: 'Wed', inflow: 7100, outflow: 2800 },
  { day: 'Thu', inflow: 3400, outflow: 4100 },
  { day: 'Fri', inflow: 5900, outflow: 8400 },
  { day: 'Sat', inflow: 1200, outflow: 600 },
  { day: 'Sun', inflow: 800, outflow: 200 },
];

const fallbackExpenseData = [
  { name: 'Payroll', value: 42, color: '#2563EB' },
  { name: 'Operations', value: 24, color: '#059669' },
  { name: 'Software', value: 15, color: '#D97706' },
  { name: 'Marketing', value: 12, color: '#DC2626' },
  { name: 'Other', value: 7, color: '#6366F1' },
];

const fallbackProposals = [
  { title: 'Fund payroll buffer', chips: ['Payroll Fri', 'Projected balance'], risk: 'MED', riskColor: '#f59e0b', riskBg: 'rgba(245, 158, 11, 0.15)', accentColor: '#f59e0b', description: 'Buffer will drop below $5K after Friday payroll. Recommend moving $4,200 from reserves.' },
  { title: 'Collect overdue AR', chips: ['2 invoices', '$6,800 total'], risk: 'HIGH', riskColor: '#ef4444', riskBg: 'rgba(239, 68, 68, 0.15)', accentColor: '#ef4444', description: 'Two invoices are 14+ days past due. Automated reminder sequence recommended.' },
  { title: 'Increase tax reserve', chips: ['Q4 estimates', 'Current: 18%'], risk: 'LOW', riskColor: '#10B981', riskBg: 'rgba(16, 185, 129, 0.15)', accentColor: '#10B981', description: 'Current reserve rate is below recommended 22% for Q4. Consider increasing allocation.' },
];

const fallbackTransactions = [
  { icon: 'arrow-down-circle' as const, title: 'Apex Corp', subtitle: 'Invoice #1847', amount: '+$4,200', time: '2h ago', color: '#10B981', status: 'Completed' },
  { icon: 'arrow-up-circle' as const, title: 'Figma Pro Plan', subtitle: 'Subscription', amount: '-$299', time: '5h ago', color: '#ef4444', status: 'Completed' },
  { icon: 'arrow-down-circle' as const, title: 'Beta Industries', subtitle: 'Invoice #1832', amount: '+$3,400', time: 'Yesterday', color: '#10B981', status: 'Pending' },
  { icon: 'arrow-up-circle' as const, title: 'AWS Hosting', subtitle: 'Monthly', amount: '-$890', time: 'Yesterday', color: '#ef4444', status: 'Completed' },
  { icon: 'arrow-down-circle' as const, title: 'Gamma LLC', subtitle: 'Invoice #1828', amount: '+$2,100', time: '2 days ago', color: '#10B981', status: 'Completed' },
];

const fallbackKpiSparkData = {
  balance: [38, 40, 42, 41, 43, 44, 45, 47],
  income: [3, 5, 4, 7, 6, 8, 7, 8],
  savings: [12, 13, 13, 14, 14, 14, 15, 15],
  expenses: [8, 9, 7, 8, 7, 7, 7, 7],
};

function formatCurrency(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 100000) return `$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShortCurrency(cents: number): string {
  const val = Math.abs(cents) / 100;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

const webOnly = (webStyles: any) => Platform.OS === 'web' ? webStyles : {};

const tintPositionMap: Record<string, string> = {
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'top-left': 'top left',
  'bottom-right': 'bottom right',
  'center': 'center',
};

function GlassCard({ children, style, onPress, hovered, tint, ...rest }: any) {
  if (Platform.OS !== 'web') {
    const Comp = onPress ? Pressable : View;
    return <Comp style={[s.card, style]} onPress={onPress} {...rest}>{children}</Comp>;
  }
  const Comp = onPress ? Pressable : View;
  const gradPos = tint ? (tintPositionMap[tint.position || 'top-right'] || 'top right') : null;
  const bg = tint
    ? `radial-gradient(ellipse at ${gradPos}, ${tint.color}10 0%, transparent 45%), ${CARD_BG}`
    : CARD_BG;
  return (
    <Comp
      style={[s.card, style, hovered && s.cardHover, { background: bg, border: `1px solid ${CARD_BORDER}` } as any]}
      onPress={onPress}
      {...rest}
    >
      {children}
    </Comp>
  );
}

function GlowBlob({ color, size, top, left, right, bottom, opacity = 0.15 }: { color: string; size: number; top?: any; left?: any; right?: any; bottom?: any; opacity?: number }) {
  return null;
}

function KpiMiniChart({ data, color }: { data: number[]; color: string }) {
  if (Platform.OS !== 'web') return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32, marginTop: 10 }}>
      {data.map((v, i) => (
        <div key={i} className="kpi-spark-bar" style={{
          flex: 1,
          height: `${20 + ((v - min) / range) * 80}%`,
          background: `linear-gradient(to top, ${color}CC, ${color})`,
          borderRadius: 3,
          minWidth: 4,
          borderTop: `1px solid ${color}`,
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function EnterpriseIcon({ type, color, bgColor, size = 36 }: { type: string; color: string; bgColor: string; size?: number }) {
  if (Platform.OS !== 'web') {
    return (
      <View style={[s.enterpriseIconWrap, { width: size, height: size, backgroundColor: bgColor }]}>
        <Ionicons name="business" size={size * 0.44} color={color} />
      </View>
    );
  }

  const iconSize = size * 0.44;
  const svgIcons: Record<string, React.ReactNode> = {
    bank: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M3 21h18v-2H3v2zm0-4h2v-4H3v4zm4 0h2v-4H7v4zm4 0h2v-4h-2v4zm4 0h2v-4h-2v4zm4 0h2v-4h-2v4zM2 11l10-6 10 6H2z" fill={color} />
      </svg>
    ),
    ledger: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M8 7h8M8 11h6M8 15h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 6h2M4 10h2M4 14h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    team: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="17" cy="8" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
        <path d="M19 19c0-2.2-1.3-4-3-4.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
    wallet: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="15" rx="3" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M2 10h20" stroke={color} strokeWidth="1.5" />
        <circle cx="17" cy="15" r="1.5" fill={color} />
      </svg>
    ),
    chart: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="12" width="4" height="8" rx="1" fill={color} opacity="0.6" />
        <rect x="10" y="6" width="4" height="14" rx="1" fill={color} />
        <rect x="17" y="9" width="4" height="11" rx="1" fill={color} opacity="0.8" />
      </svg>
    ),
    shield: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 6v5c0 5.55 3.4 10.74 8 12 4.6-1.26 8-6.45 8-12V6l-8-4z" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    receipt: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2L4 2z" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M8 8h8M8 12h6M8 16h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    invoice: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M8 8h8M8 12h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="2" stroke={color} strokeWidth="1.5" fill="none" />
        <path d="M16 14v4M14 16h4" stroke={color} strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    subscription: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M3 10h18" stroke={color} strokeWidth="1.5" />
        <path d="M7 14h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    transfer: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M4 9h13l-3-3M20 15H7l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    pulse: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M3 12h4l3-8 4 16 3-8h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    flow: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    pie: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M12 3v9h9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    trend: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M3 17l6-6 4 4 8-8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 7h4v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    activity: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <path d="M7 9h10M7 13h7M7 17h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      backgroundColor: bgColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      {svgIcons[type] || <Ionicons name="business" size={iconSize} color={color} />}
    </div>
  );
}

function SectionLabel({ icon, label, color = '#555' }: { icon: string; label: string; color?: string }) {
  return (
    <View style={s.sectionLabel}>
      <EnterpriseIcon type={icon} color={color} bgColor="transparent" size={16} />
      <Text style={[s.sectionLabelText, { color }]}>{label}</Text>
      <View style={s.sectionLabelLine} />
    </View>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const accentColor = payload[0]?.color || '#3B82F6';
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(18,21,35,0.97) 0%, rgba(12,15,25,0.98) 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 12,
      padding: '12px 16px',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${accentColor}15, inset 0 1px 0 rgba(255,255,255,0.06)`,
      minWidth: 140,
    }}>
      <p style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
        margin: '0 0 8px 0',
      }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: i > 0 ? 6 : 0,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: p.color || '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
          }} />
          <span style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            fontWeight: 500,
          }}>{p.name}</span>
          <span style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            marginLeft: 'auto',
            fontFeatureSettings: '"tnum"',
          }}>${(p.value / 1000).toFixed(1)}K</span>
        </div>
      ))}
    </div>
  );
};

function HeroCardDecoration() {
  return null;
}

function ChartCardDecoration({ variant = 'grid', accentColor = '#3B82F6' }: { variant?: 'grid' | 'dots' | 'waves'; accentColor?: string }) {
  return null;
}

function RocketDecoration() {
  if (Platform.OS !== 'web') return null;
  return (
    <div style={{ position: 'absolute', bottom: 16, right: 20, opacity: 0.08, pointerEvents: 'none' }}>
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <path d="M32 4C32 4 48 16 48 36C48 40 46 44 44 46L36 42V52L32 56L28 52V42L20 46C18 44 16 40 16 36C16 16 32 4 32 4Z" fill="white" />
        <circle cx="32" cy="28" r="4" fill="#1a1a1a" />
        <path d="M20 46C16 48 12 48 10 46" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M44 46C48 48 52 48 54 46" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

class FinanceHubErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error('FinanceHub crash:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0A0F', padding: 40, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Finance Hub Error</Text>
          <Text style={{ color: '#ccc', fontSize: 14 }}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function FinanceHubContent() {
  const router = useRouter();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [connections, setConnections] = useState<ConnectionStatus | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [lifecycleSteps, setLifecycleSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [explainMetric, setExplainMetric] = useState<string | null>(null);

  const isConnected = connections?.summary?.connected ? connections.summary.connected > 0 : false;
  const hasSnapshot = snapshot?.connected && snapshot?.generatedAt;

  const cashTrendData = fallbackCashTrendData;
  const moneyInOutData = fallbackMoneyInOutData;
  const expenseData = fallbackExpenseData;
  const proposals = hasSnapshot && snapshot.chapters.actions.proposals.length > 0
    ? snapshot.chapters.actions.proposals.map((p: any) => ({
        title: p.title || p.eventType || 'Proposal',
        chips: p.chips || p.evidence || [],
        risk: p.risk || 'LOW',
        riskColor: p.risk === 'HIGH' ? '#ef4444' : p.risk === 'MED' ? '#f59e0b' : '#10B981',
        riskBg: p.risk === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : p.risk === 'MED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
        accentColor: p.risk === 'HIGH' ? '#ef4444' : p.risk === 'MED' ? '#f59e0b' : '#10B981',
        description: p.description || '',
      }))
    : fallbackProposals;
  const recentTransactions = fallbackTransactions;
  const kpiSparkData = fallbackKpiSparkData;

  const balanceValue = hasSnapshot ? formatCurrency(snapshot.chapters.now.cashAvailable) : '$88,610.00';
  const checkingValue = hasSnapshot ? formatShortCurrency(snapshot.chapters.now.bankBalance) : '$47,250';
  const savingsValue = hasSnapshot ? formatShortCurrency(snapshot.chapters.now.stripeAvailable) : '$28,500';
  const taxReserveValue = hasSnapshot ? formatShortCurrency(snapshot.chapters.now.stripePending) : '$15,200';

  const fetchData = useCallback(async () => {
    try {
      const [snapRes, connRes, timeRes, lcRes] = await Promise.all([
        fetch('/api/finance/snapshot').then(r => r.json()).catch(() => null),
        fetch('/api/connections/status').then(r => r.json()).catch(() => null),
        fetch('/api/finance/timeline?limit=10').then(r => r.json()).catch(() => null),
        fetch('/api/finance/lifecycle').then(r => r.json()).catch(() => null),
      ]);
      if (snapRes) setSnapshot(snapRes);
      if (connRes) setConnections(connRes);
      if (timeRes?.events) setTimeline(timeRes.events);
      if (lcRes?.steps) setLifecycleSteps(lcRes.steps);
    } catch (e) {
      console.warn('Failed to fetch finance data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReviewProposal = (p: typeof fallbackProposals[0]) => {
    setSelectedProposal({
      id: p.title.toLowerCase().replace(/\s+/g, '-'),
      title: p.title,
      type: p.title.includes('payroll') ? 'payroll' : p.title.includes('AR') ? 'collection' : 'reserve',
      impact: { amount: p.title.includes('payroll') ? 12400 : p.title.includes('AR') ? 6800 : 2500, description: p.title },
      evidence: p.chips,
      sources: ['Cash forecast', 'Historical data'],
      risk: p.risk as 'LOW' | 'MED' | 'HIGH',
      approvalLevel: p.risk === 'HIGH' ? 'Owner approval required' : 'Admin approval required',
    });
    setShowProposal(true);
  };

  const webHover = (key: string) => Platform.OS === 'web' ? {
    onMouseEnter: () => setHoveredButton(key),
    onMouseLeave: () => setHoveredButton(null),
  } : {};

  const totalIn = moneyInOutData.reduce((s, d) => s + d.inflow, 0);
  const totalOut = moneyInOutData.reduce((s, d) => s + d.outflow, 0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const styleId = 'finance-hub-animations';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        @keyframes sparkGrowIn {
          0% { transform: scaleY(0); opacity: 0; }
          60% { transform: scaleY(1.1); opacity: 0.9; }
          100% { transform: scaleY(1); opacity: 0.85; }
        }
        @keyframes sparkPulse {
          0%, 100% { opacity: 0.7; transform: scaleY(0.95); }
          50% { opacity: 1; transform: scaleY(1.05); }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes barBounce {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.06); }
        }
        @keyframes pieBreathe {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.015) rotate(0.5deg); }
          50% { transform: scale(1.03) rotate(0deg); }
          75% { transform: scale(1.015) rotate(-0.5deg); }
        }
        .kpi-spark-bar {
          transform-origin: center bottom;
          animation: sparkPulse 2.5s ease-in-out infinite;
        }
        .bar-chart-container .recharts-layer.recharts-bar rect {
          transform-origin: center bottom;
          animation: barBounce 2.5s ease-in-out infinite;
        }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(1) { animation-delay: 0s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(2) { animation-delay: 0.15s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(3) { animation-delay: 0.3s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(4) { animation-delay: 0.45s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(5) { animation-delay: 0.6s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(6) { animation-delay: 0.75s; }
        .bar-chart-container .recharts-layer.recharts-bar:first-of-type rect:nth-of-type(7) { animation-delay: 0.9s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(1) { animation-delay: 0.1s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(2) { animation-delay: 0.25s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(3) { animation-delay: 0.4s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(4) { animation-delay: 0.55s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(5) { animation-delay: 0.7s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(6) { animation-delay: 0.85s; }
        .bar-chart-container .recharts-layer.recharts-bar:last-of-type rect:nth-of-type(7) { animation-delay: 1.0s; }
        .pie-chart-animated {
          animation: pieBreathe 3.5s ease-in-out infinite;
          transform-origin: center;
        }
        .pie-chart-animated .recharts-layer.recharts-pie-sector path {
          transition: transform 0.3s ease, filter 0.3s ease;
        }
        .pie-chart-animated .recharts-layer.recharts-pie-sector path:hover {
          filter: brightness(1.25);
          transform: scale(1.04);
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  return (
    <>
    <FinanceHubShell>
      {Platform.OS === 'web' ? (
        <div style={{
          height: 155, borderRadius: 16, overflow: 'hidden', marginBottom: 20, position: 'relative',
          display: 'flex', flexDirection: 'column',
          background: `radial-gradient(ellipse at top right, rgba(59,130,246,0.08) 0%, transparent 50%), ${CARD_BG}`,
          border: `1px solid ${CARD_BORDER}`,
        }}>
          <View style={[s.heroBannerOverlay, { justifyContent: 'flex-end', paddingBottom: 20 }]}>
            <View style={s.heroBannerRow}>
              <View style={s.heroBannerLeft}>
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: 'rgba(59,130,246,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
                }}>
                  <Ionicons name="analytics" size={22} color="#60A5FA" />
                </View>
                <View style={{ marginLeft: 14 }}>
                  <Text style={s.heroBannerTitle}>Finance Hub</Text>
                  <Text style={s.heroBannerSubtitle}>Your money story + governed actions</Text>
                </View>
              </View>
            </View>
          </View>
        </div>
      ) : (
        <View style={[s.heroBanner, { backgroundColor: '#111827' }]}>
          <View style={s.heroBannerOverlay}>
            <View style={s.heroBannerRow}>
              <View style={s.heroBannerLeft}>
                <LinearGradient colors={['#3B82F6', '#8B5CF6']} style={s.heroBannerIconWrap}>
                  <Ionicons name="stats-chart" size={22} color="#fff" />
                </LinearGradient>
                <View style={{ marginLeft: 14 }}>
                  <Text style={s.heroBannerTitle}>Finance Hub</Text>
                  <Text style={s.heroBannerSubtitle}>Your money story + governed actions</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      <SectionLabel icon="wallet" label="YOUR POSITION" color="#999" />

      <View style={s.row}>
        <GlassCard style={[s.balanceCard, Platform.OS === 'web' && { backgroundImage: svgPatterns.trendLine(), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '50% auto' }]} tint={{ color: '#3B82F6', position: 'top-right' }}>
          <View style={s.balanceHeader}>
            <Pressable onPress={() => setExplainMetric('cash_available')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.balanceLabel}>Total Balance</Text>
              {Platform.OS === 'web' && <Ionicons name="information-circle-outline" size={14} color="#666" />}
            </Pressable>
            {isConnected ? (
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>Live</Text>
              </View>
            ) : (
              <View style={[s.liveBadge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' }]}>
                <Ionicons name="unlink" size={10} color="#888" />
                <Text style={[s.liveText, { color: '#888' }]}>Demo</Text>
              </View>
            )}
          </View>
          <Text style={s.balanceValue}>{balanceValue}</Text>
          <View style={s.balanceChangeRow}>
            <Text style={s.balanceChangeUp}>↑ +2.3% higher than last month</Text>
          </View>
          <View style={s.balanceMetaRow}>
            <View style={s.balanceMeta}>
              <Text style={s.balanceMetaLabel}>{isConnected ? 'Bank' : 'Checking'}</Text>
              <Text style={s.balanceMetaValue}>{checkingValue}</Text>
            </View>
            <View style={[s.balanceMeta, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 16 }]}>
              <Text style={s.balanceMetaLabel}>{isConnected ? 'Stripe' : 'Savings'}</Text>
              <Text style={s.balanceMetaValue}>{savingsValue}</Text>
            </View>
            <View style={[s.balanceMeta, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 16 }]}>
              <Text style={s.balanceMetaLabel}>{isConnected ? 'Pending' : 'Tax Reserve'}</Text>
              <Text style={s.balanceMetaValue}>{taxReserveValue}</Text>
            </View>
          </View>
          {!isConnected && (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.6 }}>
              <Ionicons name="information-circle-outline" size={12} color="#888" />
              <Text style={{ color: '#888', fontSize: 11 }}>Connect providers in Finance Hub → Connections for live data</Text>
            </View>
          )}
          {Platform.OS === 'web' && (
            <div style={{
              marginTop: 16, marginLeft: -4, marginRight: -4,
              position: 'relative',
              animation: 'fadeSlideUp 1s ease-out both',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
            }}>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={cashTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceMiniGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.6} />
                      <stop offset="60%" stopColor="#3B82F6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#60A5FA" strokeWidth={3} fill="url(#balanceMiniGrad)" dot={false} animationDuration={2000} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none',
                borderRadius: 8,
              }} />
            </div>
          )}
        </GlassCard>

        <View style={s.providerStack}>
          {[
            { name: 'Plaid · Cash Position', sub: 'Connected', icon: 'bank', color: '#34D399', bg: 'rgba(16,185,129,0.2)', amount: '$47,200', flow: null },
            { name: 'QuickBooks · Cash Flow', sub: 'Connected', icon: 'ledger', color: '#60A5FA', bg: 'rgba(59,130,246,0.2)', amount: null, flow: { inLabel: '+$18.2K in', outLabel: '-$14.6K out' } },
            { name: 'Gusto · Next Payroll', sub: 'Friday, Feb 7', icon: 'team', color: '#A78BFA', bg: 'rgba(139,92,246,0.2)', amount: '$12,400', flow: null },
          ].map((prov, i) => (
            <GlassCard key={i} style={s.providerCard} tint={{ color: prov.color, position: 'top-right' }}>
              <View style={s.providerRow}>
                <EnterpriseIcon type={prov.icon} color={prov.color} bgColor={prov.bg} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={s.providerName}>{prov.name}</Text>
                  <Text style={s.providerConnected}>{prov.sub}</Text>
                </View>
                {prov.amount ? (
                  <Text style={s.providerAmount}>{prov.amount}</Text>
                ) : prov.flow ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.flowSmall, { color: '#10B981' }]}>{prov.flow.inLabel}</Text>
                    <Text style={[s.flowSmall, { color: '#ef4444' }]}>{prov.flow.outLabel}</Text>
                  </View>
                ) : null}
              </View>
            </GlassCard>
          ))}
        </View>
      </View>

      <SectionLabel icon="pulse" label="QUICK PULSE" color="#999" />

      <View style={s.kpiRow}>
        {[
          { label: 'Balance', value: '$47,200', change: '+3.2%', up: true, icon: 'wallet', sparkKey: 'balance' as const, color: '#10B981' },
          { label: 'Income', value: '+$8,400', change: '+12.4%', up: true, icon: 'chart', sparkKey: 'income' as const, color: '#10B981' },
          { label: 'Savings', value: '$15,200', change: '+10.0%', up: true, icon: 'shield', sparkKey: 'savings' as const, color: '#10B981' },
          { label: 'Expenses', value: '-$6,800', change: '-5.2%', up: false, icon: 'receipt', sparkKey: 'expenses' as const, color: '#ef4444' },
        ].map((kpi, i) => {
          const kpiTints = [
            { color: '#3B82F6', position: 'top-left' },
            { color: '#10B981', position: 'bottom-right' },
            { color: '#06b6d4', position: 'top-right' },
            { color: '#ef4444', position: 'bottom-left' },
          ];
          return (
          <GlassCard key={i} style={[s.kpiCard, Platform.OS === 'web' && { backgroundImage: svgPatterns.barChart(), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '40% auto' }]} tint={kpiTints[i]}>
            {i === 0 && <View style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', backgroundColor: '#3B82F6', borderRadius: 2 } as any} />}
            <View style={s.kpiTopRow}>
              <EnterpriseIcon type={kpi.icon} color={kpi.up ? '#34D399' : '#F87171'} bgColor={kpi.up ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'} size={34} />
              <View style={[s.kpiChangeBadge, { backgroundColor: kpi.up ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}>
                <Text style={[s.kpiChangeText, { color: kpi.color }]}>{kpi.change}</Text>
              </View>
            </View>
            <Text style={s.kpiLabel}>{kpi.label}</Text>
            <Text style={[s.kpiValue, { color: kpi.up ? '#fff' : '#ef4444' }]}>{kpi.value}</Text>
            <KpiMiniChart data={kpiSparkData[kpi.sparkKey]} color={kpi.color} />
          </GlassCard>
          );
        })}
      </View>

      <SectionLabel icon="flow" label="MONEY FLOW" color="#999" />

      <View style={s.row}>
        <GlassCard style={[s.chartCard, { flex: 2 }]} tint={{ color: '#10B981', position: 'top-right' }}>
          <View style={s.chartHeader}>
            <View>
              <Text style={s.cardTitle}>Transaction Reports</Text>
              <Text style={s.cardSubtitle}>This week's cash flow activity</Text>
            </View>
            <View style={s.chartLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={s.legendText}>In ${(totalIn / 1000).toFixed(1)}K</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#ef4444' }]} />
                <Text style={s.legendText}>Out ${(totalOut / 1000).toFixed(1)}K</Text>
              </View>
            </View>
          </View>
          {Platform.OS === 'web' && (
            <div className="bar-chart-container" style={{
              position: 'relative',
              animation: 'fadeSlideUp 0.8s ease-out both',
              filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))',
            }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={moneyInOutData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barGap={4}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                    <stop offset="60%" stopColor="#10B981" stopOpacity={1} />
                    <stop offset="100%" stopColor="#065F46" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F87171" stopOpacity={1} />
                    <stop offset="60%" stopColor="#EF4444" stopOpacity={1} />
                    <stop offset="100%" stopColor="#991B1B" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#666', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#666', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 6 }} />
                <Bar dataKey="inflow" name="Inflow" fill="url(#inflowGrad)" radius={[8, 8, 0, 0]} barSize={22} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                <Bar dataKey="outflow" name="Outflow" fill="url(#outflowGrad)" radius={[8, 8, 0, 0]} barSize={22} animationDuration={1200} animationBegin={500} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: 'none',
              borderRadius: 8,
            }} />
            </div>
          )}
        </GlassCard>

        <View style={{ flex: 1, gap: 0 }}>
          <SectionLabel icon="pie" label="WHERE IT GOES" color="#999" />
          <GlassCard style={[s.chartCard, { marginBottom: 0 }]} tint={{ color: '#8b5cf6', position: 'bottom-right' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <EnterpriseIcon type="pie" color="#A78BFA" bgColor="rgba(139,92,246,0.18)" size={28} />
              <View>
                <Text style={s.cardTitle}>Expenses</Text>
                <Text style={s.cardSubtitle}>Monthly breakdown</Text>
              </View>
            </View>
          {Platform.OS === 'web' && (
            <div className="pie-chart-animated" style={{
              width: '100%', height: 160, marginTop: 8,
              display: 'flex', justifyContent: 'center',
              animation: 'fadeSlideUp 1s ease-out 0.3s both',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
            }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <defs>
                    {expenseData.map((entry, i) => (
                      <radialGradient key={`pieGrad-${i}`} id={`pieGrad-${i}`} cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                      </radialGradient>
                    ))}
                  </defs>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={42}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    strokeWidth={0}
                    animationDuration={1800}
                    animationBegin={300}
                    animationEasing="ease-out"
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`inner-${index}`} fill={`${entry.color}25`} />
                    ))}
                  </Pie>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={0.5}
                    animationDuration={1800}
                    animationBegin={300}
                    animationEasing="ease-out"
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieGrad-${index})`} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <View style={s.expenseLegend}>
            {expenseData.map((item, i) => (
              <View key={i} style={s.expenseLegendItem}>
                <View style={[s.expenseLegendDot, { backgroundColor: item.color }]} />
                <Text style={s.expenseLegendName}>{item.name}</Text>
                <Text style={s.expenseLegendVal}>{item.value}%</Text>
              </View>
            ))}
          </View>
          </GlassCard>
        </View>
      </View>

      <SectionLabel icon="trend" label="THE TREND" color="#999" />

      <GlassCard style={s.chartCard} tint={{ color: '#3B82F6', position: 'top-left' }}>
        <View style={s.chartHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <EnterpriseIcon type="trend" color="#60A5FA" bgColor="rgba(59,130,246,0.2)" size={32} />
            <View>
              <Text style={s.cardTitle}>Cash Trend</Text>
              <Text style={s.cardSubtitle}>14-day balance trajectory</Text>
            </View>
          </View>
          <View style={s.trendBadge}>
            <Ionicons name="trending-up" size={12} color="#10B981" />
            <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>+12.4%</Text>
          </View>
        </View>
        {Platform.OS === 'web' && (
          <div style={{
            position: 'relative',
            animation: 'fadeSlideUp 0.8s ease-out 0.2s both',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
          }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cashTrendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.55} />
                  <stop offset="40%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="cashStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#818CF8" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#666', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#666', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} domain={['dataMin - 1000', 'dataMax + 1000']} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(96,165,250,0.3)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="value" name="Cash" stroke="url(#cashStroke)" strokeWidth={3} fill="url(#cashGrad)" dot={{ r: 4, fill: '#60A5FA', stroke: '#1C1C1E', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#93C5FD', stroke: '#1D4ED8', strokeWidth: 3 }} animationDuration={2000} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            borderRadius: 8,
          }} />
          </div>
        )}
      </GlassCard>

      {hasSnapshot && snapshot.chapters.reconcile.mismatchCount > 0 && (
        <>
          <SectionLabel icon="git-compare" label="RECONCILIATION" color="#999" />
          <View style={{ gap: 10, marginBottom: 4 }}>
            <View style={s.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="git-compare" size={14} color="#F59E0B" />
                </View>
                <Text style={s.sectionTitle}>Items to Reconcile</Text>
              </View>
              <View style={[s.proposalCount, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                <Text style={[s.proposalCountText, { color: '#F59E0B' }]}>{snapshot.chapters.reconcile.mismatchCount}</Text>
              </View>
            </View>
            {snapshot.chapters.reconcile.mismatches.map((m: any) => (
              <ReconcileCard
                key={m.id}
                mismatch={m}
                onAction={() => {}}
                onDismiss={() => {}}
              />
            ))}
          </View>
        </>
      )}

      {lifecycleSteps.length > 0 && lifecycleSteps.some((st: any) => st.status !== 'pending') && (
        <>
          <SectionLabel icon="git-branch" label="MONEY LIFECYCLE" color="#999" />
          <LifecycleChain
            steps={lifecycleSteps}
            title="Revenue Flow"
            onExplainStep={(step) => {
              const stageToMetric: Record<string, string> = {
                'Booked': 'expected_inflows',
                'Invoiced': 'expected_inflows',
                'Paid': 'monthly_revenue',
                'Deposited': 'cash_available',
                'Posted': 'net_income',
              };
              const metricId = stageToMetric[step.label];
              if (metricId) setExplainMetric(metricId);
            }}
          />
        </>
      )}

      <SectionLabel icon="activity" label="PROPOSALS & RECENT ACTIVITY" color="#999" />

      <View style={s.row}>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Finn's Proposals</Text>
            <View style={s.proposalCount}>
              <Text style={s.proposalCountText}>3</Text>
            </View>
          </View>
          {proposals.map((p, i) => (
            <GlassCard
              key={i}
              style={s.proposalCard}
              hovered={hoveredButton === `prop-${i}`}
              onPress={() => handleReviewProposal(p)}
              {...webHover(`prop-${i}`)}
            >
              <View style={[s.proposalAccent, { backgroundColor: p.accentColor }]} />
              <View style={s.proposalBody}>
                <View style={s.proposalTopRow}>
                  <Text style={s.proposalTitle}>{p.title}</Text>
                  <View style={[s.riskBadge, { backgroundColor: p.riskBg }]}>
                    <View style={[s.riskDot, { backgroundColor: p.riskColor }]} />
                    <Text style={[s.riskText, { color: p.riskColor }]}>{p.risk}</Text>
                  </View>
                </View>
                <Text style={s.proposalDesc}>{p.description}</Text>
                <View style={s.proposalChips}>
                  {p.chips.map((c: string, ci: number) => (
                    <View key={ci} style={s.chip}>
                      <Text style={s.chipText}>{c}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  style={[s.reviewBtn, hoveredButton === `rev-${i}` && { opacity: 0.8 }]}
                  {...webHover(`rev-${i}`)}
                  onPress={() => handleReviewProposal(p)}
                >
                  <Ionicons name="eye" size={12} color="#fff" />
                  <Text style={s.reviewBtnText}>Review</Text>
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </View>

        <GlassCard style={[s.transactionsCard, { flex: 1 }, Platform.OS === 'web' && { backgroundImage: svgPatterns.shieldCheck(), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '30% auto' }]} tint={{ color: '#06b6d4', position: 'bottom-left' }}>
          <View style={s.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <EnterpriseIcon type="activity" color="#22D3EE" bgColor="rgba(6,182,212,0.2)" size={28} />
              <Text style={s.cardTitle}>Recent Transactions</Text>
            </View>
            <Pressable {...webHover('viewall')} style={hoveredButton === 'viewall' ? { opacity: 0.7 } : undefined}>
              <Text style={s.viewAllText}>View all</Text>
            </Pressable>
          </View>
          {recentTransactions.map((tx, i) => {
            const txIconType = tx.amount.startsWith('+') ? 'invoice' : (tx.subtitle === 'Subscription' ? 'subscription' : 'transfer');
            return (
              <View key={i} style={[s.txRow, i < recentTransactions.length - 1 && s.txRowBorder]}>
                <EnterpriseIcon type={txIconType} color={tx.color === '#10B981' ? '#34D399' : '#F87171'} bgColor={tx.color === '#10B981' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={s.txTitle}>{tx.title}</Text>
                  <Text style={s.txSub}>{tx.subtitle}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.txAmount, { color: tx.amount.startsWith('+') ? '#10B981' : '#ef4444' }]}>{tx.amount}</Text>
                  <Text style={s.txTime}>{tx.time}</Text>
                </View>
              </View>
            );
          })}
        </GlassCard>
      </View>

      {timeline.length > 0 && (
        <>
          <SectionLabel icon="time" label="EVENT TIMELINE" color="#999" />
          <GlassCard style={{ padding: 0 }} tint={{ color: '#8B5CF6', position: 'top-left' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: CARD_BORDER }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="time" size={14} color="#A78BFA" />
                </View>
                <Text style={s.cardTitle}>Live Event Feed</Text>
              </View>
            </View>
            {timeline.map((evt, i) => (
              <TimelineRow
                key={evt.eventId}
                event={evt}
                isLast={i === timeline.length - 1}
              />
            ))}
          </GlassCard>
        </>
      )}

    </FinanceHubShell>
    <ExplainDrawer
      visible={!!explainMetric}
      onClose={() => setExplainMetric(null)}
      metricId={explainMetric || ''}
    />
    <ProposalReviewSheet
      visible={showProposal}
      proposal={selectedProposal}
      onClose={() => setShowProposal(false)}
      onSendToQueue={(p) => { setShowProposal(false); }}
    />
    </>
  );
}

export default function FinanceHubIndex() {
  return (
    <FinanceHubErrorBoundary>
      <FinanceHubContent />
    </FinanceHubErrorBoundary>
  );
}

const glassCardBase = {
  backgroundColor: '#1C1C1E',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
  overflow: 'hidden' as const,
  position: 'relative' as const,
};

const s = StyleSheet.create({
  heroBanner: {
    height: 155,
    overflow: 'hidden',
    borderRadius: 16,
    marginBottom: 20,
  },
  heroBannerOverlay: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  heroBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBannerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { boxShadow: '0 0 20px rgba(59,130,246,0.4)' } }),
  } as any,
  heroBannerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroBannerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 8,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
    overflow: 'hidden' as const,
  } as any,
  cardHover: {
    borderColor: 'rgba(255,255,255,0.10)',
  },

  enterpriseIconWrap: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceCard: {
    flex: 2,
    padding: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 4,
  },
  balanceChangeRow: {
    marginBottom: 16,
  },
  balanceChangeUp: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  balanceMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  balanceMeta: {},
  balanceMetaLabel: {
    color: '#999',
    fontSize: 11,
    fontWeight: '500',
  },
  balanceMetaValue: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },

  providerStack: {
    flex: 1,
    gap: 8,
  },
  providerCard: {
    padding: 16,
    flex: 1,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerName: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '600',
  },
  providerConnected: {
    color: '#999',
    fontSize: 11,
    marginTop: 1,
  },
  providerAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  flowSmall: {
    fontSize: 12,
    fontWeight: '600',
  },

  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    padding: 18,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  kpiChangeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  kpiChangeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
  },

  chartCard: {
    padding: 22,
    marginBottom: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '500',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },

  expenseLegend: {
    gap: 6,
    marginTop: 8,
  },
  expenseLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expenseLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expenseLegendName: {
    color: '#bbb',
    fontSize: 12,
    flex: 1,
  },
  expenseLegendVal: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  viewAllText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '500',
  },
  proposalCount: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proposalCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  proposalCard: {
    flexDirection: 'row',
    ...webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' }),
  } as any,
  proposalAccent: {
    width: 3,
  },
  proposalBody: {
    flex: 1,
    padding: 16,
  },
  proposalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  proposalTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  proposalDesc: {
    color: '#999',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  proposalChips: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipText: {
    color: '#aaa',
    fontSize: 11,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  riskDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: 'flex-start',
    ...webOnly({ cursor: 'pointer', transition: 'opacity 0.2s' }),
  } as any,
  reviewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  transactionsCard: {
    padding: 20,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  txTitle: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '600',
  },
  txSub: {
    color: '#999',
    fontSize: 11,
    marginTop: 1,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txTime: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
});
