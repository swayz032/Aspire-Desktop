import { generateSecret as otpGenerateSecret, verify as otpVerify } from 'otplib';
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
  return otpGenerateSecret();
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
  try {
    const result = await otpVerify({ secret, token: cleaned });
    return result?.valid === true;
  } catch {
    return false;
  }
}

export async function getQrCodeDataUrl(params: {
  issuer: string;
  accountName: string;
  secret: string;
}): Promise<string> {
  const { issuer, accountName, secret } = params;
  const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
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
