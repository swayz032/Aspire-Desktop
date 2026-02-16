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

// ── Calendar Events (bookings) ──────────────────────────────────────────────
export async function getCalendarEvents() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data ?? [];
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
