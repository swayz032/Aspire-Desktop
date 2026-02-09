import { BaseEntity } from './common';

export type IntegrationStatus = 'Connected' | 'Not connected' | 'Needs attention';
export type HealthStatus = 'ok' | 'warning' | 'error';

export interface HealthCheck {
  webhookVerified: boolean;
  tokenExpiry: 'ok' | 'soon' | 'expired';
  syncErrorCount: number;
}

export interface IntegrationEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  receiptId?: string;
}

export interface Integration extends BaseEntity {
  name: string;
  icon: string;
  status: IntegrationStatus;
  lastSync: string;
  healthCheck: HealthCheck;
  category: string;
}

export interface IntegrationDetail extends Integration {
  permissions: string[];
  recentEvents: IntegrationEvent[];
  description: string;
}
