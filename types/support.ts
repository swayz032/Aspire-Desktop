import { BaseEntity } from './common';

export interface FAQArticle extends BaseEntity {
  question: string;
  answer: string;
  category: string;
  helpful: number;
}

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface SupportTicket extends BaseEntity {
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  receiptId?: string;
}

export interface Policy extends BaseEntity {
  title: string;
  content: string;
  version: string;
  effectiveDate: string;
}
