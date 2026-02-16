import { TeamMember, Permission, DailyLimit, TeamActivity } from '@/types/team';
import { teamId } from '@/lib/ids';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

export const teamMembers: TeamMember[] = [
  {
    id: teamId(1),
    name: 'Founder',
    type: 'human',
    role: 'Owner',
    enabled: true,
    capabilities: [
      'Full administrative access',
      'Approve all authority items',
      'Manage team permissions',
      'View all receipts and audit logs',
      'Configure integrations',
    ],
    createdAt: daysAgo(365),
    updatedAt: hoursAgo(1),
  },
  {
    id: teamId(2),
    name: 'Ava',
    type: 'ai',
    role: 'Chief of Staff',
    enabled: true,
    capabilities: [
      'Triage and prioritize incoming items',
      'Draft responses and communications',
      'Schedule meetings and follow-ups',
      'Summarize documents and calls',
      'Coordinate between staff members',
    ],
    createdAt: daysAgo(180),
    updatedAt: hoursAgo(2),
  },
  {
    id: teamId(3),
    name: 'Quinn',
    type: 'ai',
    role: 'Billing Specialist',
    enabled: true,
    capabilities: [
      'Process approved invoices',
      'Send payment reminders',
      'Reconcile transactions',
      'Generate financial reports',
      'Track accounts receivable',
    ],
    createdAt: daysAgo(120),
    updatedAt: hoursAgo(6),
  },
  {
    id: teamId(4),
    name: 'Eli',
    type: 'ai',
    role: 'Inbox Specialist',
    enabled: true,
    capabilities: [
      'Categorize incoming emails',
      'Draft email responses',
      'Flag urgent items',
      'Extract action items',
      'Maintain contact records',
    ],
    createdAt: daysAgo(90),
    updatedAt: hoursAgo(3),
  },
  {
    id: teamId(5),
    name: 'Clara',
    type: 'ai',
    role: 'Front Desk',
    enabled: true,
    capabilities: [
      'Handle incoming calls',
      'Schedule appointments',
      'Route inquiries',
      'Manage visitor logs',
      'Send meeting confirmations',
    ],
    createdAt: daysAgo(60),
    updatedAt: hoursAgo(16),
  },
  {
    id: teamId(6),
    name: 'Cole',
    type: 'ai',
    role: 'IT Admin',
    enabled: false,
    capabilities: [
      'Monitor system health',
      'Manage access permissions',
      'Review security alerts',
      'Generate IT reports',
      'Track software licenses',
    ],
    createdAt: daysAgo(45),
    updatedAt: daysAgo(2),
  },
  {
    id: teamId(7),
    name: 'Nova',
    type: 'ai',
    role: 'Marketing Coordinator',
    enabled: true,
    capabilities: [
      'Schedule social posts',
      'Track campaign metrics',
      'Draft marketing content',
      'Manage subscriber lists',
      'Generate engagement reports',
    ],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(7),
  },
];

export function getTeamMemberPermissions(memberId: string): Permission[] {
  return [
    { id: 'perm_1', name: 'Execute Payments', enabled: true, description: 'Process approved payment transactions' },
    { id: 'perm_2', name: 'Send Communications', enabled: true, description: 'Send emails and messages on behalf of the business' },
    { id: 'perm_3', name: 'Access Sensitive Data', enabled: false, description: 'View financial and personal information' },
    { id: 'perm_4', name: 'Modify Records', enabled: true, description: 'Update customer and transaction records' },
    { id: 'perm_5', name: 'Create Authority Items', enabled: true, description: 'Generate items requiring human approval' },
    { id: 'perm_6', name: 'External API Calls', enabled: false, description: 'Make requests to external services' },
  ];
}

export function getTeamMemberDailyLimits(memberId: string): DailyLimit[] {
  return [
    { id: 'lim_1', name: 'Emails Sent', current: 45, max: 100, unit: 'emails' },
    { id: 'lim_2', name: 'Payments Processed', current: 3, max: 10, unit: 'transactions' },
    { id: 'lim_3', name: 'API Calls', current: 234, max: 1000, unit: 'requests' },
    { id: 'lim_4', name: 'Documents Generated', current: 8, max: 25, unit: 'documents' },
  ];
}

export function getTeamMemberActivity(memberId: string): TeamActivity[] {
  return [
    { id: 'act_1', action: 'Processed invoice payment', timestamp: hoursAgo(2), receiptId: 'RCP_0001' },
    { id: 'act_2', action: 'Sent payment reminder', timestamp: hoursAgo(8), receiptId: 'RCP_0017' },
    { id: 'act_3', action: 'Generated financial report', timestamp: daysAgo(1), receiptId: 'RCP_0033' },
    { id: 'act_4', action: 'Reconciled transactions', timestamp: daysAgo(2) },
    { id: 'act_5', action: 'Updated client record', timestamp: daysAgo(3), receiptId: 'RCP_0040' },
  ];
}
