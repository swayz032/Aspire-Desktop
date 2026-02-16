import { getItem, setItem } from './storage';

const KEY = 'aspire_plaid_consent_v1';

export type PlaidConsentRecord = {
  consented: boolean;
  consentedAt?: string;
  version: 'v1';
};

export async function getPlaidConsent(): Promise<boolean> {
  const raw = await getItem(KEY);
  if (!raw) return false;
  try {
    const rec = JSON.parse(raw) as PlaidConsentRecord;
    return rec.consented === true;
  } catch {
    return false;
  }
}

export async function getPlaidConsentRecord(): Promise<PlaidConsentRecord | null> {
  const raw = await getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlaidConsentRecord;
  } catch {
    return null;
  }
}

export async function setPlaidConsent(consented: boolean): Promise<void> {
  const rec: PlaidConsentRecord = {
    consented,
    consentedAt: new Date().toISOString(),
    version: 'v1',
  };
  await setItem(KEY, JSON.stringify(rec));
}
