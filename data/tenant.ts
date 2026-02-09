import { Tenant, NotificationSettings, SecuritySettings, AppearanceSettings, TrustedDevice } from '@/types/tenant';
import { SUITE_ID, OFFICE_ID, BUSINESS_NAME } from '@/types/common';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

export const tenant: Tenant = {
  id: 'TENANT_0001',
  businessName: BUSINESS_NAME,
  suiteId: SUITE_ID,
  officeId: OFFICE_ID,
  ownerName: 'Alex Chen',
  ownerEmail: 'alex@zenithsolutions.com',
  role: 'Founder',
  timezone: 'America/Los_Angeles',
  currency: 'USD',
  createdAt: daysAgo(365),
  updatedAt: hoursAgo(1),
};

export const defaultNotificationSettings: NotificationSettings = {
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  dailyDigest: true,
  urgentOnly: false,
};

export const trustedDevices: TrustedDevice[] = [
  {
    id: 'DEV_0001',
    name: 'iPhone 15 Pro',
    type: 'mobile',
    lastUsed: hoursAgo(1),
    current: true,
  },
  {
    id: 'DEV_0002',
    name: 'MacBook Pro',
    type: 'desktop',
    lastUsed: daysAgo(1),
    current: false,
  },
  {
    id: 'DEV_0003',
    name: 'iPad Pro',
    type: 'tablet',
    lastUsed: daysAgo(3),
    current: false,
  },
];

export const defaultSecuritySettings: SecuritySettings = {
  twoFactorEnabled: true,
  trustedDevices: trustedDevices,
  autoLockTimeout: 5,
  biometricEnabled: true,
};

export const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'dark',
  compactMode: false,
  fontSize: 'medium',
};
