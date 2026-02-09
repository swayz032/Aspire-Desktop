import { Tag, BaseEntity } from './common';

export type ContactRole = 'Vendor' | 'Client' | 'Internal' | 'Partner';

export interface Contact extends BaseEntity {
  name: string;
  title: string;
  organization: string;
  email: string;
  phone: string;
  role: ContactRole;
  tags: Tag[];
  lastContacted: string;
  notes: string;
  avatarUrl?: string;
}

export interface ContactDetail extends Contact {
  recentReceipts: string[];
  activityHistory: ContactActivity[];
}

export interface ContactActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  description: string;
  timestamp: string;
}
