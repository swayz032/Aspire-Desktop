import { InboxItem, OfficeItem, InboxDetail } from '@/types/inbox';
import { CallItem, CallDetail } from '@/types/calls';
import { MailThread, MailDetail } from '@/types/mail';
import { Contact, ContactDetail } from '@/types/contacts';
import { Receipt, ReceiptDetail } from '@/types/receipts';
import { Integration, IntegrationDetail } from '@/types/integrations';
import { TeamMember, TeamMemberDetail } from '@/types/team';
import { FAQArticle, SupportTicket, Policy } from '@/types/support';
import { Tenant, NotificationSettings, SecuritySettings, AppearanceSettings } from '@/types/tenant';

interface MockDatabase {
  officeItems: OfficeItem[];
  calls: CallItem[];
  mailThreads: MailThread[];
  contacts: Contact[];
  receipts: Receipt[];
  integrations: Integration[];
  teamMembers: TeamMember[];
  faqArticles: FAQArticle[];
  supportTickets: SupportTicket[];
  policies: Policy[];
  tenant: Tenant | null;
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
  appearanceSettings: AppearanceSettings;
}

const db: MockDatabase = {
  officeItems: [],
  calls: [],
  mailThreads: [],
  contacts: [],
  receipts: [],
  integrations: [],
  teamMembers: [],
  faqArticles: [],
  supportTickets: [],
  policies: [],
  tenant: null,
  notificationSettings: {
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    dailyDigest: true,
    urgentOnly: false,
  },
  securitySettings: {
    twoFactorEnabled: true,
    trustedDevices: [],
    autoLockTimeout: 5,
    biometricEnabled: true,
  },
  appearanceSettings: {
    theme: 'dark',
    compactMode: false,
    fontSize: 'medium',
  },
};

export function getDatabase(): MockDatabase {
  return db;
}

export function getOfficeItems(): OfficeItem[] {
  return db.officeItems;
}

export function getOfficeItemById(id: string): OfficeItem | undefined {
  return db.officeItems.find(item => item.id === id);
}

export function getCalls(): CallItem[] {
  return db.calls;
}

export function getCallById(id: string): CallItem | undefined {
  return db.calls.find(item => item.id === id);
}

export function getMailThreads(): MailThread[] {
  return db.mailThreads;
}

export function getMailThreadById(id: string): MailThread | undefined {
  return db.mailThreads.find(item => item.id === id);
}

export function getContacts(): Contact[] {
  return db.contacts;
}

export function getContactById(id: string): Contact | undefined {
  return db.contacts.find(item => item.id === id);
}

export function getReceipts(): Receipt[] {
  return db.receipts;
}

export function getReceiptById(id: string): Receipt | undefined {
  return db.receipts.find(item => item.id === id);
}

export function getReceiptsByType(type: string): Receipt[] {
  return db.receipts.filter(r => r.type === type);
}

export function getIntegrations(): Integration[] {
  return db.integrations;
}

export function getIntegrationById(id: string): Integration | undefined {
  return db.integrations.find(item => item.id === id);
}

export function getTeamMembers(): TeamMember[] {
  return db.teamMembers;
}

export function getTeamMemberById(id: string): TeamMember | undefined {
  return db.teamMembers.find(item => item.id === id);
}

export function getFAQArticles(): FAQArticle[] {
  return db.faqArticles;
}

export function getSupportTickets(): SupportTicket[] {
  return db.supportTickets;
}

export function getPolicies(): Policy[] {
  return db.policies;
}

export function getTenant(): Tenant | null {
  return db.tenant;
}

export function getNotificationSettings(): NotificationSettings {
  return db.notificationSettings;
}

export function getSecuritySettings(): SecuritySettings {
  return db.securitySettings;
}

export function getAppearanceSettings(): AppearanceSettings {
  return db.appearanceSettings;
}

export function updateNotificationSettings(settings: Partial<NotificationSettings>): void {
  Object.assign(db.notificationSettings, settings);
}

export function updateSecuritySettings(settings: Partial<SecuritySettings>): void {
  Object.assign(db.securitySettings, settings);
}

export function updateAppearanceSettings(settings: Partial<AppearanceSettings>): void {
  Object.assign(db.appearanceSettings, settings);
}

export function updateTeamMember(id: string, updates: Partial<TeamMember>): void {
  const member = db.teamMembers.find(m => m.id === id);
  if (member) {
    Object.assign(member, updates);
  }
}

export function addReceipt(receipt: Receipt): void {
  db.receipts.unshift(receipt);
}

export function addSupportTicket(ticket: SupportTicket): void {
  db.supportTickets.unshift(ticket);
}

export function setOfficeItems(items: OfficeItem[]): void {
  db.officeItems = items;
}

export function setCalls(items: CallItem[]): void {
  db.calls = items;
}

export function setMailThreads(items: MailThread[]): void {
  db.mailThreads = items;
}

export function setContacts(items: Contact[]): void {
  db.contacts = items;
}

export function setReceipts(items: Receipt[]): void {
  db.receipts = items;
}

export function setIntegrations(items: Integration[]): void {
  db.integrations = items;
}

export function setTeamMembers(items: TeamMember[]): void {
  db.teamMembers = items;
}

export function setFAQArticles(items: FAQArticle[]): void {
  db.faqArticles = items;
}

export function setPolicies(items: Policy[]): void {
  db.policies = items;
}

export function setTenant(tenant: Tenant): void {
  db.tenant = tenant;
}

export function setSecuritySettings(settings: SecuritySettings): void {
  db.securitySettings = settings;
}
