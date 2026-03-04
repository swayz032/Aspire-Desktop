export interface Feature {
  id: string;
  eyebrow: string;
  title: string;
  description1: string;
  description2: string;
  cta: string;
  ctaHref: string;
  accent: string;
  accentLight: string;
  icon: string;
}

export const features: Feature[] = [
  {
    id: 'canvas',
    eyebrow: 'Command Center',
    title: 'Your entire business on one surface.',
    description1:
      'The Aspire Canvas is a drag-and-drop workspace where every part of your business lives together. Finance, communications, approvals, schedules — all on one intelligent surface.',
    description2:
      'Arrange widgets your way. Pin what matters. Aspire learns your workflow and surfaces what needs attention before you have to ask.',
    cta: 'Explore Canvas',
    ctaHref: '/login',
    accent: '#3B82F6',
    accentLight: 'rgba(59,130,246,0.12)',
    icon: '⬡',
  },
  {
    id: 'ai-staff',
    eyebrow: 'AI Executive Team',
    title: 'Employees that never clock out.',
    description1:
      'Ava runs your operations. Eli manages your finances. Finn handles your front desk. Your AI staff team works 24/7 — handling calls, drafting contracts, approving invoices, and briefing you daily.',
    description2:
      'Each AI staff member has a specialized role, a distinct personality, and real access to your business data. They don\'t just answer questions — they take action.',
    cta: 'Meet the Team',
    ctaHref: '#meet-the-team',
    accent: '#9333EA',
    accentLight: 'rgba(147,51,234,0.12)',
    icon: '◈',
  },
  {
    id: 'finance',
    eyebrow: 'Finance Hub',
    title: 'Total financial clarity, zero effort.',
    description1:
      'Real-time cash position, inflows, outflows, receivables, and payables — all visible at a glance. Aspire connects to your bank accounts via Plaid and syncs with QuickBooks automatically.',
    description2:
      'Eli, your AI CFO, monitors every transaction, flags anomalies, generates reports, and can brief you each morning on your financial health.',
    cta: 'See Finance Hub',
    ctaHref: '/login',
    accent: '#10B981',
    accentLight: 'rgba(16,185,129,0.12)',
    icon: '◆',
  },
  {
    id: 'authority',
    eyebrow: 'Governed Execution',
    title: 'You approve. Aspire executes.',
    description1:
      'Every AI-generated action — invoices, contracts, payments, outbound communications — goes through the Authority Queue before it happens. You stay in control without doing the work.',
    description2:
      'Risk-tiered cards (green, yellow, red) surface what needs your attention. One tap to approve, one tap to deny, with a full audit trail for compliance.',
    cta: 'Learn about Governance',
    ctaHref: '/login',
    accent: '#F97316',
    accentLight: 'rgba(249,115,22,0.12)',
    icon: '◉',
  },
  {
    id: 'frontdesk',
    eyebrow: 'Front Desk & Scheduling',
    title: 'Your office never misses a beat.',
    description1:
      'Aspire\'s AI front desk answers calls, qualifies leads, schedules meetings, and sends follow-ups — all without you lifting a finger. Public booking pages handle client scheduling automatically.',
    description2:
      'Conference calls, team meetings, and client sessions are all managed in one place. Aspire sends reminders, joins calls on your behalf, and takes notes.',
    cta: 'See Front Desk',
    ctaHref: '/login',
    accent: '#06B6D4',
    accentLight: 'rgba(6,182,212,0.12)',
    icon: '⬤',
  },
  {
    id: 'contracts',
    eyebrow: 'Contracts & eSign',
    title: 'Close deals without the paperwork drag.',
    description1:
      'Aspire drafts contracts, proposals, and service agreements from your business data. Send for eSign with PandaDoc integration and track signature status in real time.',
    description2:
      'Quotes become invoices. Contracts become recurring payments. The entire deal lifecycle lives in Aspire — start to signed to paid.',
    cta: 'See Contracts',
    ctaHref: '/login',
    accent: '#8B5CF6',
    accentLight: 'rgba(139,92,246,0.12)',
    icon: '⬡',
  },
];
