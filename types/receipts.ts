import { BaseEntity, Actor, Tag } from './common';

export type ReceiptType = 'Payment' | 'Contract' | 'Communication' | 'Call';
export type ReceiptStatus = 'Success' | 'Blocked' | 'Failed' | 'Pending';

export interface PlanStep {
  id: string;
  step: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface Evidence {
  id: string;
  type: 'document' | 'screenshot' | 'log' | 'signature';
  name: string;
  url?: string;
  snippet?: string;
}

export interface Receipt extends BaseEntity {
  type: ReceiptType;
  status: ReceiptStatus;
  title: string;
  timestamp: string;
  actor: Actor;
  suiteId: string;
  officeId: string;
  intent: string;
  tags: Tag[];
  linkedInboxId?: string;
}

export interface ReceiptDetail extends Receipt {
  planSteps: PlanStep[];
  evidence: Evidence[];
  policyEvaluation: string;
}
