import { Tag, Priority, ItemStatus, BaseEntity, Actor } from './common';

export type InboxType = 'office' | 'call' | 'mail' | 'contact';

export interface InboxItem extends BaseEntity {
  type: InboxType;
  title: string;
  preview: string;
  timestamp: string;
  suiteId: string;
  officeId: string;
  tags: Tag[];
  priority: Priority;
  status: ItemStatus;
  linkedReceiptIds: string[];
  assignedTo?: Actor;
  unread?: boolean;
}

export interface OfficeItem extends InboxItem {
  type: 'office';
  department: string;
  requestType: string;
}

export interface TimelineMessage {
  id: string;
  sender: string;
  senderRole: string;
  content: string;
  timestamp: string;
  isAI?: boolean;
}

export interface InboxDetail extends InboxItem {
  timeline: TimelineMessage[];
  suggestedActions: string[];
}
