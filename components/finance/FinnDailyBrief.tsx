import React from 'react';
import { Platform } from 'react-native';
import type { StoryModeId } from './StoryModeCarousel';

const FINN_INSIGHTS: Record<StoryModeId, { quote: string; context: string }> = {
  'cash-truth': {
    quote: 'Cash position is strong — runway looks comfortable through Q2.',
    context: 'Based on current burn rate and projected inflows.',
  },
  'what-changed': {
    quote: 'Revenue up 12% vs last month. Expenses held steady.',
    context: 'Biggest driver: new client onboarding in week 2.',
  },
  'invoice-pressure': {
    quote: 'Three invoices aging past 30 days. Follow-up recommended.',
    context: 'Total outstanding: $14,200 across 2 clients.',
  },
  'tax-review': {
    quote: 'Q1 tax reserve is on track. No adjustments needed yet.',
    context: 'Estimated liability aligns with current withholdings.',
  },
  'cleanup-sprint': {
    quote: 'Four unmatched transactions found this week.',
    context: 'Most are sub-$50 charges — likely subscriptions.',
  },
  'books-vs-bank': {
    quote: 'Books and bank are within $120 delta. Nearly reconciled.',
    context: 'One pending deposit still clearing.',
  },
  'money-memory': {
    quote: 'December was your highest cash month. Pattern repeats annually.',
    context: 'Seasonal revenue spike from holiday contracts.',
  },
};

interface Props {
  activeMode: StoryModeId;
  accentColor: string;
  onAskFinn?: () => void;
}

export function FinnDailyBrief({ activeMode, accentColor, onAskFinn }: Props) {
  if (Platform.OS !== 'web') return null;

  const insight = FINN_INSIGHTS[activeMode] ?? FINN_INSIGHTS['cash-truth'];

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `2px solid ${accentColor}`,
      background: '#0A0A0F',
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: `radial-gradient(circle, ${accentColor}30, ${accentColor}10)`,
          border: `1.5px solid ${accentColor}50`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88)`,
          }} />
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: 1,
          textTransform: 'uppercase' as const,
        }}>
          FINN&apos;S DAILY BRIEF
        </div>
      </div>
      <div style={{
        color: '#fff',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '20px',
        marginBottom: 6,
      }}>
        {insight.quote}
      </div>
      <div style={{
        color: 'rgba(255,255,255,0.35)',
        fontSize: 11,
        fontWeight: 400,
        fontStyle: 'italic',
        lineHeight: '16px',
        marginBottom: 12,
        flex: 1,
      }}>
        {insight.context}
      </div>
      <div
        onClick={onAskFinn}
        style={{
          color: accentColor,
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.7'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
      >
        Ask Finn →
      </div>
    </div>
  );
}
