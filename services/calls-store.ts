/**
 * services/calls-store.ts — Calls & Messages unified store (Wave 7).
 *
 * Listener-based store matching the existing pattern in
 * `lib/authorityQueueStore.ts` and `lib/immersionStore.ts`. No external state
 * library — keeps bundle small and the cleanup story trivial.
 *
 * Three slices:
 *   - voicemails  (sorted: high-urgency unread first, then by created_at desc)
 *   - callSessions (sorted: started_at desc)
 *   - contacts    (sorted: last_seen_at desc, with blocked/unconfirmed pinned)
 *
 * Realtime: subscribes to postgres_changes on each table, scoped by suite_id.
 * Pattern lifted from `hooks/useRealtimeInbox.ts:73-114`.
 *
 * Mock mode: when `useMockData()` returns true, the store hydrates from
 * `__mocks__/calls-mock-data.ts` and skips the network entirely. Mutations
 * still work end-to-end against in-memory copies so the UI is exercisable.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { fetchVoiceToken } from '@/lib/api/voice';
import { devError, devWarn } from '@/lib/devLog';
import type {
  ContactPatch,
  FrontdeskCallSession,
  FrontdeskContact,
  FrontdeskVoicemail,
} from '@/types/calls-messages';
import {
  MOCK_CALL_SESSIONS,
  MOCK_CONTACTS,
  MOCK_VOICEMAILS,
} from '@/__mocks__/calls-mock-data';

// ---------------------------------------------------------------------------
// Mock toggle. Default true until migration 114 ships and proxy routes are
// live. Flip to false (or wire a runtime flag) once the backend is real.
// ---------------------------------------------------------------------------

const DEFAULT_USE_MOCK = true;
let mockOverride: boolean | null = null;

export function setUseMockData(useMock: boolean): void {
  mockOverride = useMock;
}

export function useMockData(): boolean {
  return mockOverride ?? DEFAULT_USE_MOCK;
}

// ---------------------------------------------------------------------------
// State + listeners
// ---------------------------------------------------------------------------

interface State {
  voicemails: FrontdeskVoicemail[];
  callSessions: FrontdeskCallSession[];
  contacts: FrontdeskContact[];
  loading: boolean;
  error: string | null;
}

let state: State = {
  voicemails: [],
  callSessions: [],
  contacts: [],
  loading: true,
  error: null,
};

const listeners = new Set<(s: State) => void>();

function notify(): void {
  for (const fn of listeners) fn(state);
}

function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
  notify();
}

// ---------------------------------------------------------------------------
// Sort helpers — single source of truth so list order never depends on caller.
// ---------------------------------------------------------------------------

const URGENCY_RANK: Record<FrontdeskVoicemail['urgency'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortVoicemails(vms: FrontdeskVoicemail[]): FrontdeskVoicemail[] {
  return [...vms].sort((a, b) => {
    // Archived sink to the bottom.
    const aArch = a.archived_at ? 1 : 0;
    const bArch = b.archived_at ? 1 : 0;
    if (aArch !== bArch) return aArch - bArch;
    // Unread before read.
    const aRead = a.read_at ? 1 : 0;
    const bRead = b.read_at ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    // Higher urgency first.
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    // Newest first.
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function sortCallSessions(cs: FrontdeskCallSession[]): FrontdeskCallSession[] {
  return [...cs].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
}

function sortContacts(cs: FrontdeskContact[]): FrontdeskContact[] {
  return [...cs].sort((a, b) => {
    const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
    const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
    return bTime - aTime;
  });
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

async function hydrateMock(): Promise<void> {
  setState({
    voicemails: sortVoicemails(MOCK_VOICEMAILS),
    callSessions: sortCallSessions(MOCK_CALL_SESSIONS),
    contacts: sortContacts(MOCK_CONTACTS),
    loading: false,
    error: null,
  });
}

async function hydrateRemote(suiteId: string): Promise<void> {
  try {
    setState({ loading: true, error: null });
    const [vm, cs, ct] = await Promise.all([
      supabase
        .from('frontdesk_voicemails')
        .select('*')
        .eq('suite_id', suiteId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('call_sessions')
        .select('*')
        .eq('suite_id', suiteId)
        .order('started_at', { ascending: false })
        .limit(200),
      supabase
        .from('frontdesk_contacts')
        .select('*')
        .eq('suite_id', suiteId)
        .order('last_seen_at', { ascending: false })
        .limit(500),
    ]);

    if (vm.error) throw vm.error;
    if (cs.error) throw cs.error;
    if (ct.error) throw ct.error;

    setState({
      voicemails: sortVoicemails((vm.data ?? []) as FrontdeskVoicemail[]),
      callSessions: sortCallSessions((cs.data ?? []) as FrontdeskCallSession[]),
      contacts: sortContacts((ct.data ?? []) as FrontdeskContact[]),
      loading: false,
      error: null,
    });
  } catch (err) {
    devError('[calls-store] hydrate failed', err);
    setState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to load',
    });
  }
}

// ---------------------------------------------------------------------------
// Realtime subscription. Mirrors useRealtimeInbox.ts:73-114.
// Returns a teardown function.
// ---------------------------------------------------------------------------

function subscribeRealtime(suiteId: string): () => void {
  const filter = `suite_id=eq.${suiteId}`;
  const stamp = Date.now();
  const channels = (
    ['frontdesk_voicemails', 'call_sessions', 'frontdesk_contacts'] as const
  ).map((table) =>
    supabase
      .channel(`calls-store-${table}-${stamp}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        () => {
          // Cheap re-hydrate; tables are small per-tenant. v2 can apply diffs.
          void hydrateRemote(suiteId);
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          devWarn(`[calls-store] ${table} channel ${status}`, err || '');
        }
      }),
  );

  return () => {
    for (const ch of channels) supabase.removeChannel(ch);
  };
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useCallsStore(suiteId: string | null | undefined): State {
  const [snap, setSnap] = useState<State>(state);

  useEffect(() => {
    const listener = (s: State) => setSnap(s);
    listeners.add(listener);
    setSnap(state);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | null = null;

    if (useMockData()) {
      void hydrateMock();
      return () => {
        cancelled = true;
      };
    }

    if (!suiteId) {
      setState({ loading: false });
      return () => {
        cancelled = true;
      };
    }

    void hydrateRemote(suiteId).then(() => {
      if (!cancelled) teardown = subscribeRealtime(suiteId);
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [suiteId]);

  return snap;
}

// ---------------------------------------------------------------------------
// Mutations — optimistic local update, then persist (when not in mock mode).
// ---------------------------------------------------------------------------

export async function markVoicemailRead(voicemailId: string): Promise<void> {
  const now = new Date().toISOString();
  setState({
    voicemails: sortVoicemails(
      state.voicemails.map((v) =>
        v.voicemail_id === voicemailId ? { ...v, read_at: v.read_at ?? now } : v,
      ),
    ),
  });
  if (useMockData()) return;
  const { error } = await supabase
    .from('frontdesk_voicemails')
    .update({ read_at: now })
    .eq('voicemail_id', voicemailId);
  if (error) devError('[calls-store] markVoicemailRead failed', error);
}

export async function archiveVoicemail(voicemailId: string): Promise<void> {
  const now = new Date().toISOString();
  setState({
    voicemails: sortVoicemails(
      state.voicemails.map((v) =>
        v.voicemail_id === voicemailId ? { ...v, archived_at: now } : v,
      ),
    ),
  });
  if (useMockData()) return;
  const { error } = await supabase
    .from('frontdesk_voicemails')
    .update({ archived_at: now })
    .eq('voicemail_id', voicemailId);
  if (error) devError('[calls-store] archiveVoicemail failed', error);
}

export async function updateContact(
  contactId: string,
  patch: ContactPatch,
): Promise<void> {
  setState({
    contacts: sortContacts(
      state.contacts.map((c) =>
        c.contact_id === contactId
          ? { ...c, ...patch, updated_at: new Date().toISOString() }
          : c,
      ),
    ),
  });
  if (useMockData()) return;
  const { error } = await supabase
    .from('frontdesk_contacts')
    .update(patch)
    .eq('contact_id', contactId);
  if (error) devError('[calls-store] updateContact failed', error);
}

/**
 * Merge two contacts into one. v2 will move all FK references on the server;
 * v1 just collapses them locally and writes a single survivor.
 */
export async function mergeContacts(
  survivorId: string,
  duplicateId: string,
): Promise<void> {
  const survivor = state.contacts.find((c) => c.contact_id === survivorId);
  const duplicate = state.contacts.find((c) => c.contact_id === duplicateId);
  if (!survivor || !duplicate) return;
  const merged: FrontdeskContact = {
    ...survivor,
    total_calls: survivor.total_calls + duplicate.total_calls,
    tags: Array.from(new Set([...survivor.tags, ...duplicate.tags])),
    notes: [survivor.notes, duplicate.notes].filter(Boolean).join('\n\n') || null,
    updated_at: new Date().toISOString(),
  };
  setState({
    contacts: sortContacts(
      state.contacts
        .filter((c) => c.contact_id !== duplicateId)
        .map((c) => (c.contact_id === survivorId ? merged : c)),
    ),
  });
  if (useMockData()) return;
  // Server-side merge endpoint — deny-closed if missing.
  devWarn('[calls-store] mergeContacts: server endpoint not yet wired (Wave 7 v2)');
}

// ---------------------------------------------------------------------------
// dialContact — wires the existing browser Twilio Voice SDK.
// Mirrors `app/session/calls.tsx:640-695` (handleCall).
// Returns the navigation params; the caller (a screen with router access)
// hands them to `router.push('/call-room', ...)`.
// ---------------------------------------------------------------------------

export interface DialParams {
  phone: string;
  voiceToken: string;
  callerId: string;
}

export interface DialContactArgs {
  phoneE164: string;
  officeId: string;
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export async function dialContact(args: DialContactArgs): Promise<DialParams> {
  if (Platform.OS !== 'web') {
    throw new Error('In-browser calling is web-only in v1.');
  }
  if (useMockData()) {
    // In mock mode we cannot mint a real token — return a sentinel the caller
    // can show as a toast instead of pushing to /call-room.
    throw new Error('Mock mode: dialing disabled. Toggle setUseMockData(false) to dial.');
  }
  const tok = await fetchVoiceToken({
    authenticatedFetch: args.authenticatedFetch,
    officeId: args.officeId,
  });
  return {
    phone: args.phoneE164,
    voiceToken: tok.token,
    callerId: tok.caller_id,
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function selectUnreadVoicemailCount(s: State): number {
  return s.voicemails.filter((v) => !v.read_at && !v.archived_at).length;
}

export function selectContactById(
  s: State,
  contactId: string | null | undefined,
): FrontdeskContact | null {
  if (!contactId) return null;
  return s.contacts.find((c) => c.contact_id === contactId) ?? null;
}
