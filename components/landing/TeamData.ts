export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  description: string;
  bullets: string[];
  avatarPath: string;
  videoPath: string;
  accent: string;
  accentLight: string;
}

export const teamMembers: TeamMember[] = [
  {
    id: 'ava',
    name: 'Ava',
    role: 'Chief AI Officer',
    department: 'Operations',
    description: 'Your primary AI executive. Ava orchestrates your entire business, briefs you each morning, and makes sure everything runs smoothly.',
    bullets: [
      'Daily executive briefings at your preferred time',
      'Orchestrates all AI staff and cross-department tasks',
      'Real-time voice and video interaction via the Cockpit',
    ],
    avatarPath: '/avatars/ava.png',
    videoPath: '/videos/team/ava.mp4',
    accent: '#3B82F6',
    accentLight: 'rgba(59,130,246,0.15)',
  },
  {
    id: 'eli',
    name: 'Eli',
    role: 'Chief Financial Officer',
    department: 'Finance',
    description: 'Your AI CFO. Eli monitors cash flow, reconciles transactions, generates financial reports, and flags anything unusual before it becomes a problem.',
    bullets: [
      'Real-time cash position monitoring and forecasting',
      'Automated invoice creation, sending, and follow-up',
      'Weekly and monthly financial briefings',
    ],
    avatarPath: '/ai-staff/Eli.png',
    videoPath: '/ai-staff/Eli.mp4',
    accent: '#10B981',
    accentLight: 'rgba(16,185,129,0.15)',
  },
  {
    id: 'sarah',
    name: 'Sarah',
    role: 'Front Desk Manager',
    department: 'Communications',
    description: 'Sarah handles inbound calls, qualifies leads, schedules appointments, and ensures every client interaction is handled professionally.',
    bullets: [
      'Answers and routes inbound calls 24/7',
      'Qualifies leads and books discovery calls automatically',
      'Sends follow-up emails and appointment reminders',
    ],
    avatarPath: '/ai-staff/Sarah.png',
    videoPath: '/ai-staff/Sarah.mp4',
    accent: '#06B6D4',
    accentLight: 'rgba(6,182,212,0.15)',
  },
  {
    id: 'clara',
    name: 'Clara',
    role: 'Contracts & Legal',
    department: 'Legal',
    description: 'Clara drafts, reviews, and manages all your contracts, proposals, and service agreements — turning negotiations into signed documents faster.',
    bullets: [
      'Drafts contracts and proposals from your business templates',
      'Manages eSign workflows via PandaDoc integration',
      'Tracks contract status and renewal dates',
    ],
    avatarPath: '/ai-staff/Clara.png',
    videoPath: '/ai-staff/Clara.mp4',
    accent: '#8B5CF6',
    accentLight: 'rgba(139,92,246,0.15)',
  },
  {
    id: 'nora',
    name: 'Nora',
    role: 'Scheduling Director',
    department: 'Operations',
    description: 'Nora owns your calendar. She manages bookings, resolves scheduling conflicts, and ensures your time is protected and productive.',
    bullets: [
      'Manages public booking pages for client scheduling',
      'Resolves calendar conflicts and optimizes your day',
      'Sends automated reminders and meeting prep notes',
    ],
    avatarPath: '/ai-staff/Nora.png',
    videoPath: '/ai-staff/Nora.mp4',
    accent: '#F97316',
    accentLight: 'rgba(249,115,22,0.15)',
  },
  {
    id: 'quinn',
    name: 'Quinn',
    role: 'Receipts & Expenses',
    department: 'Finance',
    description: 'Quinn processes expense receipts, categorizes spending, and keeps your books clean so Eli always has accurate data to work with.',
    bullets: [
      'Scans and categorizes receipts automatically',
      'Flags duplicate charges and unusual expenses',
      'Exports categorized data to QuickBooks',
    ],
    avatarPath: '/ai-staff/Quinn.png',
    videoPath: '/ai-staff/Quinn.mp4',
    accent: '#F59E0B',
    accentLight: 'rgba(245,158,11,0.15)',
  },
];
