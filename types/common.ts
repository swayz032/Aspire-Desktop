export type Tag = 'Legal' | 'Finance' | 'Ops' | 'Security' | 'Sales';
export type Priority = 'Low' | 'Medium' | 'High';
export type ItemStatus = 'Open' | 'Waiting' | 'Resolved' | 'resolved' | 'in_progress';

export const SUITE_ID = '7B2F-014';
export const OFFICE_ID = 'OFC-101';
export const BUSINESS_NAME = 'Your Business';

export interface SuiteContext {
  suiteId: string;
  officeId: string;
  businessName: string;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Actor = 'Ava' | 'Quinn' | 'Eli' | 'Clara' | 'Cole' | 'Nova' | 'Piper' | 'Nara' | 'Human';

export interface ActionButton {
  label: string;
  icon: string;
  action: string;
}
