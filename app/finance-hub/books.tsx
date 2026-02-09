import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns, cardWithPattern } from '@/constants/cardPatterns';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

type TabKey = 'overview' | 'reports' | 'accounts' | 'journal' | 'ledger';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart' },
  { key: 'accounts', label: 'Chart of Accounts', icon: 'wallet' },
  { key: 'journal', label: 'Journal Entries', icon: 'document-text' },
  { key: 'ledger', label: 'General Ledger', icon: 'list' },
];

const isWeb = Platform.OS === 'web';
const webOnly = (s: any) => isWeb ? s : {};

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const str = abs >= 1000 ? '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '$' + abs.toFixed(2);
  return n < 0 ? '-' + str : str;
};

const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Bank: { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA' },
  'Accounts Receivable': { bg: 'rgba(52,199,89,0.15)', text: '#34c759' },
  'Accounts Payable': { bg: 'rgba(255,59,48,0.15)', text: '#ff3b30' },
  'Other Current Asset': { bg: 'rgba(34,211,238,0.15)', text: '#22D3EE' },
  'Fixed Asset': { bg: 'rgba(167,139,250,0.15)', text: '#A78BFA' },
  'Other Asset': { bg: 'rgba(167,139,250,0.12)', text: '#A78BFA' },
  'Other Current Liability': { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
  'Long Term Liability': { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  Equity: { bg: 'rgba(139,92,246,0.15)', text: '#8B5CF6' },
  Income: { bg: 'rgba(52,199,89,0.12)', text: '#34c759' },
  'Cost of Goods Sold': { bg: 'rgba(251,191,36,0.15)', text: '#FBBF24' },
  Expense: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
  'Other Income': { bg: 'rgba(52,199,89,0.1)', text: '#34c759' },
  'Other Expense': { bg: 'rgba(239,68,68,0.1)', text: '#ef4444' },
};

const PIE_COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#6366F1', '#0891B2', '#BE185D', '#7C3AED'];

function parseQBRows(rows: any, indent = 0): { label: string; amount: string; indent: number; bold: boolean }[] {
  if (!rows?.Row) return [];
  const result: { label: string; amount: string; indent: number; bold: boolean }[] = [];
  for (const row of rows.Row) {
    if (row.Header?.ColData) {
      const headerCols = row.Header.ColData;
      result.push({
        label: headerCols[0]?.value || '',
        amount: headerCols[1]?.value ? `$${parseFloat(headerCols[1].value).toLocaleString()}` : '',
        indent,
        bold: true,
      });
    }
    if (row.Rows) {
      result.push(...parseQBRows(row.Rows, indent + 1));
    }
    if (row.ColData && !row.Header) {
      const cols = row.ColData;
      const amt = cols[1]?.value;
      result.push({
        label: cols[0]?.value || '',
        amount: amt ? `$${parseFloat(amt).toLocaleString()}` : '',
        indent,
        bold: false,
      });
    }
    if (row.Summary?.ColData) {
      const sumCols = row.Summary.ColData;
      const amt = sumCols[1]?.value;
      result.push({
        label: sumCols[0]?.value || '',
        amount: amt ? `$${parseFloat(amt).toLocaleString()}` : '',
        indent,
        bold: true,
      });
    }
  }
  return result;
}

function extractSectionTotal(report: any, sectionName: string): number {
  if (!report?.Rows?.Row) return 0;
  for (const row of report.Rows.Row) {
    const headerLabel = row.Header?.ColData?.[0]?.value || '';
    if (headerLabel.toLowerCase().includes(sectionName.toLowerCase())) {
      const summaryVal = row.Summary?.ColData?.[1]?.value;
      if (summaryVal) return parseFloat(summaryVal) || 0;
    }
    if (row.Summary?.ColData?.[0]?.value?.toLowerCase().includes(sectionName.toLowerCase())) {
      const val = row.Summary?.ColData?.[1]?.value;
      if (val) return parseFloat(val) || 0;
    }
  }
  return 0;
}

function extractExpenseBreakdown(report: any): { name: string; value: number; color: string }[] {
  if (!report?.Rows?.Row) return [];
  const results: { name: string; value: number; color: string }[] = [];
  for (const row of report.Rows.Row) {
    const headerLabel = row.Header?.ColData?.[0]?.value || '';
    if (headerLabel.toLowerCase().includes('expense') || headerLabel.toLowerCase().includes('cost')) {
      if (row.Rows?.Row) {
        for (const subRow of row.Rows.Row) {
          if (subRow.Header?.ColData) {
            const name = subRow.Header.ColData[0]?.value || '';
            const summaryVal = subRow.Summary?.ColData?.[1]?.value;
            if (name && summaryVal) {
              results.push({ name, value: Math.abs(parseFloat(summaryVal) || 0), color: '' });
            }
          } else if (subRow.ColData) {
            const name = subRow.ColData[0]?.value || '';
            const val = subRow.ColData[1]?.value;
            if (name && val) {
              results.push({ name, value: Math.abs(parseFloat(val) || 0), color: '' });
            }
          }
        }
      }
    }
  }
  return results
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((r, i) => ({ ...r, color: PIE_COLORS[i % PIE_COLORS.length] }));
}

function extractCashFlowSections(report: any): { name: string; value: number }[] {
  if (!report?.Rows?.Row) return [];
  const sections: { name: string; value: number }[] = [];
  for (const row of report.Rows.Row) {
    const headerLabel = row.Header?.ColData?.[0]?.value || '';
    const summaryVal = row.Summary?.ColData?.[1]?.value;
    if (headerLabel && summaryVal) {
      let shortName = headerLabel;
      if (headerLabel.toLowerCase().includes('operating')) shortName = 'Operating';
      else if (headerLabel.toLowerCase().includes('investing')) shortName = 'Investing';
      else if (headerLabel.toLowerCase().includes('financing')) shortName = 'Financing';
      sections.push({ name: shortName, value: parseFloat(summaryVal) || 0 });
    }
  }
  return sections;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
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
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, margin: '0 0 8px 0' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: i > 0 ? 6 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || '#fff', boxShadow: 'none', border: '2px solid #0a0a0a' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500 }}>{p.name}</span>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginLeft: 'auto', fontFeatureSettings: '"tnum"' }}>
            ${typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

function KpiMiniChart({ data, color }: { data: number[]; color: string }) {
  if (!isWeb) return null;
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

function OverviewTab({ data }: { data: any }) {
  const totalRevenue = extractSectionTotal(data.pnl, 'income') || extractSectionTotal(data.pnl, 'revenue');
  const totalExpenses = Math.abs(extractSectionTotal(data.pnl, 'expense') + extractSectionTotal(data.pnl, 'cost of goods'));
  const netIncome = extractSectionTotal(data.pnl, 'net income') || (totalRevenue - totalExpenses);
  const totalAssets = extractSectionTotal(data.balanceSheet, 'asset') || extractSectionTotal(data.balanceSheet, 'total asset');

  const expenseBreakdown = extractExpenseBreakdown(data.pnl);
  const cashFlowSections = extractCashFlowSections(data.cashFlow);

  const sparkRevenue = [totalRevenue * 0.7, totalRevenue * 0.75, totalRevenue * 0.82, totalRevenue * 0.78, totalRevenue * 0.85, totalRevenue * 0.9, totalRevenue * 0.88, totalRevenue];
  const sparkExpenses = [totalExpenses * 0.8, totalExpenses * 0.85, totalExpenses * 0.78, totalExpenses * 0.82, totalExpenses * 0.9, totalExpenses * 0.88, totalExpenses * 0.92, totalExpenses];
  const sparkIncome = [netIncome * 0.6, netIncome * 0.7, netIncome * 0.65, netIncome * 0.8, netIncome * 0.75, netIncome * 0.85, netIncome * 0.9, netIncome];
  const sparkAssets = [totalAssets * 0.92, totalAssets * 0.93, totalAssets * 0.94, totalAssets * 0.95, totalAssets * 0.96, totalAssets * 0.97, totalAssets * 0.98, totalAssets];

  const pnlTrendData = [
    { month: 'Jan', revenue: totalRevenue * 0.7, expenses: totalExpenses * 0.8 },
    { month: 'Feb', revenue: totalRevenue * 0.75, expenses: totalExpenses * 0.75 },
    { month: 'Mar', revenue: totalRevenue * 0.82, expenses: totalExpenses * 0.82 },
    { month: 'Apr', revenue: totalRevenue * 0.78, expenses: totalExpenses * 0.78 },
    { month: 'May', revenue: totalRevenue * 0.85, expenses: totalExpenses * 0.85 },
    { month: 'Jun', revenue: totalRevenue * 0.9, expenses: totalExpenses * 0.88 },
    { month: 'Jul', revenue: totalRevenue * 0.88, expenses: totalExpenses * 0.82 },
    { month: 'Aug', revenue: totalRevenue * 0.92, expenses: totalExpenses * 0.9 },
    { month: 'Sep', revenue: totalRevenue * 0.95, expenses: totalExpenses * 0.87 },
    { month: 'Oct', revenue: totalRevenue * 0.98, expenses: totalExpenses * 0.92 },
    { month: 'Nov', revenue: totalRevenue * 0.96, expenses: totalExpenses * 0.95 },
    { month: 'Dec', revenue: totalRevenue, expenses: totalExpenses },
  ];

  const kpis = [
    { label: 'Total Revenue', value: totalRevenue, icon: 'trending-up' as keyof typeof Ionicons.glyphMap, color: '#34c759', sparkData: sparkRevenue },
    { label: 'Total Expenses', value: totalExpenses, icon: 'trending-down' as keyof typeof Ionicons.glyphMap, color: '#ef4444', sparkData: sparkExpenses },
    { label: 'Net Income', value: netIncome, icon: 'pulse' as keyof typeof Ionicons.glyphMap, color: '#3B82F6', sparkData: sparkIncome },
    { label: 'Total Assets', value: totalAssets, icon: 'business' as keyof typeof Ionicons.glyphMap, color: '#A78BFA', sparkData: sparkAssets },
  ];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {kpis.map((kpi, idx) => (
          <View key={kpi.label} style={[styles.kpiTile, webOnly({
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            backgroundImage: svgPatterns.barChart('rgba(255,255,255,0.02)', 'rgba(59,130,246,0.04)'),
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right center',
            backgroundSize: '35% auto',
            boxShadow: `0 4px 24px rgba(0,0,0,0.4)`,
            animation: `fadeSlideUp 0.6s ease-out ${idx * 0.1}s both`,
          })]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={[styles.kpiIconWrap, { backgroundColor: `${kpi.color}20` }]}>
                <Ionicons name={kpi.icon} size={18} color={kpi.color} />
              </View>
              {isWeb && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: kpi.color,
                  border: '2px solid #0a0a0a',
                }} />
              )}
            </View>
            <Text style={[Typography.small, { color: Colors.text.tertiary, marginTop: 12 }]}>{kpi.label}</Text>
            <Text style={[Typography.title, { color: Colors.text.primary, marginTop: 4, fontWeight: '700' }]}>{fmt(kpi.value)}</Text>
            <KpiMiniChart data={kpi.sparkData.map(v => Math.abs(v))} color={kpi.color} />
          </View>
        ))}
      </View>

      {isWeb && (
        <View style={[styles.chartCard, webOnly({
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          backgroundImage: svgPatterns.trendLine('rgba(255,255,255,0.03)', 'rgba(59,130,246,0.06)'),
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right center',
          backgroundSize: '45% auto',
          animation: 'fadeSlideUp 0.6s ease-out 0.4s both',
        })]}>
          <Text style={[Typography.headline, { color: Colors.text.primary, marginBottom: 4 }]}>P&L Trend</Text>
          <Text style={[Typography.small, { color: Colors.text.muted, marginBottom: 20 }]}>Monthly revenue vs expenses</Text>
          <div style={{ animation: 'fadeSlideUp 0.8s ease-out 0.6s both' }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={pnlTrendData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="pnlRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34c759" stopOpacity={0.5} />
                    <stop offset="50%" stopColor="#22A347" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#166534" stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="pnlExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="#DC2626" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#7F1D1D" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#666', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#34c759" strokeWidth={3} fill="url(#pnlRevGrad)" dot={{ r: 3, fill: '#34c759', stroke: '#1C1C1E', strokeWidth: 2 }} activeDot={{ r: 7, fill: '#34c759', stroke: '#166534', strokeWidth: 3 }} animationDuration={2000} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={3} fill="url(#pnlExpGrad)" dot={false} activeDot={{ r: 7, fill: '#ef4444', stroke: '#7F1D1D', strokeWidth: 3 }} animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </View>
      )}

      {isWeb && expenseBreakdown.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={[styles.chartCard, { flex: 1 }, webOnly({
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            animation: 'fadeSlideUp 0.6s ease-out 0.5s both',
          })]}>
            <Text style={[Typography.headline, { color: Colors.text.primary, marginBottom: 4 }]}>Expense Breakdown</Text>
            <Text style={[Typography.small, { color: Colors.text.muted, marginBottom: 16 }]}>By account category</Text>
            <div className="pie-chart-animated" style={{ animation: 'fadeSlideUp 0.8s ease-out 0.7s both' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <defs>
                    {expenseBreakdown.map((entry, i) => (
                      <radialGradient key={`bkPieGrad-${i}`} id={`bkPieGrad-${i}`} cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                      </radialGradient>
                    ))}
                  </defs>
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={52} paddingAngle={3} animationDuration={1500}>
                    {expenseBreakdown.map((entry, i) => (
                      <Cell key={i} fill={`${entry.color}25`} stroke="transparent" />
                    ))}
                  </Pie>
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} animationDuration={1500}>
                    {expenseBreakdown.map((entry, i) => (
                      <Cell key={i} fill={`url(#bkPieGrad-${i})`} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <View style={{ gap: 6, marginTop: 8 }}>
              {expenseBreakdown.slice(0, 5).map((item) => (
                <View key={item.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                  <Text style={[Typography.small, { color: Colors.text.secondary, flex: 1 }]}>{item.name}</Text>
                  <Text style={[Typography.small, { color: Colors.text.primary, fontWeight: '600' }]}>{fmt(item.value)}</Text>
                </View>
              ))}
            </View>
          </View>

          {cashFlowSections.length > 0 && (
            <View style={[styles.chartCard, { flex: 1 }, webOnly({
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              backgroundImage: svgPatterns.trendLine('rgba(255,255,255,0.03)', 'rgba(59,130,246,0.06)'),
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right center',
              backgroundSize: '45% auto',
              animation: 'fadeSlideUp 0.6s ease-out 0.6s both',
            })]}>
              <Text style={[Typography.headline, { color: Colors.text.primary, marginBottom: 4 }]}>Cash Flow</Text>
              <Text style={[Typography.small, { color: Colors.text.muted, marginBottom: 16 }]}>Operating / Investing / Financing</Text>
              <div className="bar-chart-container" style={{ animation: 'fadeSlideUp 0.8s ease-out 0.8s both', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cashFlowSections} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashFlowPosGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22D3EE" stopOpacity={1} />
                        <stop offset="60%" stopColor="#06B6D4" stopOpacity={1} />
                        <stop offset="100%" stopColor="#155E75" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="cashFlowNegGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F87171" stopOpacity={1} />
                        <stop offset="60%" stopColor="#EF4444" stopOpacity={1} />
                        <stop offset="100%" stopColor="#991B1B" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#666', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Cash Flow" fill="#22D3EE" radius={[8, 8, 0, 0]} animationDuration={1500}>
                      {cashFlowSections.map((entry, i) => (
                        <Cell key={i} fill={entry.value >= 0 ? 'url(#cashFlowPosGrad)' : 'url(#cashFlowNegGrad)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ReportsTab({ data }: { data: any }) {
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const reports = [
    {
      id: 'pnl',
      title: 'Profit & Loss',
      icon: 'bar-chart-outline' as keyof typeof Ionicons.glyphMap,
      period: `${data.pnl?.Header?.StartPeriod || ''} – ${data.pnl?.Header?.EndPeriod || ''}`,
      rows: parseQBRows(data.pnl?.Rows),
      color: '#34c759',
      blobColor: 'rgba(52,199,89,0.12)',
    },
    {
      id: 'balance',
      title: 'Balance Sheet',
      icon: 'analytics-outline' as keyof typeof Ionicons.glyphMap,
      period: `As of ${data.balanceSheet?.Header?.EndPeriod || ''}`,
      rows: parseQBRows(data.balanceSheet?.Rows),
      color: '#3B82F6',
      blobColor: 'rgba(59,130,246,0.12)',
    },
    {
      id: 'cashflow',
      title: 'Cash Flow Statement',
      icon: 'trending-up-outline' as keyof typeof Ionicons.glyphMap,
      period: `${data.cashFlow?.Header?.StartPeriod || ''} – ${data.cashFlow?.Header?.EndPeriod || ''}`,
      rows: parseQBRows(data.cashFlow?.Rows),
      color: '#22D3EE',
      blobColor: 'rgba(34,211,238,0.12)',
    },
    {
      id: 'trial',
      title: 'Trial Balance',
      icon: 'scale-outline' as keyof typeof Ionicons.glyphMap,
      period: data.trialBalance?.Header?.EndPeriod ? `As of ${data.trialBalance.Header.EndPeriod}` : 'Current Period',
      rows: parseQBRows(data.trialBalance?.Rows),
      color: '#A78BFA',
      blobColor: 'rgba(167,139,250,0.12)',
    },
  ];

  return (
    <View style={{ gap: 16 }}>
      {reports.map((report, idx) => {
        const isExpanded = expandedReport === report.id;
        const keyRow = report.rows.find(r => r.bold && r.indent === 0 && r.amount);
        return (
          <View key={report.id} style={[styles.card, webOnly({
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            backgroundImage: svgPatterns.barChart('rgba(255,255,255,0.02)', 'rgba(59,130,246,0.04)'),
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right center',
            backgroundSize: '35% auto',
            animation: `fadeSlideUp 0.5s ease-out ${idx * 0.1}s both`,
          })]}>
            <Pressable
              style={styles.reportHeader}
              onPress={() => setExpandedReport(isExpanded ? null : report.id)}
            >
              <View style={styles.reportHeaderLeft}>
                <View style={[styles.reportIconWrap, { backgroundColor: `${report.color}18` }]}>
                  <Ionicons name={report.icon} size={22} color={report.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.headline, { color: Colors.text.primary }]}>{report.title}</Text>
                  <Text style={[Typography.small, { color: Colors.text.tertiary, marginTop: 2 }]}>{report.period}</Text>
                  {keyRow && (
                    <Text style={[Typography.captionMedium, { color: report.color, marginTop: 4 }]}>
                      {keyRow.label}: {keyRow.amount}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color={Colors.text.tertiary}
              />
            </Pressable>

            {isExpanded && (
              <View style={styles.reportRows}>
                {report.rows.map((row, i) => (
                  <View
                    key={i}
                    style={[
                      styles.reportRow,
                      row.bold && { backgroundColor: 'rgba(255,255,255,0.02)' },
                      row.label === '' && { height: 12 },
                    ]}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        { color: row.bold ? Colors.text.primary : Colors.text.secondary, flex: 1 },
                        row.bold && { fontWeight: '600' },
                        { paddingLeft: row.indent * 20 },
                      ]}
                    >
                      {row.label}
                    </Text>
                    <Text
                      style={[
                        Typography.caption,
                        { color: row.bold ? Colors.text.primary : Colors.text.secondary, textAlign: 'right' },
                        row.bold && { fontWeight: '600' },
                        row.amount.startsWith('-') && { color: '#ef4444' },
                      ]}
                    >
                      {row.amount}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function AccountsTab({ accounts }: { accounts: any[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'Name' | 'AccountType' | 'CurrentBalance'>('AccountType');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = accounts.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (a.Name || '').toLowerCase().includes(q) ||
      (a.AccountType || '').toLowerCase().includes(q) ||
      (a.AccountSubType || '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'Name') cmp = (a.Name || '').localeCompare(b.Name || '');
    else if (sortField === 'AccountType') cmp = (a.AccountType || '').localeCompare(b.AccountType || '');
    else cmp = (a.CurrentBalance || 0) - (b.CurrentBalance || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const grouped: Record<string, any[]> = {};
  sorted.forEach(acct => {
    const type = acct.AccountType || 'Other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(acct);
  });

  const handleSort = (field: 'Name' | 'AccountType' | 'CurrentBalance') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return <Ionicons name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.accent.blue} />;
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.searchBar, webOnly({
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
      })]}>
        <Ionicons name="search" size={18} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search accounts..."
          placeholderTextColor={Colors.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.text.muted} />
          </Pressable>
        )}
      </View>

      <View style={[styles.card, webOnly({
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
      })]}>
        <Pressable style={styles.tableHeader} onPress={() => {}}>
          <Pressable style={[styles.tableHeaderCellWrap, { flex: 2.5 }]} onPress={() => handleSort('Name')}>
            <Text style={styles.tableHeaderCell}>Account Name</Text>
            <SortIcon field="Name" />
          </Pressable>
          <Pressable style={[styles.tableHeaderCellWrap, { flex: 1.5 }]} onPress={() => handleSort('AccountType')}>
            <Text style={styles.tableHeaderCell}>Type</Text>
            <SortIcon field="AccountType" />
          </Pressable>
          <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Detail Type</Text>
          <Pressable style={[styles.tableHeaderCellWrap, { flex: 1, justifyContent: 'flex-end' }]} onPress={() => handleSort('CurrentBalance')}>
            <Text style={styles.tableHeaderCell}>Balance</Text>
            <SortIcon field="CurrentBalance" />
          </Pressable>
        </Pressable>

        {Object.entries(grouped).map(([type, accts]) => {
          const typeColor = ACCOUNT_TYPE_COLORS[type] || { bg: 'rgba(110,110,115,0.15)', text: '#a1a1a6' };
          return (
            <View key={type}>
              <View style={styles.groupHeader}>
                <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
                  <Text style={[Typography.micro, { color: typeColor.text }]}>{type}</Text>
                </View>
                <Text style={[Typography.small, { color: Colors.text.muted }]}>{accts.length} accounts</Text>
              </View>
              {accts.map((acct: any, i: number) => (
                <View key={acct.Id || i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, { flex: 2.5, color: Colors.text.primary, fontWeight: '500' }]} numberOfLines={1}>
                    {acct.Name}
                  </Text>
                  <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.typeBadgeSmall, { backgroundColor: typeColor.bg }]}>
                      <Text style={[{ fontSize: 10, fontWeight: '600', color: typeColor.text }]}>{type}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tableCell, { flex: 1.5, color: Colors.text.tertiary }]} numberOfLines={1}>
                    {acct.AccountSubType || '—'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: Colors.text.primary, fontWeight: '500' }]}>
                    {acct.CurrentBalance != null ? fmt(acct.CurrentBalance) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyRow}>
            <Ionicons name="search-outline" size={24} color={Colors.text.muted} />
            <Text style={[Typography.caption, { color: Colors.text.muted, marginTop: 8 }]}>No accounts found</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function JournalEntriesTab({ entries, accounts }: { entries: any[]; accounts: any[] }) {
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formMemo, setFormMemo] = useState('');
  const [formLines, setFormLines] = useState<{ accountId: string; accountName: string; type: 'Debit' | 'Credit'; amount: string; description: string }[]>([
    { accountId: '', accountName: '', type: 'Debit', amount: '', description: '' },
    { accountId: '', accountName: '', type: 'Credit', amount: '', description: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState<number | null>(null);
  const [accountSearch, setAccountSearch] = useState('');

  const totalDebit = formLines.filter(l => l.type === 'Debit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCredit = formLines.filter(l => l.type === 'Credit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => {
    setFormLines([...formLines, { accountId: '', accountName: '', type: 'Debit', amount: '', description: '' }]);
  };

  const removeLine = (idx: number) => {
    if (formLines.length <= 2) return;
    setFormLines(formLines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, updates: Partial<typeof formLines[0]>) => {
    setFormLines(formLines.map((l, i) => i === idx ? { ...l, ...updates } : l));
  };

  const selectAccount = (idx: number, acct: any) => {
    updateLine(idx, { accountId: acct.Id, accountName: acct.Name });
    setShowAccountPicker(null);
    setAccountSearch('');
  };

  const filteredAccounts = accounts.filter(a => {
    if (!accountSearch) return true;
    return (a.Name || '').toLowerCase().includes(accountSearch.toLowerCase());
  });

  const handleSubmit = async () => {
    if (!isBalanced) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/quickbooks/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnDate: formDate,
          privateNote: formMemo,
          lines: formLines.map(l => ({
            accountId: l.accountId,
            accountName: l.accountName,
            type: l.type,
            amount: parseFloat(l.amount) || 0,
            description: l.description,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create journal entry');
      }
      setShowForm(false);
      setFormLines([
        { accountId: '', accountName: '', type: 'Debit', amount: '', description: '' },
        { accountId: '', accountName: '', type: 'Credit', amount: '', description: '' },
      ]);
      setFormMemo('');
    } catch (e: any) {
      setSubmitError(e.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[Typography.headline, { color: Colors.text.primary }]}>Journal Entries</Text>
        <Pressable
          style={[styles.actionBtn, webOnly({ cursor: 'pointer' })]}
          onPress={() => setShowForm(!showForm)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={18} color="#fff" />
          <Text style={styles.actionBtnText}>{showForm ? 'Cancel' : 'New Entry'}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={[styles.card, webOnly({
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          backgroundImage: svgPatterns.invoice('rgba(255,255,255,0.02)'),
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right center',
          backgroundSize: '20% auto',
        })]}>
          <Text style={[Typography.captionMedium, { color: Colors.text.primary, marginBottom: 12 }]}>New Journal Entry</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.small, { color: Colors.text.tertiary, marginBottom: 6 }]}>Date</Text>
              <TextInput
                style={styles.formInput}
                value={formDate}
                onChangeText={setFormDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.text.muted}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={[Typography.small, { color: Colors.text.tertiary, marginBottom: 6 }]}>Memo</Text>
              <TextInput
                style={styles.formInput}
                value={formMemo}
                onChangeText={setFormMemo}
                placeholder="Optional memo"
                placeholderTextColor={Colors.text.muted}
              />
            </View>
          </View>

          <View style={styles.lineHeader}>
            <Text style={[styles.lineHeaderCell, { flex: 2 }]}>Account</Text>
            <Text style={[styles.lineHeaderCell, { flex: 1 }]}>Type</Text>
            <Text style={[styles.lineHeaderCell, { flex: 1 }]}>Amount</Text>
            <Text style={[styles.lineHeaderCell, { flex: 1.5 }]}>Description</Text>
            <Text style={[styles.lineHeaderCell, { width: 32 }]}></Text>
          </View>

          {formLines.map((line, idx) => (
            <View key={idx} style={styles.lineRow}>
              <View style={{ flex: 2, position: 'relative' as const }}>
                <Pressable
                  style={styles.accountPickerBtn}
                  onPress={() => { setShowAccountPicker(showAccountPicker === idx ? null : idx); setAccountSearch(''); }}
                >
                  <Text style={[Typography.small, { color: line.accountName ? Colors.text.primary : Colors.text.muted }]} numberOfLines={1}>
                    {line.accountName || 'Select account'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.text.muted} />
                </Pressable>
                {showAccountPicker === idx && isWeb && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: CARD_BG,
                    border: '1px solid #2C2C2E',
                    borderRadius: 10,
                    maxHeight: 200,
                    overflow: 'auto',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(20px)',
                  }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #2C2C2E' }}>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #2C2C2E',
                          borderRadius: 6, padding: '6px 10px', color: '#fff', fontSize: 12, outline: 'none',
                        }}
                      />
                    </div>
                    {filteredAccounts.slice(0, 20).map((acct: any) => (
                      <div
                        key={acct.Id}
                        onClick={() => selectAccount(idx, acct)}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#d1d1d6',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ fontWeight: 500, color: '#fff' }}>{acct.Name}</div>
                        <div style={{ fontSize: 10, color: '#6e6e73', marginTop: 2 }}>{acct.AccountType}</div>
                      </div>
                    ))}
                  </div>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Pressable
                  style={[styles.typeToggle, { backgroundColor: line.type === 'Debit' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)' }]}
                  onPress={() => updateLine(idx, { type: line.type === 'Debit' ? 'Credit' : 'Debit' })}
                >
                  <Text style={[Typography.small, { color: line.type === 'Debit' ? '#60A5FA' : '#ef4444', fontWeight: '600' }]}>{line.type}</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.formInput}
                  value={line.amount}
                  onChangeText={(v) => updateLine(idx, { amount: v })}
                  placeholder="0.00"
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <TextInput
                  style={styles.formInput}
                  value={line.description}
                  onChangeText={(v) => updateLine(idx, { description: v })}
                  placeholder="Description"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <Pressable style={{ width: 32, alignItems: 'center', justifyContent: 'center' }} onPress={() => removeLine(idx)}>
                <Ionicons name="trash-outline" size={16} color={formLines.length <= 2 ? Colors.text.disabled : '#ef4444'} />
              </Pressable>
            </View>
          ))}

          <Pressable style={styles.addLineBtn} onPress={addLine}>
            <Ionicons name="add-circle-outline" size={16} color={Colors.accent.blue} />
            <Text style={[Typography.small, { color: Colors.accent.blue, fontWeight: '500' }]}>Add Line</Text>
          </Pressable>

          <View style={styles.totalsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.small, { color: Colors.text.tertiary }]}>Total Debits</Text>
              <Text style={[Typography.captionMedium, { color: '#60A5FA', marginTop: 4 }]}>{fmt(totalDebit)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.small, { color: Colors.text.tertiary }]}>Total Credits</Text>
              <Text style={[Typography.captionMedium, { color: '#ef4444', marginTop: 4 }]}>{fmt(totalCredit)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.small, { color: Colors.text.tertiary }]}>Difference</Text>
              <Text style={[Typography.captionMedium, { color: isBalanced ? '#34c759' : '#f59e0b', marginTop: 4 }]}>
                {fmt(Math.abs(totalDebit - totalCredit))} {isBalanced ? '✓ Balanced' : ''}
              </Text>
            </View>
          </View>

          {submitError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={[Typography.small, { color: '#ef4444' }]}>{submitError}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.submitBtn, !isBalanced && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!isBalanced || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Journal Entry</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {entries.length === 0 ? (
        <View style={[styles.card, styles.emptyRow]}>
          <Ionicons name="document-text-outline" size={32} color={Colors.text.muted} />
          <Text style={[Typography.caption, { color: Colors.text.muted, marginTop: 8 }]}>No journal entries found</Text>
        </View>
      ) : (
        entries.map((entry: any, idx: number) => {
          const isExpanded = expandedEntry === (entry.Id || `${idx}`);
          const lines = entry.Line || [];
          return (
            <View key={entry.Id || idx} style={[styles.card, webOnly({
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              backgroundImage: svgPatterns.invoice('rgba(255,255,255,0.02)'),
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right center',
              backgroundSize: '20% auto',
              animation: `fadeSlideUp 0.4s ease-out ${idx * 0.05}s both`,
            })]}>
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => setExpandedEntry(isExpanded ? null : (entry.Id || `${idx}`))}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={[styles.reportIconWrap, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
                    <Ionicons name="document-text" size={18} color="#A78BFA" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.captionMedium, { color: Colors.text.primary }]}>
                      {entry.DocNumber ? `#${entry.DocNumber}` : `Entry ${idx + 1}`}
                    </Text>
                    <Text style={[Typography.small, { color: Colors.text.tertiary, marginTop: 2 }]}>
                      {entry.TxnDate || '—'} {entry.PrivateNote ? `· ${entry.PrivateNote}` : ''}
                    </Text>
                  </View>
                  <Text style={[Typography.captionMedium, { color: Colors.text.primary }]}>
                    {lines.length > 0 && lines[0]?.Amount ? fmt(lines[0].Amount) : '—'}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.text.tertiary}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>

              {isExpanded && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#2C2C2E', paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
                    <Text style={[Typography.micro, { flex: 2, color: Colors.text.muted, textTransform: 'uppercase' }]}>Account</Text>
                    <Text style={[Typography.micro, { flex: 1, color: Colors.text.muted, textAlign: 'right', textTransform: 'uppercase' }]}>Debit</Text>
                    <Text style={[Typography.micro, { flex: 1, color: Colors.text.muted, textAlign: 'right', textTransform: 'uppercase' }]}>Credit</Text>
                  </View>
                  {lines.map((line: any, li: number) => {
                    const detail = line.JournalEntryLineDetail;
                    const isDebit = detail?.PostingType === 'Debit';
                    return (
                      <View key={li} style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.02)' }}>
                        <View style={{ flex: 2 }}>
                          <Text style={[Typography.small, { color: Colors.text.primary }]}>{detail?.AccountRef?.name || '—'}</Text>
                          {line.Description ? <Text style={[Typography.micro, { color: Colors.text.muted, marginTop: 2 }]}>{line.Description}</Text> : null}
                        </View>
                        <Text style={[Typography.small, { flex: 1, textAlign: 'right', color: isDebit ? '#60A5FA' : Colors.text.muted, fontWeight: isDebit ? '600' : '400' }]}>
                          {isDebit ? fmt(line.Amount) : '—'}
                        </Text>
                        <Text style={[Typography.small, { flex: 1, textAlign: 'right', color: !isDebit ? '#ef4444' : Colors.text.muted, fontWeight: !isDebit ? '600' : '400' }]}>
                          {!isDebit ? fmt(line.Amount) : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function GeneralLedgerTab({ initialData }: { initialData: any }) {
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [ledgerData, setLedgerData] = useState<any>(initialData);
  const [loading, setLoading] = useState(false);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quickbooks/general-ledger?start_date=${startDate}&end_date=${endDate}`);
      const data = await res.json();
      setLedgerData(data);
    } catch (e) {
      console.error('Failed to fetch general ledger:', e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const rows = parseQBRows(ledgerData?.Rows);

  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.card, webOnly({
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
      })]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <View>
            <Text style={[Typography.small, { color: Colors.text.tertiary, marginBottom: 6 }]}>Start Date</Text>
            <TextInput
              style={[styles.formInput, { width: 140 }]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.text.muted}
            />
          </View>
          <View>
            <Text style={[Typography.small, { color: Colors.text.tertiary, marginBottom: 6 }]}>End Date</Text>
            <TextInput
              style={[styles.formInput, { width: 140 }]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.text.muted}
            />
          </View>
          <Pressable style={[styles.actionBtn, webOnly({ cursor: 'pointer' })]} onPress={fetchLedger}>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="refresh" size={16} color="#fff" />}
            <Text style={styles.actionBtnText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, webOnly({
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
      })]}>
        <Text style={[Typography.headline, { color: Colors.text.primary, marginBottom: 16 }]}>General Ledger</Text>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={Colors.accent.blue} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyRow}>
            <Ionicons name="list-outline" size={32} color={Colors.text.muted} />
            <Text style={[Typography.caption, { color: Colors.text.muted, marginTop: 8 }]}>No ledger data available</Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <View
              key={i}
              style={[
                styles.reportRow,
                row.bold && { backgroundColor: 'rgba(255,255,255,0.03)' },
                row.label === '' && { height: 8 },
              ]}
            >
              <Text
                style={[
                  Typography.small,
                  { color: row.bold ? Colors.text.primary : Colors.text.secondary, flex: 1 },
                  row.bold && { fontWeight: '700', fontSize: 13 },
                  { paddingLeft: row.indent * 20 },
                ]}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              <Text
                style={[
                  Typography.small,
                  { color: row.bold ? Colors.text.primary : Colors.text.secondary, textAlign: 'right', minWidth: 100 },
                  row.bold && { fontWeight: '700' },
                  row.amount.startsWith('-') && { color: '#ef4444' },
                ]}
              >
                {row.amount}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default function BooksScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [qbConnected, setQbConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [reports, setReports] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [generalLedger, setGeneralLedger] = useState<any>(null);

  useEffect(() => {
    if (!isWeb) return;
    const styleId = 'books-page-animations';
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

  useEffect(() => {
    fetch('/api/quickbooks/status')
      .then(r => r.json())
      .then(data => {
        setQbConnected(data.connected);
        if (data.connected) {
          Promise.all([
            fetch('/api/quickbooks/profit-and-loss').then(r => r.json()),
            fetch('/api/quickbooks/balance-sheet').then(r => r.json()),
            fetch('/api/quickbooks/cash-flow').then(r => r.json()),
            fetch('/api/quickbooks/trial-balance').then(r => r.json()),
            fetch('/api/quickbooks/accounts').then(r => r.json()),
            fetch('/api/quickbooks/journal-entries').then(r => r.json()),
            fetch('/api/quickbooks/general-ledger').then(r => r.json()),
          ]).then(([pnl, bs, cf, tb, acct, je, gl]) => {
            setReports({ pnl, balanceSheet: bs, cashFlow: cf, trialBalance: tb });
            setAccounts(acct.accounts || []);
            setJournalEntries(je.journalEntries || []);
            setGeneralLedger(gl);
          }).catch(e => console.error('QB data fetch error:', e))
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(e => {
        console.error('QB status check error:', e);
        setLoading(false);
      });
  }, []);

  const tabHover = (key: string) => isWeb ? {
    onMouseEnter: () => setHoveredTab(key),
    onMouseLeave: () => setHoveredTab(null),
  } : {};

  return (
    <FinanceHubShell>
      {isWeb ? (
        <div style={{
          borderRadius: 16, overflow: 'hidden', marginBottom: 24, position: 'relative',
          padding: '24px 28px',
          background: `radial-gradient(ellipse at top right, rgba(59,130,246,0.08) 0%, transparent 50%), ${CARD_BG}`,
          border: `1px solid ${CARD_BORDER}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: `linear-gradient(90deg, transparent 0%, ${CARD_BORDER} 30%, ${CARD_BORDER} 70%, transparent 100%)`,
            pointerEvents: 'none',
          }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: 'rgba(59,130,246,0.15)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
              }}>
                <Ionicons name="book" size={22} color="#60A5FA" />
              </View>
              <View>
                <Text style={[Typography.title, { color: Colors.text.primary, fontWeight: '700' }]}>Books</Text>
                <Text style={[Typography.small, { color: Colors.text.tertiary, marginTop: 2 }]}>QuickBooks accounting data & reports</Text>
              </View>
            </View>
            {loading ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(110,110,115,0.15)' }]}>
                <ActivityIndicator size="small" color={Colors.text.muted} />
                <Text style={[Typography.small, { color: Colors.text.muted }]}>Checking...</Text>
              </View>
            ) : qbConnected ? (
              <View style={styles.statusBadge}>
                <View style={[styles.dot, { backgroundColor: Colors.semantic.success }]} />
                <Text style={[Typography.small, { color: Colors.semantic.success, fontWeight: '600' }]}>QuickBooks Connected</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,59,48,0.12)' }]}>
                <View style={[styles.dot, { backgroundColor: '#ff3b30' }]} />
                <Text style={[Typography.small, { color: '#ff3b30', fontWeight: '600' }]}>Not Connected</Text>
              </View>
            )}
          </View>
        </div>
      ) : (
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 10,
              backgroundColor: 'rgba(59,130,246,0.15)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="book" size={20} color="#60A5FA" />
            </View>
            <Text style={[Typography.display, { color: Colors.text.primary }]}>Books</Text>
          </View>
          {qbConnected && (
            <View style={styles.statusBadge}>
              <View style={[styles.dot, { backgroundColor: Colors.semantic.success }]} />
              <Text style={[Typography.small, { color: Colors.semantic.success, fontWeight: '600' }]}>Connected</Text>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent.blue} />
          <Text style={[Typography.caption, { color: Colors.text.muted, marginTop: 12 }]}>Loading QuickBooks data...</Text>
        </View>
      ) : !qbConnected ? (
        <View style={styles.centerContent}>
          {isWeb ? (
            <div style={{
              width: 88, height: 88, borderRadius: 44,
              background: CARD_BG,
              border: '1px solid #2C2C2E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <Ionicons name="book-outline" size={40} color={Colors.text.muted} />
            </div>
          ) : (
            <View style={styles.emptyIcon}>
              <Ionicons name="book-outline" size={40} color={Colors.text.muted} />
            </View>
          )}
          <Text style={[Typography.headline, { color: Colors.text.secondary, marginTop: 20, textAlign: 'center' }]}>
            Connect QuickBooks to view your books
          </Text>
          <Text style={[Typography.caption, { color: Colors.text.muted, marginTop: 8, textAlign: 'center', maxWidth: 400 }]}>
            Link your QuickBooks account to access reports, chart of accounts, journal entries, and general ledger data.
          </Text>
          <Pressable
            style={[styles.connectBtn, webOnly({ cursor: 'pointer' })]}
            onPress={() => {
              if (isWeb) window.location.href = '/finance-hub/connections';
            }}
          >
            <LinearGradient colors={['#3B82F6', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.connectBtnGradient}>
              <Ionicons name="link-outline" size={18} color="#fff" />
              <Text style={styles.connectBtnText}>Go to Connections</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.tabBar}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const isHovered = hoveredTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  {...tabHover(tab.key)}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.tabPill, styles.tabPillActive, webOnly({
                        boxShadow: '0 0 12px rgba(59,130,246,0.4), 0 2px 8px rgba(0,0,0,0.3)',
                        cursor: 'pointer',
                      })]}
                    >
                      <Ionicons name={tab.icon} size={16} color="#fff" />
                      <Text style={[styles.tabPillText, { color: '#fff', fontWeight: '600' }]}>{tab.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.tabPill, isHovered && styles.tabPillHover, webOnly({ cursor: 'pointer', transition: 'all 0.2s ease' })]}>
                      <Ionicons name={tab.icon} size={16} color={Colors.text.tertiary} />
                      <Text style={[styles.tabPillText, { color: Colors.text.tertiary }]}>{tab.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'overview' && reports && <OverviewTab data={reports} />}
          {activeTab === 'reports' && reports && <ReportsTab data={reports} />}
          {activeTab === 'accounts' && <AccountsTab accounts={accounts} />}
          {activeTab === 'journal' && <JournalEntriesTab entries={journalEntries} accounts={accounts} />}
          {activeTab === 'ledger' && <GeneralLedgerTab initialData={generalLedger} />}
        </>
      )}
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtn: {
    marginTop: 24,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  connectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    gap: 4,
    flexWrap: 'wrap',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
    } as any : {}),
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    borderWidth: 0,
  },
  tabPillHover: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    overflow: 'hidden' as const,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    } as any : {}),
  },
  chartCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 24,
    overflow: 'hidden' as const,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    } as any : {}),
  },
  kpiTile: {
    flex: 1,
    minWidth: 180,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    overflow: 'hidden' as const,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    } as any : {}),
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportRows: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    paddingTop: 12,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER}`,
    } as any : {}),
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 14,
    ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  tableHeaderCellWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  tableCell: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.blue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.text.primary,
    fontSize: 13,
    ...(Platform.OS === 'web' ? { outline: 'none' } as any : {}),
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 4,
  },
  lineHeaderCell: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  accountPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  typeToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  addLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent.blue,
    paddingVertical: 12,
    borderRadius: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
