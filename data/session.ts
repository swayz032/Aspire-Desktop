import { Colors } from '@/constants/tokens';

export type SessionPurpose = 'Internal' | 'Networking' | 'Client Call' | 'Vendor Call' | 'Deal Review';
export type SessionMode = 'voice' | 'video' | 'conference';
export type ParticipantRole = 'Host' | 'AI' | 'Member' | 'Guest';
export type ParticipantPresence = 'good' | 'fair' | 'poor';
export type StaffTaskState = 'idle' | 'working' | 'done';

export interface SessionParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  initial: string;
  color: string;
  isSpeaking: boolean;
  isMuted: boolean;
  presence: ParticipantPresence;
  avatarUrl?: string;
}

export interface TranscriptEntry {
  id: string;
  speaker: string;
  speakerColor: string;
  text: string;
  timestamp: Date;
  isBookmarked?: boolean;
}

export interface SessionAuthorityItem {
  id: string;
  title: string;
  description: string;
  risk: 'Low' | 'Medium' | 'High';
  whyRequired: string;
  status: 'pending' | 'approved' | 'denied';
  evidence?: string[];
  createdAt: Date;
}

export interface SessionStaffMember {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  state: StaffTaskState;
  currentTask?: string;
  outputCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  roomId: string;
  purpose: SessionPurpose;
  mode: SessionMode;
  title: string;
  startedAt: Date;
  endedAt?: Date;
  isRecording: boolean;
  isLive: boolean;
  participants: SessionParticipant[];
  transcript: TranscriptEntry[];
  authorityQueue: SessionAuthorityItem[];
  staff: SessionStaffMember[];
  chatMessages: ChatMessage[];
  bookmarks: string[];
  actionItems: string[];
}

let currentSession: Session | null = null;
const sessions: Session[] = [];

export function createSession(purpose: SessionPurpose, mode: SessionMode, participants: SessionParticipant[]): Session {
  const session: Session = {
    id: `session-${Date.now()}`,
    roomId: 'CR-01',
    purpose,
    mode,
    title: 'Conference Room',
    startedAt: new Date(),
    isRecording: true,
    isLive: true,
    participants: [
      {
        id: 'host-1',
        name: 'You',
        role: 'Host',
        initial: 'Y',
        color: Colors.accent.blue,
        isSpeaking: false,
        isMuted: false,
        presence: 'good',
      },
      ...participants,
    ],
    transcript: [],
    authorityQueue: [],
    staff: [],
    chatMessages: [],
    bookmarks: [],
    actionItems: [],
  };
  
  sessions.push(session);
  currentSession = session;
  return session;
}

export function getDefaultSession(): Session {
  if (!currentSession) {
    currentSession = {
      id: 'session-default',
      roomId: 'CR-01',
      purpose: 'Internal',
      mode: 'conference',
      title: 'Conference Room',
      startedAt: new Date(),
      isRecording: true,
      isLive: true,
      participants: [
        {
          id: 'host-1',
          name: 'You',
          role: 'Host',
          initial: 'Y',
          color: Colors.accent.blue,
          isSpeaking: true,
          isMuted: false,
          presence: 'good',
        },
        {
          id: 'ai-ava',
          name: 'Ava',
          role: 'AI',
          initial: 'A',
          color: Colors.semantic.success,
          isSpeaking: false,
          isMuted: false,
          presence: 'good',
        },
        {
          id: 'guest-1',
          name: 'Marcus Chen',
          role: 'Guest',
          initial: 'M',
          color: Colors.semantic.warning,
          isSpeaking: false,
          isMuted: true,
          presence: 'good',
        },
      ],
      transcript: [
        {
          id: 'tr-1',
          speaker: 'You',
          speakerColor: Colors.accent.blue,
          text: "Let's review the NDA terms before signing.",
          timestamp: new Date(Date.now() - 120000),
        },
        {
          id: 'tr-2',
          speaker: 'Ava',
          speakerColor: Colors.semantic.success,
          text: "I've pulled up the NDA. Key terms include a 2-year non-compete clause and mutual confidentiality.",
          timestamp: new Date(Date.now() - 90000),
        },
        {
          id: 'tr-3',
          speaker: 'Marcus Chen',
          speakerColor: Colors.semantic.warning,
          text: "The non-compete seems standard. Can Ava verify the indemnification clause?",
          timestamp: new Date(Date.now() - 60000),
        },
        {
          id: 'tr-4',
          speaker: 'Ava',
          speakerColor: Colors.semantic.success,
          text: "The indemnification is mutual and capped at the contract value. This is favorable for both parties.",
          timestamp: new Date(Date.now() - 30000),
        },
        {
          id: 'tr-5',
          speaker: 'You',
          speakerColor: Colors.accent.blue,
          text: "Great. Let's proceed with the approval.",
          timestamp: new Date(),
        },
      ],
      authorityQueue: [
        {
          id: 'auth-1',
          title: 'Sign NDA Agreement',
          description: 'Mutual NDA with Acme Corp for partnership discussions',
          risk: 'Low',
          whyRequired: 'Contract signing requires founder approval for legal binding agreements',
          status: 'pending',
          evidence: ['NDA_Acme_Corp_v2.pdf', 'Legal review notes'],
          createdAt: new Date(Date.now() - 300000),
        },
        {
          id: 'auth-2',
          title: 'Invoice Payment $4,500',
          description: 'Quarterly payment to CloudHost Services',
          risk: 'Medium',
          whyRequired: 'Payments over $1,000 require founder approval per policy',
          status: 'pending',
          evidence: ['Invoice #CH-2024-089', 'Service agreement'],
          createdAt: new Date(Date.now() - 600000),
        },
        {
          id: 'auth-3',
          title: 'Calendar Access Request',
          description: 'External CRM integration requesting calendar sync',
          risk: 'High',
          whyRequired: 'Third-party data access requires security review and approval',
          status: 'pending',
          evidence: ['Integration spec', 'Security assessment'],
          createdAt: new Date(Date.now() - 900000),
        },
      ],
      staff: [
        {
          id: 'staff-quinn',
          name: 'Quinn',
          role: 'Billing Specialist',
          avatarColor: Colors.accent.blue,
          state: 'idle',
          outputCount: 0,
        },
        {
          id: 'staff-eli',
          name: 'Eli',
          role: 'Inbox Manager',
          avatarColor: Colors.semantic.success,
          state: 'working',
          currentTask: 'Drafting follow-up email',
          outputCount: 2,
        },
        {
          id: 'staff-clara',
          name: 'Clara',
          role: 'Front Desk',
          avatarColor: Colors.semantic.warning,
          state: 'done',
          outputCount: 1,
        },
      ],
      chatMessages: [
        {
          id: 'chat-1',
          senderId: 'ai-ava',
          senderName: 'Ava',
          text: 'I\'ve prepared the NDA summary for your review.',
          timestamp: new Date(Date.now() - 180000),
        },
        {
          id: 'chat-2',
          senderId: 'host-1',
          senderName: 'You',
          text: 'Thanks, please highlight any unusual clauses.',
          timestamp: new Date(Date.now() - 150000),
        },
        {
          id: 'chat-3',
          senderId: 'ai-ava',
          senderName: 'Ava',
          text: 'All clauses are standard. The indemnification cap is favorable.',
          timestamp: new Date(Date.now() - 120000),
        },
      ],
      bookmarks: [],
      actionItems: [],
    };
  }
  return currentSession;
}

export function getCurrentSession(): Session | null {
  return currentSession;
}

export function updateSessionPurpose(purpose: SessionPurpose): void {
  if (currentSession) {
    currentSession.purpose = purpose;
  }
}

export function addParticipant(participant: SessionParticipant): void {
  if (currentSession) {
    currentSession.participants.push(participant);
  }
}

export function removeParticipant(participantId: string): void {
  if (currentSession) {
    currentSession.participants = currentSession.participants.filter(p => p.id !== participantId);
  }
}

export function updateParticipantMute(participantId: string, isMuted: boolean): void {
  if (currentSession) {
    const participant = currentSession.participants.find(p => p.id === participantId);
    if (participant) {
      participant.isMuted = isMuted;
    }
  }
}

export function addTranscriptEntry(entry: Omit<TranscriptEntry, 'id'>): void {
  if (currentSession) {
    currentSession.transcript.push({
      ...entry,
      id: `tr-${Date.now()}`,
    });
  }
}

export function bookmarkTranscript(entryId: string): void {
  if (currentSession) {
    const entry = currentSession.transcript.find(t => t.id === entryId);
    if (entry) {
      entry.isBookmarked = true;
      currentSession.bookmarks.push(entryId);
    }
  }
}

export function createActionItem(text: string): void {
  if (currentSession) {
    currentSession.actionItems.push(text);
  }
}

export function approveAuthorityItem(itemId: string): SessionAuthorityItem | null {
  if (currentSession) {
    const item = currentSession.authorityQueue.find(a => a.id === itemId);
    if (item) {
      item.status = 'approved';
      return item;
    }
  }
  return null;
}

export function denyAuthorityItem(itemId: string): SessionAuthorityItem | null {
  if (currentSession) {
    const item = currentSession.authorityQueue.find(a => a.id === itemId);
    if (item) {
      item.status = 'denied';
      return item;
    }
  }
  return null;
}

export function updateStaffState(staffId: string, state: StaffTaskState, task?: string): void {
  if (currentSession) {
    const staff = currentSession.staff.find(s => s.id === staffId);
    if (staff) {
      staff.state = state;
      staff.currentTask = task;
      if (state === 'done') {
        staff.outputCount += 1;
      }
    }
  }
}

export function addChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): void {
  if (currentSession) {
    currentSession.chatMessages.push({
      ...message,
      id: `chat-${Date.now()}`,
      timestamp: new Date(),
    });
  }
}

export function endSession(): Session | null {
  if (currentSession) {
    currentSession.isLive = false;
    currentSession.endedAt = new Date();
    const ended = currentSession;
    currentSession = null;
    return ended;
  }
  return null;
}

export const AVAILABLE_STAFF = [
  { id: 'staff-quinn', name: 'Quinn', role: 'Billing Specialist', avatarColor: Colors.accent.blue },
  { id: 'staff-eli', name: 'Eli', role: 'Inbox Manager', avatarColor: Colors.semantic.success },
  { id: 'staff-clara', name: 'Clara', role: 'Front Desk', avatarColor: Colors.semantic.warning },
  { id: 'staff-cole', name: 'Cole', role: 'IT Admin', avatarColor: '#8B5CF6' },
  { id: 'staff-nova', name: 'Nova', role: 'Marketing', avatarColor: '#EC4899' },
  { id: 'staff-piper', name: 'Piper', role: 'Pipeline Ops', avatarColor: '#14B8A6' },
  { id: 'staff-nara', name: 'Nara', role: 'Client Success', avatarColor: '#F97316' },
];

export const MEMBER_DIRECTORY = [
  { id: 'member-1', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Operations Lead' },
  { id: 'member-2', name: 'David Park', email: 'david@company.com', role: 'Finance Director' },
  { id: 'member-3', name: 'Lisa Wang', email: 'lisa@company.com', role: 'Legal Counsel' },
  { id: 'member-4', name: 'Michael Torres', email: 'michael@company.com', role: 'Sales Manager' },
  { id: 'member-5', name: 'Emily Chen', email: 'emily@company.com', role: 'Product Lead' },
];

export const STAFF_COMMANDS = [
  { id: 'cmd-summary', label: 'Ask for summary', icon: 'document-text' },
  { id: 'cmd-email', label: 'Draft follow-up email', icon: 'mail' },
  { id: 'cmd-actions', label: 'Extract action items', icon: 'list' },
  { id: 'cmd-review', label: 'Review contract terms', icon: 'shield-checkmark' },
  { id: 'cmd-receipt', label: 'Create receipt note', icon: 'receipt' },
];
