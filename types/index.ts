export * from './common';
export * from './inbox';
export * from './calls';
export * from './mail';
export * from './contacts';
export * from './receipts';
export * from './integrations';
export * from './team';
export * from './support';
export * from './tenant';
export * from './advisory';

export interface LegacyTenant {
  id: string;
  businessName: string;
  suiteId: string;
  officeId: string;
  role: 'Founder' | 'Owner' | 'Admin' | 'Member';
  businessEmail?: string;
  businessPhone?: string;
  status: 'active' | 'suspended';
}

export interface AuthorityItemDocumentPreview {
  type: 'meeting' | 'invoice' | 'contract' | 'email' | 'call';
  content: string;
  metadata?: {
    participants?: string[];
    duration?: string;
    vendor?: string;
    amount?: string;
    dueDate?: string;
    counterparty?: string;
    term?: string;
    preparedBy?: string;
  };
}

export interface AuthorityItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'session' | 'invoice' | 'contract' | 'call' | 'email' | 'approval';
  status: 'live' | 'pending' | 'blocked' | 'failed' | 'logged';
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
  dueDate?: string;
  thumbnailUrl?: string;
  documentType?: 'pdf' | 'image' | 'video';
  actions: ('review' | 'approve' | 'deny' | 'defer' | 'delegate' | 'join')[];
  staffRole?: string;
  receiptId?: string;
  documentPreview?: AuthorityItemDocumentPreview;
}

export interface DocumentPreview {
  id: string;
  title: string;
  subtitle: string;
  type: 'pdf' | 'contract' | 'invoice' | 'nda' | 'proposal' | 'receipt';
  thumbnailUrl?: string;
  status: 'draft' | 'pending' | 'approved' | 'signed' | 'sent';
  timestamp: string;
  tags?: string[];
}

export interface Receipt {
  id: string;
  type: 'allow' | 'deny' | 'fail' | 'success';
  capability: string;
  title: string;
  subtitle: string;
  timestamp: string;
  staffRole: string;
  actor: string;
  intent?: string;
  plan?: string[];
  evidence?: {
    type: 'email' | 'call' | 'document' | 'transaction';
    summary: string;
  };
  tags: string[];
}

export interface StaffRole {
  id: string;
  name: string;
  role: string;
  internalPackId: string;
  outcome: string;
  whatIDo: string[];
  needsApprovalFor: string[];
  neverDo: string[];
  receipts: string;
  status: 'active' | 'available' | 'coming_soon';
  approvalLevel: 'always' | 'conditional' | 'auto_low_risk';
  badges: {
    approval: boolean;
    receipts: boolean;
    limits: boolean;
    certified?: boolean;
  };
  avatarColor: string;
}

export type SessionState = 
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'responding'
  | 'awaiting_approval'
  | 'executing'
  | 'ended';

export interface Session {
  id: string;
  type: 'voice' | 'video' | 'conference';
  state: SessionState;
  startedAt?: string;
  transcript?: TranscriptEntry[];
  currentContext: DocumentPreview[];
  authorityQueue: AuthorityItem[];
  riskLevel: 'low' | 'medium' | 'high';
  mode: 'listening_only' | 'execution_enabled';
}

export interface TranscriptEntry {
  id: string;
  speaker: 'user' | 'ava';
  text: string;
  timestamp: string;
}

export interface AvaDockState {
  isOpen: boolean;
  isMinimized: boolean;
  sessionState: SessionState;
  mode: 'listening_only' | 'execution_enabled';
  receiptEnabled: boolean;
}

export interface InteractionModeOption {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  route: string;
  badge?: number;
}

export interface CashPosition {
  availableCash: number;
  upcomingOutflows7d: number;
  expectedInflows7d: number;
  accountsConnected: number;
}

export interface PipelineStage {
  name: string;
  count: number;
  target: number;
  trend: 'up' | 'down' | 'flat';
}

export interface ConnectedAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  last4: string;
  balance: number;
  availableBalance: number;
  institution: string;
  color: string;
}

export interface ReserveAccount {
  id: string;
  name: string;
  icon: string;
  targetPercent: number;
  currentAmount: number;
  targetAmount: number;
  color: string;
  status: 'healthy' | 'low' | 'critical';
}

export interface AllocationSuggestion {
  id: string;
  triggerEvent: string;
  triggerAmount: number;
  suggestedAmount: number;
  suggestedPercent: number;
  destinationAccount: string;
  destinationId: string;
  reasoning: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'denied';
  staffRole: string;
}

export interface RecentInflow {
  id: string;
  payer: string;
  payerInitials: string;
  amount: number;
  invoiceNumber: string;
  paidAt: string;
  allocationStatus: 'allocated' | 'partial' | 'pending';
  allocatedAmount?: number;
}

export interface FinanceReceipt {
  id: string;
  type: 'success' | 'allow' | 'deny' | 'fail';
  action: string;
  amount?: number;
  source?: string;
  destination?: string;
  timestamp: string;
  actor: string;
}

export interface ScoreImpactItem {
  id: string;
  title: string;
  impact: number;
  action: string;
  urgent: boolean;
}

export interface BusinessScoreCategory {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  trend: 'up' | 'down' | 'flat';
  icon: string;
  color: string;
  staffOwner?: string;
  skillPack?: string;
  impactItems?: ScoreImpactItem[];
}

export interface HiddenOpportunity {
  id: string;
  title: string;
  description: string;
  dollarValue: number;
  type: 'unbilled' | 'overdue' | 'expired_quote' | 'upsell';
  staffOwner: string;
  action: string;
  daysOld?: number;
  clientName?: string;
}

export interface EfficiencyWin {
  id: string;
  title: string;
  currentHoursPerWeek: number;
  potentialSavingsHours: number;
  automationPercent: number;
  staffOwner: string;
  action: string;
}

export interface BenchmarkMetric {
  id: string;
  name: string;
  userValue: number;
  industryAverage: number;
  topPerformers: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  action: string;
}

export interface GrowthForecast {
  currentMonthlyRevenue: number;
  projectedMonthlyRevenue: number;
  projectedDate: string;
  pipelineValue: number;
  dealsToClose: number;
  momentum: number;
  scenarios: GrowthScenario[];
}

export interface GrowthScenario {
  id: string;
  condition: string;
  result: string;
  dollarImpact: number;
  action: string;
}

export interface CumulativeValue {
  totalRevenueSaved: number;
  totalHoursSaved: number;
  daysSinceOnboarding: number;
  capabilitiesUnlocked: string[];
  weeklyStreak: number;
  lastVisitDelta: LastVisitDelta;
}

export interface LastVisitDelta {
  revenueCollected: number;
  emailsCleared: number;
  callsHandled: number;
  approvalsCompleted: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  description: string;
  staffOwner: string;
  timestamp: string;
  type: 'revenue' | 'scheduling' | 'communication' | 'documentation';
}

export interface BusinessScore {
  overallScore: number;
  maxScore: number;
  trend: 'up' | 'down' | 'flat';
  trendValue: number;
  lastUpdated: string;
  categories: BusinessScoreCategory[];
  insights: BusinessInsight[];
  potentialRevenue: number;
  currentRevenue: number;
  hiddenOpportunities: HiddenOpportunity[];
  efficiencyWins: EfficiencyWin[];
  benchmarks: BenchmarkMetric[];
  growthForecast: GrowthForecast;
  cumulativeValue: CumulativeValue;
  recentActivity: RecentActivity[];
}

export interface BusinessInsight {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  action?: string;
}

export interface FocusArea {
  id: string;
  name: string;
  icon: string;
  count: number;
  label: string;
  color: string;
}

export interface TopPriority {
  id: string;
  category: 'cashflow' | 'growth' | 'ops' | 'sales';
  icon: string;
  iconColor: string;
  title: string;
  evidence: string;
  primaryCta: string;
  primaryCtaAction: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface FounderHubSignals {
  overdue_ar_count: number;
  overdue_ar_amount: number;
  cash_position_total: number;
  new_leads_count: number;
  stalled_deals_count: number;
  ops_issue_count: number;
  pending_approvals_count: number;
  recent_receipts_count: number;
  education_brief_ready: boolean;
}

export interface PreparedArtifact {
  id: string;
  type: 'draft' | 'template' | 'plan' | 'checklist';
  title: string;
  status?: 'drafted' | 'needs_review' | 'approved' | 'receipt_required' | 'queued' | 'executed';
  createdAt: string;
}

export interface FounderHubData {
  topPriorities: TopPriority[];
  focusAreas: FocusArea[];
  preparedArtifacts: PreparedArtifact[];
  prioritiesCount: number;
  preparedCount: number;
}
