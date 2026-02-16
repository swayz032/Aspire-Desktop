import { BaseEntity, Actor } from './common';

export type TeamMemberType = 'ai' | 'human';

export interface Permission {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface DailyLimit {
  id: string;
  name: string;
  current: number;
  max: number;
  unit: string;
}

export interface TeamMember extends BaseEntity {
  name: string;
  type: TeamMemberType;
  role: string;
  avatarUrl?: string;
  enabled: boolean;
  capabilities: string[];
}

export interface TeamMemberDetail extends TeamMember {
  permissions: Permission[];
  dailyLimits: DailyLimit[];
  recentActivity: TeamActivity[];
}

export interface TeamActivity {
  id: string;
  action: string;
  timestamp: string;
  receiptId?: string;
}
