import { Tag, Priority, ItemStatus, BaseEntity } from './common';

export interface MailAttachment {
  id: string;
  name: string;
  type: string;
  size: string;
}

export interface MailMessage {
  id: string;
  sender: string;
  senderEmail: string;
  content: string;
  timestamp: string;
  attachments: MailAttachment[];
}

export interface MailThread extends BaseEntity {
  type: 'mail';
  subject: string;
  preview: string;
  senderName: string;
  senderEmail: string;
  recipients: string[];
  timestamp: string;
  suiteId: string;
  officeId: string;
  tags: Tag[];
  priority: Priority;
  status: ItemStatus;
  linkedReceiptIds: string[];
  unread: boolean;
  messageCount: number;
  hasAttachments: boolean;
}

export interface MailDetail extends MailThread {
  messages: MailMessage[];
  complianceFooter: string;
}
