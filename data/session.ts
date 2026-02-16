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
          isSpeaking: false,
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
      ],
      transcript: [],
      authorityQueue: [],
      staff: [],
      chatMessages: [],
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
  { id: 'staff-quinn', name: 'Quinn', role: 'Invoicing Specialist', avatarColor: Colors.accent.blue },
  { id: 'staff-eli', name: 'Eli', role: 'Inbox Manager', avatarColor: Colors.semantic.success },
  { id: 'staff-clara', name: 'Clara', role: 'Legal Counsel', avatarColor: Colors.semantic.warning },
  { id: 'staff-adam', name: 'Adam', role: 'Research Assistant', avatarColor: '#8B5CF6' },
  { id: 'staff-nora', name: 'Nora', role: 'Conference Host', avatarColor: '#EC4899' },
  { id: 'staff-sarah', name: 'Sarah', role: 'Front Desk', avatarColor: '#14B8A6' },
  { id: 'staff-tec', name: 'Tec', role: 'Documents Specialist', avatarColor: '#F97316' },
  { id: 'staff-finn', name: 'Finn', role: 'Finance Manager', avatarColor: '#3B82F6' },
  { id: 'staff-teressa', name: 'Teressa', role: 'Bookkeeper', avatarColor: '#A78BFA' },
  { id: 'staff-milo', name: 'Milo', role: 'Payroll Specialist', avatarColor: '#FB923C' },
];

// Populated from Supabase office members at runtime
export const MEMBER_DIRECTORY: { id: string; name: string; email: string; role: string }[] = [];

export const STAFF_COMMANDS = [
  { id: 'cmd-summary', label: 'Ask for summary', icon: 'document-text' },
  { id: 'cmd-email', label: 'Draft follow-up email', icon: 'mail' },
  { id: 'cmd-actions', label: 'Extract action items', icon: 'list' },
  { id: 'cmd-review', label: 'Review contract terms', icon: 'shield-checkmark' },
  { id: 'cmd-receipt', label: 'Create receipt note', icon: 'receipt' },
];
