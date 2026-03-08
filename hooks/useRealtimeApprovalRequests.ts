/**
 * useRealtimeApprovalRequests
 *
 * Dual-path notification system for authority queue items:
 * 1. Supabase Realtime (primary) — instant push via postgres_changes on approval_requests
 * 2. Polling fallback (secondary) — catches missed events every 30 seconds
 *
 * Writes to authorityQueueStore, consumed by:
 * - DesktopHome (master queue — all items)
 * - DesktopHeader (bell notification count)
 * - Finance Hub (finance-domain items)
 * - Conference Lobby (docs/PDFs + video invites)
 *
 * Mount this hook once at the app layout level (_layout.tsx).
 *
 * Law #6: Tenant Isolation — filters by tenant_id via RLS + explicit filter.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/providers';
import {
  addAuthorityItem,
  removeAuthorityItem,
  setAuthorityItems,
} from '@/lib/authorityQueueStore';
import { getAuthorityQueue } from '@/lib/api';
import type { AuthorityItem } from '@/types';

const LOG_PREFIX = '[ApprovalRequests]';
const POLL_INTERVAL_MS = 30_000;

/** Map a Supabase approval_requests row to an AuthorityItem for the store */
function rowToAuthorityItem(row: Record<string, unknown>): AuthorityItem {
  const riskTier = (row.risk_tier as string) || 'yellow';
  const tool = (row.tool as string) || '';
  const operation = (row.operation as string) || '';
  const typeLabel = tool && operation ? `${tool}.${operation}` : tool || operation || 'approval';

  return {
    id: (row.approval_id as string) || (row.id as string) || '',
    title: (row.draft_summary as string) || typeLabel || 'Approval Request',
    subtitle: (row.assigned_agent as string) ? `Agent: ${row.assigned_agent}` : typeLabel,
    type: 'approval' as const,
    status: 'pending' as const,
    priority: riskTier === 'red' ? 'high' as const : riskTier === 'yellow' ? 'medium' as const : 'low' as const,
    timestamp: (row.created_at as string) || new Date().toISOString(),
    actions: ['review', 'approve', 'deny'] as const,
    riskTier: riskTier as 'green' | 'yellow' | 'red',
    assignedAgent: (row.assigned_agent as string) || '',
    staffRole: (row.assigned_agent as string) || '',
    draftSummary: (row.draft_summary as string) || undefined,
    pandadocDocumentId: (row.pandadoc_document_id as string) || undefined,
  };
}

/** Map API response item to AuthorityItem */
function apiRowToAuthorityItem(r: Record<string, unknown>): AuthorityItem {
  const risk = (r.risk as string) || 'yellow';
  return {
    id: (r.id as string) ?? '',
    title: (r.draftSummary as string) || (r.title as string) || (r.type as string) || 'Approval Request',
    subtitle: (r.assignedAgent as string) ? `Agent: ${r.assignedAgent}` : ((r.type as string) || ''),
    type: 'approval' as const,
    status: 'pending' as const,
    priority: risk === 'red' ? 'high' as const : risk === 'yellow' ? 'medium' as const : 'low' as const,
    timestamp: (r.createdAt as string) ?? new Date().toISOString(),
    actions: ['review', 'approve', 'deny'] as const,
    riskTier: risk as 'green' | 'yellow' | 'red',
    assignedAgent: (r.assignedAgent as string) || '',
    staffRole: (r.assignedAgent as string) || '',
    draftSummary: (r.draftSummary as string) || undefined,
    pandadocDocumentId: (r.pandadocDocumentId as string) || undefined,
  };
}

export function useRealtimeApprovalRequests(): void {
  const { session, suiteId } = useSupabase();
  const realtimeConnected = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_RETRIES = 3;
  const RETRY_BASE_MS = 3000;

  useEffect(() => {
    if (!session?.user?.id) return;
    // Law #6: Tenant isolation — require suiteId before subscribing
    if (!suiteId) return;

    const userId = session.user.id;
    const accessToken = session.access_token;
    let disposed = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    console.log(`${LOG_PREFIX} Initializing for user ${userId.slice(0, 8)}...`);

    // ── 1. Supabase Realtime subscription (primary — instant) ──────────

    const createSubscription = () => {
      if (disposed) return;

      // Filter by tenant_id (RLS also enforces this)
      const filter = `tenant_id=eq.${suiteId}`;
      const channelName = `approval-requests-${userId.slice(0, 8)}-${Date.now()}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'approval_requests',
            filter,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            console.log(`${LOG_PREFIX} Realtime INSERT:`, { id: row.approval_id || row.id, risk_tier: row.risk_tier, status: row.status });
            if (row.status === 'pending') {
              addAuthorityItem(rowToAuthorityItem(row));
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'approval_requests',
            filter,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            console.log(`${LOG_PREFIX} Realtime UPDATE:`, { id: row.approval_id || row.id, status: row.status });
            const id = (row.approval_id as string) || (row.id as string);
            if (id && row.status !== 'pending') {
              removeAuthorityItem(id);
            }
          },
        )
        .subscribe((status, err) => {
          console.log(`${LOG_PREFIX} Subscription status: ${status}`, err || '');
          if (status === 'SUBSCRIBED') {
            realtimeConnected.current = true;
            retryCountRef.current = 0;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeConnected.current = false;
            if (retryCountRef.current < MAX_RETRIES) {
              const delay = RETRY_BASE_MS * Math.pow(2, retryCountRef.current);
              retryCountRef.current++;
              console.warn(`${LOG_PREFIX} Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms...`);
              retryTimerRef.current = setTimeout(() => {
                supabase.removeChannel(channel);
                createSubscription();
              }, delay);
            } else {
              console.error(`${LOG_PREFIX} Max retries (${MAX_RETRIES}) reached. Falling back to polling only.`);
            }
          }
        });

      channels.push(channel);
    };

    createSubscription();

    // ── 2. Polling fallback (secondary — catches missed events) ────────
    // Runs every 30s. If Realtime is working, polling typically finds nothing new.
    // If Realtime is down, polling is the safety net.

    const hydrateFromApi = async () => {
      try {
        const rows = await getAuthorityQueue(accessToken, suiteId ?? undefined);
        if (disposed) return;

        const items: AuthorityItem[] = rows.map((r: Record<string, unknown>) => apiRowToAuthorityItem(r));
        setAuthorityItems(items);
      } catch (err) {
        console.warn(`${LOG_PREFIX} Poll error:`, err);
      }
    };

    // Initial hydration + periodic polling
    hydrateFromApi();
    const pollTimer = setInterval(hydrateFromApi, POLL_INTERVAL_MS);

    // ── Cleanup ────────────────────────────────────────────────────────

    return () => {
      console.log(`${LOG_PREFIX} Cleaning up subscriptions`);
      disposed = true;
      realtimeConnected.current = false;
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [session?.user?.id, session?.access_token, suiteId]);
}
