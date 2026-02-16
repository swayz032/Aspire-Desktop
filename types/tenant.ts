import { BaseEntity } from './common';

export interface Tenant extends BaseEntity {
  businessName: string;
  suiteId: string;
  officeId: string;
  ownerName: string;
  ownerEmail: string;
  role: string;
  timezone: string;
  currency: string;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  dailyDigest: boolean;
  urgentOnly: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  trustedDevices: TrustedDevice[];
  autoLockTimeout: number;
  biometricEnabled: boolean;
}

export interface TrustedDevice {
  id: string;
  name: string;
  type: string;
  lastUsed: string;
  current: boolean;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  compactMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
}
