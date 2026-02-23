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
  pandadocDocumentId?: string;
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
