export type MailProvider = 'POLARIS' | 'GOOGLE';

export type MailAccountStatus = 'SETUP_REQUIRED' | 'VERIFYING' | 'ACTIVE' | 'ERROR';

export interface MailCapabilities {
  canSend: boolean;
  canDraft: boolean;
  canLabels: boolean;
  canJunk: boolean;
  canThreads: boolean;
}

export interface MailAccount {
  id: string;
  provider: MailProvider;
  email: string;
  displayName: string;
  status: MailAccountStatus;
  capabilities: MailCapabilities;
}

export interface DnsPlanRecord {
  type: 'MX' | 'SPF' | 'DKIM' | 'DMARC';
  host: string;
  value: string;
  ttl?: number;
}

export interface DnsCheckResult {
  type: string;
  ok: boolean;
  observed?: string;
}

export interface DnsStatus {
  lastCheckedAt: string;
  results: DnsCheckResult[];
}

export interface OAuthStatus {
  connectedEmail?: string;
  scopes?: string[];
}

export type CheckId = 'LIST' | 'DRAFT' | 'SEND_TEST' | 'LABEL';
export type CheckStatus = 'NOT_RUN' | 'PASS' | 'FAIL';

export interface OnboardingCheck {
  id: CheckId;
  status: CheckStatus;
  message?: string;
}

export type RateLimitPreset = 'CONSERVATIVE' | 'STANDARD';

export interface EliConfig {
  canDraft: boolean;
  canSend: boolean;
  externalApprovalRequired: boolean;
  attachmentsAlwaysApproval: boolean;
  rateLimitPreset: RateLimitPreset;
}

export type DomainMode = 'NEW_DOMAIN' | 'EXISTING_DOMAIN';

export interface MailOnboardingState {
  provider?: MailProvider;
  domainMode?: DomainMode;
  domain?: string;
  mailboxes?: { email: string; displayName?: string }[];
  dnsPlan?: DnsPlanRecord[];
  dnsStatus?: DnsStatus;
  oauthStatus?: OAuthStatus;
  checks?: OnboardingCheck[];
  eli?: EliConfig;
}

export interface MailSetupReceipt {
  id: string;
  action: string;
  timestamp: string;
  status: 'success' | 'failure' | 'pending';
  detail?: string;
}
