const BASE = '/v1';

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  price?: string;
  currency?: string;
  tld: string;
  term?: number;
}

// ─── Authenticated fetch injection (Law #3: Fail Closed) ───
type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;
let _authFetch: FetchFn = fetch;

/** Call once after login to inject JWT-bearing fetch for all mail API calls. */
export function initMailApi(fetchFn: FetchFn): void {
  _authFetch = fetchFn;
}

async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await _authFetch(url, {
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
      const parsed = JSON.parse(body);
      msg = parsed.error || parsed.message || body;
    } catch {
      msg = body;
    }
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const mailApi = {
  getAccounts: () =>
    apiFetch(`${BASE}/inbox/accounts`),

  startOnboarding: (provider: string, context?: any) =>
    apiFetch(`${BASE}/mail/onboarding/start`, {
      method: 'POST',
      body: JSON.stringify({ provider, context }),
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
    apiFetch<{ status: string; orderId?: string; amount?: string; currency?: string; dnsPlan?: any }>(
      `${BASE}/domains/checkout/start`, {
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
