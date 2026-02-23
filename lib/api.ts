/**
 * Aspire Desktop — Supabase data access layer.
 * All queries are RLS-scoped by the authenticated user's suite_id (Law #6).
 */
import { supabase } from './supabase';

// ── Receipts ────────────────────────────────────────────────────────────────
export async function getReceipts(limit = 50) {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Authority Queue (approval_requests) ─────────────────────────────────────
export async function getAuthorityQueue() {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .in('status', ['pending', 'live'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Outbox Jobs ─────────────────────────────────────────────────────────────
export async function getOutboxJobs(limit = 50) {
  const { data, error } = await supabase
    .from('outbox_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Inbox Items ─────────────────────────────────────────────────────────────
export async function getInboxItems(limit = 50) {
  const { data, error } = await supabase
    .from('inbox_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Suite Profile ───────────────────────────────────────────────────────────
export async function getSuiteProfile() {
  const { data, error } = await supabase
    .from('suite_profiles')
    .select('*')
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

// ── Cash Position (from ops-snapshot server endpoint) ────────────────────────
export async function getCashPosition() {
  const res = await fetch('/api/ops-snapshot');
  if (!res.ok) throw new Error('Failed to fetch cash position');
  return res.json();
}

// ── Provider Calls ──────────────────────────────────────────────────────────
export async function getProviderCalls(limit = 50) {
  const { data, error } = await supabase
    .from('provider_call_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Calendar Events (bookings + calendar_events merged) ─────────────────────
export async function getCalendarEvents() {
  const [bookingsResult, eventsResult] = await Promise.all([
    supabase
      .from('bookings')
      .select('*')
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('calendar_events')
      .select('*')
      .order('start_time', { ascending: true }),
  ]);

  const bookings = (bookingsResult.data ?? []).map((b: any) => ({
    ...b,
    _source: 'booking' as const,
    title: b.title || `${b.client_name || 'Client'} - Booking`,
    start_time: b.scheduled_at,
  }));

  const events = (eventsResult.data ?? []).map((e: any) => ({
    ...e,
    _source: 'calendar' as const,
  }));

  // Merge and sort by start_time
  return [...bookings, ...events].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

// ── Presence Sessions ───────────────────────────────────────────────────────
export async function getSessions() {
  const { data, error } = await supabase
    .from('presence_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

// ── Contracts (server-side routes — use authenticatedFetch, not supabase) ────
// These call routes.ts endpoints which orchestrate PandaDoc API calls.
// Pass the authenticatedFetch function from useAuthFetch() hook.

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

export type ContractFilters = {
  status?: string;
  template_key?: string;
  page?: number;
  limit?: number;
};

const CONTRACT_TIMEOUT_MS = 15000;

async function contractFetch<T>(fetchFn: FetchFn, url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONTRACT_TIMEOUT_MS);
  try {
    const resp = await fetchFn(url, { ...options, signal: controller.signal });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Contract API error ${resp.status}: ${body}`);
    }
    return resp.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getContracts(fetchFn: FetchFn, filters?: ContractFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.template_key) params.set('template_key', filters.template_key);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return contractFetch<any[]>(fetchFn, `/api/contracts${qs ? `?${qs}` : ''}`);
}

export async function getContract(fetchFn: FetchFn, id: string) {
  return contractFetch<any>(fetchFn, `/api/contracts/${id}`);
}

export async function sendContract(fetchFn: FetchFn, id: string) {
  return contractFetch<any>(fetchFn, `/api/contracts/${id}/send`, { method: 'POST' });
}

export async function createSigningSession(
  fetchFn: FetchFn,
  id: string,
  signerEmail: string,
  signerName: string,
) {
  return contractFetch<{ token: string; signing_url: string; expires_at: string }>(
    fetchFn,
    `/api/contracts/${id}/session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signer_email: signerEmail, signer_name: signerName }),
    },
  );
}

export async function voidContract(fetchFn: FetchFn, id: string) {
  return contractFetch<any>(fetchFn, `/api/contracts/${id}/void`, { method: 'POST' });
}

export async function downloadContract(fetchFn: FetchFn, id: string) {
  return contractFetch<{ download_url: string }>(fetchFn, `/api/contracts/${id}/download`);
}

// ── PandaDoc Templates (live from workspace) ─────────────────────────────────

export interface PandaDocTemplate {
  id: string;
  name: string;
  date_created: string;
  date_modified: string;
  tokens: Array<{ name: string; value: string }>;
  fields: Array<{ name: string; type: string; field_id: string; assigned_to: string | null }>;
  roles: Array<{ id: string; name: string }>;
  images: number;
  content_placeholders: number;
  has_pricing: boolean;
}

export async function getPandaDocTemplates(fetchFn: FetchFn) {
  return contractFetch<{ templates: PandaDocTemplate[]; count: number }>(
    fetchFn,
    '/api/contracts/templates',
  );
}
