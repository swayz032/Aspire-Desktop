import { BaseEntity } from './common';

export interface Tenant extends BaseEntity {
  businessName: string;
  suiteId: string;
  officeId: string;
  displayId?: string;
  officeDisplayId?: string;
  ownerName: string;
  ownerEmail: string;
  role: string;
  timezone: string;
  currency: string;
  // Intake fields (populated from suite_profiles after onboarding)
  industry: string | null;
  industrySpecialty: string | null;
  incomeRange: string | null;
  referralSource: string | null;
  gender: string | null;
  teamSize: string | null;
  entityType: string | null;
  yearsInBusiness: string | null;
  businessGoals: string[] | null;
  painPoint: string | null;
  salesChannel: string | null;
  customerType: string | null;
  preferredChannel: string | null;
  onboardingCompleted: boolean;
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
