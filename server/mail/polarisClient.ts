import { createTrustSpineReceipt } from '../receiptService';

// ─── Config from env ───
const POLARIS_BASE_URL = () => process.env.POLARIS_BASE_URL || 'https://admin.emailarray.com';
const POLARIS_USERNAME = () => process.env.POLARIS_USERNAME || '';
const POLARIS_PASSWORD = () => process.env.POLARIS_PASSWORD || '';

function getAuthHeader(): string {
  const user = POLARIS_USERNAME();
  const pass = POLARIS_PASSWORD();
  if (!user || !pass) throw new Error('PolarisM credentials not configured');
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

// ─── Retry with exponential backoff ───

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Don't retry on 4xx client errors (except 429)
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
        throw err;
      }
      if (attempt < maxAttempts) {
        const jitter = Math.random() * 500;
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ─── HTTP helper ───

interface PolarisError extends Error {
  statusCode?: number;
}

const POLARIS_TIMEOUT_MS = 10_000; // Gate 3: Reliability — 10s timeout for PolarisM API

async function polarisFetch(
  method: string,
  path: string,
  body?: any,
): Promise<any> {
  const url = `${POLARIS_BASE_URL()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLARIS_TIMEOUT_MS);
  const opts: RequestInit = {
    method,
    signal: controller.signal,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, opts);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: PolarisError = new Error(`PolarisM API error: ${res.status} ${text}`);
    err.statusCode = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

// ─── Public API ───

export interface AddDomainResult {
  domainId?: string;
  verificationTxt: string;
  status: string;
}

export async function addDomain(
  domain: string,
  suiteId: string,
): Promise<AddDomainResult> {
  try {
    return await withRetry(async () => {
      const result = await polarisFetch('POST', '/api/domains', { domain });

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.polaris.domain_added',
        status: 'SUCCEEDED',
        action: { provider: 'polaris', domain },
        result: { domainId: result.domainId, verificationTxt: result.verificationTxt ? '<REDACTED>' : 'none' },
      });

      return {
        domainId: result.domainId || result.id,
        verificationTxt: result.verificationTxt || result.verification_txt || '',
        status: result.status || 'pending',
      };
    });
  } catch (err: any) {
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.polaris.domain_add_failed',
      status: 'FAILED',
      action: { provider: 'polaris', domain },
      result: { error: 'domain_add_failed' },
    }).catch(() => {});
    throw err;
  }
}

export interface DomainHealth {
  verified: boolean;
  mxOk: boolean;
  spfOk: boolean;
  dkimOk: boolean;
  overall: boolean;
}

export async function getDomainHealth(
  domain: string,
  suiteId: string,
): Promise<DomainHealth> {
  return withRetry(async () => {
    const result = await polarisFetch('GET', `/api/domains/${encodeURIComponent(domain)}/health`);

    return {
      verified: !!result.verified,
      mxOk: !!result.mxOk || !!result.mx_ok,
      spfOk: !!result.spfOk || !!result.spf_ok,
      dkimOk: !!result.dkimOk || !!result.dkim_ok,
      overall: !!result.overall,
    };
  });
}

export interface DkimResult {
  dkimHost: string;
  dkimValue: string;
}

export async function enableDKIM(
  domain: string,
  suiteId: string,
): Promise<DkimResult> {
  try {
    return await withRetry(async () => {
      const result = await polarisFetch('POST', `/api/domains/${encodeURIComponent(domain)}/dkim`);

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.polaris.dkim_enabled',
        status: 'SUCCEEDED',
        action: { provider: 'polaris', domain },
        result: { dkimHost: result.dkimHost || result.dkim_host, hasValue: !!result.dkimValue },
      });

      return {
        dkimHost: result.dkimHost || result.dkim_host || '',
        dkimValue: result.dkimValue || result.dkim_value || '',
      };
    });
  } catch (err: any) {
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.polaris.dkim_enable_failed',
      status: 'FAILED',
      action: { provider: 'polaris', domain },
      result: { error: 'dkim_enable_failed' },
    }).catch(() => {});
    throw err;
  }
}

export interface CreateMailboxResult {
  email: string;
  mailboxId?: string;
}

export async function createMailbox(
  domain: string,
  localPart: string,
  password: string,
  suiteId: string,
): Promise<CreateMailboxResult> {
  try {
    return await withRetry(async () => {
      const result = await polarisFetch('POST', `/api/domains/${encodeURIComponent(domain)}/mailboxes`, {
        localPart,
        password,
      });

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.polaris.mailbox_created',
        status: 'SUCCEEDED',
        action: { provider: 'polaris', domain, localPart },
        result: { email: '<EMAIL_REDACTED>', mailboxId: result.mailboxId || result.id },
      });

      return {
        email: result.email || `${localPart}@${domain}`,
        mailboxId: result.mailboxId || result.id,
      };
    });
  } catch (err: any) {
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.polaris.mailbox_create_failed',
      status: 'FAILED',
      action: { provider: 'polaris', domain, localPart },
      result: { error: 'mailbox_create_failed' },
    }).catch(() => {});
    throw err;
  }
}

export async function listMailboxes(
  domain: string,
): Promise<Array<{ email: string; mailboxId: string }>> {
  return withRetry(async () => {
    const result = await polarisFetch('GET', `/api/domains/${encodeURIComponent(domain)}/mailboxes`);
    return Array.isArray(result) ? result : (result.mailboxes || []);
  });
}

export async function resetPassword(
  domain: string,
  email: string,
  newPassword: string,
  suiteId?: string,
): Promise<void> {
  await withRetry(async () => {
    await polarisFetch('PUT', `/api/domains/${encodeURIComponent(domain)}/mailboxes/${encodeURIComponent(email)}/password`, {
      password: newPassword,
    });
  });

  // Receipt — Law #2: password reset is a state change
  if (suiteId) {
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.polaris.password_reset',
      status: 'SUCCEEDED',
      action: { provider: 'polaris', domain, email: '<EMAIL_REDACTED>' },
      result: { passwordReset: true },
    }).catch(() => {});
  }
}
