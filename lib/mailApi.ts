const BASE = '/v1';

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  price?: string;
  currency?: string;
  tld: string;
  term?: number;
}

async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    let msg: string;
    try {
      msg = JSON.parse(body).error || body;
    } catch {
      msg = body;
    }
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const mailApi = {
  getAccounts: (userId: string) =>
    apiFetch(`${BASE}/inbox/accounts?userId=${encodeURIComponent(userId)}`),

  startOnboarding: (userId: string, provider: string, context?: any) =>
    apiFetch(`${BASE}/mail/onboarding/start`, {
      method: 'POST',
      body: JSON.stringify({ userId, provider, context }),
    }),

  getOnboarding: (jobId: string) =>
    apiFetch(`${BASE}/mail/onboarding/${encodeURIComponent(jobId)}`),

  generateDnsPlan: (jobId: string, domain: string, mailbox: string, displayName: string, domainMode: string) =>
    apiFetch(`${BASE}/mail/onboarding/${encodeURIComponent(jobId)}/dns/plan`, {
      method: 'POST',
      body: JSON.stringify({ domain, mailbox, displayName, domainMode }),
    }),

  checkDns: (jobId: string) =>
    apiFetch(`${BASE}/mail/onboarding/${encodeURIComponent(jobId)}/dns/check`, {
      method: 'POST',
    }),

  searchDomains: (query: string) =>
    apiFetch<{ query: string; results: DomainSearchResult[] }>(
      `${BASE}/domains/search?q=${encodeURIComponent(query)}`
    ),

  requestDomainPurchase: (jobId: string, domain: string) =>
    apiFetch(`${BASE}/domains/purchase/request`, {
      method: 'POST',
      body: JSON.stringify({ jobId, domain }),
    }),

  startDomainCheckout: (jobId: string, domain: string) =>
    apiFetch(`${BASE}/domains/checkout/start`, {
      method: 'POST',
      body: JSON.stringify({ jobId, domain }),
    }),

  startGoogleOAuth: (jobId: string) =>
    apiFetch(`${BASE}/mail/oauth/google/start?jobId=${encodeURIComponent(jobId)}`),

  runChecks: (jobId: string, checks?: string[]) =>
    apiFetch(`${BASE}/mail/onboarding/${encodeURIComponent(jobId)}/checks/run`, {
      method: 'POST',
      body: JSON.stringify({ checks }),
    }),

  applyEliPolicy: (jobId: string, policy: any) =>
    apiFetch(`${BASE}/mail/eli/policy/apply`, {
      method: 'POST',
      body: JSON.stringify({ jobId, policy }),
    }),

  activate: (jobId: string) =>
    apiFetch(`${BASE}/mail/onboarding/${encodeURIComponent(jobId)}/activate`, {
      method: 'POST',
    }),

  getReceipts: (jobId: string) =>
    apiFetch(`${BASE}/receipts?jobId=${encodeURIComponent(jobId)}`),
};
