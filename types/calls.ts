import { Tag, Priority, ItemStatus, BaseEntity } from './common';

export type CallType = 'inbound' | 'outbound' | 'missed' | 'voicemail' | 'blocked';
export type CallOutcome = 'Completed' | 'Missed' | 'Blocked' | 'Needs follow-up';

export interface CallItem extends BaseEntity {
  type: 'call';
  callType: CallType;
  callerName: string;
  callerNumber: string;
  duration: string;
  outcome: CallOutcome;
  timestamp: string;
  suiteId: string;
  officeId: string;
  tags: Tag[];
  priority: Priority;
  status: ItemStatus;
  linkedReceiptIds: string[];
  hasSummary: boolean;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  content: string;
  timestamp: string;
}

export interface CallDetail extends CallItem {
  transcript: TranscriptLine[];
  summary: string;
  nextSteps: string[];
}
