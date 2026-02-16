/**
 * @deprecated Use lib/api.ts for real Supabase queries. This file is kept as
 * offline/dev fallback only. All new code should import from '@/lib/api'.
 */
// Team Workspace Data Models and Mock Data
// Enterprise-grade ops + governance console

export type RoleType = 'owner' | 'admin' | 'member' | 'viewer' | 'external';

export interface Suite {
  id: string;
  name: string;
  suiteNumber: string;
  isActive: boolean;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  roleId: RoleType;
  status: 'active' | 'pending' | 'suspended';
  suiteAccessIds: string[];
  extension?: string;
  lastActiveAt: string;
  avatarUrl?: string;
}

export interface Invite {
  id: string;
  email: string;
  name: string;
  roleId: RoleType;
  suiteAccessIds: string[];
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  requiresApproval: boolean;
}

export interface Role {
  id: RoleType;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export type PermissionKey =
  | 'team.invite'
  | 'team.manage_roles'
  | 'team.manage_members'
  | 'suite.switch'
  | 'approvals.view'
  | 'approvals.approve_low_risk'
  | 'approvals.approve_high_risk'
  | 'receipts.view_all'
  | 'receipts.export'
  | 'queues.assign'
  | 'billing.view_usage';

export type ActionType = 
  | 'email_send'
  | 'contract_send'
  | 'money_move'
  | 'invite_member'
  | 'suite_change';

export interface ApprovalRule {
  id: string;
  scope: 'suite' | 'global';
  actionType: ActionType;
  requiredApproverRole: RoleType;
  requiresOwnerVideo: boolean;
}

export interface ApprovalRequest {
  id: string;
  actionType: ActionType;
  createdBy: string;
  createdByName: string;
  assignedToRole: RoleType;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  dueAt?: string;
  payloadSummary: string;
  requiresVideo: boolean;
  suiteId: string;
}

export type DeskType = 'frontDesk' | 'inbox' | 'billing' | 'legal' | 'conference';

export interface QueueItem {
  id: string;
  desk: DeskType;
  summary: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'ready_for_approval' | 'completed';
  assigneeId?: string;
  assigneeName?: string;
  createdAt: string;
  suiteId: string;
}

export type ActorType = 'human' | 'aiDesk' | 'system';

export interface Receipt {
  id: string;
  actionType: ActionType | 'queue_complete' | 'login' | 'settings_change';
  actorId: string;
  actorName: string;
  actorType: ActorType;
  suiteId: string;
  status: 'drafted' | 'approved' | 'executed' | 'failed' | 'blocked';
  timestamp: string;
  summary: string;
  approverId?: string;
  approverName?: string;
}

export interface UsageLedger {
  suiteId: string;
  memberId?: string;
  memberName?: string;
  period: string;
  actionsUsed: number;
  actionsLimit: number;
  phoneInboundMins: number;
  phoneInboundLimit: number;
  phoneOutboundMins: number;
  phoneOutboundLimit: number;
  smsSegments: number;
  smsLimit: number;
  voiceMins: number;
  voiceLimit: number;
  videoMins: number;
  videoLimit: number;
  conferenceSessions: number;
  conferenceSessionsLimit: number;
  conferenceMins: number;
  conferenceMinsCap: number;
}

// Mock Data

export const mockSuites: Suite[] = [
  {
    id: 'suite_1',
    name: 'Zenith Solutions',
    suiteNumber: '1042',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'suite_2',
    name: 'Zenith Consulting',
    suiteNumber: '1043',
    isActive: true,
    createdAt: '2024-06-01T10:00:00Z',
  },
];

export const mockMembers: Member[] = [
  {
    id: 'member_1',
    name: 'Marcus Chen',
    email: 'marcus@zenithsolutions.com',
    roleId: 'owner',
    status: 'active',
    suiteAccessIds: ['suite_1', 'suite_2'],
    extension: '101',
    lastActiveAt: '2025-01-30T14:32:00Z',
  },
  {
    id: 'member_2',
    name: 'Sarah Mitchell',
    email: 'sarah@zenithsolutions.com',
    roleId: 'admin',
    status: 'active',
    suiteAccessIds: ['suite_1'],
    extension: '102',
    lastActiveAt: '2025-01-30T13:15:00Z',
  },
  {
    id: 'member_3',
    name: 'James Park',
    email: 'james@zenithsolutions.com',
    roleId: 'member',
    status: 'active',
    suiteAccessIds: ['suite_1'],
    extension: '103',
    lastActiveAt: '2025-01-29T16:45:00Z',
  },
];

export const mockInvites: Invite[] = [
  {
    id: 'invite_1',
    email: 'alex@zenithsolutions.com',
    name: 'Alex Rivera',
    roleId: 'member',
    suiteAccessIds: ['suite_1'],
    status: 'pending',
    createdAt: '2025-01-28T10:00:00Z',
    requiresApproval: false,
  },
];

export const mockRoles: Role[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all features and settings',
    permissions: [
      'team.invite',
      'team.manage_roles',
      'team.manage_members',
      'suite.switch',
      'approvals.view',
      'approvals.approve_low_risk',
      'approvals.approve_high_risk',
      'receipts.view_all',
      'receipts.export',
      'queues.assign',
      'billing.view_usage',
    ],
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Manage team and approve most actions',
    permissions: [
      'team.invite',
      'team.manage_members',
      'suite.switch',
      'approvals.view',
      'approvals.approve_low_risk',
      'receipts.view_all',
      'queues.assign',
      'billing.view_usage',
    ],
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Work on assigned tasks and queues',
    permissions: [
      'approvals.view',
      'receipts.view_all',
      'queues.assign',
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'View-only access to workspace',
    permissions: [
      'approvals.view',
      'receipts.view_all',
    ],
  },
  {
    id: 'external',
    name: 'External',
    description: 'Limited access for external collaborators',
    permissions: [],
  },
];

export const mockApprovalRules: ApprovalRule[] = [
  { id: 'rule_1', scope: 'global', actionType: 'email_send', requiredApproverRole: 'member', requiresOwnerVideo: false },
  { id: 'rule_2', scope: 'global', actionType: 'contract_send', requiredApproverRole: 'admin', requiresOwnerVideo: true },
  { id: 'rule_3', scope: 'global', actionType: 'money_move', requiredApproverRole: 'owner', requiresOwnerVideo: true },
  { id: 'rule_4', scope: 'global', actionType: 'invite_member', requiredApproverRole: 'admin', requiresOwnerVideo: false },
  { id: 'rule_5', scope: 'global', actionType: 'suite_change', requiredApproverRole: 'owner', requiresOwnerVideo: false },
];

export const mockApprovalRequests: ApprovalRequest[] = [
  {
    id: 'approval_1',
    actionType: 'contract_send',
    createdBy: 'member_2',
    createdByName: 'Sarah Mitchell',
    assignedToRole: 'admin',
    status: 'pending',
    createdAt: '2025-01-30T09:00:00Z',
    dueAt: '2025-01-30T17:00:00Z',
    payloadSummary: 'Send NDA to Acme Corp — Mutual non-disclosure agreement for the Q2 logistics partnership deal. 12-month term, standard liability clauses, covers proprietary shipping data and pricing models.',
    requiresVideo: true,
    suiteId: 'suite_1',
  },
  {
    id: 'approval_2',
    actionType: 'money_move',
    createdBy: 'member_3',
    createdByName: 'James Park',
    assignedToRole: 'owner',
    status: 'pending',
    createdAt: '2025-01-30T10:30:00Z',
    dueAt: '2025-01-30T15:00:00Z',
    payloadSummary: 'Wire transfer $5,000 to BuildRight Supplies — Final payment for warehouse shelving installation (Invoice #BR-2847). Vendor account ending in 4421, Chase Business routing.',
    requiresVideo: true,
    suiteId: 'suite_1',
  },
  {
    id: 'approval_3',
    actionType: 'email_send',
    createdBy: 'member_2',
    createdByName: 'Sarah Mitchell',
    assignedToRole: 'member',
    status: 'pending',
    createdAt: '2025-01-30T11:00:00Z',
    payloadSummary: 'Follow-up email to 12 leads — Personalized outreach to warm leads from the January product demo webinar. Includes pricing sheet attachment and a link to schedule a discovery call.',
    requiresVideo: false,
    suiteId: 'suite_1',
  },
];

export const mockQueueItems: QueueItem[] = [
  // Front Desk (Sarah)
  { id: 'q1', desk: 'frontDesk', summary: 'Missed call from potential client - callback requested', priority: 'high', status: 'pending', createdAt: '2025-01-30T09:15:00Z', suiteId: 'suite_1' },
  { id: 'q2', desk: 'frontDesk', summary: 'Voicemail from vendor - needs invoice clarification', priority: 'medium', status: 'pending', createdAt: '2025-01-30T10:00:00Z', suiteId: 'suite_1' },
  { id: 'q3', desk: 'frontDesk', summary: 'New lead inquiry - website form submission', priority: 'high', status: 'pending', createdAt: '2025-01-30T11:30:00Z', suiteId: 'suite_1' },
  { id: 'q15', desk: 'frontDesk', summary: 'Follow-up call with returning customer about service upgrade', priority: 'medium', status: 'pending', createdAt: '2025-01-30T13:00:00Z', suiteId: 'suite_1' },
  { id: 'q16', desk: 'frontDesk', summary: 'Receptionist handoff — visitor badge for 2pm appointment', priority: 'low', status: 'pending', createdAt: '2025-01-30T12:15:00Z', suiteId: 'suite_1' },
  // Inbox (Eli)
  { id: 'q4', desk: 'inbox', summary: 'Client email requesting project update', priority: 'medium', status: 'in_progress', assigneeId: 'member_2', assigneeName: 'Sarah Mitchell', createdAt: '2025-01-30T08:00:00Z', suiteId: 'suite_1' },
  { id: 'q5', desk: 'inbox', summary: 'Partnership proposal from TechCorp', priority: 'high', status: 'pending', createdAt: '2025-01-30T09:45:00Z', suiteId: 'suite_1' },
  { id: 'q6', desk: 'inbox', summary: 'Invoice dispute from customer', priority: 'urgent', status: 'pending', createdAt: '2025-01-30T07:30:00Z', suiteId: 'suite_1' },
  { id: 'q7', desk: 'inbox', summary: 'Scheduling request for Q2 planning', priority: 'low', status: 'pending', createdAt: '2025-01-30T10:15:00Z', suiteId: 'suite_1' },
  // Billing (Quinn)
  { id: 'q8', desk: 'billing', summary: 'Prepare Q1 invoice for Acme Corp', priority: 'high', status: 'pending', createdAt: '2025-01-29T14:00:00Z', suiteId: 'suite_1' },
  { id: 'q9', desk: 'billing', summary: 'Follow up on overdue payment - TechStart', priority: 'urgent', status: 'pending', createdAt: '2025-01-28T09:00:00Z', suiteId: 'suite_1' },
  { id: 'q10', desk: 'billing', summary: 'Quote request for new project scope', priority: 'medium', status: 'pending', createdAt: '2025-01-30T08:30:00Z', suiteId: 'suite_1' },
  { id: 'q17', desk: 'billing', summary: 'Reconcile bank statement discrepancy — $1,240 variance', priority: 'high', status: 'pending', createdAt: '2025-01-30T11:00:00Z', suiteId: 'suite_1' },
  { id: 'q18', desk: 'billing', summary: 'Process vendor refund — duplicate charge on materials order', priority: 'medium', status: 'pending', createdAt: '2025-01-30T09:45:00Z', suiteId: 'suite_1' },
  // Legal (Clara)
  { id: 'q11', desk: 'legal', summary: 'NDA review for new partnership', priority: 'high', status: 'ready_for_approval', createdAt: '2025-01-29T16:00:00Z', suiteId: 'suite_1' },
  { id: 'q12', desk: 'legal', summary: 'Contract renewal - annual service agreement', priority: 'medium', status: 'pending', createdAt: '2025-01-30T09:00:00Z', suiteId: 'suite_1' },
  // Conference (Nora)
  { id: 'q13', desk: 'conference', summary: 'Prepare recap for client strategy meeting', priority: 'medium', status: 'pending', createdAt: '2025-01-30T12:00:00Z', suiteId: 'suite_1' },
  { id: 'q14', desk: 'conference', summary: 'Send meeting invite - Q2 kickoff', priority: 'high', status: 'pending', createdAt: '2025-01-30T10:00:00Z', suiteId: 'suite_1' },
];

export const mockReceipts: Receipt[] = [
  {
    id: 'receipt_1',
    actionType: 'money_move',
    actorId: 'ai_quinn',
    actorName: 'Quinn (Billing)',
    actorType: 'aiDesk',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-30T15:45:00Z',
    summary: 'Processed vendor payment to Acme Supplies — $4,250.00',
    approverId: 'member_1',
    approverName: 'Marcus Chen',
  },
  {
    id: 'receipt_2',
    actionType: 'contract_send',
    actorId: 'ai_clara',
    actorName: 'Clara (Legal)',
    actorType: 'aiDesk',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-30T14:30:00Z',
    summary: 'Sent Master Services Agreement to TechFlow Inc for e-signature',
    approverId: 'member_1',
    approverName: 'Marcus Chen',
  },
  {
    id: 'receipt_3',
    actionType: 'email_send',
    actorId: 'ai_eli',
    actorName: 'Eli (Inbox)',
    actorType: 'aiDesk',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-30T13:15:00Z',
    summary: 'Sent proposal follow-up to 12 qualified leads from trade show',
    approverId: 'member_2',
    approverName: 'Sarah Mitchell',
  },
  {
    id: 'receipt_4',
    actionType: 'queue_complete',
    actorId: 'member_2',
    actorName: 'Sarah Mitchell',
    actorType: 'human',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-30T12:00:00Z',
    summary: 'Completed priority callback to Enterprise client — renewal confirmed',
  },
  {
    id: 'receipt_5',
    actionType: 'money_move',
    actorId: 'ai_quinn',
    actorName: 'Quinn (Billing)',
    actorType: 'aiDesk',
    suiteId: 'suite_1',
    status: 'blocked',
    timestamp: '2025-01-30T11:30:00Z',
    summary: 'Wire transfer to new vendor blocked — $18,500 requires Owner approval',
  },
  {
    id: 'receipt_6',
    actionType: 'invite_member',
    actorId: 'member_1',
    actorName: 'Marcus Chen',
    actorType: 'human',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-30T10:45:00Z',
    summary: 'Invited Jordan Lee to join as Admin with full suite access',
  },
  {
    id: 'receipt_7',
    actionType: 'contract_send',
    actorId: 'ai_clara',
    actorName: 'Clara (Legal)',
    actorType: 'aiDesk',
    suiteId: 'suite_1',
    status: 'approved',
    timestamp: '2025-01-30T10:00:00Z',
    summary: 'NDA prepared for Horizon Partners — pending client signature',
    approverId: 'member_1',
    approverName: 'Marcus Chen',
  },
  {
    id: 'receipt_8',
    actionType: 'email_send',
    actorId: 'ai_eli',
    actorName: 'Eli (Inbox)',
    actorType: 'aiDesk',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-30T09:30:00Z',
    summary: 'Sent monthly newsletter to 2,847 subscribers',
    approverId: 'member_2',
    approverName: 'Sarah Mitchell',
  },
  {
    id: 'receipt_9',
    actionType: 'login',
    actorId: 'member_3',
    actorName: 'James Park',
    actorType: 'human',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-30T09:00:00Z',
    summary: 'Signed in from new device in San Francisco, CA',
  },
  {
    id: 'receipt_10',
    actionType: 'settings_change',
    actorId: 'system',
    actorName: 'System',
    actorType: 'system',
    suiteId: 'suite_1',
    status: 'executed',
    timestamp: '2025-01-29T23:00:00Z',
    summary: 'Auto-renewed monthly subscription — next billing Feb 28, 2025',
  },
];

export const mockUsage: UsageLedger[] = [
  {
    suiteId: 'suite_1',
    period: '2025-01',
    actionsUsed: 342,
    actionsLimit: 500,
    phoneInboundMins: 180,
    phoneInboundLimit: 250,
    phoneOutboundMins: 420,
    phoneOutboundLimit: 600,
    smsSegments: 156,
    smsLimit: 300,
    voiceMins: 210,
    voiceLimit: 300,
    videoMins: 85,
    videoLimit: 150,
    conferenceSessions: 8,
    conferenceSessionsLimit: 12,
    conferenceMins: 185,
    conferenceMinsCap: 360,
  },
];

export const mockMemberUsage: UsageLedger[] = [
  {
    suiteId: 'suite_1',
    memberId: 'member_1',
    memberName: 'Marcus Chen',
    period: '2025-01',
    actionsUsed: 145,
    actionsLimit: 500,
    phoneInboundMins: 45,
    phoneInboundLimit: 250,
    phoneOutboundMins: 120,
    phoneOutboundLimit: 600,
    smsSegments: 42,
    smsLimit: 300,
    voiceMins: 90,
    voiceLimit: 300,
    videoMins: 35,
    videoLimit: 150,
    conferenceSessions: 4,
    conferenceSessionsLimit: 12,
    conferenceMins: 95,
    conferenceMinsCap: 360,
  },
  {
    suiteId: 'suite_1',
    memberId: 'member_2',
    memberName: 'Sarah Mitchell',
    period: '2025-01',
    actionsUsed: 118,
    actionsLimit: 500,
    phoneInboundMins: 85,
    phoneInboundLimit: 250,
    phoneOutboundMins: 180,
    phoneOutboundLimit: 600,
    smsSegments: 78,
    smsLimit: 300,
    voiceMins: 75,
    voiceLimit: 300,
    videoMins: 30,
    videoLimit: 150,
    conferenceSessions: 3,
    conferenceSessionsLimit: 12,
    conferenceMins: 65,
    conferenceMinsCap: 360,
  },
  {
    suiteId: 'suite_1',
    memberId: 'member_3',
    memberName: 'James Park',
    period: '2025-01',
    actionsUsed: 79,
    actionsLimit: 500,
    phoneInboundMins: 50,
    phoneInboundLimit: 250,
    phoneOutboundMins: 120,
    phoneOutboundLimit: 600,
    smsSegments: 36,
    smsLimit: 300,
    voiceMins: 45,
    voiceLimit: 300,
    videoMins: 20,
    videoLimit: 150,
    conferenceSessions: 1,
    conferenceSessionsLimit: 12,
    conferenceMins: 25,
    conferenceMinsCap: 360,
  },
];

// Desk metadata for display
export const deskInfo: Record<DeskType, { name: string; staffName: string; icon: string; color: string }> = {
  frontDesk: { name: 'Front Desk', staffName: 'Sarah', icon: 'call', color: '#22D3EE' },
  inbox: { name: 'Inbox', staffName: 'Eli', icon: 'mail', color: '#3B82F6' },
  billing: { name: 'Billing', staffName: 'Quinn', icon: 'card', color: '#10B981' },
  legal: { name: 'Legal', staffName: 'Clara', icon: 'document-text', color: '#8B5CF6' },
  conference: { name: 'Conference', staffName: 'Nora', icon: 'videocam', color: '#F59E0B' },
};

// Action type display names
export const actionTypeLabels: Record<ActionType, string> = {
  email_send: 'Email Send',
  contract_send: 'Contract Send / e-Sign',
  money_move: 'Money Movement',
  invite_member: 'Invite Teammate',
  suite_change: 'Suite Settings Change',
};

// Pricing
export const pricing = {
  teamMemberSeat: 299,
  secondSuite: 349,
};

// Current user (mock - would come from auth context)
export const currentUser: Member = mockMembers[0]; // Marcus Chen - Owner
