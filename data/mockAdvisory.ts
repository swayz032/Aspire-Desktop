import {
  BusinessProfile,
  DailyQuote,
  GrowthLever,
  MarketAngle,
  AdvisoryPack,
  RecommendedTool,
  RecommendedAgent,
  DraftArtifact,
} from '@/types/advisory';

export const mockBusinessProfile: BusinessProfile = {
  industry: 'Logistics & Transportation',
  stage: 'growth',
  connectedTools: ['Stripe', 'Gmail'],
  companyName: 'Zenith Solutions',
  employeeCount: 12,
};

export const mockDailyQuote: DailyQuote = {
  id: 'quote-1',
  quote: 'The best businesses solve problems customers didn\'t know they had.',
  author: 'Industry Insight',
  source: 'Aspire Intelligence',
};

export const mockGrowthLevers: GrowthLever[] = [
  {
    id: 'lever-1',
    title: 'Cashflow Leak Detection',
    whyItMatters: 'Companies in your industry lose 8-12% of revenue to late payments and unbilled work.',
    whyYouSeeThis: 'Based on your Stripe transaction patterns and invoice aging data.',
    roiExpectation: {
      type: 'cash_recovered',
      value: '$8,400',
      timeframe: 'next 30 days',
    },
    riskTier: 'red',
    evidenceType: 'evidence-backed',
    packId: 'pack-collections',
  },
  {
    id: 'lever-2',
    title: 'Response Time Optimization',
    whyItMatters: 'Businesses that respond within 1 hour close 7x more deals than those responding after 24 hours.',
    whyYouSeeThis: 'Your average email response time is 6.2 hours based on Gmail data.',
    roiExpectation: {
      type: 'revenue_potential',
      value: '$12,000',
      timeframe: 'per quarter',
    },
    riskTier: 'yellow',
    evidenceType: 'evidence-backed',
    packId: 'pack-inbox',
  },
  {
    id: 'lever-3',
    title: 'Recurring Revenue Model',
    whyItMatters: 'Subscription models increase customer lifetime value by 3-5x in your industry.',
    whyYouSeeThis: 'Similar companies in logistics have successfully transitioned 40% of clients to retainers.',
    roiExpectation: {
      type: 'revenue_potential',
      value: '$24,000',
      timeframe: 'annual increase',
    },
    riskTier: 'green',
    evidenceType: 'estimated',
  },
];

export const mockMarketAngles: MarketAngle[] = [
  {
    id: 'angle-1',
    title: 'Pallet Broker Expansion',
    description: 'Transition from pallet supply to pallet brokerage - connecting buyers with multiple suppliers for margin without inventory.',
    bullets: [
      'No inventory holding costs',
      'Commission-based revenue model (8-15% per transaction)',
      'Scalable without capital requirements',
    ],
    whenItFits: [
      'You have established supplier relationships',
      'Customers ask for products you don\'t carry',
      'You want to expand without warehouse space',
    ],
    risksTradeoffs: [
      'Lower per-unit margins than direct sales',
      'Requires strong vendor management',
      'Quality control depends on third parties',
    ],
    riskTier: 'yellow',
    evidenceType: 'estimated',
  },
  {
    id: 'angle-2',
    title: 'Managed Services Bundle',
    description: 'Package logistics consulting with ongoing management for higher-margin recurring revenue.',
    bullets: [
      'Monthly retainer model increases predictability',
      'Upsell existing transactional clients',
      'Premium positioning vs competitors',
    ],
    whenItFits: [
      'Clients frequently ask for advice',
      'You have deep industry expertise',
      'Current clients have complex ongoing needs',
    ],
    risksTradeoffs: [
      'Requires dedicated account management',
      'Longer sales cycle than transactional',
      'Service delivery must be consistent',
    ],
    riskTier: 'green',
    evidenceType: 'estimated',
  },
];

export const mockAdvisoryPacks: AdvisoryPack[] = [
  {
    id: 'pack-collections',
    name: 'Collections Accelerator',
    description: 'Automated follow-up sequences and payment recovery workflows.',
    includes: [
      'Payment reminder sequence (5 templates)',
      'Escalation workflow config',
      'Quinn agent billing rules',
      'Past-due notification scripts',
    ],
    requiredTools: ['Stripe'],
    templates: 5,
    agentConfigs: 2,
    installed: false,
  },
  {
    id: 'pack-inbox',
    name: 'Inbox Zero System',
    description: 'Smart triage and rapid response templates for customer communication.',
    includes: [
      'Email categorization rules',
      'Quick response templates (12)',
      'Eli agent inbox config',
      'Priority routing logic',
    ],
    requiredTools: ['Gmail'],
    templates: 12,
    agentConfigs: 1,
    installed: false,
  },
  {
    id: 'pack-pipeline',
    name: 'Pipeline Momentum',
    description: 'Deal tracking and follow-up automation for sales acceleration.',
    includes: [
      'Deal stage templates',
      'Follow-up sequence config',
      'Piper agent pipeline rules',
      'Win/loss analysis framework',
    ],
    templates: 8,
    agentConfigs: 1,
    installed: false,
  },
];

export const mockRecommendedTools: RecommendedTool[] = [
  {
    id: 'tool-stripe',
    name: 'Stripe',
    icon: 'card-outline',
    whatAspireUnlocks: 'Real-time payment tracking, invoice aging analysis, and automated collections.',
    connected: true,
    category: 'payments',
  },
  {
    id: 'tool-gmail',
    name: 'Gmail',
    icon: 'mail-outline',
    whatAspireUnlocks: 'Response time optimization, smart inbox triage, and communication analytics.',
    connected: true,
    category: 'communication',
  },
  {
    id: 'tool-calendly',
    name: 'Calendly',
    icon: 'calendar-outline',
    whatAspireUnlocks: 'Meeting efficiency metrics, scheduling automation, and availability optimization.',
    connected: false,
    category: 'calendar',
  },
  {
    id: 'tool-quickbooks',
    name: 'QuickBooks',
    icon: 'calculator-outline',
    whatAspireUnlocks: 'Cash flow forecasting, expense categorization, and financial health insights.',
    connected: false,
    category: 'accounting',
  },
];

export const mockRecommendedAgents: RecommendedAgent[] = [
  {
    id: 'agent-quinn',
    name: 'Quinn',
    role: 'Billing Specialist',
    capabilities: [
      'Invoice generation and tracking',
      'Payment follow-up sequences',
      'Collections escalation',
      'Revenue recovery identification',
    ],
    riskTier: 'green',
    avatarColor: '#4facfe',
    configInstalled: true,
  },
  {
    id: 'agent-eli',
    name: 'Eli',
    role: 'Inbox Manager',
    capabilities: [
      'Email triage and prioritization',
      'Quick response drafting',
      'Meeting scheduling coordination',
      'Customer inquiry routing',
    ],
    riskTier: 'green',
    avatarColor: '#34c759',
    configInstalled: false,
  },
  {
    id: 'agent-piper',
    name: 'Piper',
    role: 'Pipeline Operations',
    capabilities: [
      'Deal tracking and updates',
      'Follow-up automation',
      'Pipeline health monitoring',
      'Opportunity identification',
    ],
    riskTier: 'yellow',
    avatarColor: '#f59e0b',
    configInstalled: false,
  },
];

export const initialDraftArtifacts: DraftArtifact[] = [];
