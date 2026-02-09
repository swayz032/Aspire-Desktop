import { 
  Tenant, 
  AuthorityItem, 
  DocumentPreview, 
  Receipt, 
  StaffRole, 
  Session,
  CashPosition,
  PipelineStage,
  InteractionModeOption,
  ConnectedAccount,
  ReserveAccount,
  AllocationSuggestion,
  RecentInflow,
  FinanceReceipt,
  BusinessScore
} from '@/types';

export const mockTenant: Tenant = {
  id: 'tnt_zenith_001',
  createdAt: '2024-01-15T08:00:00Z',
  updatedAt: '2024-01-15T08:00:00Z',
  businessName: 'Zenith Solutions',
  suiteId: 'ZEN-014',
  officeId: 'O-1029',
  ownerName: 'Marcus Chen',
  ownerEmail: 'founder@zenithsolutions.com',
  role: 'Founder',
  timezone: 'America/Los_Angeles',
  currency: 'USD',
};

export const mockInteractionModes: InteractionModeOption[] = [
  {
    id: 'voice',
    icon: 'mic',
    title: 'Voice with Ava',
    subtitle: 'Receipted',
    route: '/session/voice',
  },
  {
    id: 'video',
    icon: 'videocam',
    title: 'Video with Ava',
    subtitle: 'Receipted',
    route: '/session/video',
  },
  {
    id: 'conference',
    icon: 'people',
    title: 'Conference Call',
    subtitle: 'Multi-party business calls • Ava for every participant',
    route: '/session/conference-lobby',
  },
  {
    id: 'calls',
    icon: 'call',
    title: 'Return Calls',
    subtitle: 'Creates receipt • Requires approval',
    route: '/session/calls',
    badge: 3,
  },
];

export const mockCashPosition: CashPosition = {
  availableCash: 47250.00,
  upcomingOutflows7d: 12400.00,
  expectedInflows7d: 28900.00,
  accountsConnected: 2,
};

export const mockConnectedAccounts: ConnectedAccount[] = [
  {
    id: 'acc_001',
    name: 'Business Checking',
    type: 'checking',
    last4: '4821',
    balance: 47250.00,
    availableBalance: 45120.00,
    institution: 'Chase',
    color: '#4facfe',
  },
  {
    id: 'acc_002',
    name: 'Business Savings',
    type: 'savings',
    last4: '7734',
    balance: 28500.00,
    availableBalance: 28500.00,
    institution: 'Chase',
    color: '#34c759',
  },
  {
    id: 'acc_003',
    name: 'Tax Reserve',
    type: 'savings',
    last4: '9102',
    balance: 15200.00,
    availableBalance: 15200.00,
    institution: 'Mercury',
    color: '#ff9500',
  },
  {
    id: 'acc_004',
    name: 'Operating Credit',
    type: 'credit',
    last4: '5567',
    balance: -2340.00,
    availableBalance: 47660.00,
    institution: 'Brex',
    color: '#af52de',
  },
];

export const mockReserveAccounts: ReserveAccount[] = [
  {
    id: 'res_001',
    name: 'Tax Reserve',
    icon: 'receipt',
    targetPercent: 30,
    currentAmount: 15200.00,
    targetAmount: 22875.00,
    color: '#ff9500',
    status: 'low',
  },
  {
    id: 'res_002',
    name: 'Operating Expenses',
    icon: 'briefcase',
    targetPercent: 20,
    currentAmount: 12400.00,
    targetAmount: 15250.00,
    color: '#4facfe',
    status: 'healthy',
  },
  {
    id: 'res_003',
    name: 'Emergency Fund',
    icon: 'shield-checkmark',
    targetPercent: 15,
    currentAmount: 8500.00,
    targetAmount: 11437.50,
    color: '#34c759',
    status: 'low',
  },
  {
    id: 'res_004',
    name: "Owner's Draw",
    icon: 'wallet',
    targetPercent: 10,
    currentAmount: 7625.00,
    targetAmount: 7625.00,
    color: '#af52de',
    status: 'healthy',
  },
];

export const mockAllocationSuggestions: AllocationSuggestion[] = [
  {
    id: 'sug_001',
    triggerEvent: 'Invoice #38421 paid by Apex Corp',
    triggerAmount: 4200.00,
    suggestedAmount: 1260.00,
    suggestedPercent: 30,
    destinationAccount: 'Tax Reserve',
    destinationId: 'res_001',
    reasoning: 'Based on your 30% tax allocation rule, I recommend setting aside $1,260 for quarterly taxes.',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: 'pending',
    staffRole: 'Quinn',
  },
  {
    id: 'sug_002',
    triggerEvent: 'Weekly revenue exceeded $10,000',
    triggerAmount: 12850.00,
    suggestedAmount: 1285.00,
    suggestedPercent: 10,
    destinationAccount: 'Emergency Fund',
    destinationId: 'res_003',
    reasoning: 'Your emergency fund is below target. Allocating 10% of weekly revenue will help reach your 3-month runway goal.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: 'pending',
    staffRole: 'Quinn',
  },
  {
    id: 'sug_003',
    triggerEvent: 'Invoice #38398 paid by BlueSky Inc',
    triggerAmount: 2850.00,
    suggestedAmount: 855.00,
    suggestedPercent: 30,
    destinationAccount: 'Tax Reserve',
    destinationId: 'res_001',
    reasoning: 'Standard tax allocation for received payment.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: 'pending',
    staffRole: 'Quinn',
  },
];

export const mockRecentInflows: RecentInflow[] = [
  {
    id: 'inflow_001',
    payer: 'Apex Corp',
    payerInitials: 'AC',
    amount: 4200.00,
    invoiceNumber: '#38421',
    paidAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    allocationStatus: 'pending',
  },
  {
    id: 'inflow_002',
    payer: 'BlueSky Inc',
    payerInitials: 'BI',
    amount: 2850.00,
    invoiceNumber: '#38398',
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    allocationStatus: 'pending',
  },
  {
    id: 'inflow_003',
    payer: 'Cedar Holdings',
    payerInitials: 'CH',
    amount: 6100.00,
    invoiceNumber: '#38445',
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    allocationStatus: 'allocated',
    allocatedAmount: 6100.00,
  },
  {
    id: 'inflow_004',
    payer: 'Delta Partners',
    payerInitials: 'DP',
    amount: 8500.00,
    invoiceNumber: '#38402',
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    allocationStatus: 'allocated',
    allocatedAmount: 8500.00,
  },
  {
    id: 'inflow_005',
    payer: 'Echo Ventures',
    payerInitials: 'EV',
    amount: 3200.00,
    invoiceNumber: '#38389',
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    allocationStatus: 'partial',
    allocatedAmount: 1600.00,
  },
];

export const mockFinanceReceipts: FinanceReceipt[] = [
  {
    id: 'frcp_001',
    type: 'success',
    action: 'Transfer to Tax Reserve',
    amount: 1830.00,
    source: 'Business Checking',
    destination: 'Tax Reserve',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actor: 'Quinn',
  },
  {
    id: 'frcp_002',
    type: 'allow',
    action: 'Allocation approved',
    amount: 2550.00,
    destination: 'Emergency Fund',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    actor: 'You',
  },
  {
    id: 'frcp_003',
    type: 'success',
    action: 'Owner draw processed',
    amount: 5000.00,
    source: 'Business Checking',
    destination: "Owner's Draw",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    actor: 'System',
  },
  {
    id: 'frcp_004',
    type: 'deny',
    action: 'Transfer blocked - insufficient funds',
    amount: 8000.00,
    destination: 'Tax Reserve',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    actor: 'System',
  },
  {
    id: 'frcp_005',
    type: 'success',
    action: 'Account sync completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    actor: 'Sequence',
  },
  {
    id: 'frcp_006',
    type: 'allow',
    action: 'Rule trigger approved',
    amount: 3200.00,
    destination: 'Operating Expenses',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    actor: 'You',
  },
];

export const mockPipelineStages: PipelineStage[] = [
  { name: 'Leads', count: 24, target: 30, trend: 'up' },
  { name: 'Follow-ups', count: 12, target: 15, trend: 'flat' },
  { name: 'Calls', count: 8, target: 10, trend: 'up' },
  { name: 'Proposals', count: 5, target: 8, trend: 'down' },
  { name: 'Invoices', count: 3, target: 5, trend: 'up' },
  { name: 'Paid', count: 2, target: 4, trend: 'flat' },
];

export const mockBusinessScore: BusinessScore = {
  overallScore: 74,
  maxScore: 100,
  trend: 'up',
  trendValue: 8,
  lastUpdated: new Date().toISOString(),
  potentialRevenue: 285000,
  currentRevenue: 142500,
  categories: [
    {
      id: 'financial',
      name: 'Financial Health',
      score: 82,
      maxScore: 100,
      trend: 'up',
      icon: 'wallet',
      color: '#4facfe',
      staffOwner: 'Quinn',
      skillPack: 'Invoice & Quote Desk',
      impactItems: [
        { id: 'fi_1', title: '3 invoices overdue (30+ days)', impact: -8, action: 'Send Stripe reminders', urgent: true },
        { id: 'fi_2', title: 'Quote pending approval', impact: -3, action: 'Review & send', urgent: false },
        { id: 'fi_3', title: 'Payment webhook failed', impact: -5, action: 'Retry sync', urgent: true },
      ],
    },
    {
      id: 'operational',
      name: 'Ops Efficiency',
      score: 71,
      maxScore: 100,
      trend: 'up',
      icon: 'flash',
      color: '#34c759',
      staffOwner: 'Eli',
      skillPack: 'Inbox Specialist',
      impactItems: [
        { id: 'op_1', title: '14 emails awaiting response', impact: -12, action: 'Review Gmail drafts', urgent: true },
        { id: 'op_2', title: '3 threads need summarizing', impact: -8, action: 'Approve summaries', urgent: true },
        { id: 'op_3', title: 'Follow-up tasks queued', impact: -4, action: 'Review queue', urgent: false },
      ],
    },
    {
      id: 'pipeline',
      name: 'Pipeline Health',
      score: 68,
      maxScore: 100,
      trend: 'down',
      icon: 'trending-up',
      color: '#00c7be',
      staffOwner: 'Piper',
      skillPack: 'Pipeline Assistant',
      impactItems: [
        { id: 'pi_1', title: '5 deals stalled 2+ weeks', impact: -15, action: 'Draft outreach', urgent: true },
        { id: 'pi_2', title: '3 leads need qualification', impact: -8, action: 'Schedule follow-up', urgent: true },
        { id: 'pi_3', title: 'Pipeline stage outdated', impact: -6, action: 'Update stages', urgent: false },
      ],
    },
    {
      id: 'support',
      name: 'Call Support',
      score: 76,
      maxScore: 100,
      trend: 'up',
      icon: 'call',
      color: '#ff9500',
      staffOwner: 'Clara',
      skillPack: 'Support Switchboard',
      impactItems: [
        { id: 'cs_1', title: '2 missed calls need callback', impact: -10, action: 'Return calls', urgent: true },
        { id: 'cs_2', title: 'Voicemail transcription pending', impact: -5, action: 'Review notes', urgent: false },
        { id: 'cs_3', title: 'Escalation awaiting response', impact: -8, action: 'Triage issue', urgent: true },
      ],
    },
  ],
  insights: [
    {
      id: 'insight_001',
      title: 'Invoice velocity improving',
      description: 'Your average days-to-pay decreased from 34 to 28 days this month. Keep it up.',
      impact: 'high',
      category: 'financial',
      action: 'View AR Report',
    },
    {
      id: 'insight_002',
      title: 'Pipeline bottleneck detected',
      description: 'Proposals stage has 5 deals stalled for 2+ weeks. Consider follow-up outreach.',
      impact: 'medium',
      category: 'pipeline',
      action: 'Review Proposals',
    },
    {
      id: 'insight_003',
      title: 'Revenue potential unlocked',
      description: 'Based on your industry and current trajectory, you could reach $285K ARR within 6 months.',
      impact: 'high',
      category: 'potential',
    },
  ],
  hiddenOpportunities: [
    {
      id: 'opp_001',
      title: 'Unbilled work from December',
      description: '3 clients have completed projects without invoices',
      dollarValue: 8400,
      type: 'unbilled',
      staffOwner: 'Quinn',
      action: 'Create Invoices',
      daysOld: 45,
    },
    {
      id: 'opp_002',
      title: 'Overdue invoices need follow-up',
      description: 'Outstanding payments past 30 days',
      dollarValue: 12400,
      type: 'overdue',
      staffOwner: 'Quinn',
      action: 'Send Reminders',
      daysOld: 34,
      clientName: 'Multiple clients',
    },
    {
      id: 'opp_003',
      title: 'Expired quotes not followed up',
      description: '2 quotes expired without client response',
      dollarValue: 15200,
      type: 'expired_quote',
      staffOwner: 'Piper',
      action: 'Re-engage Leads',
      daysOld: 21,
    },
    {
      id: 'opp_004',
      title: 'Upsell opportunity with Acme Corp',
      description: 'Client mentioned expansion plans in last call',
      dollarValue: 24000,
      type: 'upsell',
      staffOwner: 'Piper',
      action: 'Schedule Call',
      clientName: 'Acme Corp',
    },
  ],
  efficiencyWins: [
    {
      id: 'eff_001',
      title: 'Email management',
      currentHoursPerWeek: 12,
      potentialSavingsHours: 9.6,
      automationPercent: 80,
      staffOwner: 'Eli',
      action: 'Enable Eli',
    },
    {
      id: 'eff_002',
      title: 'Invoice creation & follow-up',
      currentHoursPerWeek: 6,
      potentialSavingsHours: 4.8,
      automationPercent: 80,
      staffOwner: 'Quinn',
      action: 'Enable Quinn',
    },
    {
      id: 'eff_003',
      title: 'Call handling & scheduling',
      currentHoursPerWeek: 8,
      potentialSavingsHours: 5.6,
      automationPercent: 70,
      staffOwner: 'Clara',
      action: 'Enable Clara',
    },
  ],
  benchmarks: [
    {
      id: 'bench_001',
      name: 'Invoice collection time',
      userValue: 45,
      industryAverage: 30,
      topPerformers: 21,
      unit: 'days',
      trend: 'down',
      action: 'Automate reminders',
    },
    {
      id: 'bench_002',
      name: 'Email response time',
      userValue: 8,
      industryAverage: 4,
      topPerformers: 2,
      unit: 'hours',
      trend: 'flat',
      action: 'Enable auto-drafts',
    },
    {
      id: 'bench_003',
      name: 'Pipeline close rate',
      userValue: 18,
      industryAverage: 24,
      topPerformers: 32,
      unit: '%',
      trend: 'up',
      action: 'Review lost deals',
    },
    {
      id: 'bench_004',
      name: 'Lead follow-up speed',
      userValue: 24,
      industryAverage: 12,
      topPerformers: 4,
      unit: 'hours',
      trend: 'down',
      action: 'Enable auto-outreach',
    },
  ],
  growthForecast: {
    currentMonthlyRevenue: 47500,
    projectedMonthlyRevenue: 100000,
    projectedDate: 'April 2026',
    pipelineValue: 142000,
    dealsToClose: 8,
    momentum: 18,
    scenarios: [
      {
        id: 'scenario_001',
        condition: 'Close 5 stalled proposals',
        result: 'Add $42k this quarter',
        dollarImpact: 42000,
        action: 'Draft follow-ups',
      },
      {
        id: 'scenario_002',
        condition: 'Collect overdue invoices',
        result: 'Recover $12.4k by Friday',
        dollarImpact: 12400,
        action: 'Send reminders',
      },
      {
        id: 'scenario_003',
        condition: 'Re-engage expired quotes',
        result: 'Potential $15.2k revenue',
        dollarImpact: 15200,
        action: 'Reach out now',
      },
    ],
  },
  cumulativeValue: {
    totalRevenueSaved: 34200,
    totalHoursSaved: 82,
    daysSinceOnboarding: 45,
    capabilitiesUnlocked: ['Invoice Automation', 'Email Drafts', 'Call Summaries', 'Pipeline Tracking'],
    weeklyStreak: 5,
    lastVisitDelta: {
      revenueCollected: 4200,
      emailsCleared: 12,
      callsHandled: 3,
      approvalsCompleted: 7,
    },
  },
  recentActivity: [
    {
      id: 'activity_001',
      action: 'Invoice payment collected',
      description: 'Acme Corp - $2,400',
      staffOwner: 'Quinn',
      timestamp: '2 hours ago',
      type: 'revenue',
    },
    {
      id: 'activity_002',
      action: 'Meeting scheduled',
      description: 'Client call with Zenith Labs',
      staffOwner: 'Clara',
      timestamp: '4 hours ago',
      type: 'scheduling',
    },
    {
      id: 'activity_003',
      action: 'Follow-up email sent',
      description: 'Proposal reminder to TechFlow Inc',
      staffOwner: 'Eli',
      timestamp: '6 hours ago',
      type: 'communication',
    },
    {
      id: 'activity_004',
      action: 'Invoice reminder sent',
      description: '3 overdue payment reminders',
      staffOwner: 'Quinn',
      timestamp: 'Yesterday',
      type: 'revenue',
    },
    {
      id: 'activity_005',
      action: 'Call summary generated',
      description: 'Vendor negotiation with Marcus Chen',
      staffOwner: 'Clara',
      timestamp: 'Yesterday',
      type: 'documentation',
    },
  ],
};

export const mockAuthorityQueue: AuthorityItem[] = [
  {
    id: 'auth_001',
    title: 'Session: Vendor Negotiation — Zenith',
    subtitle: 'Suite ZEN-014 • Host: Office O-1011',
    type: 'session',
    status: 'live',
    priority: 'high',
    timestamp: new Date().toISOString(),
    thumbnailUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=400',
    actions: ['join'],
    staffRole: 'Nora',
    documentPreview: {
      type: 'meeting',
      content: 'Vendor Contract Renewal Discussion\n\nAgenda:\n• Review current pricing terms ($4,200/mo)\n• Discuss volume discount (15% proposed)\n• Negotiate payment terms (Net-30 to Net-45)\n• SLA requirements update',
      metadata: {
        participants: ['Marcus Chen (Vendor)', 'Ava (Host)', 'You'],
        duration: '15 min elapsed',
      }
    }
  },
  {
    id: 'auth_002',
    title: 'Review Invoice — Delta Partners',
    subtitle: 'Accounts Payable • Due in 39 days',
    type: 'invoice',
    status: 'pending',
    priority: 'medium',
    timestamp: new Date().toISOString(),
    dueDate: '2026-02-20',
    documentType: 'pdf',
    actions: ['review', 'approve', 'defer'],
    staffRole: 'Quinn',
    documentPreview: {
      type: 'invoice',
      content: 'INVOICE #38437\n\nFrom: Delta Partners LLC\nTo: Zenith Solutions\n\nServices Rendered:\nConsulting Services (Jan 2026).....$8,500.00\nProject Management Fee................$1,200.00\nExpenses & Materials......................$847.50\n\nSubtotal: $10,547.50\nTax (8.25%): $870.17\n\nTOTAL DUE: $11,417.67\n\nPayment Terms: Net-30\nDue Date: February 20, 2026',
      metadata: {
        vendor: 'Delta Partners LLC',
        amount: '$11,417.67',
        dueDate: 'Feb 20, 2026',
      }
    }
  },
  {
    id: 'auth_003',
    title: 'NDA Review — Zenith Solutions',
    subtitle: 'Draft ready • Approval required',
    type: 'contract',
    status: 'pending',
    priority: 'high',
    timestamp: new Date().toISOString(),
    documentType: 'pdf',
    actions: ['review', 'approve', 'deny'],
    staffRole: 'Cole',
    documentPreview: {
      type: 'contract',
      content: 'MUTUAL NON-DISCLOSURE AGREEMENT\n\nThis Agreement is entered into as of January 11, 2026\n\nBETWEEN:\nZenith Solutions ("Disclosing Party")\nAND:\nAcme Technologies Inc. ("Receiving Party")\n\n1. CONFIDENTIAL INFORMATION\nAll proprietary data, trade secrets, business strategies, client lists, and technical specifications shared during the partnership evaluation period.\n\n2. TERM\nThis Agreement shall remain in effect for a period of two (2) years from the Effective Date.\n\n3. OBLIGATIONS\nThe Receiving Party agrees to maintain confidentiality...',
      metadata: {
        counterparty: 'Acme Technologies Inc.',
        term: '2 years',
        preparedBy: 'Cole (Contracts Specialist)',
      }
    }
  },
];

export const mockTodaysPlan = [
  {
    id: 'plan_001',
    time: '10:00–10:30 AM',
    action: 'Send payment reminders to 3 clients',
    details: 'Emails drafted by Quinn for: Apex Corp ($4,200), BlueSky Inc ($2,850), Cedar Holdings ($6,100)',
    status: 'next',
    staffRole: 'Quinn',
    documents: [
      { 
        name: 'Apex Corp - Invoice #38421', 
        type: 'invoice',
        amount: '$4,200.00', 
        daysOverdue: 5,
        preview: 'Professional Services - Q4 2025 Consulting\nNet-30 payment terms exceeded',
        contactName: 'Jennifer Walsh',
        contactEmail: 'j.walsh@apexcorp.com'
      },
      { 
        name: 'BlueSky Inc - Invoice #38398', 
        type: 'invoice',
        amount: '$2,850.00', 
        daysOverdue: 12,
        preview: 'Software License Renewal - Annual Subscription\nSecond reminder required',
        contactName: 'Michael Torres',
        contactEmail: 'm.torres@bluesky.io'
      },
      { 
        name: 'Cedar Holdings - Invoice #38445', 
        type: 'invoice',
        amount: '$6,100.00', 
        daysOverdue: 2,
        preview: 'Project Management Services - Phase 2 Deliverables\nFirst reminder',
        contactName: 'Amanda Chen',
        contactEmail: 'a.chen@cedarholdings.com'
      },
    ]
  },
  {
    id: 'plan_002',
    time: '2:00–3:00 PM',
    action: 'Review and sign vendor contracts',
    details: '3 contracts pending signature: Delta Partners renewal, Acme NDA, Phoenix Services SLA',
    status: 'scheduled',
    staffRole: 'Cole',
    documents: [
      {
        name: 'Delta Partners - Master Services Agreement',
        type: 'contract',
        preview: 'Annual renewal with 12% rate increase\nNew SLA terms: 99.5% uptime guarantee',
        value: '$50,400/year',
        expiresIn: '5 days'
      },
      {
        name: 'Acme Technologies - Mutual NDA',
        type: 'contract',
        preview: '2-year confidentiality agreement\nStandard terms, no modifications',
        status: 'Ready for signature'
      },
      {
        name: 'Phoenix Services - SLA Amendment',
        type: 'contract',
        preview: 'Support hours extended to 24/7\nResponse time reduced to 2 hours',
        value: '+$800/month',
        effectiveDate: 'Feb 1, 2026'
      }
    ]
  },
  {
    id: 'plan_003',
    time: '4:30 PM',
    action: 'Prepare weekly cash flow report',
    details: 'Automated report generation. Review required before distribution to stakeholders.',
    status: 'scheduled',
    staffRole: 'Quinn',
    documents: [
      {
        name: 'Weekly Cash Flow Summary',
        type: 'report',
        preview: 'Week of Jan 6-12, 2026\nProjected ending balance: $62,150\nKey variances flagged for review',
        recipients: ['Board of Directors', 'CFO', 'Operations Lead']
      }
    ]
  }
];

export const mockAtRiskItems = [
  {
    id: 'risk_001',
    title: 'Invoice #38437 — Delta Partners',
    description: 'Invoice past due by 5 days. Authorize payment reminder to avoid late fees and maintain vendor relationship.',
    amount: '$11,417.67',
    daysOverdue: 5,
    actions: ['Review', 'Defer', 'Delegate'],
    urgency: 'high',
  }
];

export const mockDocuments: DocumentPreview[] = [
  {
    id: 'doc_001',
    title: 'NDA Summary — PDF generated',
    subtitle: 'Receipt attached',
    type: 'nda',
    status: 'pending',
    timestamp: new Date().toISOString(),
    tags: ['Contract', 'Review'],
  },
  {
    id: 'doc_002',
    title: 'Delta Partners Invoice #38137',
    subtitle: 'Payment due in 3 days',
    type: 'invoice',
    status: 'sent',
    timestamp: new Date().toISOString(),
    tags: ['Invoice', 'Urgent'],
  },
  {
    id: 'doc_003',
    title: 'Mutual NDA — Zenith Solutions',
    subtitle: 'Awaiting approval',
    type: 'contract',
    status: 'pending',
    timestamp: new Date().toISOString(),
    tags: ['NDA', 'Pending'],
  },
];

export const mockReceipts: Receipt[] = [
  {
    id: 'rcp_001',
    type: 'success',
    capability: 'EMAIL_SEND',
    title: 'Invoice Reminder Sent',
    subtitle: 'Suite S-014 • Office O-1011 • 10:42 AM',
    timestamp: new Date().toISOString(),
    staffRole: 'Quinn',
    actor: 'Ava',
    intent: 'Remind Zenith Solutions about NDA invoice #38137 payment due in 3 days',
    plan: [
      'Identify related message thread',
      'Contextualize into an outbound reminder',
    ],
    tags: ['Outbound email', 'Zenith NDA Invoice'],
  },
  {
    id: 'rcp_002',
    type: 'success',
    capability: 'CONTRACT_BIND',
    title: 'Contract Bound',
    subtitle: 'Suite ZEN-014 • Office O-1011',
    timestamp: new Date().toISOString(),
    staffRole: 'Cole',
    actor: 'user_001',
    tags: ['E-signature', 'Vendor agreement', 'Date'],
  },
  {
    id: 'rcp_003',
    type: 'deny',
    capability: 'CALL_SUMMARY',
    title: 'Call Summary Ready',
    subtitle: 'Suite ZEN-014 • Office O-1011',
    timestamp: new Date().toISOString(),
    staffRole: 'Clara',
    actor: 'Ava',
    tags: ['Cold call'],
  },
  {
    id: 'rcp_004',
    type: 'fail',
    capability: 'INVOICE_VALIDATE',
    title: 'Invoice Validation Blocked',
    subtitle: 'Suite S-014 • Office O-1029',
    timestamp: new Date().toISOString(),
    staffRole: 'Quinn',
    actor: 'system',
    tags: ['Unreachable vendor'],
  },
];

export const mockStaff: StaffRole[] = [
  {
    id: 'staff_quinn',
    name: 'Quinn',
    role: 'Billing Specialist',
    internalPackId: 'invoice_desk',
    outcome: 'Get invoices sent and paid faster.',
    whatIDo: [
      'Draft invoices and quotes',
      'Queue follow-up reminders',
      'Track payment status',
    ],
    needsApprovalFor: [
      'Sending invoices',
      'Batch reminders',
    ],
    neverDo: ['Move money'],
    receipts: 'Send events + outcomes',
    status: 'active',
    approvalLevel: 'conditional',
    badges: { approval: true, receipts: true, limits: true, certified: true },
    avatarColor: '#4facfe',
  },
  {
    id: 'staff_eli',
    name: 'Eli',
    role: 'Inbox Specialist',
    internalPackId: 'email_management',
    outcome: 'Clear email without living in email.',
    whatIDo: [
      'Draft replies to messages',
      'Summarize email threads',
      'Queue follow-up tasks',
    ],
    needsApprovalFor: ['External sends'],
    neverDo: ['Send externally without approval'],
    receipts: 'Send + thread outcome',
    status: 'active',
    approvalLevel: 'conditional',
    badges: { approval: true, receipts: true, limits: false },
    avatarColor: '#34c759',
  },
  {
    id: 'staff_clara',
    name: 'Clara',
    role: 'Front Desk',
    internalPackId: 'support_switchboard',
    outcome: 'Stop missing calls and messages.',
    whatIDo: [
      'Answer and triage calls',
      'Capture notes and context',
      'Escalate to owner when needed',
    ],
    needsApprovalFor: [
      'Binding commitments',
      'External follow-ups (configurable)',
    ],
    neverDo: ['Commit business to legal/financial action without approval'],
    receipts: 'Call summary + disposition',
    status: 'active',
    approvalLevel: 'always',
    badges: { approval: true, receipts: true, limits: true },
    avatarColor: '#ff9500',
  },
  {
    id: 'staff_skye',
    name: 'Skye',
    role: 'Scheduling Coordinator',
    internalPackId: 'scheduling_desk',
    outcome: 'Book and confirm appointments automatically.',
    whatIDo: [
      'Propose available times',
      'Confirm and reschedule meetings',
      'Send appointment reminders',
    ],
    needsApprovalFor: [],
    neverDo: ['Double-book calendar'],
    receipts: 'Booking changes + confirmations',
    status: 'active',
    approvalLevel: 'auto_low_risk',
    badges: { approval: false, receipts: true, limits: true },
    avatarColor: '#af52de',
  },
  {
    id: 'staff_cole',
    name: 'Cole',
    role: 'Contracts Specialist',
    internalPackId: 'e_signature_desk',
    outcome: 'Get contracts signed with fewer delays.',
    whatIDo: [
      'Prepare contract drafts from templates',
      'Send documents for e-signature',
      'Track signature status',
    ],
    needsApprovalFor: ['Send for signature'],
    neverDo: ['Send binding docs without approval'],
    receipts: 'Audit trail for status + timestamps',
    status: 'available',
    approvalLevel: 'always',
    badges: { approval: true, receipts: true, limits: true, certified: true },
    avatarColor: '#5856d6',
  },
  {
    id: 'staff_nova',
    name: 'Nova',
    role: 'Notary Coordinator',
    internalPackId: 'notary_desk',
    outcome: 'Coordinate notarization end-to-end.',
    whatIDo: [
      'Schedule notary sessions',
      'Collect document requirements',
      'Track completion status',
    ],
    needsApprovalFor: ['Booking/fees', 'Binding steps'],
    neverDo: [],
    receipts: 'Session scheduled/completed',
    status: 'coming_soon',
    approvalLevel: 'always',
    badges: { approval: true, receipts: true, limits: false },
    avatarColor: '#ff2d55',
  },
  {
    id: 'staff_piper',
    name: 'Piper',
    role: 'Pipeline Assistant',
    internalPackId: 'deal_pipeline',
    outcome: 'Keep deals moving with consistent follow-up.',
    whatIDo: [
      'Update pipeline stages',
      'Draft outreach messages',
      'Schedule follow-up tasks',
    ],
    needsApprovalFor: ['First-touch outbound (recommended)'],
    neverDo: [],
    receipts: 'Outreach + stage changes',
    status: 'available',
    approvalLevel: 'conditional',
    badges: { approval: true, receipts: true, limits: false },
    avatarColor: '#00c7be',
  },
  {
    id: 'staff_nora',
    name: 'Nora',
    role: 'Deal Room Host',
    internalPackId: 'deal_rooms',
    outcome: 'Run client calls like a real office.',
    whatIDo: [
      'Set up meeting rooms',
      'Capture meeting recaps',
      'Route materials to participants',
    ],
    needsApprovalFor: ['Binding actions'],
    neverDo: [],
    receipts: 'Meeting recap + materials delivered',
    status: 'active',
    approvalLevel: 'conditional',
    badges: { approval: true, receipts: true, limits: false },
    avatarColor: '#ff6b6b',
  },
];

export const mockSession: Session = {
  id: 'sess_001',
  type: 'voice',
  state: 'listening',
  startedAt: new Date().toISOString(),
  currentContext: mockDocuments.slice(0, 2),
  authorityQueue: mockAuthorityQueue.slice(0, 2),
  riskLevel: 'medium',
  mode: 'listening_only',
  transcript: [
    { id: 't1', speaker: 'user', text: 'Review the NDA with Zenith Solutions', timestamp: new Date().toISOString() },
    { id: 't2', speaker: 'ava', text: 'I\'ll review the NDA and extract key obligations. One moment...', timestamp: new Date().toISOString() },
  ],
};

const getDateString = (daysOffset: number = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const mockCalendarEvents = [
  {
    id: 'cal_001',
    date: getDateString(0),
    time: '8:00 AM',
    title: 'Morning Standup with Team',
    type: 'meeting',
    duration: '30 min',
    location: 'Virtual Office',
    participants: ['Ava', 'Quinn', 'Eli'],
  },
  {
    id: 'cal_002',
    date: getDateString(0),
    time: '9:30 AM',
    title: 'Client Onboarding: Apex Corp',
    type: 'meeting',
    duration: '1 hour',
    location: 'Conference Room A',
    participants: ['Jennifer Walsh', 'Ava', 'Clara'],
  },
  {
    id: 'cal_003',
    date: getDateString(0),
    time: '10:30 AM',
    title: 'Review Q4 Financial Reports',
    type: 'task',
    duration: '45 min',
  },
  {
    id: 'cal_004',
    date: getDateString(0),
    time: '11:00 AM',
    title: 'Follow up with BlueSky Inc',
    type: 'call',
    duration: '15 min',
    participants: ['Michael Torres'],
  },
  {
    id: 'cal_005',
    date: getDateString(0),
    time: '12:00 PM',
    title: 'Contract Renewal Deadline',
    type: 'deadline',
    isAllDay: false,
  },
  {
    id: 'cal_006',
    date: getDateString(1),
    time: '1:30 PM',
    title: 'Vendor Negotiation: Delta Partners',
    type: 'meeting',
    duration: '1 hour',
    location: 'Virtual Office',
    participants: ['Marcus Chen', 'Cole', 'Ava'],
  },
  {
    id: 'cal_007',
    date: getDateString(1),
    time: '3:00 PM',
    title: 'Weekly Pipeline Review',
    type: 'meeting',
    duration: '45 min',
    participants: ['Piper', 'Nora', 'Ava'],
  },
  {
    id: 'cal_008',
    date: getDateString(2),
    time: '4:00 PM',
    title: 'Invoice Payment Reminder',
    type: 'reminder',
    duration: '15 min',
  },
  {
    id: 'cal_009',
    date: getDateString(2),
    time: '4:30 PM',
    title: 'Prepare Cash Flow Report',
    type: 'task',
    duration: '30 min',
  },
  {
    id: 'cal_010',
    date: getDateString(3),
    time: '5:00 PM',
    title: 'End of Day Wrap-up',
    type: 'meeting',
    duration: '15 min',
    location: 'Virtual Office',
    participants: ['Ava'],
  },
  {
    id: 'cal_011',
    date: getDateString(4),
    time: '5:30 PM',
    title: 'NDA Signature Deadline',
    type: 'deadline',
  },
  {
    id: 'cal_012',
    date: getDateString(5),
    time: '',
    title: 'Monthly Compliance Check',
    type: 'reminder',
    isAllDay: true,
  },
  {
    id: 'cal_013',
    date: getDateString(7),
    time: '10:00 AM',
    title: 'Board Meeting',
    type: 'meeting',
    duration: '2 hours',
    location: 'Executive Suite',
    participants: ['Board Members', 'Ava'],
  },
  {
    id: 'cal_014',
    date: getDateString(10),
    time: '2:00 PM',
    title: 'Quarterly Review',
    type: 'meeting',
    duration: '1.5 hours',
    participants: ['All Staff', 'Ava'],
  },
  {
    id: 'cal_015',
    date: getDateString(14),
    time: '9:00 AM',
    title: 'Tax Filing Deadline',
    type: 'deadline',
  },
  {
    id: 'cal_016',
    date: getDateString(21),
    time: '11:00 AM',
    title: 'Investor Call',
    type: 'call',
    duration: '45 min',
    participants: ['Investors', 'CFO'],
  },
];

export const mockInboxItems = [
  {
    id: 'inbox_001',
    title: 'Vendor onboarding — Zenith',
    subtitle: 'ZEN-006, O-1011, O-1029',
    description: 'Got it, I can draft the onboarding agreement. We\'ll review it together then.',
    time: '1h ago',
    category: 'Legal',
    categoryColor: '#2c2c2e',
  },
  {
    id: 'inbox_002',
    title: 'Lease renewal discussion',
    subtitle: 'ZEN-001, O-1029',
    description: 'Revised lease agreement draft attached. Please review...',
    time: '2h ago',
    category: 'Finance',
    categoryColor: '#3a2a1a',
    categoryTextColor: '#d4a017',
  },
  {
    id: 'inbox_003',
    title: 'Upcoming client visit...',
    subtitle: 'ZEN-014, O-1028 • Internal Office',
    description: 'Finalizing agenda for the client visit next week. Please check...',
    time: '3h ago',
  },
  {
    id: 'inbox_004',
    title: 'Security audit preparation',
    subtitle: 'ZEN-014, Internal Office',
    description: 'Received auditor checklist. Ava is organizing required...',
    time: '9:07 AM',
    category: 'Ops',
    categoryColor: '#1a2a3a',
    categoryTextColor: '#4facfe',
  },
];

export class MockApi {
  static async getTenant(): Promise<Tenant> {
    return mockTenant;
  }

  static async getAuthorityQueue(): Promise<AuthorityItem[]> {
    return mockAuthorityQueue;
  }

  static async getDocuments(): Promise<DocumentPreview[]> {
    return mockDocuments;
  }

  static async getReceipts(): Promise<Receipt[]> {
    return mockReceipts;
  }

  static async getStaff(): Promise<StaffRole[]> {
    return mockStaff;
  }

  static async getCashPosition(): Promise<CashPosition> {
    return mockCashPosition;
  }

  static async getPipeline(): Promise<PipelineStage[]> {
    return mockPipelineStages;
  }

  static async getInboxItems() {
    return mockInboxItems;
  }

  static async getSession(): Promise<Session> {
    return mockSession;
  }

  static async getTodaysPlan() {
    return mockTodaysPlan;
  }

  static async getAtRiskItems() {
    return mockAtRiskItems;
  }
}
