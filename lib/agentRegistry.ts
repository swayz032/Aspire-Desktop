/**
 * Agent Registry — Static configuration for AI staff workers.
 * These are product-defined agents, not dynamic data.
 * Source of truth: backend/orchestrator/pack_manifests/*.json
 */

export type StaffState = 'active' | 'available' | 'coming_soon';

export interface AgentStaff {
  id: string;
  name: string;
  role: string;
  state: StaffState;
  headline: string;
  description: string;
  bullets: string[];
  avatarImage: ReturnType<typeof require>;
  introVideoUrl?: string;
  avatarColor: string;
}

/**
 * Static agent registry derived from pack_manifests.
 * This is configuration, not mock data — agents are product-defined.
 */
export const agentRegistry: AgentStaff[] = [
  {
    id: 'staff_eli',
    name: 'Eli',
    role: 'Inbox Specialist',
    state: 'active',
    headline: 'Reply fast. Never drop follow-ups.',
    description: 'Triages your business inbox, drafts replies and follow-ups, and queues everything for approval with a receipt trail.',
    bullets: [
      'Summarizes threads and flags urgent messages',
      'Drafts replies + follow-ups for approval',
      'Receipts for what was sent and why',
    ],
    avatarImage: require('@/assets/avatars/eli.png'),
    introVideoUrl: '/staff-intros/eli.mp4',
    avatarColor: '#34c759',
  },
  {
    id: 'staff_sarah',
    name: 'Sarah',
    role: 'Front Desk Specialist',
    state: 'active',
    headline: 'Stop missing calls — and stop getting interrupted.',
    description: 'Answers your business number, captures structured intake, and routes each request to the right next step.',
    bullets: [
      'Answers calls and captures lead/support/vendor intent',
      'Drafts call summary + next steps for approval',
      'Receipts for call outcomes and dispositions',
    ],
    avatarImage: require('@/assets/avatars/sarah.png'),
    introVideoUrl: '/staff-intros/sarah.mp4',
    avatarColor: '#ff6b6b',
  },
  {
    id: 'staff_clara',
    name: 'Clara',
    role: 'Legal Desk (Contracts + e-Signature)',
    state: 'active',
    headline: 'Get contracts signed without the back-and-forth.',
    description: 'Drafts agreements from your templates, prepares signature packets, and tracks status—always with approvals and receipts.',
    bullets: [
      'Drafts from approved templates + intake details',
      'Preps sends + reminders for approval',
      'Receipts for versions, sends, and signatures',
    ],
    avatarImage: require('@/assets/avatars/clara.png'),
    introVideoUrl: '/staff-intros/clara.mp4',
    avatarColor: '#a78bfa',
  },
  {
    id: 'staff_nora',
    name: 'Nora',
    role: 'Conference Room Assistant',
    state: 'active',
    headline: 'Cleaner meetings. Fewer no-shows.',
    description: 'Sets up your conference room workflow—invites, confirmations, reminders, and approved recap packs.',
    bullets: [
      'Sends invites + reminders for approval',
      'Recording/transcripts: ON, ASK, or OFF',
      'Recap pack: notes + action items (approved)',
    ],
    avatarImage: require('@/assets/avatars/nora.png'),
    introVideoUrl: '/staff-intros/nora.mp4',
    avatarColor: '#f59e0b',
  },
  {
    id: 'staff_quinn',
    name: 'Quinn',
    role: 'Invoices & Quotes Specialist',
    state: 'active',
    headline: 'Send quotes and invoices on time—get paid faster.',
    description: 'Drafts quotes and invoices, prepares follow-ups, and tracks billing events with approval gates and receipts.',
    bullets: [
      'Drafts quotes/invoices for approval',
      'Queues follow-ups without you chasing',
      'Receipts for invoice and payment events',
    ],
    avatarImage: require('@/assets/avatars/quinn.png'),
    introVideoUrl: '/staff-intros/quinn.mp4',
    avatarColor: '#4facfe',
  },
];

export function getAgentsByState(state: StaffState): AgentStaff[] {
  return agentRegistry.filter(agent => agent.state === state);
}

export function getActiveAgents(): AgentStaff[] {
  return getAgentsByState('active');
}

export function getAvailableAgents(): AgentStaff[] {
  return getAgentsByState('available');
}

export function getComingSoonAgents(): AgentStaff[] {
  return getAgentsByState('coming_soon');
}

export function getAgentById(id: string): AgentStaff | undefined {
  return agentRegistry.find(agent => agent.id === id);
}
