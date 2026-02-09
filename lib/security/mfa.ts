import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { getItem, setItem, removeItem } from './storage';

const SECRET_KEY = 'aspire_mfa_secret_v1';
const STATUS_KEY = 'aspire_mfa_status_v1';

export type MfaStatus = {
  enabled: boolean;
  lastVerifiedAt?: string;
  method?: 'TOTP';
};

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export async function storeMfaSecret(secret: string): Promise<void> {
  await setItem(SECRET_KEY, secret);
}

export async function getStoredMfaSecret(): Promise<string | null> {
  return await getItem(SECRET_KEY);
}

export async function clearMfaSecret(): Promise<void> {
  await removeItem(SECRET_KEY);
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const raw = await getItem(STATUS_KEY);
  if (!raw) return { enabled: false };
  try {
    return JSON.parse(raw) as MfaStatus;
  } catch {
    return { enabled: false };
  }
}

export async function updateMfaStatus(patch: Partial<MfaStatus>): Promise<MfaStatus> {
  const current = await getMfaStatus();
  const next: MfaStatus = { ...current, ...patch };
  await setItem(STATUS_KEY, JSON.stringify(next));
  return next;
}

export async function verifyMfaCode(code: string): Promise<boolean> {
  const secret = await getStoredMfaSecret();
  if (!secret) return false;
  const cleaned = (code || '').replace(/\s+/g, '');
  return authenticator.check(cleaned, secret);
}

export async function getQrCodeDataUrl(params: {
  issuer: string;
  accountName: string;
  secret: string;
}): Promise<string> {
  const { issuer, accountName, secret } = params;
  const otpauth = authenticator.keyuri(accountName, issuer, secret);
  return await QRCode.toDataURL(otpauth);
}

export async function isMfaVerifiedRecently(maxAgeMinutes = 12 * 60): Promise<boolean> {
  const status = await getMfaStatus();
  if (!status.enabled || !status.lastVerifiedAt) return false;
  const then = Date.parse(status.lastVerifiedAt);
  if (Number.isNaN(then)) return false;
  const ageMs = Date.now() - then;
  return ageMs <= maxAgeMinutes * 60 * 1000;
}
