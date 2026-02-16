import { Integration, IntegrationEvent } from '@/types/integrations';
import { integrationId } from '@/lib/ids';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

export const integrations: Integration[] = [
  {
    id: integrationId(1),
    name: 'Stripe',
    icon: 'card',
    status: 'Connected',
    lastSync: hoursAgo(1),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'ok',
      syncErrorCount: 0,
    },
    category: 'Payments',
    createdAt: daysAgo(180),
    updatedAt: hoursAgo(1),
  },
  {
    id: integrationId(2),
    name: 'QuickBooks',
    icon: 'calculator',
    status: 'Connected',
    lastSync: hoursAgo(2),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'ok',
      syncErrorCount: 0,
    },
    category: 'Accounting',
    createdAt: daysAgo(365),
    updatedAt: hoursAgo(2),
  },
  {
    id: integrationId(3),
    name: 'Google Workspace',
    icon: 'logo-google',
    status: 'Connected',
    lastSync: hoursAgo(1),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'ok',
      syncErrorCount: 0,
    },
    category: 'Productivity',
    createdAt: daysAgo(400),
    updatedAt: hoursAgo(1),
  },
  {
    id: integrationId(4),
    name: 'Microsoft Outlook',
    icon: 'mail',
    status: 'Needs attention',
    lastSync: daysAgo(3),
    healthCheck: {
      webhookVerified: false,
      tokenExpiry: 'soon',
      syncErrorCount: 2,
    },
    category: 'Email',
    createdAt: daysAgo(200),
    updatedAt: daysAgo(3),
  },
  {
    id: integrationId(5),
    name: 'HubSpot',
    icon: 'people',
    status: 'Connected',
    lastSync: hoursAgo(3),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'ok',
      syncErrorCount: 0,
    },
    category: 'CRM',
    createdAt: daysAgo(90),
    updatedAt: hoursAgo(3),
  },
  {
    id: integrationId(6),
    name: 'Slack',
    icon: 'chatbubbles',
    status: 'Connected',
    lastSync: hoursAgo(1),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'ok',
      syncErrorCount: 0,
    },
    category: 'Communication',
    createdAt: daysAgo(300),
    updatedAt: hoursAgo(1),
  },
  {
    id: integrationId(7),
    name: 'Twilio',
    icon: 'call',
    status: 'Connected',
    lastSync: hoursAgo(1),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'ok',
      syncErrorCount: 0,
    },
    category: 'Communications',
    createdAt: daysAgo(150),
    updatedAt: hoursAgo(1),
  },
  {
    id: integrationId(8),
    name: 'DocuSign',
    icon: 'document-text',
    status: 'Connected',
    lastSync: hoursAgo(5),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'ok',
      syncErrorCount: 0,
    },
    category: 'Documents',
    createdAt: daysAgo(180),
    updatedAt: hoursAgo(5),
  },
  {
    id: integrationId(9),
    name: 'Dropbox',
    icon: 'cloud',
    status: 'Not connected',
    lastSync: '',
    healthCheck: {
      webhookVerified: false,
      tokenExpiry: 'expired',
      syncErrorCount: 0,
    },
    category: 'Storage',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  },
  {
    id: integrationId(10),
    name: 'Notion',
    icon: 'book',
    status: 'Needs attention',
    lastSync: daysAgo(7),
    healthCheck: {
      webhookVerified: true,
      tokenExpiry: 'expired',
      syncErrorCount: 5,
    },
    category: 'Productivity',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(7),
  },
];

export function getIntegrationEvents(integrationId: string): IntegrationEvent[] {
  return [
    { id: 'evt_1', type: 'sync', description: 'Data synchronized successfully', timestamp: hoursAgo(1), receiptId: 'RCP_0001' },
    { id: 'evt_2', type: 'webhook', description: 'Webhook received and processed', timestamp: hoursAgo(3), receiptId: 'RCP_0002' },
    { id: 'evt_3', type: 'auth', description: 'Token refreshed automatically', timestamp: hoursAgo(12) },
    { id: 'evt_4', type: 'sync', description: 'Incremental sync completed', timestamp: daysAgo(1), receiptId: 'RCP_0003' },
    { id: 'evt_5', type: 'webhook', description: 'Payment notification received', timestamp: daysAgo(2), receiptId: 'RCP_0004' },
  ];
}

export function getIntegrationPermissions(integrationId: string): string[] {
  return [
    'Read account information',
    'Read transaction history',
    'Create payments (requires approval)',
    'Manage customer records',
    'Access financial reports',
    'Receive webhook notifications',
  ];
}

export function getIntegrationDescription(integrationId: string): string {
  return 'This integration enables secure communication between Aspire and the connected service. All data transfers are encrypted and logged. Actions that modify data require explicit approval through the Authority Queue before execution.';
}
